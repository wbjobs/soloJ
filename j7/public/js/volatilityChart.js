class VolatilityChart {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.chart = null;
        this.maxDataPoints = 200;
        
        this.actualData = [];
        this.predictedData = [];
        this.timestamps = [];
        
        this.initChart();
    }

    initChart() {
        if (!this.container) return;
        
        this.chart = echarts.init(this.container, 'dark');
        
        this.chart.setOption({
            backgroundColor: 'transparent',
            title: {
                text: '波动率预测',
                textStyle: {
                    color: '#8b949e',
                    fontSize: 12,
                    fontWeight: 'normal'
                },
                left: 10,
                top: 5
            },
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(22, 27, 34, 0.9)',
                borderColor: '#30363d',
                textStyle: {
                    color: '#f0f6fc',
                    fontFamily: 'JetBrains Mono'
                },
                formatter: (params) => {
                    let result = '';
                    for (const p of params) {
                        const value = p.value;
                        const date = new Date(p.axisValue);
                        const timeStr = date.toLocaleTimeString('zh-CN', { hour12: false });
                        result += `${p.marker}${p.seriesName}: ${(value * 100).toFixed(4)}%<br/>`;
                    }
                    return result;
                }
            },
            legend: {
                data: ['实际波动率', '预测波动率'],
                textStyle: {
                    color: '#8b949e',
                    fontSize: 11
                },
                right: 10,
                top: 5,
                itemWidth: 12,
                itemHeight: 8
            },
            grid: {
                left: 50,
                right: 20,
                top: 40,
                bottom: 30
            },
            xAxis: {
                type: 'time',
                axisLine: {
                    lineStyle: {
                        color: '#30363d'
                    }
                },
                axisLabel: {
                    color: '#6e7681',
                    fontSize: 10,
                    formatter: (value) => {
                        const date = new Date(value);
                        return date.toLocaleTimeString('zh-CN', { 
                            hour: '2-digit', 
                            minute: '2-digit', 
                            second: '2-digit',
                            hour12: false 
                        });
                    }
                },
                splitLine: {
                    lineStyle: {
                        color: 'rgba(48, 54, 61, 0.3)'
                    }
                }
            },
            yAxis: {
                type: 'value',
                name: '波动率',
                nameTextStyle: {
                    color: '#6e7681',
                    fontSize: 10
                },
                axisLine: {
                    lineStyle: {
                        color: '#30363d'
                    }
                },
                axisLabel: {
                    color: '#6e7681',
                    fontSize: 10,
                    formatter: (value) => (value * 100).toFixed(2) + '%'
                },
                splitLine: {
                    lineStyle: {
                        color: 'rgba(48, 54, 61, 0.3)'
                    }
                }
            },
            series: [
                {
                    name: '实际波动率',
                    type: 'line',
                    data: [],
                    smooth: true,
                    symbol: 'none',
                    lineStyle: {
                        color: '#58a6ff',
                        width: 2
                    },
                    areaStyle: {
                        color: {
                            type: 'linear',
                            x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [
                                { offset: 0, color: 'rgba(88, 166, 255, 0.3)' },
                                { offset: 1, color: 'rgba(88, 166, 255, 0.05)' }
                            ]
                        }
                    }
                },
                {
                    name: '预测波动率',
                    type: 'line',
                    data: [],
                    smooth: true,
                    symbol: 'none',
                    lineStyle: {
                        color: '#f0883e',
                        width: 2,
                        type: 'dashed'
                    },
                    areaStyle: {
                        color: {
                            type: 'linear',
                            x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [
                                { offset: 0, color: 'rgba(240, 136, 62, 0.2)' },
                                { offset: 1, color: 'rgba(240, 136, 62, 0.03)' }
                            ]
                        }
                    }
                }
            ]
        });
        
        window.addEventListener('resize', () => {
            this.chart && this.chart.resize();
        });
    }

    update(prediction) {
        if (!this.chart || !prediction) return;
        
        this.timestamps.push(prediction.timestamp);
        this.actualData.push([prediction.timestamp, prediction.actualVolatility]);
        this.predictedData.push([prediction.timestamp, prediction.predictedVolatility]);
        
        while (this.timestamps.length > this.maxDataPoints) {
            this.timestamps.shift();
            this.actualData.shift();
            this.predictedData.shift();
        }
        
        this.chart.setOption({
            series: [
                {
                    name: '实际波动率',
                    data: this.actualData
                },
                {
                    name: '预测波动率',
                    data: this.predictedData
                }
            ]
        });
    }

    exportToImage() {
        if (!this.chart) return null;
        
        const dataUrl = this.chart.getDataURL({
            type: 'png',
            pixelRatio: 2,
            backgroundColor: '#0d1117'
        });
        
        return dataUrl;
    }

    clear() {
        this.actualData = [];
        this.predictedData = [];
        this.timestamps = [];
        
        if (this.chart) {
            this.chart.setOption({
                series: [
                    { name: '实际波动率', data: [] },
                    { name: '预测波动率', data: [] }
                ]
            });
        }
    }

    resize() {
        if (this.chart) {
            this.chart.resize();
        }
    }
}
