<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Activity, Wifi } from 'lucide-vue-next';

defineProps<{
  onlineCount: number;
}>();

const currentTime = ref(new Date());
let timer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  timer = setInterval(() => {
    currentTime.value = new Date();
  }, 1000);
});

onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
  }
});

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

const formatDate = (date: Date) => {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
};
</script>

<template>
  <header class="glass-card px-6 py-4 mb-6 animate-fade-in">
    <div class="flex flex-col md:flex-row items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-cyan-400 flex items-center justify-center animate-glow">
          <Activity class="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 class="font-orbitron text-2xl md:text-3xl font-bold text-primary glow-text">
            IoT Sensor Monitor
          </h1>
          <p class="text-slate-400 text-sm font-inter">Industrial Real-time Monitoring System</p>
        </div>
      </div>
      <div class="flex items-center gap-6">
        <div class="flex items-center gap-2 px-4 py-2 rounded-lg bg-dark-700/50">
          <Wifi class="w-5 h-5 text-success animate-pulse-slow" />
          <span class="font-orbitron text-sm text-slate-300">
            Online: <span class="text-success font-bold">{{ onlineCount }}</span>
          </span>
        </div>
        <div class="text-right">
          <div class="font-orbitron text-xl text-primary animate-pulse-slow">
            {{ formatTime(currentTime) }}
          </div>
          <div class="text-xs text-slate-400 font-inter">
            {{ formatDate(currentTime) }}
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
