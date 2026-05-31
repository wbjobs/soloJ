<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { Thermometer, Activity, Zap, Clock, AlertTriangle } from 'lucide-vue-next';
import * as echarts from 'echarts';
import { onMounted, ref, watch, onUnmounted } from 'vue';
import type { SensorData, SensorStatus } from '@/types';

const props = defineProps<{
  sensor: SensorData;
  historyData?: SensorData[];
}>();

const router = useRouter();
const chartRef = ref<HTMLElement | null>(null);
let chartInstance: echarts.ECharts | null = null;

const ANOMALY_THRESHOLD = 5;

const statusConfig = computed(() => {
  if (props.sensor.isAlerting) {
    return {
      color: 'text-white',
      bgColor: 'bg-danger',
      borderColor: 'border-danger',
      label: '告警',
    };
  }
  
  const status = props.sensor.status || 'normal';
  const configs: Record<SensorStatus, { color: string; bgColor: string; label: string; borderColor: string }> = {
    normal: {
      color: 'text-success',
      bgColor: 'bg-success/20',
      borderColor: 'border-success/30',
      label: '正常',
    },
    warning: {
      color: 'text-warning',
      bgColor: 'bg-warning/20',
      borderColor: 'border-warning/30',
      label: '警告',
    },
    error: {
      color: 'text-danger',
      bgColor: 'bg-danger/20',
      borderColor: 'border-danger/30',
      label: '异常',
    },
  };
  return configs[status];
});

const consecutiveProgress = computed(() => {
  const count = props.sensor.consecutiveErrors || 0;
  return Math.min((count / ANOMALY_THRESHOLD) * 100, 100);
});

const showConsecutiveWarning = computed(() => {
  const count = props.sensor.consecutiveErrors || 0;
  return count >= 2 && count < ANOMALY_THRESHOLD && !props.sensor.isAlerting;
});

const alertTypeLabel = computed(() => {
  if (!props.sensor.alertType) return '';
  const labels: Record<string, string> = {
    temperature: '温度',
    vibration: '震动',
    voltage: '电压',
  };
  return labels[props.sensor.alertType] || props.sensor.alertType;
});

const initChart = () => {
  if (!chartRef.value) return;
  
  if (chartInstance) {
    chartInstance.dispose();
  }
  
  chartInstance = echarts.init(chartRef.value);
  
  const history = props.historyData || [];
  const tempData = history.length > 0 
    ? history.map(h => h.temperature).slice(-10) 
    : [props.sensor.temperature];
  const times = history.length > 0 
    ? history.map(h => h.timestamp).slice(-10) 
    : [props.sensor.timestamp];
  
  const minVal = Math.min(...tempData) - 2;
  const maxVal = Math.max(...tempData) + 2;
  
  const lineColor = props.sensor.isAlerting 
    ? '#ef4444' 
    : props.sensor.status === 'error' 
      ? '#ef4444' 
      : props.sensor.status === 'warning' 
        ? '#f59e0b' 
        : '#10b981';
  
  const areaColor = props.sensor.isAlerting 
    ? 'rgba(239, 68, 68, 0.5)' 
    : props.sensor.status === 'error' 
      ? 'rgba(239, 68, 68, 0.3)' 
      : props.sensor.status === 'warning' 
        ? 'rgba(245, 158, 11, 0.3)' 
        : 'rgba(16, 185, 129, 0.3)';
  
  const option = {
    grid: {
      left: 0,
      right: 0,
      top: 5,
      bottom: 0,
    },
    xAxis: {
      type: 'category',
      show: false,
      data: times,
    },
    yAxis: {
      type: 'value',
      show: false,
      min: minVal,
      max: maxVal,
    },
    series: [
      {
        data: tempData,
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: {
          color: lineColor,
          width: props.sensor.isAlerting ? 3 : 2,
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: areaColor },
            { offset: 1, color: 'rgba(0, 0, 0, 0)' },
          ]),
        },
      },
    ],
  };
  
  chartInstance.setOption(option);
};

const handleClick = () => {
  router.push(`/sensor/${props.sensor.workshop}/${props.sensor.sensorId}`);
};

const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

onMounted(() => {
  initChart();
  window.addEventListener('resize', () => {
    chartInstance?.resize();
  });
});

watch(() => [props.sensor, props.historyData], () => {
  initChart();
}, { deep: true });

onUnmounted(() => {
  chartInstance?.dispose();
});
</script>

<template>
  <div
    class="glass-card-hover p-5 cursor-pointer animate-fade-in relative overflow-hidden"
    :class="[
      statusConfig.borderColor,
      sensor.isAlerting ? 'animate-alert-flash border-2 border-danger shadow-lg shadow-danger/40' : '',
      !sensor.isAlerting && sensor.status === 'error' ? 'animate-breathe border-danger' : '',
      sensor.status === 'warning' ? 'border-warning' : ''
    ]"
    @click="handleClick"
  >
    <div 
      v-if="sensor.isAlerting"
      class="absolute inset-0 bg-gradient-to-r from-transparent via-danger/20 to-transparent animate-sweep"
    ></div>
    
    <div class="relative z-10">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <div
            class="status-dot"
            :class="[
              sensor.isAlerting ? 'bg-danger animate-alert-pulse' :
              sensor.status === 'error' ? 'bg-danger animate-pulse-slow' : 
              sensor.status === 'warning' ? 'bg-warning' : 'bg-success'
            ]"
          ></div>
          <span class="font-orbitron font-bold text-lg">{{ sensor.sensorId }}</span>
          <AlertTriangle 
            v-if="sensor.isAlerting" 
            class="w-4 h-4 text-danger animate-alert-pulse" 
          />
        </div>
        <span
          class="px-2 py-1 rounded text-xs font-medium"
          :class="[
            statusConfig.color, 
            statusConfig.bgColor,
            sensor.isAlerting ? 'animate-alert-pulse' : ''
          ]"
        >
          {{ statusConfig.label }}
        </span>
      </div>

      <div 
        v-if="sensor.isAlerting && sensor.alertType"
        class="bg-danger/20 border border-danger/50 rounded-lg p-2 mb-3"
      >
        <p class="text-xs text-danger font-medium">
          ⚠️ {{ alertTypeLabel }}连续告警 ({{ sensor.consecutiveErrors }}次)
        </p>
        <p class="text-xs text-danger/80 mt-0.5">
          当前值: {{ sensor.alertValue?.toFixed(2) }} / 阈值: {{ sensor.alertThreshold?.toFixed(2) }}
        </p>
      </div>

      <div 
        v-else-if="showConsecutiveWarning"
        class="bg-warning/20 border border-warning/50 rounded-lg p-2 mb-3"
      >
        <p class="text-xs text-warning font-medium">
          ⚡ 连续异常 {{ sensor.consecutiveErrors }}/{{ ANOMALY_THRESHOLD }}，即将触发告警
        </p>
        <div class="w-full bg-dark-700 rounded-full h-1.5 mt-2">
          <div 
            class="bg-warning h-1.5 rounded-full transition-all duration-300"
            :style="{ width: `${consecutiveProgress}%` }"
          ></div>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-3 mb-4">
        <div class="text-center">
          <Thermometer class="w-4 h-4 mx-auto mb-1" :class="sensor.alertType === 'temperature' ? 'text-danger' : 'text-warning'" />
          <p 
            class="font-orbitron text-xl font-bold" 
            :class="[
              sensor.alertType === 'temperature' ? 'text-danger animate-alert-pulse' : 
              sensor.temperature >= 50 ? 'text-danger' : 
              sensor.temperature >= 40 ? 'text-warning' : 
              'text-slate-100'
            ]"
          >
            {{ sensor.temperature }}<span class="text-xs">°C</span>
          </p>
        </div>
        <div class="text-center">
          <Activity class="w-4 h-4 mx-auto mb-1" :class="sensor.alertType === 'vibration' ? 'text-danger' : 'text-primary'" />
          <p 
            class="font-orbitron text-xl font-bold" 
            :class="[
              sensor.alertType === 'vibration' ? 'text-danger animate-alert-pulse' :
              sensor.vibration >= 150 ? 'text-danger' : 
              sensor.vibration >= 100 ? 'text-warning' : 
              'text-slate-100'
            ]"
          >
            {{ sensor.vibration }}<span class="text-xs">Hz</span>
          </p>
        </div>
        <div class="text-center">
          <Zap class="w-4 h-4 mx-auto mb-1" :class="sensor.alertType === 'voltage' ? 'text-danger' : 'text-success'" />
          <p 
            class="font-orbitron text-xl font-bold" 
            :class="[
              sensor.alertType === 'voltage' ? 'text-danger animate-alert-pulse' :
              (sensor.voltage >= 250 || sensor.voltage <= 190) ? 'text-danger' : 
              (sensor.voltage >= 240 || sensor.voltage <= 200) ? 'text-warning' : 
              'text-slate-100'
            ]"
          >
            {{ sensor.voltage }}<span class="text-xs">V</span>
          </p>
        </div>
      </div>

      <div ref="chartRef" class="h-12 mb-3"></div>

      <div class="flex items-center justify-between text-xs text-slate-400">
        <span class="flex items-center gap-1">
          <Clock class="w-3 h-3" />
          {{ formatTime(sensor.timestamp) }}
        </span>
        <span 
          class="font-inter flex items-center gap-1"
          :class="sensor.consecutiveErrors && sensor.consecutiveErrors >= 2 ? 'text-danger' : ''"
        >
          {{ sensor.workshop }}
          <span v-if="sensor.consecutiveErrors && sensor.consecutiveErrors >= 2" class="font-bold">
            ({{ sensor.consecutiveErrors }})
          </span>
        </span>
      </div>
    </div>
  </div>
</template>
