class VolatilityPredictor {
    constructor(windowSize = 100, predictSeconds = 10) {
        this.windowSize = windowSize;
        this.predictSeconds = predictSeconds;
        
        this.history = [];
        this.maxHistory = 500;
        
        this.actualVolatility = null;
        this.predictedVolatility = null;
        this.confidence = 0;
        
        this.onUpdate = null;
    }

    addDataPoint(data) {
        const { timestamp, spread, imbalance, midPrice, bestBid, bestAsk } = data;
        
        if (midPrice <= 0 || bestBid <= 0 || bestAsk <= 0) return;
        
        this.history.push({
            timestamp,
            spread,
            imbalance,
            midPrice,
            bestBid,
            bestAsk
        });
        
        while (this.history.length > this.maxHistory) {
            this.history.shift();
        }
        
        if (this.history.length >= this.windowSize) {
            this.computeVolatility();
            this.predictVolatility();
            
            if (this.onUpdate) {
                this.onUpdate({
                    actualVolatility: this.actualVolatility,
                    predictedVolatility: this.predictedVolatility,
                    confidence: this.confidence,
                    timestamp: this.history[this.history.length - 1].timestamp
                });
            }
        }
    }

    computeVolatility() {
        const recentData = this.history.slice(-this.windowSize);
        const prices = recentData.map(d => d.midPrice);
        
        let minPrice = Infinity;
        let maxPrice = -Infinity;
        
        for (let i = 0; i < prices.length; i++) {
            if (prices[i] < minPrice) minPrice = prices[i];
            if (prices[i] > maxPrice) maxPrice = prices[i];
        }
        
        const currentMidPrice = recentData[recentData.length - 1].midPrice;
        this.actualVolatility = (maxPrice - minPrice) / currentMidPrice;
    }

    predictVolatility() {
        if (this.history.length < this.windowSize) return;
        
        const recentData = this.history.slice(-this.windowSize);
        const n = recentData.length;
        
        const spreads = recentData.map(d => d.spread);
        const imbalances = recentData.map(d => d.imbalance);
        const prices = recentData.map(d => d.midPrice);
        
        const avgSpread = this.mean(spreads);
        const avgImbalance = this.mean(imbalances);
        const avgPrice = this.mean(prices);
        
        const spreadVolatility = this.standardDeviation(spreads) / avgSpread;
        const imbalanceVolatility = this.standardDeviation(imbalances);
        const priceVolatility = this.standardDeviation(prices) / avgPrice;
        
        const { slope: spreadSlope, intercept: spreadIntercept, r2: spreadR2 } = 
            this.linearRegression(this.indices(n), spreads);
        const { slope: imbalanceSlope, intercept: imbalanceIntercept, r2: imbalanceR2 } = 
            this.linearRegression(this.indices(n), imbalances);
        
        const predictedFutureSpread = Math.max(0, spreadSlope * (n + this.predictSeconds) + spreadIntercept);
        const predictedFutureImbalance = Math.max(-1, Math.min(1, imbalanceSlope * (n + this.predictSeconds) + imbalanceIntercept));
        
        const spreadTrendStrength = Math.abs(spreadSlope) / (avgSpread || 1);
        const imbalanceTrendStrength = Math.abs(imbalanceSlope) / 0.5;
        
        const predictedVolatility = 
            priceVolatility * 0.4 +
            spreadVolatility * 0.3 +
            imbalanceVolatility * 0.15 +
            spreadTrendStrength * 0.1 +
            imbalanceTrendStrength * 0.05;
        
        const predictedPriceRange = predictedVolatility * avgPrice;
        this.predictedVolatility = Math.max(0.0001, predictedVolatility);
        
        const avgR2 = (spreadR2 + imbalanceR2) / 2;
        this.confidence = Math.max(0.3, Math.min(0.95, 0.5 + avgR2 * 0.3));
    }

    linearRegression(x, y) {
        const n = x.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        
        for (let i = 0; i < n; i++) {
            sumX += x[i];
            sumY += y[i];
            sumXY += x[i] * y[i];
            sumX2 += x[i] * x[i];
        }
        
        const meanX = sumX / n;
        const meanY = sumY / n;
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = meanY - slope * meanX;
        
        let ssRes = 0, ssTot = 0;
        for (let i = 0; i < n; i++) {
            const predicted = slope * x[i] + intercept;
            ssRes += Math.pow(y[i] - predicted, 2);
            ssTot += Math.pow(y[i] - meanY, 2);
        }
        
        const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
        
        return { slope, intercept, r2 };
    }

    mean(arr) {
        return arr.reduce((sum, val) => sum + val, 0) / arr.length;
    }

    standardDeviation(arr) {
        const avg = this.mean(arr);
        const squareDiffs = arr.map(val => Math.pow(val - avg, 2));
        return Math.sqrt(this.mean(squareDiffs));
    }

    indices(n) {
        const result = new Array(n);
        for (let i = 0; i < n; i++) result[i] = i;
        return result;
    }

    getPredictionSummary() {
        return {
            actualVolatility: this.actualVolatility,
            predictedVolatility: this.predictedVolatility,
            confidence: this.confidence,
            predictedPriceRange: this.predictedVolatility * (this.history.length > 0 ? 
                this.history[this.history.length - 1].midPrice : 0),
            windowSize: this.windowSize,
            predictSeconds: this.predictSeconds
        };
    }

    reset() {
        this.history = [];
        this.actualVolatility = null;
        this.predictedVolatility = null;
        this.confidence = 0;
    }
}
