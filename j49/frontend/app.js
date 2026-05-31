const socket = io();
const startTime = Date.now();

let temperatureChart, humidityChart, tempRangeChart;
let temperatureData = [];
let humidityData = [];
let tempRangeData = { min: [], max: [], avg: [] };
const maxDataPoints = 60;

let currentDeviceStats = [];
let droppedFrames = 0;
let renderedFrames = 0;

class RenderScheduler {
  constructor(targetFps = 30) {
    this.frameInterval = 1000 / targetFps;
    this.lastFrameTime = 0;
    this.pendingRender = null;
    this.scheduledRaf = null;
    this.dropCount = 0;
    this.renderCount = 0;
  }

  schedule(renderFn) {
    this.pendingRender = renderFn;

    if (!this.scheduledRaf) {
      this.scheduledRaf = requestAnimationFrame((timestamp) => {
        this.scheduledRaf = null;
        this._executeFrame(timestamp);
      });
    }
  }

  _executeFrame(timestamp) {
    if (!this.pendingRender) return;

    const elapsed = timestamp - this.lastFrameTime;

    if (elapsed < this.frameInterval) {
      this.scheduledRaf = requestAnimationFrame((t) => {
        this.scheduledRaf = null;
        this._executeFrame(t);
      });
      return;
    }

    const renderFn = this.pendingRender;
    this.pendingRender = null;
    this.lastFrameTime = timestamp;
    this.renderCount++;

    try {
      renderFn();
    } catch (err) {
      console.error('Render error:', err);
    }

    if (this.pendingRender) {
      this.scheduledRaf = requestAnimationFrame((t) => {
        this.scheduledRaf = null;
        this._executeFrame(t);
      });
    }
  }

  getStats() {
    return {
      rendered: this.renderCount,
      dropped: this.dropCount
    };
  }
}

const chartScheduler = new RenderScheduler(30);
const deviceListScheduler = new RenderScheduler(4);

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const secs = seconds % 60;
  const mins = minutes % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

let pendingChartData = null;
let pendingHumidityData = null;

function initCharts() {
  temperatureChart = echarts.init(document.getElementById('temperatureChart'));
  humidityChart = echarts.init(document.getElementById('humidityChart'));
  tempRangeChart = echarts.init(document.getElementById('tempRangeChart'));

  const tempOption = {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      borderColor: 'rgba(0, 212, 255, 0.3)',
      textStyle: { color: '#e4e4e7' },
      formatter: function(params) {
        const result = params[0].axisValue + '<br/>';
        params.forEach(param => {
          result += `${param.marker} ${param.seriesName}: <strong>${param.value.toFixed(2)}°C</strong><br/>`;
        });
        return result;
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: [],
      axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
      axisLabel: { color: '#9ca3af', fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      name: '温度 (°C)',
      nameTextStyle: { color: '#9ca3af' },
      axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
      axisLabel: { color: '#9ca3af' },
      splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } }
    },
    series: [
      {
        name: '平均温度',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: false,
        lineStyle: {
          width: 3,
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#00d4ff' },
              { offset: 1, color: '#7c3aed' }
            ]
          }
        },
        itemStyle: {
          color: '#00d4ff',
          borderColor: '#fff',
          borderWidth: 2
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(0, 212, 255, 0.3)' },
              { offset: 1, color: 'rgba(0, 212, 255, 0.02)' }
            ]
          }
        },
        data: []
      }
    ]
  };

  const humidityOption = {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      borderColor: 'rgba(34, 197, 94, 0.3)',
      textStyle: { color: '#e4e4e7' },
      formatter: function(params) {
        return `${params[0].axisValue}<br/>${params[0].marker} ${params[0].seriesName}: <strong>${params[0].value.toFixed(2)}%</strong>`;
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: [],
      axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
      axisLabel: { color: '#9ca3af', fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      name: '湿度 (%)',
      nameTextStyle: { color: '#9ca3af' },
      axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
      axisLabel: { color: '#9ca3af' },
      splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } }
    },
    series: [
      {
        name: '平均湿度',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: false,
        lineStyle: {
          width: 3,
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#22c55e' },
              { offset: 1, color: '#059669' }
            ]
          }
        },
        itemStyle: {
          color: '#22c55e',
          borderColor: '#fff',
          borderWidth: 2
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(34, 197, 94, 0.3)' },
              { offset: 1, color: 'rgba(34, 197, 94, 0.02)' }
            ]
          }
        },
        data: []
      }
    ]
  };

  const tempRangeOption = {
    backgroundColor: 'transparent',
    animation: false,
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      borderColor: 'rgba(0, 212, 255, 0.3)',
      textStyle: { color: '#e4e4e7' }
    },
    legend: {
      data: ['最高', '平均', '最低'],
      textStyle: { color: '#9ca3af' },
      top: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: [],
      axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
      axisLabel: { color: '#9ca3af', fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      name: '温度 (°C)',
      nameTextStyle: { color: '#9ca3af' },
      axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
      axisLabel: { color: '#9ca3af' },
      splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } }
    },
    series: [
      {
        name: '最高',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        showSymbol: false,
        lineStyle: { width: 2, color: '#ef4444' },
        itemStyle: { color: '#ef4444' },
        data: []
      },
      {
        name: '平均',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: false,
        lineStyle: { width: 3, color: '#00d4ff' },
        itemStyle: { color: '#00d4ff' },
        data: []
      },
      {
        name: '最低',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        showSymbol: false,
        lineStyle: { width: 2, color: '#3b82f6' },
        itemStyle: { color: '#3b82f6' },
        data: []
      }
    ]
  };

  temperatureChart.setOption(tempOption);
  humidityChart.setOption(humidityOption);
  tempRangeChart.setOption(tempRangeOption);

  window.addEventListener('resize', () => {
    temperatureChart.resize();
    humidityChart.resize();
    tempRangeChart.resize();
  });
}

function renderAllCharts() {
  if (pendingChartData) {
    const data = pendingChartData;
    pendingChartData = null;
    renderedFrames++;

    if (temperatureData.length >= maxDataPoints) {
      temperatureData.shift();
    }
    temperatureData.push(data.avg);

    const now = Date.now();
    const times = temperatureData.map((_, i) => {
      return formatTime(now - (temperatureData.length - 1 - i) * 1000);
    });

    temperatureChart.setOption({
      xAxis: { data: times },
      series: [{ data: [...temperatureData] }]
    });

    if (tempRangeData.avg.length >= maxDataPoints) {
      tempRangeData.min.shift();
      tempRangeData.max.shift();
      tempRangeData.avg.shift();
    }
    tempRangeData.min.push(data.min);
    tempRangeData.max.push(data.max);
    tempRangeData.avg.push(data.avg);

    tempRangeChart.setOption({
      xAxis: { data: times },
      series: [
        { data: [...tempRangeData.max] },
        { data: [...tempRangeData.avg] },
        { data: [...tempRangeData.min] }
      ]
    });

    const badge = document.getElementById('tempUpdateBadge');
    badge.textContent = `更新于 ${formatTime(data.timestamp)}`;
  }

  if (pendingHumidityData) {
    const data = pendingHumidityData;
    pendingHumidityData = null;

    if (humidityData.length >= maxDataPoints) {
      humidityData.shift();
    }
    humidityData.push(data.avg);

    const now = Date.now();
    const times = humidityData.map((_, i) => {
      return formatTime(now - (humidityData.length - 1 - i) * 1000);
    });

    humidityChart.setOption({
      xAxis: { data: times },
      series: [{ data: [...humidityData] }]
    });
  }
}

function updateTemperatureChart(data) {
  if (pendingChartData !== null) {
    droppedFrames++;
  }
  pendingChartData = data;
  chartScheduler.schedule(renderAllCharts);
}

function updateHumidityChart(data) {
  pendingHumidityData = data;
  chartScheduler.schedule(renderAllCharts);
}

let deviceElementCache = new Map();
let lastDeviceListHash = '';

function updateDeviceList(devices) {
  deviceListScheduler.schedule(() => {
    const container = document.getElementById('devicesList');

    if (!devices || devices.length === 0) {
      container.innerHTML = `
        <div class="loading">
          <div class="spinner"></div>
          <span>等待设备数据...</span>
        </div>
      `;
      return;
    }

    const currentHash = devices.length + '_' + devices[0]?.lastUpdate;
    if (currentHash === lastDeviceListHash) return;
    lastDeviceListHash = currentHash;

    let needsFullRebuild = deviceElementCache.size === 0 ||
      deviceElementCache.size !== devices.length;

    if (needsFullRebuild) {
      deviceElementCache.clear();
      let html = '';
      devices.forEach(device => {
        const temp = device.temperature?.latest ?? '--';
        const humidity = device.humidity?.latest ?? '--';
        const tempClass = temp > 28 ? 'hot' : temp < 22 ? 'cool' : '';
        const lastUpdate = device.lastUpdate ? formatTime(device.lastUpdate) : '--';

        html += `
          <div class="device-item" id="dev-${device.deviceId}">
            <div class="device-id">${device.deviceId}</div>
            <div class="device-reading">
              <span class="reading-label">温度</span>
              <span class="reading-value ${tempClass}">${temp}°C</span>
            </div>
            <div class="device-reading">
              <span class="reading-label">湿度</span>
              <span class="reading-value">${humidity}%</span>
            </div>
            <div class="device-status">
              <div class="device-status-dot"></div>
              <span class="device-status-text">更新于 ${lastUpdate}</span>
            </div>
          </div>
        `;
        deviceElementCache.set(device.deviceId, true);
      });
      container.innerHTML = html;
    } else {
      devices.forEach(device => {
        const el = document.getElementById(`dev-${device.deviceId}`);
        if (!el) return;

        const temp = device.temperature?.latest ?? '--';
        const humidity = device.humidity?.latest ?? '--';
        const tempClass = temp > 28 ? 'hot' : temp < 22 ? 'cool' : '';
        const lastUpdate = device.lastUpdate ? formatTime(device.lastUpdate) : '--';

        const readings = el.querySelectorAll('.device-reading');
        if (readings[0]) {
          const val = readings[0].querySelector('.reading-value');
          if (val) {
            val.className = `reading-value ${tempClass}`;
            val.textContent = `${temp}°C`;
          }
        }
        if (readings[1]) {
          const val = readings[1].querySelector('.reading-value');
          if (val) val.textContent = `${humidity}%`;
        }
        const statusText = el.querySelector('.device-status-text');
        if (statusText) statusText.textContent = `更新于 ${lastUpdate}`;
      });
    }

    document.getElementById('deviceCountBadge').textContent = `${devices.length} 台在线`;
  });
}

function updateStats(stats) {
  document.getElementById('deviceCount').textContent = stats.deviceCount.toLocaleString();
  document.getElementById('totalRecords').textContent = stats.totalRecords.toLocaleString();

  const elapsed = Date.now() - startTime;
  const throughput = elapsed > 0 ? (stats.totalRecords / (elapsed / 1000)).toFixed(0) : 0;
  document.getElementById('throughput').textContent = throughput.toLocaleString();
  document.getElementById('uptime').textContent = formatDuration(elapsed);

  if (currentDeviceStats && currentDeviceStats.length > 0) {
    const validTemps = currentDeviceStats.filter(d => d.temperature?.latest != null);
    const validHumidity = currentDeviceStats.filter(d => d.humidity?.latest != null);

    if (validTemps.length > 0) {
      const avgTemp = validTemps.reduce((sum, d) => sum + d.temperature.latest, 0) / validTemps.length;
      document.getElementById('avgTemp').textContent = `${avgTemp.toFixed(1)}°C`;
    }

    if (validHumidity.length > 0) {
      const avgHumidity = validHumidity.reduce((sum, d) => sum + d.humidity.latest, 0) / validHumidity.length;
      document.getElementById('avgHumidity').textContent = `${avgHumidity.toFixed(1)}%`;
    }
  }

  const lagEl = document.getElementById('renderLag');
  if (lagEl && stats.ingestQueueDepth !== undefined) {
    const queueDepth = stats.ingestQueueDepth || 0;
    lagEl.textContent = queueDepth > 0 ? `队列: ${queueDepth}` : '实时';
    lagEl.style.color = queueDepth > 3 ? '#f97316' : '#22c55e';
  }
}

function setConnected(connected) {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');

  if (connected) {
    dot.classList.add('connected');
    text.textContent = '已连接';
    text.style.color = '#22c55e';
  } else {
    dot.classList.remove('connected');
    text.textContent = '连接断开';
    text.style.color = '#ef4444';
  }
}

socket.on('connect', () => {
  console.log('Connected to server');
  setConnected(true);
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
  setConnected(false);
});

socket.on('systemStats', (stats) => {
  updateStats(stats);
});

socket.on('initialTemperatureData', (data) => {
  if (data && data.length > 0) {
    temperatureData = data.map(d => d.avg);
    tempRangeData.min = data.map(d => d.min);
    tempRangeData.max = data.map(d => d.max);
    tempRangeData.avg = data.map(d => d.avg);

    const now = Date.now();
    const times = temperatureData.map((_, i) => {
      return formatTime(now - (temperatureData.length - 1 - i) * 1000);
    });

    temperatureChart.setOption({
      xAxis: { data: times },
      series: [{ data: [...temperatureData] }]
    });

    tempRangeChart.setOption({
      xAxis: { data: times },
      series: [
        { data: [...tempRangeData.max] },
        { data: [...tempRangeData.avg] },
        { data: [...tempRangeData.min] }
      ]
    });
  }
});

socket.on('initialHumidityData', (data) => {
  if (data && data.length > 0) {
    humidityData = data.map(d => d.avg);

    const now = Date.now();
    const times = humidityData.map((_, i) => {
      return formatTime(now - (humidityData.length - 1 - i) * 1000);
    });

    humidityChart.setOption({
      xAxis: { data: times },
      series: [{ data: [...humidityData] }]
    });
  }
});

socket.on('temperatureUpdate', (data) => {
  updateTemperatureChart(data);
});

socket.on('humidityUpdate', (data) => {
  updateHumidityChart(data);
});

socket.on('deviceStatsUpdate', (devices) => {
  currentDeviceStats = devices;
  updateDeviceList(devices);
});

document.addEventListener('DOMContentLoaded', () => {
  initCharts();
  setConnected(false);

  fetch('/api/temperature/history?limit=60')
    .then(res => res.json())
    .then(result => {
      if (result.data && result.data.length > 0) {
        temperatureData = result.data.map(d => d.avg);
        tempRangeData.min = result.data.map(d => d.min);
        tempRangeData.max = result.data.map(d => d.max);
        tempRangeData.avg = result.data.map(d => d.avg);

        const now = Date.now();
        const times = temperatureData.map((_, i) => {
          return formatTime(now - (temperatureData.length - 1 - i) * 1000);
        });

        temperatureChart.setOption({
          xAxis: { data: times },
          series: [{ data: [...temperatureData] }]
        });

        tempRangeChart.setOption({
          xAxis: { data: times },
          series: [
            { data: [...tempRangeData.max] },
            { data: [...tempRangeData.avg] },
            { data: [...tempRangeData.min] }
          ]
        });
      }
    })
    .catch(err => console.log('No historical data available yet'));

  fetch('/api/humidity/history?limit=60')
    .then(res => res.json())
    .then(result => {
      if (result.data && result.data.length > 0) {
        humidityData = result.data.map(d => d.avg);

        const now = Date.now();
        const times = humidityData.map((_, i) => {
          return formatTime(now - (humidityData.length - 1 - i) * 1000);
        });

        humidityChart.setOption({
          xAxis: { data: times },
          series: [{ data: [...humidityData] }]
        });
      }
    })
    .catch(err => console.log('No humidity data available yet'));

  fetch('/api/devices')
    .then(res => res.json())
    .then(result => {
      if (result.devices) {
        currentDeviceStats = result.devices;
        updateDeviceList(result.devices);
      }
    })
    .catch(err => console.log('No device data available yet'));
});

setInterval(() => {
  document.getElementById('uptime').textContent = formatDuration(Date.now() - startTime);
}, 1000);
