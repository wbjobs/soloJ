const axios = require('axios');

const CONFIG = {
  deviceCount: 100,
  intervalMs: 1000,
  backendUrl: process.env.BACKEND_URL || 'http://localhost:3000/api/ingest',
  temperatureBase: 25,
  temperatureVariance: 5,
  humidityBase: 60,
  humidityVariance: 15
};

class DeviceSimulator {
  constructor() {
    this.devices = this.initializeDevices();
    this.stats = {
      totalSent: 0,
      successfulBatches: 0,
      failedBatches: 0,
      startTime: Date.now()
    };
    this.setupGracefulShutdown();
  }

  initializeDevices() {
    const devices = [];
    for (let i = 0; i < CONFIG.deviceCount; i++) {
      devices.push({
        deviceId: `sensor_${String(i).padStart(4, '0')}`,
        currentTemp: CONFIG.temperatureBase + (Math.random() - 0.5) * CONFIG.temperatureVariance * 2,
        currentHumidity: CONFIG.humidityBase + (Math.random() - 0.5) * CONFIG.humidityVariance * 2,
        tempTrend: (Math.random() - 0.5) * 0.1,
        humidityTrend: (Math.random() - 0.5) * 0.2
      });
    }
    return devices;
  }

  updateDeviceData(device) {
    const tempNoise = (Math.random() - 0.5) * 0.5;
    const humidityNoise = (Math.random() - 0.5) * 1;
    
    device.tempTrend += (Math.random() - 0.5) * 0.02;
    device.tempTrend = Math.max(-0.2, Math.min(0.2, device.tempTrend));
    
    device.humidityTrend += (Math.random() - 0.5) * 0.05;
    device.humidityTrend = Math.max(-0.5, Math.min(0.5, device.humidityTrend));
    
    device.currentTemp += device.tempTrend + tempNoise;
    device.currentTemp = Math.max(
      CONFIG.temperatureBase - CONFIG.temperatureVariance,
      Math.min(CONFIG.temperatureBase + CONFIG.temperatureVariance, device.currentTemp)
    );
    
    device.currentHumidity += device.humidityTrend + humidityNoise;
    device.currentHumidity = Math.max(
      CONFIG.humidityBase - CONFIG.humidityVariance,
      Math.min(CONFIG.humidityBase + CONFIG.humidityVariance, device.currentHumidity)
    );
  }

  generateBatch() {
    const timestamp = Date.now();
    const batch = [];
    
    this.devices.forEach(device => {
      this.updateDeviceData(device);
      batch.push({
        deviceId: device.deviceId,
        temperature: parseFloat(device.currentTemp.toFixed(2)),
        humidity: parseFloat(device.currentHumidity.toFixed(2)),
        timestamp
      });
    });
    
    return batch;
  }

  async sendBatch(batch) {
    try {
      const response = await axios.post(CONFIG.backendUrl, { data: batch }, {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' }
      });
      
      this.stats.totalSent += batch.length;
      this.stats.successfulBatches++;
      
      if (this.stats.successfulBatches % 10 === 0) {
        this.printStats();
      }
      
      return response.data;
    } catch (error) {
      this.stats.failedBatches++;
      console.error(`[${new Date().toISOString()}] Failed to send batch:`, 
        error.code || error.response?.status || error.message);
      throw error;
    }
  }

  printStats() {
    const elapsed = (Date.now() - this.stats.startTime) / 1000;
    const rate = this.stats.totalSent / elapsed;
    console.log(`
==================================================
[${new Date().toISOString()}] IoT Device Simulator Stats
--------------------------------------------------
Total devices simulated: ${CONFIG.deviceCount}
Total data points sent:  ${this.stats.totalSent.toLocaleString()}
Successful batches:      ${this.stats.successfulBatches}
Failed batches:          ${this.stats.failedBatches}
Elapsed time:            ${elapsed.toFixed(1)}s
Average rate:            ${rate.toFixed(1)} points/sec
Target rate:             ${CONFIG.deviceCount * (1000 / CONFIG.intervalMs)} points/sec
==================================================
`);
  }

  setupGracefulShutdown() {
    process.on('SIGINT', () => {
      console.log('\nReceived SIGINT, shutting down gracefully...');
      this.printStats();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('\nReceived SIGTERM, shutting down gracefully...');
      this.printStats();
      process.exit(0);
    });
  }

  async start() {
    console.log(`
==================================================
IoT Device Simulator Starting...
--------------------------------------------------
Configuration:
  - Device count:     ${CONFIG.deviceCount}
  - Interval:         ${CONFIG.intervalMs}ms
  - Backend URL:      ${CONFIG.backendUrl}
  - Temp range:       ${CONFIG.temperatureBase - CONFIG.temperatureVariance}°C ~ ${CONFIG.temperatureBase + CONFIG.temperatureVariance}°C
  - Humidity range:   ${CONFIG.humidityBase - CONFIG.humidityVariance}% ~ ${CONFIG.humidityBase + CONFIG.humidityVariance}%
  - Target throughput: ${CONFIG.deviceCount * (1000 / CONFIG.intervalMs)} data points/sec
==================================================
`);

    const run = async () => {
      const batch = this.generateBatch();
      try {
        await this.sendBatch(batch);
      } catch (error) {
      }
    };

    setInterval(run, CONFIG.intervalMs);
    run();
  }
}

const simulator = new DeviceSimulator();
simulator.start();
