class OrderbookApp {
    constructor() {
        this.ws = null;
        this.orderbook = new Orderbook();
        this.renderer = new DepthChartRenderer(document.getElementById('depthChart'));
        this.metrics = new MetricsManager();
        this.predictor = new VolatilityPredictor(100, 10);
        this.volatilityChart = new VolatilityChart('volatilityChart');
        
        this.isPlaying = false;
        this.playbackSpeed = 1;
        this.startTime = 0;
        this.endTime = 0;
        this.isSeeking = false;
        
        this._messageQueue = [];
        this._isProcessing = false;
        this._maxQueueSize = 5;
        this._lastProcessTime = 0;
        this._minProcessInterval = 33;
        
        this.predictor.onUpdate = (prediction) => {
            this.metrics.updateVolatilityPrediction(prediction);
            this.volatilityChart.update(prediction);
        };
        
        this.bindEvents();
        this.connect();
        this.renderer.start();
        
        setInterval(() => this.metrics.updateSystemTime(), 1000);
    }

    bindEvents() {
        document.getElementById('playBtn').addEventListener('click', () => {
            if (this.isPlaying) {
                this.sendControl('pause');
            } else {
                this.sendControl('play');
            }
        });

        document.getElementById('resetBtn').addEventListener('click', () => {
            this.sendControl('seek', this.startTime);
            this.predictor.reset();
            this.volatilityChart.clear();
        });

        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const speed = parseFloat(btn.dataset.speed);
                this.playbackSpeed = speed;
                this.metrics.setPlaybackSpeed(speed);
                this.sendControl('speed', null, speed);
            });
        });

        const slider = document.getElementById('timeSlider');
        let sliderTimeout;

        slider.addEventListener('input', (e) => {
            this.isSeeking = true;
            const value = parseFloat(e.target.value);
            const timestamp = this.startTime + (value / 1000) * (this.endTime - this.startTime);
            this.metrics.updateSliderTooltip(timestamp);
            
            const rect = slider.getBoundingClientRect();
            const percentage = value / 1000;
            const tooltip = document.getElementById('sliderTooltip');
            tooltip.style.left = (rect.left + percentage * rect.width) + 'px';
            tooltip.style.opacity = '1';
        });

        slider.addEventListener('change', (e) => {
            const value = parseFloat(e.target.value);
            const timestamp = this.startTime + (value / 1000) * (this.endTime - this.startTime);
            
            clearTimeout(sliderTimeout);
            sliderTimeout = setTimeout(() => {
                this.sendControl('seek', timestamp);
                this.isSeeking = false;
                this.predictor.reset();
                this.volatilityChart.clear();
                document.getElementById('sliderTooltip').style.opacity = '0';
            }, 100);
        });

        slider.addEventListener('mouseleave', () => {
            if (!this.isSeeking) {
                document.getElementById('sliderTooltip').style.opacity = '0';
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                if (this.isPlaying) {
                    this.sendControl('pause');
                } else {
                    this.sendControl('play');
                }
            } else if (e.code === 'ArrowLeft') {
                const currentValue = parseFloat(slider.value);
                const newValue = Math.max(0, currentValue - 10);
                const timestamp = this.startTime + (newValue / 1000) * (this.endTime - this.startTime);
                this.sendControl('seek', timestamp);
                this.predictor.reset();
                this.volatilityChart.clear();
            } else if (e.code === 'ArrowRight') {
                const currentValue = parseFloat(slider.value);
                const newValue = Math.min(1000, currentValue + 10);
                const timestamp = this.startTime + (newValue / 1000) * (this.endTime - this.startTime);
                this.sendControl('seek', timestamp);
                this.predictor.reset();
                this.volatilityChart.clear();
            }
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            this.openExportModal();
        });

        document.getElementById('closeExportModal').addEventListener('click', () => {
            this.closeExportModal();
        });

        document.getElementById('downloadDepthBtn').addEventListener('click', () => {
            this.downloadDepthImage();
        });

        document.getElementById('downloadVolatilityBtn').addEventListener('click', () => {
            this.downloadVolatilityImage();
        });

        document.getElementById('downloadAllBtn').addEventListener('click', () => {
            this.downloadAllImages();
        });

        document.getElementById('exportModal').addEventListener('click', (e) => {
            if (e.target.id === 'exportModal') {
                this.closeExportModal();
            }
        });
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.metrics.updateConnectionStatus(true);
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this._queueMessage(data);
            } catch (e) {
                console.error('Error parsing message:', e);
            }
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.metrics.updateConnectionStatus(false);
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.metrics.updateConnectionStatus(false);
            
            setTimeout(() => {
                console.log('Reconnecting...');
                this.connect();
            }, 3000);
        };
    }

    _queueMessage(data) {
        if (this._messageQueue.length >= this._maxQueueSize) {
            this._messageQueue.shift();
        }
        this._messageQueue.push(data);
        this._processQueue();
    }

    _processQueue() {
        if (this._isProcessing) return;
        
        const now = performance.now();
        const timeSinceLastProcess = now - this._lastProcessTime;
        
        if (timeSinceLastProcess < this._minProcessInterval) {
            setTimeout(() => this._processQueue(), this._minProcessInterval - timeSinceLastProcess);
            return;
        }
        
        this._isProcessing = true;
        
        try {
            while (this._messageQueue.length > 0) {
                const data = this._messageQueue.shift();
                this.handleMessage(data);
            }
        } finally {
            this._lastProcessTime = performance.now();
            this._isProcessing = false;
        }
    }

    handleMessage(data) {
        switch (data.type) {
            case 'orderbook_update':
                this.handleOrderbookUpdate(data);
                break;
            case 'orderbook_snapshot':
                this.handleSnapshot(data);
                break;
            case 'replay_status':
                this.handleStatus(data);
                break;
        }
    }

    handleOrderbookUpdate(data) {
        this.orderbook.updateFromSnapshot(data);
        this.renderer.setOrderbook(this.orderbook);
        this.metrics.update(data, data);
        
        if (data.startTime !== undefined) this.startTime = data.startTime;
        if (data.endTime !== undefined) this.endTime = data.endTime;
        
        this.isPlaying = data.isPlaying;
        this.metrics.updatePlayButton(data.isPlaying);
        
        if (data.speed !== undefined) {
            this.playbackSpeed = data.speed;
            this.metrics.setPlaybackSpeed(data.speed);
        }
        
        const midPrice = this.orderbook.getMidPrice();
        if (midPrice > 0 && data.bestBid > 0 && data.bestAsk > 0) {
            this.predictor.addDataPoint({
                timestamp: data.timestamp,
                spread: data.spread,
                imbalance: data.imbalance,
                midPrice: midPrice,
                bestBid: data.bestBid,
                bestAsk: data.bestAsk
            });
        }
    }

    handleSnapshot(snapshot) {
        this.orderbook.updateFromSnapshot(snapshot);
        this.renderer.setOrderbook(this.orderbook);
        this.metrics.update(snapshot);
    }

    handleStatus(status) {
        if (status.startTime) this.startTime = status.startTime;
        if (status.endTime) this.endTime = status.endTime;
        
        this.isPlaying = status.isPlaying;
        this.metrics.updatePlayButton(status.isPlaying);
        
        if (status.speed) {
            this.playbackSpeed = status.speed;
            this.metrics.setPlaybackSpeed(status.speed);
        }
        
        this.metrics.update({}, status);
    }

    sendControl(action, timestamp = null, speed = null) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        const message = { action };
        if (timestamp !== null) message.timestamp = timestamp;
        if (speed !== null) message.speed = speed;
        
        this.ws.send(JSON.stringify(message));
    }

    openExportModal() {
        const modal = document.getElementById('exportModal');
        modal.classList.remove('hidden');
        
        this.updateExportPreviews();
    }

    closeExportModal() {
        const modal = document.getElementById('exportModal');
        modal.classList.add('hidden');
    }

    updateExportPreviews() {
        const depthCanvas = document.getElementById('depthChart');
        const previewCanvas = document.getElementById('depthPreviewCanvas');
        
        previewCanvas.width = depthCanvas.width;
        previewCanvas.height = depthCanvas.height;
        
        const previewCtx = previewCanvas.getContext('2d');
        previewCtx.drawImage(depthCanvas, 0, 0);
        
        const volatilityImg = document.getElementById('volatilityPreviewImg');
        const imgData = this.volatilityChart.exportToImage();
        if (imgData) {
            volatilityImg.src = imgData;
        }
    }

    downloadDepthImage() {
        const canvas = document.getElementById('depthChart');
        const dataUrl = canvas.toDataURL('image/png');
        this.downloadDataURL(dataUrl, 'orderbook-depth.png');
    }

    downloadVolatilityImage() {
        const imgData = this.volatilityChart.exportToImage();
        if (imgData) {
            this.downloadDataURL(imgData, 'volatility-prediction.png');
        }
    }

    downloadAllImages() {
        this.downloadDepthImage();
        setTimeout(() => this.downloadVolatilityImage(), 200);
    }

    downloadDataURL(dataUrl, filename) {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new OrderbookApp();
});
