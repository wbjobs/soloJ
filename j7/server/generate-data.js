import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '..', 'data', 'orderbook_events.csv');

const NUM_EVENTS = 1_000_000;
const BASE_PRICE = 100.0;
const TICK_SIZE = 0.01;
const START_TIMESTAMP = 1717209600000;

function generateOrderbookEvents() {
    console.log(`Generating ${NUM_EVENTS.toLocaleString()} orderbook events...`);
    
    const writeStream = fs.createWriteStream(DATA_PATH);
    writeStream.write('timestamp,side,price,quantity\n');
    
    let currentTimestamp = START_TIMESTAMP;
    let midPrice = BASE_PRICE;
    
    const priceHistory = [BASE_PRICE];
    
    for (let i = 0; i < NUM_EVENTS; i++) {
        const timeIncrement = Math.floor(Math.random() * 50) + 1;
        currentTimestamp += timeIncrement;
        
        const side = Math.random() < 0.5 ? 'bid' : 'ask';
        
        const volatility = 0.002;
        const drift = Math.sin(i / 10000) * 0.0001;
        const priceChange = (Math.random() - 0.5 + drift) * volatility * midPrice;
        midPrice = Math.max(1, midPrice + priceChange);
        priceHistory.push(midPrice);
        if (priceHistory.length > 100) priceHistory.shift();
        
        const avgPrice = priceHistory.reduce((a, b) => a + b, 0) / priceHistory.length;
        const stdDev = Math.sqrt(
            priceHistory.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / priceHistory.length
        );
        
        let priceOffset;
        if (side === 'bid') {
            priceOffset = -Math.abs((Math.random() * 3 + 0.5) * TICK_SIZE + (Math.random() * stdDev * 0.3));
        } else {
            priceOffset = Math.abs((Math.random() * 3 + 0.5) * TICK_SIZE + (Math.random() * stdDev * 0.3));
        }
        
        const price = Math.round((midPrice + priceOffset) / TICK_SIZE) * TICK_SIZE;
        
        const quantityRandom = Math.random();
        let quantity;
        if (quantityRandom < 0.7) {
            quantity = Math.floor(Math.random() * 20) + 1;
        } else if (quantityRandom < 0.95) {
            quantity = Math.floor(Math.random() * 100) + 20;
        } else {
            quantity = Math.floor(Math.random() * 500) + 100;
        }
        
        if (i < 20) {
            const seedSide = i % 2 === 0 ? 'bid' : 'ask';
            const seedPrice = Math.round((BASE_PRICE + (i % 10 - 5) * TICK_SIZE) / TICK_SIZE) * TICK_SIZE;
            writeStream.write(`${currentTimestamp},${seedSide},${seedPrice.toFixed(2)},${quantity}\n`);
        } else {
            writeStream.write(`${currentTimestamp},${side},${price.toFixed(2)},${quantity}\n`);
        }
        
        if ((i + 1) % 100000 === 0) {
            console.log(`Generated ${(i + 1).toLocaleString()} events...`);
        }
    }
    
    return new Promise((resolve, reject) => {
        writeStream.end();
        writeStream.on('finish', () => {
            const stats = fs.statSync(DATA_PATH);
            console.log(`\nDone! File created at: ${DATA_PATH}`);
            console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            console.log(`Time range: ${START_TIMESTAMP} -> ${currentTimestamp}`);
            console.log(`Duration: ${((currentTimestamp - START_TIMESTAMP) / 1000 / 60).toFixed(2)} minutes`);
            resolve();
        });
        writeStream.on('error', reject);
    });
}

generateOrderbookEvents().catch(console.error);
