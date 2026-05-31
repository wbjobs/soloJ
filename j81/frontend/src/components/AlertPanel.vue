<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { AlertTriangle, Clock, Building2, Thermometer, Activity, Zap } from 'lucide-vue-next';
import type { AlertRecord } from '@/types';

const props = defineProps<{
  alerts: AlertRecord[];
}>();

const containerRef = ref<HTMLElement | null>(null);

const typeIcons = {
  temperature: Thermometer,
  vibration: Activity,
  voltage: Zap,
};

const typeNames = {
  temperature: '温度',
  vibration: '震动',
  voltage: '电压',
};

const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

watch(() => props.alerts, async () => {
  await nextTick();
  if (containerRef.value) {
    containerRef.value.scrollTop = 0;
  }
}, { deep: true });
</script>

<template>
  <div class="glass-card p-5 animate-fade-in h-full flex flex-col">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-orbitron text-lg font-bold text-slate-100 flex items-center gap-2">
        <AlertTriangle class="w-5 h-5 text-danger animate-pulse-slow" />
        实时告警
      </h3>
      <span v-if="alerts.length > 0" class="px-2 py-1 rounded-full bg-danger/20 text-danger text-xs font-bold font-inter animate-pulse-slow">
        {{ alerts.length }} 条
      </span>
    </div>

    <div ref="containerRef" class="flex-1 overflow-y-auto space-y-3 pr-1 max-h-96">
      <div
        v-for="(alert, index) in alerts.slice(0, 20)"
        :key="alert.id"
        class="p-3 rounded-lg transition-all duration-300 animate-fade-in"
        :class="alert.status === 'error' ? 'bg-danger/10 border border-danger/30' : 'bg-warning/10 border border-warning/30'"
        :style="{ animationDelay: `${index * 0.05}s` }"
      >
        <div class="flex items-start gap-3">
          <div
            class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            :class="alert.status === 'error' ? 'bg-danger/20 text-danger animate-pulse-slow' : 'bg-warning/20 text-warning'"
          >
            <component :is="typeIcons[alert.type]" class="w-4 h-4" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2 mb-1">
              <span class="font-orbitron font-bold text-sm truncate">
                {{ alert.sensorId }}
              </span>
              <span
                class="px-1.5 py-0.5 rounded text-xs font-bold flex-shrink-0"
                :class="alert.status === 'error' ? 'bg-danger/30 text-danger' : 'bg-warning/30 text-warning'"
              >
                {{ alert.status === 'error' ? '异常' : '警告' }}
              </span>
            </div>
            <div class="text-xs text-slate-400 font-inter space-y-1">
              <div class="flex items-center gap-1.5">
                <Building2 class="w-3 h-3" />
                <span class="truncate">{{ alert.workshop }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <Clock class="w-3 h-3" />
                <span>{{ formatTime(alert.timestamp) }}</span>
              </div>
              <div class="text-sm mt-1.5">
                <span class="text-slate-300">{{ typeNames[alert.type] }}:</span>
                <span
                  class="font-orbitron font-bold ml-1"
                  :class="alert.status === 'error' ? 'text-danger' : 'text-warning'"
                >
                  {{ alert.value }}
                  <span class="text-xs">
                    {{ alert.type === 'temperature' ? '°C' : alert.type === 'vibration' ? 'Hz' : 'V' }}
                  </span>
                </span>
                <span class="text-slate-500 text-xs ml-1">
                  (阈值: {{ alert.threshold }})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="alerts.length === 0" class="flex flex-col items-center justify-center py-12 text-slate-500">
        <AlertTriangle class="w-12 h-12 mb-3 opacity-30" />
        <p class="font-inter text-sm">暂无告警信息</p>
        <p class="font-inter text-xs mt-1">所有传感器运行正常</p>
      </div>
    </div>
  </div>
</template>
