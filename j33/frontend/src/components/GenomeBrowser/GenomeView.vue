<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useBrowserStore } from '@/stores/browser'
import { fetchCoverage, fetchVariants } from '@/api'
import { useGenomeRenderer } from '@/composables/useGenomeRenderer'
import ChromosomeSelector from './ChromosomeSelector.vue'
import TrackControls from './TrackControls.vue'

const browserStore = useBrowserStore()
const { currentChrom, regionStart, regionEnd, tracks, activeFileId } = storeToRefs(browserStore)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const canvasWidth = ref(800)
const canvasHeight = ref(400)

const renderer = useGenomeRenderer({
  canvasRef,
  width: canvasWidth,
  height: canvasHeight,
  chrom: currentChrom,
  regionStart,
  regionEnd,
  tracks,
  onVariantClick: (variant) => browserStore.selectVariant(variant),
  onRegionChange: (start, end) => browserStore.navigateTo(currentChrom.value, start, end),
})

async function loadRegionData() {
  if (!activeFileId.value) return
  try {
    const [coverage, variants] = await Promise.all([
      fetchCoverage(
        activeFileId.value,
        currentChrom.value,
        regionStart.value,
        regionEnd.value
      ),
      fetchVariants(
        activeFileId.value,
        currentChrom.value,
        regionStart.value,
        regionEnd.value
      ),
    ])
    renderer.setCoverageData(coverage)
    renderer.setVariantsData(variants)
    browserStore.setCoverageData(coverage)
    browserStore.setVariantsData(variants)
    renderer.render()
  } catch {
    renderer.setCoverageData([])
    renderer.setVariantsData([])
    renderer.render()
  }
}

function updateSize() {
  if (!containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  canvasWidth.value = Math.floor(rect.width)
  const trackH = tracks.value
    .filter((t) => t.visible)
    .reduce((sum, t) => sum + t.height, 28)
  canvasHeight.value = Math.max(trackH, 200)
}

let resizeObserver: ResizeObserver | null = null

onMounted(async () => {
  updateSize()
  await renderer.init()
  if (activeFileId.value) loadRegionData()
  resizeObserver = new ResizeObserver(() => {
    updateSize()
    renderer.resize(canvasWidth.value, canvasHeight.value)
  })
  if (containerRef.value) resizeObserver.observe(containerRef.value)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  renderer.destroy()
})

watch(
  () => [currentChrom.value, regionStart.value, regionEnd.value, activeFileId.value],
  () => { loadRegionData() }
)

watch(
  () => tracks.value.map((t) => `${t.id}:${t.visible}:${t.height}`).join(','),
  () => {
    updateSize()
    renderer.resize(canvasWidth.value, canvasHeight.value)
  }
)
</script>

<template>
  <div class="flex flex-col h-full bg-genome-surface rounded-lg border border-genome-border overflow-hidden">
    <div class="flex items-center gap-3 px-4 py-2 border-b border-genome-border bg-genome-surface-2">
      <ChromosomeSelector />
      <div class="flex items-center gap-2 ml-auto">
        <TrackControls />
        <div class="flex items-center rounded-lg overflow-hidden border border-genome-border">
          <button
            class="px-2 py-1 text-xs transition-colors"
            :class="browserStore.viewMode === 'standard'
              ? 'bg-genome-blue/20 text-genome-blue'
              : 'bg-genome-surface text-genome-text-dim hover:bg-genome-surface-2'"
            @click="browserStore.setViewMode('standard')"
          >标准</button>
          <button
            class="px-2 py-1 text-xs transition-colors"
            :class="browserStore.viewMode === 'heatmap'
              ? 'bg-genome-blue/20 text-genome-blue'
              : 'bg-genome-surface text-genome-text-dim hover:bg-genome-surface-2'"
            @click="browserStore.setViewMode('heatmap')"
          >热力图</button>
        </div>
        <button
          class="px-2 py-1 text-xs rounded bg-genome-surface hover:bg-genome-blue/20 text-genome-text-muted hover:text-genome-blue transition-colors"
          @click="() => browserStore.zoomIn()"
        >+</button>
        <button
          class="px-2 py-1 text-xs rounded bg-genome-surface hover:bg-genome-blue/20 text-genome-text-muted hover:text-genome-blue transition-colors"
          @click="() => browserStore.zoomOut()"
        >−</button>
      </div>
    </div>
    <div ref="containerRef" class="flex-1 relative">
      <canvas ref="canvasRef" class="w-full h-full" />
      <div
        v-if="!activeFileId"
        class="absolute inset-0 flex items-center justify-center text-genome-text-dim text-sm"
      >
        请先上传或选择一个文件以查看基因组数据
      </div>
    </div>
  </div>
</template>
