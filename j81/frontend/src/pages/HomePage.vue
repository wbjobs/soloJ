<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useSensorData } from '@/composables/useSensorData';
import HeaderBar from '@/components/HeaderBar.vue';
import StatsCards from '@/components/StatsCards.vue';
import WorkshopTabs from '@/components/WorkshopTabs.vue';
import SensorCard from '@/components/SensorCard.vue';
import TrendChart from '@/components/TrendChart.vue';
import AlertPanel from '@/components/AlertPanel.vue';

const route = useRoute();

const {
  workshops,
  alerts,
  loading,
  selectedWorkshop,
  stats,
  filteredData,
  workshopErrorCounts,
  selectWorkshop,
  getSensorHistory,
} = useSensorData();

const workshopId = computed(() => route.params.id as string);

onMounted(() => {
  if (workshopId.value) {
    selectWorkshop(workshopId.value);
  }
});

const skeletonCount = 8;
</script>

<template>
  <div class="min-h-screen p-4 md:p-6 lg:p-8">
    <div class="max-w-7xl mx-auto">
      <HeaderBar :online-count="stats.normalCount + stats.warningCount + stats.errorCount" />
      
      <StatsCards :stats="stats" />
      
      <WorkshopTabs
        :workshops="workshops"
        :selected-workshop="selectedWorkshop"
        :error-counts="workshopErrorCounts"
        @select="selectWorkshop"
      />

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div class="lg:col-span-2">
          <div class="glass-card p-5 animate-fade-in">
            <h3 class="font-orbitron text-lg font-bold text-slate-100 mb-4">传感器列表</h3>
            
            <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div
                v-for="i in skeletonCount"
                :key="i"
                class="bg-dark-800/60 backdrop-blur-md border border-white/10 rounded-xl p-5 animate-pulse"
              >
                <div class="flex items-center justify-between mb-4">
                  <div class="flex items-center gap-2">
                    <div class="w-3 h-3 rounded-full bg-dark-700"></div>
                    <div class="h-5 w-20 bg-dark-700 rounded"></div>
                  </div>
                  <div class="h-6 w-12 bg-dark-700 rounded"></div>
                </div>
                <div class="grid grid-cols-3 gap-3 mb-4">
                  <div class="text-center">
                    <div class="h-4 w-4 mx-auto mb-1 bg-dark-700 rounded"></div>
                    <div class="h-6 w-12 mx-auto bg-dark-700 rounded"></div>
                  </div>
                  <div class="text-center">
                    <div class="h-4 w-4 mx-auto mb-1 bg-dark-700 rounded"></div>
                    <div class="h-6 w-12 mx-auto bg-dark-700 rounded"></div>
                  </div>
                  <div class="text-center">
                    <div class="h-4 w-4 mx-auto mb-1 bg-dark-700 rounded"></div>
                    <div class="h-6 w-12 mx-auto bg-dark-700 rounded"></div>
                  </div>
                </div>
                <div class="h-12 bg-dark-700 rounded mb-3"></div>
                <div class="flex justify-between">
                  <div class="h-4 w-16 bg-dark-700 rounded"></div>
                  <div class="h-4 w-16 bg-dark-700 rounded"></div>
                </div>
              </div>
            </div>

            <div v-else class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <SensorCard
                v-for="sensor in filteredData"
                :key="`${sensor.workshop}-${sensor.sensorId}`"
                :sensor="sensor"
                :history-data="getSensorHistory(sensor.workshop, sensor.sensorId)"
              />
            </div>

            <div v-if="!loading && filteredData.length === 0" class="text-center py-12 text-slate-500">
              <p class="font-inter">暂无传感器数据</p>
            </div>
          </div>
        </div>

        <div class="lg:col-span-1">
          <AlertPanel :alerts="alerts" />
        </div>
      </div>
    </div>
  </div>
</template>
