class DepthChartRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.orderbook = null;
        this.animationId = null;
        this.needsRender = false;
        
        this.margin = { top: 40, right: 60, bottom: 60, left: 80 };
        this.gridColor = 'rgba(48, 54, 61, 0.5)';
        this.axisColor = '#6e7681';
        this.bidColor = '#00d26a';
        this.askColor = '#ff4757';
        
        this._bgGradient = null;
        this._bidGradient = null;
        this._askGradient = null;
        this._cachedScales = null;
        this._lastWidth = 0;
        this._lastHeight = 0;
        
        this._priceFormatter = (p) => p.toFixed(2);
        this._volumeFormatter = this.formatVolume.bind(this);
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    setOrderbook(orderbook) {
        this.orderbook = orderbook;
        this.needsRender = true;
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        this.ctx.scale(dpr, dpr);
        
        this.width = rect.width;
        this.height = rect.height;
        
        this.chartWidth = this.width - this.margin.left - this.margin.right;
        this.chartHeight = this.height - this.margin.top - this.margin.bottom;
        
        this._bgGradient = null;
        this._bidGradient = null;
        this._askGradient = null;
        this._cachedScales = null;
        this._lastWidth = this.width;
        this._lastHeight = this.height;
        
        this.needsRender = true;
    }

    _getBgGradient() {
        if (!this._bgGradient) {
            this._bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
            this._bgGradient.addColorStop(0, '#0d1117');
            this._bgGradient.addColorStop(1, '#161b22');
        }
        return this._bgGradient;
    }

    _getAreaGradient(color) {
        if (color === this.bidColor) {
            if (!this._bidGradient) {
                this._bidGradient = this.ctx.createLinearGradient(0, this.margin.top, 0, this.height - this.margin.bottom);
                this._bidGradient.addColorStop(0, this.bidColor + '80');
                this._bidGradient.addColorStop(1, this.bidColor + '10');
            }
            return this._bidGradient;
        } else {
            if (!this._askGradient) {
                this._askGradient = this.ctx.createLinearGradient(0, this.margin.top, 0, this.height - this.margin.bottom);
                this._askGradient.addColorStop(0, this.askColor + '80');
                this._askGradient.addColorStop(1, this.askColor + '10');
            }
            return this._askGradient;
        }
    }

    start() {
        const renderLoop = () => {
            if (this.needsRender) {
                this.render();
                this.needsRender = false;
            }
            this.animationId = requestAnimationFrame(renderLoop);
        };
        this.animationId = requestAnimationFrame(renderLoop);
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        this.drawBackground();
        this.drawGrid();
        
        if (this.orderbook) {
            const bidData = this.orderbook.getCumulativeBids();
            const askData = this.orderbook.getCumulativeAsks();
            
            const { xScale, yScale, maxVolume } = this.calculateScales(bidData, askData);
            
            this.drawArea(askData, xScale, yScale, this.askColor, false);
            this.drawArea(bidData, xScale, yScale, this.bidColor, true);
            
            this.drawLine(askData, xScale, yScale, this.askColor);
            this.drawLine(bidData, xScale, yScale, this.bidColor);
            
            this.drawPriceLevels(xScale, yScale, bidData, askData);
            this.drawAxes(xScale, yScale, maxVolume);
            this.drawBestPrices(xScale, yScale);
        }
    }

    drawBackground() {
        this.ctx.fillStyle = this._getBgGradient();
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    drawGrid() {
        this.ctx.strokeStyle = this.gridColor;
        this.ctx.lineWidth = 1;
        
        const xSteps = 10;
        const ySteps = 8;
        
        for (let i = 0; i <= xSteps; i++) {
            const x = this.margin.left + (i / xSteps) * this.chartWidth;
            this.ctx.beginPath();
            this.ctx.moveTo(x, this.margin.top);
            this.ctx.lineTo(x, this.height - this.margin.bottom);
            this.ctx.stroke();
        }
        
        for (let i = 0; i <= ySteps; i++) {
            const y = this.margin.top + (i / ySteps) * this.chartHeight;
            this.ctx.beginPath();
            this.ctx.moveTo(this.margin.left, y);
            this.ctx.lineTo(this.width - this.margin.right, y);
            this.ctx.stroke();
        }
    }

    calculateScales(bidData, askData) {
        let minPrice = Infinity;
        let maxPrice = -Infinity;
        let maxVolume = 0;
        
        const bidLen = bidData.length;
        const askLen = askData.length;
        
        for (let i = 0; i < bidLen; i++) {
            const price = bidData[i][0];
            const volume = bidData[i][1];
            if (price < minPrice) minPrice = price;
            if (price > maxPrice) maxPrice = price;
            if (volume > maxVolume) maxVolume = volume;
        }
        
        for (let i = 0; i < askLen; i++) {
            const price = askData[i][0];
            const volume = askData[i][1];
            if (price < minPrice) minPrice = price;
            if (price > maxPrice) maxPrice = price;
            if (volume > maxVolume) maxVolume = volume;
        }
        
        if (maxVolume === 0) maxVolume = 1;
        
        const priceRange = maxPrice - minPrice;
        const pricePadding = priceRange * 0.1;
        minPrice -= pricePadding;
        maxPrice += pricePadding;
        
        const priceDenom = maxPrice - minPrice;
        const chartW = this.chartWidth;
        const chartH = this.chartHeight;
        const marginL = this.margin.left;
        const marginB = this.height - this.margin.bottom;
        
        const xScale = (price) => {
            return marginL + ((price - minPrice) / priceDenom) * chartW;
        };
        
        const yScale = (volume) => {
            return marginB - (volume / maxVolume) * chartH;
        };
        
        return { xScale, yScale, maxVolume, minPrice, maxPrice };
    }

    drawArea(data, xScale, yScale, color, isBid) {
        if (data.length < 2) return;
        
        this.ctx.beginPath();
        
        if (isBid) {
            this.ctx.moveTo(xScale(data[0][0]), this.height - this.margin.bottom);
        } else {
            this.ctx.moveTo(xScale(data[0][0]), this.height - this.margin.bottom);
        }
        
        for (let i = 0; i < data.length; i++) {
            const [price, volume] = data[i];
            this.ctx.lineTo(xScale(price), yScale(volume));
        }
        
        if (isBid) {
            this.ctx.lineTo(xScale(data[data.length - 1][0]), this.height - this.margin.bottom);
        } else {
            this.ctx.lineTo(xScale(data[data.length - 1][0]), this.height - this.margin.bottom);
        }
        
        this.ctx.closePath();
        
        this.ctx.fillStyle = this._getAreaGradient(color);
        this.ctx.fill();
    }

    drawLine(data, xScale, yScale, color) {
        if (data.length < 2) return;
        
        this.ctx.beginPath();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2.5;
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = 10;
        
        for (let i = 0; i < data.length; i++) {
            const [price, volume] = data[i];
            const x = xScale(price);
            const y = yScale(volume);
            
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
    }

    drawPriceLevels(xScale, yScale, bidData, askData) {
        this.ctx.font = '11px "JetBrains Mono", monospace';
        this.ctx.textAlign = 'right';
        this.ctx.fillStyle = this.axisColor;
        
        for (let i = 0; i < Math.min(5, bidData.length); i++) {
            const [price, volume] = bidData[i];
            const y = yScale(volume);
            
            this.ctx.fillStyle = this.bidColor + '80';
            this.ctx.fillText(price.toFixed(2), this.margin.left - 10, y + 4);
        }
        
        for (let i = 0; i < Math.min(5, askData.length); i++) {
            const [price, volume] = askData[i];
            const y = yScale(volume);
            
            this.ctx.fillStyle = this.askColor + '80';
            this.ctx.fillText(price.toFixed(2), this.margin.left - 10, y + 4);
        }
    }

    drawAxes(xScale, yScale, maxVolume) {
        this.ctx.strokeStyle = this.axisColor;
        this.ctx.lineWidth = 1;
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.margin.left, this.margin.top);
        this.ctx.lineTo(this.margin.left, this.height - this.margin.bottom);
        this.ctx.lineTo(this.width - this.margin.right, this.height - this.margin.bottom);
        this.ctx.stroke();
        
        this.ctx.font = '11px "JetBrains Mono", monospace';
        this.ctx.fillStyle = this.axisColor;
        this.ctx.textAlign = 'right';
        
        const volumeSteps = 5;
        for (let i = 0; i <= volumeSteps; i++) {
            const volume = (i / volumeSteps) * maxVolume;
            const y = yScale(volume);
            this.ctx.fillText(this.formatVolume(volume), this.margin.left - 10, y + 4);
        }
        
        this.ctx.save();
        this.ctx.translate(20, this.height / 2);
        this.ctx.rotate(-Math.PI / 2);
        this.ctx.textAlign = 'center';
        this.ctx.fillText('累计量', 0, 0);
        this.ctx.restore();
        
        this.ctx.textAlign = 'center';
        this.ctx.fillText('价格', this.width / 2, this.height - 20);
    }

    drawBestPrices(xScale, yScale) {
        if (!this.orderbook) return;
        
        const { bestBid, bestAsk } = this.orderbook;
        const midY = this.margin.top + this.chartHeight / 2;
        
        if (bestBid > 0) {
            const x = xScale(bestBid);
            this.ctx.strokeStyle = this.bidColor;
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.moveTo(x, this.margin.top);
            this.ctx.lineTo(x, this.height - this.margin.bottom);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
            
            this.ctx.fillStyle = this.bidColor;
            this.ctx.font = 'bold 12px "JetBrains Mono", monospace';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`买一 ${bestBid.toFixed(2)}`, x + 5, midY - 10);
        }
        
        if (bestAsk > 0) {
            const x = xScale(bestAsk);
            this.ctx.strokeStyle = this.askColor;
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.moveTo(x, this.margin.top);
            this.ctx.lineTo(x, this.height - this.margin.bottom);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
            
            this.ctx.fillStyle = this.askColor;
            this.ctx.font = 'bold 12px "JetBrains Mono", monospace';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`卖一 ${bestAsk.toFixed(2)}`, x + 5, midY + 20);
        }
    }

    formatVolume(volume) {
        if (volume >= 1000000) {
            return (volume / 1000000).toFixed(1) + 'M';
        } else if (volume >= 1000) {
            return (volume / 1000).toFixed(1) + 'K';
        }
        return volume.toFixed(0);
    }
}
