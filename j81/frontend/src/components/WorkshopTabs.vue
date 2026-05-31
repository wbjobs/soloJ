<script setup lang="ts">
import { Building2 } from 'lucide-vue-next';

defineProps<{
  workshops: string[];
  selectedWorkshop: string | null;
  errorCounts: Record<string, number>;
}>();

const emit = defineEmits<{
  (e: 'select', workshopId: string | null): void;
}>();
</script>

<template>
  <div class="glass-card p-3 mb-6 animate-fade-in">
    <div class="flex flex-wrap gap-2">
      <button
        class="px-4 py-2.5 rounded-lg font-medium font-inter text-sm transition-all duration-300 flex items-center gap-2"
        :class="!selectedWorkshop ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-dark-700/50 text-slate-300 hover:bg-dark-700 hover:text-white'"
        @click="emit('select', null)"
      >
        <Building2 class="w-4 h-4" />
        全部车间
      </button>
      <button
        v-for="workshop in workshops"
        :key="workshop"
        class="px-4 py-2.5 rounded-lg font-medium font-inter text-sm transition-all duration-300 flex items-center gap-2 relative"
        :class="selectedWorkshop === workshop ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-dark-700/50 text-slate-300 hover:bg-dark-700 hover:text-white'"
        @click="emit('select', workshop)"
      >
        <Building2 class="w-4 h-4" />
        {{ workshop }}
        <span
          v-if="errorCounts[workshop] && errorCounts[workshop] > 0"
          class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-danger text-white text-xs font-bold flex items-center justify-center animate-pulse-slow"
        >
          {{ errorCounts[workshop] }}
        </span>
      </button>
    </div>
  </div>
</template>
