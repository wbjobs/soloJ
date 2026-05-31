<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, Thermometer, Activity, Zap, Clock, Building2, AlertTriangle } from 'lucide-vue-next';
import * as echarts from 'echarts';
import type { SensorData, SensorStatus } from '@/types';
import {
  TEMPERATURE_WARNING,
  TEMPERATURE_ERROR,
  VIBRATION_WARNING,
  VIBRATION_ERROR,
  VOLTAGE_WARNING_HIGH,
  VOLTAGE_WARNING_LOW,
  VOLTAGE_ERROR_HIGH,
  VOLTAGE_ERROR_LOW,
} from '@/types';
import { getHistoryData, getLatestData } from '@/api/client';

const route = useRoute();
const router = useRouter();

const workshop = computed(() => route.params.workshop as string);
const sensorId = computed(() => route.params.sensorId as string);

const currentData = ref<SensorData | null>(null);
const historyData = ref<SensorData[]>([]);
const loading = ref(true);
const timeRange = ref<1 | 6 | 24 | 168>(1);

const chartRef = ref<HTMLElement | null>(null);
let chartInstance: echarts.ECharts | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

const timeRangeOptions = [
  { value: 1, label: '1小时' },
  { value: 6, label: '6小时' },
  { value: 24, label: '24小时' },
  { value: 168, label: '7天' },
];

const statusConfig = computed(() => {
  const status = currentData.value?.status || 'normal';
  const configs: Record<SensorStatus, { color: string; bgColor: string; label: string }> = {
    normal: {
      color: 'text-success',
      bgColor: 'bg-success/20',
      label: '正常',
    },
    warning: {
      color: 'text-warning',
      bgColor: 'bg-warning/20',
      label: '警告',
    },
    error: {
      color: 'text-danger',
      bgColor: 'bg-danger/20',
      label: '异常',
    },
  };
  return configs[status];
});

const initChart = () => {
  if (!chartRef.value || historyData.value.length === 0) return;

  if (chartInstance) {
    chartInstance.dispose();
  }

  chartInstance = echarts.init(chartRef.value);

  const timestamps = historyData.value.map((d) => {
    const date = new Date(d.timestamp);
    if (timeRange.value <= 24) {
      return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    }
    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
    }) + ' ' + date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  });

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(30, 41, 59, 0.95)',
      borderColor: 'rgba(14, 165, 233, 0.3)',
      textStyle: {
        color: '#e2e8f0',
        fontFamily: 'Inter, sans-serif',
      },
    },
    legend: {
      data: ['温度', '震动', '电压'],
      textStyle: {
        color: '#94a3b8',
        fontFamily: 'Inter, sans-serif',
      },
      top: 10,
    },
    grid: {
      left: 60,
      right: 60,
      top: 50,
      bottom: 60,
    },
    xAxis: {
      type: 'category',
      data: timestamps,
      axisLine: {
        lineStyle: {
          color: '#334155',
        },
      },
      axisLabel: {
        color: '#64748b',
        fontFamily: 'Inter, sans-serif',
        fontSize: 11,
        rotate: 45,
      },
      axisTick: {
        show: false,
      },
    },
    yAxis: [
      {
        type: 'value',
        name: '温度(°C) / 震动(Hz)',
        position: 'left',
        axisLine: {
          show: false,
        },
        axisLabel: {
          color: '#64748b',
          fontFamily: 'Inter, sans-serif',
          fontSize: 11,
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(51, 65, 85, 0.5)',
            type: 'dashed',
          },
        },
      },
      {
        type: 'value',
        name: '电压(V)',
        position: 'right',
        axisLine: {
          show: false,
        },
        axisLabel: {
          color: '#64748b',
          fontFamily: 'Inter, sans-serif',
          fontSize: 11,
        },
        splitLine: {
          show: false,
        },
      },
    ],
    series: [
      {
        name: '温度',
        type: 'line',
        smooth: true,
        data: historyData.value.map((d) => d.temperature),
        lineStyle: {
          color: '#f59e0b',
          width: 3,
        },
        itemStyle: {
          color: '#f59e0b',
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(245, 158, 11, 0.4)' },
            { offset: 1, color: 'rgba(245, 158, 11, 0.05)' },
          ]),
        },
        showSymbol: true,
        symbolSize: 6,
        markLine: {
          silent: true,
          lineStyle: {
            type: 'dashed',
          },
          data: [
            {
              yAxis: TEMPERATURE_WARNING,
              label: {
                formatter: '警告',
                color: '#f59e0b',
              },
              lineStyle: {
                color: '#f59e0b',
              },
            },
            {
              yAxis: TEMPERATURE_ERROR,
              label: {
                formatter: '异常',
                color: '#ef4444',
              },
              lineStyle: {
                color: '#ef4444',
              },
            },
          ],
        },
      },
      {
        name: '震动',
        type: 'line',
        smooth: true,
        data: historyData.value.map((d) => d.vibration),
        lineStyle: {
          color: '#0ea5e9',
          width: 3,
        },
        itemStyle: {
          color: '#0ea5e9',
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(14, 165, 233, 0.4)' },
            { offset: 1, color: 'rgba(14, 165, 233, 0.05)' },
          ]),
        },
        showSymbol: true,
        symbolSize: 6,
        markLine: {
          silent: true,
          lineStyle: {
            type: 'dashed',
          },
          data: [
            {
              yAxis: VIBRATION_WARNING,
              label: {
                formatter: '警告',
                color: '#f59e0b',
              },
              lineStyle: {
                color: '#f59e0b',
              },
            },
            {
              yAxis: VIBRATION_ERROR,
              label: {
                formatter: '异常',
                color: '#ef4444',
              },
              lineStyle: {
                color: '#ef4444',
              },
            },
          ],
        },
      },
      {
        name: '电压',
        type: 'line',
        smooth: true,
        yAxisIndex: 1,
        data: historyData.value.map((d) => d.voltage),
        lineStyle: {
          color: '#10b981',
          width: 3,
        },
        itemStyle: {
          color: '#10b981',
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(16, 185, 129, 0.4)' },
            { offset: 1, color: 'rgba(16, 185, 129, 0.05)' },
          ]),
        },
        showSymbol: true,
        symbolSize: 6,
        markLine: {
          silent: true,
          lineStyle: {
            type: 'dashed',
          },
          data: [
            {
              yAxis: VOLTAGE_WARNING_HIGH,
              label: {
                formatter: '高警告',
                color: '#f59e0b',
              },
              lineStyle: {
                color: '#f59e0b',
              },
            },
            {
              yAxis: VOLTAGE_WARNING_LOW,
              label: {
                formatter: '低警告',
                color: '#f59e0b',
              },
              lineStyle: {
                color: '#f59e0b',
              },
            },
            {
              yAxis: VOLTAGE_ERROR_HIGH,
              label: {
                formatter: '高异常',
                color: '#ef4444',
              },
              lineStyle: {
                color: '#ef4444',
              },
            },
            {
              yAxis: VOLTAGE_ERROR_LOW,
              label: {
                formatter: '低异常',
                color: '#ef4444',
              },
              lineStyle: {
                color: '#ef4444',
              },
            },
          ],
        },
      },
    ],
  };

  chartInstance.setOption(option);
};

const fetchData = async () => {
  loading.value = true;
  try {
    const [history, latestNested] = await Promise.all([
      getHistoryData(workshop.value, sensorId.value, timeRange.value),
      getLatestData(),
    ]);
    
    historyData.value = history;
    
    const workshopSensors = latestNested[workshop.value] || {};
    currentData.value = workshopSensors[sensorId.value] 
      ? { ...workshopSensors[sensorId.value], workshop: workshop.value, sensorId: sensorId.value }
      : null;
    
    if (currentData.value) {
      const { temperature, vibration, voltage } = currentData.value;
      let status: SensorStatus = 'normal';
      
      if (
        temperature >= TEMPERATURE_ERROR ||
        vibration >= VIBRATION_ERROR ||
        voltage >= VOLTAGE_ERROR_HIGH ||
        voltage <= VOLTAGE_ERROR_LOW
      ) {
        status = 'error';
      } else if (
        temperature >= TEMPERATURE_WARNING ||
        vibration >= VIBRATION_WARNING ||
        voltage >= VOLTAGE_WARNING_HIGH ||
        voltage <= VOLTAGE_WARNING_LOW
      ) {
        status = 'warning';
      }
      
      currentData.value.status = status;
    }
    
    initChart();
  } catch (error) {
    console.error('Failed to fetch sensor data:', error);
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  router.back();
};

const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

onMounted(() => {
  fetchData();
  refreshTimer = setInterval(fetchData, 3000);
  window.addEventListener('resize', () => {
    chartInstance?.resize();
  });
});

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
  chartInstance?.dispose();
});
</script>

<template>
  <div class="min-h-screen p-4 md:p-6 lg:p-8">
    <div class="max-w-7xl mx-auto">
      <button
        class="flex items-center gap-2 px-4 py-2 mb-6 rounded-lg bg-dark-800/60 border border-white/10 text-slate-300 hover:bg-dark-800 hover:text-white transition-all duration-300 font-inter"
        @click="goBack"
      >
        <ArrowLeft class="w-4 h-4" />
        返回
      </button>

      <div v-if="loading" class="animate-pulse space-y-6">
        <div class="h-24 bg-dark-800/60 rounded-xl"></div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="h-32 bg-dark-800/60 rounded-xl"></div>
          <div class="h-32 bg-dark-800/60 rounded-xl"></div>
          <div class="h-32 bg-dark-800/60 rounded-xl"></div>
        </div>
        <div class="h-96 bg-dark-800/60 rounded-xl"></div>
      </div>

      <div v-else-if="currentData" class="space-y-6 animate-fade-in">
        <div class="glass-card p-6">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div class="flex items-center gap-4">
              <div
                class="w-16 h-16 rounded-2xl flex items-center justify-center"
                :class="[
                  statusConfig.bgColor,
                  currentData.status === 'error' ? 'animate-breathe' : ''
                ]"
              >
                <AlertTriangle class="w-8 h-8" :class="statusConfig.color" />
              </div>
              <div>
                <h1 class="font-orbitron text-3xl font-bold text-slate-100">
                  {{ currentData.sensorId }}
                </h1>
                <div class="flex items-center gap-4 mt-1 text-sm text-slate-400 font-inter">
                  <span class="flex items-center gap-1">
                    <Building2 class="w-4 h-4" />
                    {{ currentData.workshop }}
                  </span>
                  <span class="flex items-center gap-1">
                    <Clock class="w-4 h-4" />
                    {{ formatTime(currentData.timestamp) }}
                  </span>
                </div>
              </div>
            </div>
            <span
              class="px-4 py-2 rounded-lg font-bold font-orbitron text-lg"
              :class="[statusConfig.color, statusConfig.bgColor]"
            >
              {{ statusConfig.label }}
            </span>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="glass-card-hover p-5">
            <div class="flex items-center justify-between mb-3">
              <span class="text-slate-400 font-inter text-sm">温度</span>
              <Thermometer class="w-5 h-5 text-warning" />
            </div>
            <p
              class="font-orbitron text-4xl font-bold"
              :class="currentData.temperature >= 50 ? 'text-danger' : currentData.temperature >= 40 ? 'text-warning' : 'text-slate-100'"
            >
              {{ currentData.temperature }}<span class="text-xl">°C</span>
            </p>
            <div class="mt-3 text-xs text-slate-500 font-inter">
              警告: {{ TEMPERATURE_WARNING }}°C / 异常: {{ TEMPERATURE_ERROR }}°C
            </div>
          </div>

          <div class="glass-card-hover p-5">
            <div class="flex items-center justify-between mb-3">
              <span class="text-slate-400 font-inter text-sm">震动</span>
              <Activity class="w-5 h-5 text-primary" />
            </div>
            <p
              class="font-orbitron text-4xl font-bold"
              :class="currentData.vibration >= 150 ? 'text-danger' : currentData.vibration >= 100 ? 'text-warning' : 'text-slate-100'"
            >
              {{ currentData.vibration }}<span class="text-xl">Hz</span>
            </p>
            <div class="mt-3 text-xs text-slate-500 font-inter">
              警告: {{ VIBRATION_WARNING }}Hz / 异常: {{ VIBRATION_ERROR }}Hz
            </div>
          </div>

          <div class="glass-card-hover p-5">
            <div class="flex items-center justify-between mb-3">
              <span class="text-slate-400 font-inter text-sm">电压</span>
              <Zap class="w-5 h-5 text-success" />
            </div>
            <p
              class="font-orbitron text-4xl font-bold"
              :class="(currentData.voltage >= 250 || currentData.voltage <= 190) ? 'text-danger' : (currentData.voltage >= 240 || currentData.voltage <= 200) ? 'text-warning' : 'text-slate-100'"
            >
              {{ currentData.voltage }}<span class="text-xl">V</span>
            </p>
            <div class="mt-3 text-xs text-slate-500 font-inter">
              正常: {{ VOLTAGE_WARNING_LOW }}-{{ VOLTAGE_WARNING_HIGH }}V
            </div>
          </div>
        </div>

        <div class="glass-card p-5">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 class="font-orbitron text-lg font-bold text-slate-100">
              历史趋势
            </h3>
            <div class="flex gap-2">
              <button
                v-for="option in timeRangeOptions"
                :key="option.value"
                class="px-4 py-2 rounded-lg text-sm font-medium font-inter transition-all duration-300"
                :class="timeRange === option.value ? 'bg-primary text-white' : 'bg-dark-700/50 text-slate-400 hover:bg-dark-700 hover:text-white'"
                @click="timeRange = option.value as 1 | 6 | 24 | 168; fetchData()"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
          <div ref="chartRef" class="h-96"></div>
        </div>
      </div>

      <div v-else class="text-center py-12 text-slate-500">
        <p class="font-inter">未找到传感器数据</p>
      </div>
    </div>
  </div>
</template>
