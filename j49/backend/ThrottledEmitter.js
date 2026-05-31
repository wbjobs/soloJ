class ThrottledEmitter {
  constructor(io, config = {}) {
    this.io = io;
    this.chartIntervalMs = config.chartIntervalMs || 1000;
    this.deviceListIntervalMs = config.deviceListIntervalMs || 5000;
    this.statsIntervalMs = config.statsIntervalMs || 1000;

    this.latestTempFrame = null;
    this.latestHumidityFrame = null;
    this.latestDeviceStats = null;
    this.latestSystemStats = null;

    this.pendingIngestCount = 0;

    this._startEmitLoop();
  }

  onIngest(db) {
    this.pendingIngestCount++;

    const tempAgg = db.getAggregatedLatest('temperature', 1);
    if (tempAgg.length > 0) {
      this.latestTempFrame = tempAgg[tempAgg.length - 1];
    }

    const humidityAgg = db.getAggregatedLatest('humidity', 1);
    if (humidityAgg.length > 0) {
      this.latestHumidityFrame = humidityAgg[humidityAgg.length - 1];
    }

    this.latestSystemStats = {
      deviceCount: db.getDeviceCount(),
      totalRecords: db.getTotalRecords(),
      ingestQueueDepth: this.pendingIngestCount,
      lastUpdate: Date.now()
    };
  }

  markIngestProcessed() {
    this.pendingIngestCount = 0;
  }

  refreshDeviceStats(db) {
    this.latestDeviceStats = db.getAllDeviceStats();
  }

  _startEmitLoop() {
    setInterval(() => {
      if (this.latestTempFrame) {
        this.io.emit('temperatureUpdate', this.latestTempFrame);
        this.latestTempFrame = null;
      }
      if (this.latestHumidityFrame) {
        this.io.emit('humidityUpdate', this.latestHumidityFrame);
        this.latestHumidityFrame = null;
      }
    }, this.chartIntervalMs);

    setInterval(() => {
      if (this.latestDeviceStats) {
        this.io.emit('deviceStatsUpdate', this.latestDeviceStats);
      } else {
        this.refreshDeviceStats();
        if (this.latestDeviceStats) {
          this.io.emit('deviceStatsUpdate', this.latestDeviceStats);
        }
      }
    }, this.deviceListIntervalMs);

    setInterval(() => {
      if (this.latestSystemStats) {
        this.io.emit('systemStats', this.latestSystemStats);
      }
    }, this.statsIntervalMs);
  }

  emitInitialData(socket, db) {
    socket.emit('systemStats', this.latestSystemStats || {
      deviceCount: db.getDeviceCount(),
      totalRecords: db.getTotalRecords(),
      ingestQueueDepth: 0,
      lastUpdate: Date.now()
    });

    if (this.latestDeviceStats) {
      socket.emit('deviceStatsUpdate', this.latestDeviceStats);
    } else {
      this.refreshDeviceStats(db);
      socket.emit('deviceStatsUpdate', this.latestDeviceStats);
    }

    const initialTempData = db.getAggregatedLatest('temperature', 60);
    if (initialTempData.length > 0) {
      socket.emit('initialTemperatureData', initialTempData);
    }

    const initialHumidityData = db.getAggregatedLatest('humidity', 60);
    if (initialHumidityData.length > 0) {
      socket.emit('initialHumidityData', initialHumidityData);
    }
  }
}

module.exports = ThrottledEmitter;
