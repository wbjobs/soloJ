<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Application, Container, Graphics } from 'pixi.js'
import { useBrowserStore } from '@/stores/browser'
import { useFilesStore } from '@/stores/files'
import { fetchCoverage } from '@/api'
import type { CoveragePoint } from '@/types'

const props = defineProps<{
  fileAId: string
  fileBId: string
}>()

const browserStore = useBrowserStore()
const filesStore = useFilesStore()
const canvasARef = ref<HTMLCanvasElement | null>(null)
const canvasBRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const width = ref(800)
const trackHeight = 120

let appA: Application | null = null
let appB: Application | null = null
let coverageA: CoveragePoint[] = []
let coverageB: CoveragePoint[] = []

const buildA = computed(() => filesStore.getFileById(props.fileAId)?.genomeBuild)
const buildB = computed(() => filesStore.getFileById(props.fileBId)?.genomeBuild)

async function loadData() {
  if (!props.fileAId || !props.fileBId) return
  try {
    const [dataA, dataB] = await Promise.all([
      fetchCoverage(props.fileAId, browserStore.currentChrom, browserStore.regionStart, browserStore.regionEnd),
      fetchCoverage(props.fileBId, browserStore.currentChrom, browserStore.regionStart, browserStore.regionEnd),
    ])
    coverageA = dataA
    coverageB = dataB
    renderTracks()
  } catch {
    coverageA = []
    coverageB = []
    renderTracks()
  }
}

function renderTrack(app: Application | null, data: CoveragePoint[], color: number) {
  if (!app) return
  const container = app.stage.getChildAt(0) as Container
  container.removeChildren()

  if (data.length < 2) return
  const g = new Graphics()
  const maxDepth = Math.max(...data.map((p) => p.depth), 1)
  const span = browserStore.regionEnd - browserStore.regionStart
  if (span === 0) return

  g.beginFill(color, 0.15)
  g.moveTo(0, trackHeight)
  for (const p of data) {
    const x = ((p.position - browserStore.regionStart) / span) * width.value
    const y = trackHeight - (p.depth / maxDepth) * (trackHeight - 4)
    g.lineTo(x, y)
  }
  g.lineTo(width.value, trackHeight)
  g.closePath()
  g.endFill()

  g.lineStyle(1.5, color, 0.8)
  for (let i = 0; i < data.length; i++) {
    const x = ((data[i].position - browserStore.regionStart) / span) * width.value
    const y = trackHeight - (data[i].depth / maxDepth) * (trackHeight - 4)
    if (i === 0) g.moveTo(x, y)
    else g.lineTo(x, y)
  }

  container.addChild(g)
}

function renderTracks() {
  renderTrack(appA, coverageA, 0x165DFF)
  renderTrack(appB, coverageB, 0x00B42A)
}

async function initApp(canvas: HTMLCanvasElement | null): Promise<Application | null> {
  if (!canvas) return null
  const app = new Application({
    view: canvas,
    width: width.value,
    height: trackHeight,
    backgroundColor: 0x111827,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  })
  app.stage.addChild(new Container())
  return app
}

let resizeObserver: ResizeObserver | null = null

onMounted(async () => {
  if (containerRef.value) {
    width.value = Math.floor(containerRef.value.getBoundingClientRect().width)
  }
  appA = await initApp(canvasARef.value)
  appB = await initApp(canvasBRef.value)
  loadData()
  resizeObserver = new ResizeObserver(() => {
    if (!containerRef.value) return
    width.value = Math.floor(containerRef.value.getBoundingClientRect().width)
    appA?.renderer.resize(width.value, trackHeight)
    appB?.renderer.resize(width.value, trackHeight)
    renderTracks()
  })
  if (containerRef.value) resizeObserver.observe(containerRef.value)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  appA?.destroy(true)
  appB?.destroy(true)
})

watch(
  () => [browserStore.currentChrom, browserStore.regionStart, browserStore.regionEnd],
  () => loadData()
)
</script>

<template>
  <div ref="containerRef" class="space-y-2">
    <div class="flex items-center gap-2 text-xs text-genome-text-muted mb-1">
      <span class="w-2 h-2 rounded-full bg-genome-blue" /> 样本 A<span v-if="buildA" class="text-genome-text-dim font-mono ml-1">[{{ buildA }}]</span>
      <span class="w-2 h-2 rounded-full bg-genome-green ml-3" /> 样本 B<span v-if="buildB" class="text-genome-text-dim font-mono ml-1">[{{ buildB }}]</span>
    </div>
    <div class="bg-genome-surface rounded-lg border border-genome-border overflow-hidden">
      <canvas ref="canvasARef" class="w-full" :style="{ height: trackHeight + 'px' }" />
    </div>
    <div class="bg-genome-surface rounded-lg border border-genome-border overflow-hidden">
      <canvas ref="canvasBRef" class="w-full" :style="{ height: trackHeight + 'px' }" />
    </div>
  </div>
</template>
