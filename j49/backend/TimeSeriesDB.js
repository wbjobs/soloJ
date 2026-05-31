class TimeSeriesDB {
  constructor(retentionMinutes = 60) {
    this.data = new Map();
    this.retentionMs = retentionMinutes * 60 * 1000;
    this.deviceList = new Set();
  }

  insert(deviceId, metric, value, timestamp = Date.now()) {
    const key = `${deviceId}_${metric}`;
    if (!this.data.has(key)) {
      this.data.set(key, []);
    }
    this.data.get(key).push({ timestamp, value });
    this.deviceList.add(deviceId);
    this.cleanupOldData(key);
  }

  insertBatch(records) {
    records.forEach(record => {
      const { deviceId, temperature, humidity, timestamp } = record;
      this.insert(deviceId, 'temperature', temperature, timestamp);
      this.insert(deviceId, 'humidity', humidity, timestamp);
    });
  }

  query(deviceId, metric, startTime, endTime = Date.now()) {
    const key = `${deviceId}_${metric}`;
    const series = this.data.get(key) || [];
    return series.filter(p => p.timestamp >= startTime && p.timestamp <= endTime);
  }

  queryLatest(deviceId, metric, limit = 1) {
    const key = `${deviceId}_${metric}`;
    const series = this.data.get(key) || [];
    return series.slice(-limit);
  }

  getAllLatest(metric, limit = 1) {
    const result = [];
    this.deviceList.forEach(deviceId => {
      const latest = this.queryLatest(deviceId, metric, limit);
      if (latest.length > 0) {
        result.push({ deviceId, data: latest });
      }
    });
    return result;
  }

  getAggregatedLatest(metric, limit = 60) {
    const aggregated = [];
    const deviceData = this.getAllLatest(metric, limit);
    
    if (deviceData.length === 0) return [];

    const timePoints = new Set();
    deviceData.forEach(d => d.data.forEach(p => timePoints.add(p.timestamp)));
    const sortedTimes = Array.from(timePoints).sort((a, b) => a - b);

    sortedTimes.forEach(timestamp => {
      let sum = 0;
      let count = 0;
      let min = Infinity;
      let max = -Infinity;
      
      deviceData.forEach(d => {
        const point = d.data.find(p => p.timestamp === timestamp);
        if (point) {
          sum += point.value;
          count++;
          min = Math.min(min, point.value);
          max = Math.max(max, point.value);
        }
      });
      
      if (count > 0) {
        aggregated.push({
          timestamp,
          avg: sum / count,
          min,
          max,
          count
        });
      }
    });

    return aggregated.slice(-limit);
  }

  getDeviceStats(deviceId) {
    const tempData = this.queryLatest(deviceId, 'temperature', 60);
    const humidityData = this.queryLatest(deviceId, 'humidity', 60);
    
    const calcStats = (data) => {
      if (data.length === 0) return null;
      const values = data.map(d => d.value);
      return {
        latest: values[values.length - 1],
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length
      };
    };

    return {
      deviceId,
      temperature: calcStats(tempData),
      humidity: calcStats(humidityData),
      lastUpdate: tempData.length > 0 ? tempData[tempData.length - 1].timestamp : null
    };
  }

  getAllDeviceStats() {
    const stats = [];
    this.deviceList.forEach(deviceId => {
      stats.push(this.getDeviceStats(deviceId));
    });
    return stats;
  }

  cleanupOldData(key) {
    const series = this.data.get(key);
    if (!series) return;
    
    const cutoffTime = Date.now() - this.retentionMs;
    while (series.length > 0 && series[0].timestamp < cutoffTime) {
      series.shift();
    }
  }

  getDeviceCount() {
    return this.deviceList.size;
  }

  getTotalRecords() {
    let count = 0;
    this.data.forEach(series => {
      count += series.length;
    });
    return count;
  }
}

module.exports = TimeSeriesDB;
