class Orderbook {
    constructor() {
        this.bids = new Map();
        this.asks = new Map();
        this.bestBid = 0;
        this.bestAsk = 0;
        this.timestamp = 0;
        
        this._cachedBidLevels = null;
        this._cachedAskLevels = null;
        this._cachedCumulativeBids = null;
        this._cachedCumulativeAsks = null;
        this._cacheValid = false;
    }

    updateFromSnapshot(snapshot) {
        this.timestamp = snapshot.timestamp;
        this.bestBid = snapshot.bestBid;
        this.bestAsk = snapshot.bestAsk;

        this.bids.clear();
        for (const [price, quantity] of snapshot.bids) {
            this.bids.set(price, quantity);
        }

        this.asks.clear();
        for (const [price, quantity] of snapshot.asks) {
            this.asks.set(price, quantity);
        }
        
        this._cacheValid = false;
    }

    _invalidateCache() {
        this._cacheValid = false;
    }

    _computeCache() {
        if (this._cacheValid) return;
        
        this._cachedBidLevels = Array.from(this.bids.entries()).sort((a, b) => b[0] - a[0]);
        this._cachedAskLevels = Array.from(this.asks.entries()).sort((a, b) => a[0] - b[0]);
        
        let cumulative = 0;
        this._cachedCumulativeBids = this._cachedBidLevels.map(([price, quantity]) => {
            cumulative += quantity;
            return [price, cumulative];
        });
        
        cumulative = 0;
        this._cachedCumulativeAsks = this._cachedAskLevels.map(([price, quantity]) => {
            cumulative += quantity;
            return [price, cumulative];
        });
        
        this._cacheValid = true;
    }

    getSortedBids() {
        this._computeCache();
        return this._cachedBidLevels;
    }

    getSortedAsks() {
        this._computeCache();
        return this._cachedAskLevels;
    }

    getCumulativeBids() {
        this._computeCache();
        return this._cachedCumulativeBids;
    }

    getCumulativeAsks() {
        this._computeCache();
        return this._cachedCumulativeAsks;
    }

    getMidPrice() {
        if (this.bestBid === 0 || this.bestAsk === 0) return 0;
        return (this.bestBid + this.bestAsk) / 2;
    }
}
