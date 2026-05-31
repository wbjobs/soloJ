<script setup lang="ts">
import { Thermometer, Activity, Zap, AlertTriangle } from 'lucide-vue-next';
import type { SensorStats } from '@/types';

defineProps<{
  stats: SensorStats;
}>();
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    <div class="glass-card-hover p-5 animate-fade-in" style="animation-delay: 0.1s">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-slate-400 text-sm font-inter mb-1">平均温度</p>
          <p class="font-orbitron text-3xl font-bold text-warning animate-number-scroll" :key="stats.avgTemperature">
            {{ stats.avgTemperature }}<span class="text-lg">°C</span>
          </p>
        </div>
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-warning/20 to-orange-500/20 flex items-center justify-center">
          <Thermometer class="w-6 h-6 text-warning" />
        </div>
      </div>
      <div class="mt-3 h-1.5 bg-dark-700 rounded-full overflow-hidden">
        <div
          class="h-full bg-gradient-to-r from-warning to-orange-500 rounded-full transition-all duration-500"
          :style="{ width: `${Math.min(stats.avgTemperature / 60 * 100, 100)}%` }"
        ></div>
      </div>
    </div>

    <div class="glass-card-hover p-5 animate-fade-in" style="animation-delay: 0.2s">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-slate-400 text-sm font-inter mb-1">平均震动</p>
          <p class="font-orbitron text-3xl font-bold text-primary animate-number-scroll" :key="stats.avgVibration">
            {{ stats.avgVibration }}<span class="text-lg">Hz</span>
          </p>
        </div>
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-cyan-500/20 flex items-center justify-center">
          <Activity class="w-6 h-6 text-primary" />
        </div>
      </div>
      <div class="mt-3 h-1.5 bg-dark-700 rounded-full overflow-hidden">
        <div
          class="h-full bg-gradient-to-r from-primary to-cyan-500 rounded-full transition-all duration-500"
          :style="{ width: `${Math.min(stats.avgVibration / 150 * 100, 100)}%` }"
        ></div>
      </div>
    </div>

    <div class="glass-card-hover p-5 animate-fade-in" style="animation-delay: 0.3s">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-slate-400 text-sm font-inter mb-1">平均电压</p>
          <p class="font-orbitron text-3xl font-bold text-success animate-number-scroll" :key="stats.avgVoltage">
            {{ stats.avgVoltage }}<span class="text-lg">V</span>
          </p>
        </div>
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-success/20 to-emerald-500/20 flex items-center justify-center">
          <Zap class="w-6 h-6 text-success" />
        </div>
      </div>
      <div class="mt-3 h-1.5 bg-dark-700 rounded-full overflow-hidden">
        <div
          class="h-full bg-gradient-to-r from-success to-emerald-500 rounded-full transition-all duration-500"
          :style="{ width: `${Math.min(Math.abs(stats.avgVoltage - 180) / 100 * 100, 100)}%` }"
        ></div>
      </div>
    </div>

    <div class="glass-card-hover p-5 animate-fade-in" style="animation-delay: 0.4s">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-slate-400 text-sm font-inter mb-1">异常传感器</p>
          <p class="font-orbitron text-3xl font-bold animate-number-scroll" :class="stats.errorCount > 0 ? 'text-danger' : 'text-success'" :key="stats.errorCount">
            {{ stats.errorCount + stats.warningCount }}
          </p>
          <p class="text-xs text-slate-400 font-inter">
            <span class="text-danger">{{ stats.errorCount }} 异常</span>
            <span class="mx-1">/</span>
            <span class="text-warning">{{ stats.warningCount }} 警告</span>
          </p>
        </div>
        <div
          class="w-12 h-12 rounded-xl bg-gradient-to-br from-danger/20 to-red-500/20 flex items-center justify-center"
          :class="{ 'animate-breathe text-danger': stats.errorCount > 0 }"
        >
          <AlertTriangle class="w-6 h-6" :class="stats.errorCount > 0 ? 'text-danger' : 'text-success'" />
        </div>
      </div>
      <div class="mt-3 h-1.5 bg-dark-700 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-500"
          :class="stats.errorCount > 0 ? 'bg-gradient-to-r from-danger to-red-500' : 'bg-gradient-to-r from-success to-emerald-500'"
          :style="{ width: `${Math.min((stats.errorCount + stats.warningCount) / Math.max(stats.normalCount + stats.warningCount + stats.errorCount, 1) * 100, 100)}%` }"
        ></div>
      </div>
    </div>
  </div>
</template>
