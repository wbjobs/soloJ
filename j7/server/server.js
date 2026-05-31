import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import csv from 'csv-parser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '..', 'data', 'orderbook_events.csv');
const PUBLIC_PATH = path.join(__dirname, '..', 'public');

const PORT = process.env.PORT || 8080;
const DEPTH_LEVELS = 20;
const TARGET_FPS = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

let events = [];
let startTime = 0;
let endTime = 0;

async function loadEvents() {
    console.log('Loading orderbook events from CSV...');
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(DATA_PATH)
            .pipe(csv())
            .on('data', (row) => {
                results.push({
                    timestamp: parseInt(row.timestamp),
                    side: row.side,
                    price: parseFloat(row.price),
                    quantity: parseInt(row.quantity)
                });
            })
            .on('end', () => {
                console.log(`Loaded ${results.length.toLocaleString()} events`);
                startTime = results[0].timestamp;
                endTime = results[results.length - 1].timestamp;
                console.log(`Time range: ${new Date(startTime).toISOString()} -> ${new Date(endTime).toISOString()}`);
                console.log(`Duration: ${((endTime - startTime) / 1000 / 60).toFixed(2)} minutes`);
                events = results;
                resolve();
            })
            .on('error', reject);
    });
}

class Orderbook {
    constructor() {
        this.bids = new Map();
        this.asks = new Map();
    }

    update(event) {
        const book = event.side === 'bid' ? this.bids : this.asks;
        const currentQty = book.get(event.price) || 0;
        const newQty = Math.max(0, currentQty + event.quantity);
        
        if (newQty === 0) {
            book.delete(event.price);
        } else {
            book.set(event.price, newQty);
        }
    }

    getBestBid() {
        let best = 0;
        for (const price of this.bids.keys()) {
            if (price > best) best = price;
        }
        return best;
    }

    getBestAsk() {
        let best = Infinity;
        for (const price of this.asks.keys()) {
            if (price < best) best = price;
        }
        return best === Infinity ? 0 : best;
    }

    getBidLevels(levels = DEPTH_LEVELS) {
        const prices = Array.from(this.bids.keys()).sort((a, b) => b - a).slice(0, levels);
        return prices.map(p => [p, this.bids.get(p)]);
    }

    getAskLevels(levels = DEPTH_LEVELS) {
        const prices = Array.from(this.asks.keys()).sort((a, b) => a - b).slice(0, levels);
        return prices.map(p => [p, this.asks.get(p)]);
    }

    rebuildFromEvents(eventsArray, count) {
        this.bids.clear();
        this.asks.clear();
        for (let i = 0; i < count; i++) {
            this.update(eventsArray[i]);
        }
    }
}

class ReplayEngine {
    constructor() {
        this.orderbook = new Orderbook();
        this.currentIndex = 0;
        this.isPlaying = false;
        this.playbackSpeed = 1;
        this.lastEventTime = 0;
        this.lastWallClockTime = 0;
        this.lastSendTime = 0;
        this.clients = new Set();
        this.timeoutId = null;
        this.pendingSnapshot = null;
        this.pendingStatus = null;
    }

    addClient(ws) {
        this.clients.add(ws);
        this.sendStatus(ws);
        this.sendSnapshot(ws);
    }

    removeClient(ws) {
        this.clients.delete(ws);
    }

    broadcast(message) {
        const data = JSON.stringify(message);
        for (const client of this.clients) {
            if (client.readyState === 1) {
                client.send(data);
            }
        }
    }

    sendStatus(ws) {
        ws.send(JSON.stringify({
            type: 'replay_status',
            currentTime: events[this.currentIndex]?.timestamp || startTime,
            startTime,
            endTime,
            totalEvents: events.length,
            processedEvents: this.currentIndex,
            isPlaying: this.isPlaying,
            speed: this.playbackSpeed
        }));
    }

    sendSnapshot(ws) {
        const bids = this.orderbook.getBidLevels();
        const asks = this.orderbook.getAskLevels();
        const bestBid = this.orderbook.getBestBid();
        const bestAsk = this.orderbook.getBestAsk();
        const spread = bestAsk - bestBid;
        const imbalance = this.calculateImbalance(bids, asks);

        ws.send(JSON.stringify({
            type: 'orderbook_update',
            timestamp: events[this.currentIndex]?.timestamp || startTime,
            bids,
            asks,
            bestBid,
            bestAsk,
            spread,
            imbalance,
            processedEvents: this.currentIndex,
            totalEvents: events.length,
            isPlaying: this.isPlaying,
            speed: this.playbackSpeed,
            startTime,
            endTime
        }));
    }

    calculateImbalance(bids, asks) {
        const bidVol = bids.reduce((sum, [, qty]) => sum + qty, 0);
        const askVol = asks.reduce((sum, [, qty]) => sum + qty, 0);
        const total = bidVol + askVol;
        return total === 0 ? 0 : (bidVol - askVol) / total;
    }

    seek(targetTimestamp) {
        let left = 0;
        let right = events.length - 1;
        let targetIndex = 0;

        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            if (events[mid].timestamp <= targetTimestamp) {
                targetIndex = mid;
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }

        this.currentIndex = targetIndex;
        this.orderbook.rebuildFromEvents(events, targetIndex + 1);
        
        this.broadcast({
            type: 'replay_status',
            currentTime: events[this.currentIndex].timestamp,
            startTime,
            endTime,
            totalEvents: events.length,
            processedEvents: this.currentIndex,
            isPlaying: this.isPlaying,
            speed: this.playbackSpeed
        });

        for (const client of this.clients) {
            this.sendSnapshot(client);
        }
    }

    play() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        
        if (this.currentIndex >= events.length - 1) {
            this.currentIndex = 0;
            this.orderbook = new Orderbook();
        }

        this.lastEventTime = events[this.currentIndex].timestamp;
        this.lastWallClockTime = Date.now();

        this.broadcast({
            type: 'replay_status',
            currentTime: events[this.currentIndex].timestamp,
            startTime,
            endTime,
            totalEvents: events.length,
            processedEvents: this.currentIndex,
            isPlaying: true,
            speed: this.playbackSpeed
        });

        this.scheduleNextEvent();
    }

    pause() {
        this.isPlaying = false;
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        
        this.broadcast({
            type: 'replay_status',
            currentTime: events[this.currentIndex].timestamp,
            startTime,
            endTime,
            totalEvents: events.length,
            processedEvents: this.currentIndex,
            isPlaying: false,
            speed: this.playbackSpeed
        });
    }

    setSpeed(speed) {
        this.playbackSpeed = speed;
        this.lastWallClockTime = Date.now();
        this.lastEventTime = events[this.currentIndex].timestamp;
        
        this.broadcast({
            type: 'replay_status',
            currentTime: events[this.currentIndex].timestamp,
            startTime,
            endTime,
            totalEvents: events.length,
            processedEvents: this.currentIndex,
            isPlaying: this.isPlaying,
            speed: this.playbackSpeed
        });
    }

    scheduleNextEvent() {
        if (!this.isPlaying || this.currentIndex >= events.length - 1) {
            if (this.currentIndex >= events.length - 1) {
                this.pause();
            }
            return;
        }

        const processBatch = () => {
            if (!this.isPlaying) return;

            const now = Date.now();
            const wallElapsed = (now - this.lastWallClockTime) * this.playbackSpeed;
            const targetEventTime = this.lastEventTime + wallElapsed;

            let eventsProcessed = 0;
            const maxBatchSize = 5000;

            while (
                this.currentIndex < events.length - 1 &&
                events[this.currentIndex + 1].timestamp <= targetEventTime &&
                eventsProcessed < maxBatchSize
            ) {
                this.currentIndex++;
                this.orderbook.update(events[this.currentIndex]);
                eventsProcessed++;
            }

            if (eventsProcessed > 0) {
                const timeSinceLastSend = now - this.lastSendTime;
                if (timeSinceLastSend >= FRAME_INTERVAL) {
                    const bids = this.orderbook.getBidLevels();
                    const asks = this.orderbook.getAskLevels();
                    const bestBid = this.orderbook.getBestBid();
                    const bestAsk = this.orderbook.getBestAsk();
                    const spread = bestAsk - bestBid;
                    const imbalance = this.calculateImbalance(bids, asks);

                    this.broadcast({
                        type: 'orderbook_update',
                        timestamp: events[this.currentIndex].timestamp,
                        bids,
                        asks,
                        bestBid,
                        bestAsk,
                        spread,
                        imbalance,
                        processedEvents: this.currentIndex,
                        totalEvents: events.length,
                        isPlaying: this.isPlaying,
                        speed: this.playbackSpeed,
                        startTime,
                        endTime
                    });

                    this.lastSendTime = now;
                }

                this.lastEventTime = events[this.currentIndex].timestamp;
                this.lastWallClockTime = now;
            }

            if (this.currentIndex < events.length - 1 && this.isPlaying) {
                this.timeoutId = setTimeout(processBatch, 4);
            } else if (this.currentIndex >= events.length - 1) {
                this.pause();
            }
        };

        this.timeoutId = setTimeout(processBatch, 4);
    }
}

const server = http.createServer((req, res) => {
    let filePath = path.join(PUBLIC_PATH, req.url === '/' ? 'index.html' : req.url);
    
    const extname = path.extname(filePath);
    let contentType = 'text/html';
    switch (extname) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
        case '.json':
            contentType = 'application/json';
            break;
    }

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end('Not Found');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

const wss = new WebSocketServer({ server });
let replayEngine = null;

wss.on('connection', (ws) => {
    console.log('Client connected');
    
    if (replayEngine) {
        replayEngine.addClient(ws);
    }

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            if (!replayEngine) return;

            switch (message.action) {
                case 'play':
                    replayEngine.play();
                    break;
                case 'pause':
                    replayEngine.pause();
                    break;
                case 'seek':
                    if (typeof message.timestamp === 'number') {
                        replayEngine.seek(message.timestamp);
                    }
                    break;
                case 'speed':
                    if (typeof message.speed === 'number') {
                        replayEngine.setSpeed(message.speed);
                    }
                    break;
            }
        } catch (e) {
            console.error('Error parsing message:', e);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        if (replayEngine) {
            replayEngine.removeClient(ws);
        }
    });
});

async function start() {
    await loadEvents();
    replayEngine = new ReplayEngine();
    
    server.listen(PORT, () => {
        console.log(`\nServer running on http://localhost:${PORT}`);
        console.log(`WebSocket server ready on ws://localhost:${PORT}`);
    });
}

start().catch(console.error);
