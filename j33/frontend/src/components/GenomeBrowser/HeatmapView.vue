<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useBrowserStore } from '@/stores/browser'
import { fetchHeatmapData } from '@/api'
import { useHeatmapRenderer } from '@/composables/useHeatmapRenderer'
import ChromosomeSelector from './ChromosomeSelector.vue'

const browserStore = useBrowserStore()
const { currentChrom, regionStart, regionEnd, heatmapCells, activeFileId } = storeToRefs(browserStore)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const canvasWidth = ref(800)
const canvasHeight = ref(400)

const renderer = useHeatmapRenderer({
  canvasRef,
  width: canvasWidth,
  height: canvasHeight,
  chrom: currentChrom,
  regionStart,
  regionEnd,
  heatmapCells,
  onCellClick: (cell) => {
    browserStore.navigateTo(currentChrom.value, cell.start, cell.end)
  },
  onRegionChange: (start, end) => browserStore.navigateTo(currentChrom.value, start, end),
})

async function loadHeatmapData() {
  if (!activeFileId.value) return
  try {
    const data = await fetchHeatmapData(
      activeFileId.value,
      currentChrom.value,
      regionStart.value,
      regionEnd.value
    )
    browserStore.setHeatmapCells(data)
    renderer.render()
  } catch {
    browserStore.setHeatmapCells([])
    renderer.render()
  }
}

function updateSize() {
  if (!containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  canvasWidth.value = Math.floor(rect.width)
  canvasHeight.value = Math.max(Math.floor(rect.height), 200)
}

let resizeObserver: ResizeObserver | null = null

onMounted(async () => {
  updateSize()
  await renderer.init()
  if (activeFileId.value) loadHeatmapData()
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
  () => { loadHeatmapData() }
)
</script>

<template>
  <div class="flex flex-col h-full bg-genome-surface rounded-lg border border-genome-border overflow-hidden">
    <div class="flex items-center gap-3 px-4 py-2 border-b border-genome-border bg-genome-surface-2">
      <ChromosomeSelector />
      <div class="flex items-center gap-2 ml-auto">
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
        请先上传或选择一个文件以查看热力图数据
      </div>
    </div>
    <div class="flex items-center gap-2 px-4 py-2 border-t border-genome-border bg-genome-surface-2">
      <span class="text-[10px] text-genome-text-dim">低</span>
      <div class="flex h-3 flex-1 rounded overflow-hidden">
        <div class="flex-1" style="background: #0A0E1A" />
        <div class="flex-1" style="background: #165DFF" />
        <div class="flex-1" style="background: #00B42A" />
        <div class="flex-1" style="background: #FF7D00" />
        <div class="flex-1" style="background: #F53F3F" />
      </div>
      <span class="text-[10px] text-genome-text-dim">高</span>
      <span class="text-[10px] text-genome-text-dim ml-2">富集分数</span>
    </div>
  </div>
</template>
