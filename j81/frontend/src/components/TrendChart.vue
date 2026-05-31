<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted, computed } from 'vue';
import * as echarts from 'echarts';
import type { SensorData } from '@/types';

const props = defineProps<{
  data: SensorData[];
  title?: string;
  metric?: 'all' | 'temperature' | 'vibration' | 'voltage';
}>();

const chartRef = ref<HTMLElement | null>(null);
let chartInstance: echarts.ECharts | null = null;
const currentMetric = ref<'all' | 'temperature' | 'vibration' | 'voltage'>(props.metric || 'all');

const metricColors = {
  temperature: '#f59e0b',
  vibration: '#0ea5e9',
  voltage: '#10b981',
};

const metricNames = {
  temperature: '温度',
  vibration: '震动',
  voltage: '电压',
};

const metricUnits = {
  temperature: '°C',
  vibration: 'Hz',
  voltage: 'V',
};

const initChart = () => {
  if (!chartRef.value || props.data.length === 0) return;

  if (chartInstance) {
    chartInstance.dispose();
  }

  chartInstance = echarts.init(chartRef.value);

  const timestamps = props.data.map((d) =>
    new Date(d.timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  );

  const series: echarts.SeriesOption[] = [];

  if (currentMetric.value === 'all' || currentMetric.value === 'temperature') {
    series.push({
      name: '温度',
      type: 'line',
      smooth: true,
      data: props.data.map((d) => d.temperature),
      lineStyle: {
        color: metricColors.temperature,
        width: 3,
      },
      itemStyle: {
        color: metricColors.temperature,
      },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(245, 158, 11, 0.4)' },
          { offset: 1, color: 'rgba(245, 158, 11, 0.05)' },
        ]),
      },
      animation: true,
      animationDuration: 1000,
      showSymbol: true,
      symbolSize: 6,
    });
  }

  if (currentMetric.value === 'all' || currentMetric.value === 'vibration') {
    series.push({
      name: '震动',
      type: 'line',
      smooth: true,
      data: props.data.map((d) => d.vibration),
      lineStyle: {
        color: metricColors.vibration,
        width: 3,
      },
      itemStyle: {
        color: metricColors.vibration,
      },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(14, 165, 233, 0.4)' },
          { offset: 1, color: 'rgba(14, 165, 233, 0.05)' },
        ]),
      },
      animation: true,
      animationDuration: 1000,
      animationDelay: 300,
      showSymbol: true,
      symbolSize: 6,
    });
  }

  if (currentMetric.value === 'all' || currentMetric.value === 'voltage') {
    series.push({
      name: '电压',
      type: 'line',
      smooth: true,
      data: props.data.map((d) => d.voltage),
      lineStyle: {
        color: metricColors.voltage,
        width: 3,
      },
      itemStyle: {
        color: metricColors.voltage,
      },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(16, 185, 129, 0.4)' },
          { offset: 1, color: 'rgba(16, 185, 129, 0.05)' },
        ]),
      },
      animation: true,
      animationDuration: 1000,
      animationDelay: 600,
      showSymbol: true,
      symbolSize: 6,
    });
  }

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    title: {
      text: props.title || '历史趋势',
      textStyle: {
        color: '#e2e8f0',
        fontSize: 16,
        fontFamily: 'Orbitron, sans-serif',
      },
      left: 20,
      top: 10,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(30, 41, 59, 0.95)',
      borderColor: 'rgba(14, 165, 233, 0.3)',
      textStyle: {
        color: '#e2e8f0',
        fontFamily: 'Inter, sans-serif',
      },
      formatter: (params: any) => {
        let result = `<div style="font-weight: bold; margin-bottom: 8px;">${params[0].axisValue}</div>`;
        params.forEach((item: any) => {
          const unit = metricUnits[item.seriesName as keyof typeof metricUnits] || '';
          result += `<div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${item.color};"></span>
            <span>${item.seriesName}:</span>
            <span style="font-weight: bold; color: ${item.color};">${item.value}${unit}</span>
          </div>`;
        });
        return result;
      },
    },
    legend: {
      data: currentMetric.value === 'all' ? ['温度', '震动', '电压'] : [metricNames[currentMetric.value]],
      textStyle: {
        color: '#94a3b8',
        fontFamily: 'Inter, sans-serif',
      },
      top: 10,
      right: 20,
    },
    grid: {
      left: 60,
      right: 30,
      top: 60,
      bottom: 40,
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
    yAxis: {
      type: 'value',
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
    series,
  };

  chartInstance.setOption(option);
};

const switchMetric = (metric: 'all' | 'temperature' | 'vibration' | 'voltage') => {
  currentMetric.value = metric;
  initChart();
};

onMounted(() => {
  initChart();
  window.addEventListener('resize', () => {
    chartInstance?.resize();
  });
});

watch(() => [props.data, props.metric], () => {
  if (props.metric) {
    currentMetric.value = props.metric;
  }
  initChart();
}, { deep: true });

onUnmounted(() => {
  chartInstance?.dispose();
});
</script>

<template>
  <div class="glass-card p-5 animate-fade-in">
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <h3 class="font-orbitron text-lg font-bold text-slate-100">
        {{ title || '历史趋势' }}
      </h3>
      <div class="flex gap-2">
        <button
          v-for="m in (['all', 'temperature', 'vibration', 'voltage'] as const)"
          :key="m"
          class="px-3 py-1.5 rounded-lg text-xs font-medium font-inter transition-all duration-300"
          :class="currentMetric === m ? 'bg-primary text-white' : 'bg-dark-700/50 text-slate-400 hover:bg-dark-700 hover:text-white'"
          @click="switchMetric(m)"
        >
          {{ m === 'all' ? '全部' : metricNames[m] }}
        </button>
      </div>
    </div>
    <div ref="chartRef" class="h-80"></div>
  </div>
</template>
