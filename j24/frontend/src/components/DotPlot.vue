<template>
  <div class="dot-plot-wrapper" ref="wrapperRef">
    <div class="dot-plot-toolbar">
      <span class="dot-info">
        <span v-if="loading">计算中... {{ progress.stage }} ({{ progress.percent.toFixed(0) }}%)</span>
        <span v-else-if="mode === 'density'">密度模式 ({{ totalMatches.toLocaleString() }} 匹配，超过 {{ maxDots.toLocaleString() }} 自动降级)</span>
        <span v-else-if="totalMatches > 0">{{ totalMatches.toLocaleString() }} 个匹配点</span>
        <span v-else>无匹配点</span>
      </span>
      <button @click="resetZoom">重置视图</button>
      <button @click="forceDotMode" v-if="mode === 'density'">强制点模式(慢)</button>
    </div>
    <div class="dot-plot-container" ref="containerRef">
      <svg ref="svgRef" class="dot-plot-svg">
        <g class="x-axis" />
        <g class="y-axis" />
        <text class="x-label" />
        <text class="y-label" />
        <rect class="highlight-rect" fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4 4" style="display:none" />
      </svg>
      <canvas ref="canvasRef" class="dot-plot-canvas" />
      <div v-if="loading" class="dot-plot-loading">
        <div class="loading-spinner" />
        <div>计算点阵图中...</div>
        <div class="loading-progress">{{ progress.stage }} {{ progress.percent.toFixed(0) }}%</div>
      </div>
    </div>
    <div v-if="clickedCell" class="dot-plot-tooltip-inline">
      点击位置: seq1={{ clickedCell.i }} ({{ clickedCell.baseA }}) · seq2={{ clickedCell.j }} ({{ clickedCell.baseB }})
      · k-mer: {{ clickedCell.kmers[0] }} / {{ clickedCell.kmers[1] }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import * as d3 from 'd3'
import type { DotWorkerMessage, DotWorkerResult } from '../dotplot.worker'

interface Highlight {
  seq1_start: number
  seq1_end: number
  seq2_start: number
  seq2_end: number
}

const props = withDefaults(
  defineProps<{
    seq1: string
    seq2: string
    kmer?: number
    step?: number
    matchThreshold?: number
    highlight?: Highlight | null
    maxDots?: number
    densityBins?: number
  }>(),
  {
    kmer: 11,
    step: 3,
    matchThreshold: 11,
    highlight: null,
    maxDots: 500000,
    densityBins: 256,
  },
)

const emit = defineEmits<{
  (e: 'cell-click', payload: { i: number; j: number; baseA: string; baseB: string; kmers: string[] }): void
}>()

const wrapperRef = ref<HTMLDivElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const svgRef = ref<SVGSVGElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const loading = ref(false)
const progress = ref({ stage: '', percent: 0 })
const totalMatches = ref(0)
const mode = ref<'dots' | 'density'>('dots')
const clickedCell = ref<{ i: number; j: number; baseA: string; baseB: string; kmers: string[] } | null>(null)

// State
let width = 800
let height = 520
const margin = { top: 20, right: 20, bottom: 40, left: 60 }
let innerW = width - margin.left - margin.right
let innerH = height - margin.top - margin.bottom

let xBase = d3.scaleLinear().domain([0, 1]).range([0, 1])
let yBase = d3.scaleLinear().domain([0, 1]).range([0, 1])
let currentTransform = d3.zoomIdentity

let dots: { i: number; j: number }[] = []
let density: DotWorkerResult['density'] | null = null
let worker: Worker | null = null
let renderFrame = 0
let debounceTimer: number | null = null

function adaptiveStep(scale: number): number {
  // Zoom out -> larger step (fewer points)
  // Zoom in -> smaller step (more detail)
  const baseStep = props.step
  if (scale <= 1) return Math.max(baseStep * 4, 10)
  if (scale <= 3) return Math.max(baseStep * 2, 5)
  if (scale <= 8) return baseStep
  return Math.max(1, Math.floor(baseStep / 2))
}

function getViewport(transform: d3.ZoomTransform): { iMin: number; iMax: number; jMin: number; jMax: number } {
  const zx = transform.rescaleX(xBase)
  const zy = transform.rescaleY(yBase)
  const jMin = Math.max(0, Math.floor(zx.invert(-20)))
  const jMax = Math.min(props.seq2.length, Math.ceil(zx.invert(innerW + 20)))
  const iMin = Math.max(0, Math.floor(zy.invert(innerH + 20)))
  const iMax = Math.min(props.seq1.length, Math.ceil(zy.invert(-20)))
  return { iMin, iMax, jMin, jMax }
}

function scheduleCompute() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => {
    computeDots()
  }, 150)
}

async function computeDots() {
  if (!props.seq1 || !props.seq2 || props.seq1.length < props.kmer || props.seq2.length < props.kmer) {
    dots = []
    density = null
    totalMatches.value = 0
    drawCanvas()
    return
  }

  const step = adaptiveStep(currentTransform.k)
  const viewport = getViewport(currentTransform)

  if (worker) worker.terminate()
  worker = new Worker(new URL('../dotplot.worker.ts', import.meta.url), { type: 'module' })

  loading.value = true
  progress.value = { stage: 'starting', percent: 0 }

  worker.onmessage = (ev: MessageEvent<DotWorkerMessage>) => {
    const msg = ev.data
    if (msg.type === 'progress') {
      progress.value = { stage: msg.stage, percent: msg.percent }
    } else if (msg.type === 'result') {
      loading.value = false
      if (!msg.ok) {
        console.error('dot worker error:', msg.error)
        return
      }
      dots = msg.dots || []
      density = msg.density || null
      totalMatches.value = msg.totalMatches
      mode.value = msg.mode
      drawCanvas()
    }
  }

  worker.postMessage({
    type: 'compute',
    payload: {
      seq1: props.seq1,
      seq2: props.seq2,
      kmer: props.kmer,
      step,
      viewport,
      maxDots: props.maxDots,
      densityBins: props.densityBins,
    },
  })
}

function forceDotMode() {
  if (worker) worker.terminate()
  worker = new Worker(new URL('../dotplot.worker.ts', import.meta.url), { type: 'module' })
  loading.value = true
  progress.value = { stage: 'forcing-dots', percent: 0 }

  const step = adaptiveStep(currentTransform.k)
  const viewport = getViewport(currentTransform)

  worker.onmessage = (ev: MessageEvent<DotWorkerMessage>) => {
    const msg = ev.data
    if (msg.type === 'progress') {
      progress.value = { stage: msg.stage, percent: msg.percent }
    } else if (msg.type === 'result') {
      loading.value = false
      dots = msg.dots || []
      density = null
      totalMatches.value = msg.totalMatches
      mode.value = 'dots'
      drawCanvas()
    }
  }

  // Force dot mode with a very high limit
  worker.postMessage({
    type: 'compute',
    payload: {
      seq1: props.seq1,
      seq2: props.seq2,
      kmer: props.kmer,
      step,
      viewport,
      maxDots: 5000000,
      densityBins: props.densityBins,
    },
  })
}

function drawCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  cancelAnimationFrame(renderFrame)
  renderFrame = requestAnimationFrame(() => {
    ctx.clearRect(0, 0, width, height)

    const zx = currentTransform.rescaleX(xBase)
    const zy = currentTransform.rescaleY(yBase)

    // Draw dots or density
    if (mode.value === 'density' && density) {
      drawDensity(ctx, zx, zy)
    } else {
      drawDots(ctx, zx, zy)
    }
  })
}

function drawDots(ctx: CanvasRenderingContext2D, zx: d3.ScaleLinear<number, number>, zy: d3.ScaleLinear<number, number>) {
  const k = currentTransform.k
  const dotSize = Math.min(3, Math.max(0.8, 1.4 * Math.sqrt(k)))

  ctx.fillStyle = 'rgba(56, 189, 248, 0.75)'
  ctx.beginPath()
  for (const d of dots) {
    const x = margin.left + zx(d.j + props.kmer / 2)
    const y = margin.top + zy(d.i + props.kmer / 2)
    if (x < -5 || x > width + 5 || y < -5 || y > height + 5) continue
    ctx.moveTo(x + dotSize, y)
    ctx.arc(x, y, dotSize, 0, Math.PI * 2)
  }
  ctx.fill()
}

function drawDensity(ctx: CanvasRenderingContext2D, zx: d3.ScaleLinear<number, number>, zy: d3.ScaleLinear<number, number>) {
  if (!density) return
  const { data, iMin, iMax, jMin, jMax } = density
  const binsPerSide = Math.ceil(Math.sqrt(data.length))
  const binsI = Math.ceil((iMax - iMin) / Math.max(1, Math.ceil((iMax - iMin) / binsPerSide)))
  const binsJ = binsPerSide

  let maxCount = 0
  for (let idx = 0; idx < data.length; idx++) {
    if (data[idx] > maxCount) maxCount = data[idx]
  }
  if (maxCount === 0) return

  const binSizeI = (iMax - iMin) / binsI
  const binSizeJ = (jMax - jMin) / binsJ

  for (let bi = 0; bi < binsI; bi++) {
    for (let bj = 0; bj < binsJ; bj++) {
      const count = data[bi * binsJ + bj]
      if (count === 0) continue
      const intensity = Math.min(1, Math.log(count + 1) / Math.log(maxCount + 1))
      // Viridis-like color ramp
      const r = Math.floor(68 + intensity * 188)
      const g = Math.floor(1 + intensity * 188)
      const b = Math.floor(84 + intensity * 164)
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.3 + intensity * 0.6})`
      const iPos = iMin + bi * binSizeI
      const jPos = jMin + bj * binSizeJ
      const x = margin.left + zx(jPos)
      const y = margin.top + zy(iPos + binSizeI)
      const w = zx(jPos + binSizeJ) - zx(jPos)
      const h = zy(iPos) - zy(iPos + binSizeI)
      ctx.fillRect(x, y, Math.max(1, w), Math.max(1, h))
    }
  }
}

function updateAxes() {
  if (!svgRef.value) return
  const svg = d3.select(svgRef.value)
  const zx = currentTransform.rescaleX(xBase)
  const zy = currentTransform.rescaleY(yBase)

  svg.select<SVGGElement>('.x-axis')
    .attr('transform', `translate(${margin.left},${margin.top + innerH})`)
    .call(d3.axisBottom(zx).ticks(8) as any)
    .attr('color', '#64748b')

  svg.select<SVGGElement>('.y-axis')
    .attr('transform', `translate(${margin.left},${margin.top})`)
    .call(d3.axisLeft(zy).ticks(8) as any)
    .attr('color', '#64748b')

  // Labels
  svg.select<SVGTextElement>('.x-label')
    .attr('x', margin.left + innerW / 2)
    .attr('y', height - 8)
    .attr('text-anchor', 'middle')
    .attr('fill', '#94a3b8')
    .attr('font-size', 12)
    .text('Sequence 2 position')

  svg.select<SVGTextElement>('.y-label')
    .attr('transform', `rotate(-90)`)
    .attr('x', -(margin.top + innerH / 2))
    .attr('y', 15)
    .attr('text-anchor', 'middle')
    .attr('fill', '#94a3b8')
    .attr('font-size', 12)
    .text('Sequence 1 position')

  // Highlight rect
  if (props.highlight) {
    const h = props.highlight
    const x0 = margin.left + zx(h.seq2_start)
    const y0 = margin.top + zy(h.seq1_end)
    const x1 = margin.left + zx(h.seq2_end)
    const y1 = margin.top + zy(h.seq1_start)
    svg.select<SVGRectElement>('.highlight-rect')
      .style('display', null)
      .attr('x', Math.min(x0, x1))
      .attr('y', Math.min(y0, y1))
      .attr('width', Math.abs(x1 - x0))
      .attr('height', Math.abs(y1 - y0))
  } else {
    svg.select<SVGRectElement>('.highlight-rect').style('display', 'none')
  }
}

function handleClick(event: MouseEvent) {
  if (!canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  const cx = event.clientX - rect.left - margin.left
  const cy = event.clientY - rect.top - margin.top
  const zx = currentTransform.rescaleX(xBase)
  const zy = currentTransform.rescaleY(yBase)
  const j = Math.floor(zx.invert(cx))
  const i = Math.floor(zy.invert(cy))
  const baseA = props.seq1[i] ?? '-'
  const baseB = props.seq2[j] ?? '-'
  const kmerA = props.seq1.slice(Math.max(0, i), Math.min(props.seq1.length, i + props.kmer))
  const kmerB = props.seq2.slice(Math.max(0, j), Math.min(props.seq2.length, j + props.kmer))
  const payload = { i, j, baseA, baseB, kmers: [kmerA, kmerB] }
  clickedCell.value = payload
  emit('cell-click', payload)
}

function setupZoom() {
  if (!svgRef.value) return
  const svg = d3.select(svgRef.value)

  const zoom = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.5, 100])
    .on('zoom', (event) => {
      currentTransform = event.transform
      updateAxes()
      drawCanvas()
    })
    .on('end', () => {
      // Recompute dots for new viewport / zoom level
      scheduleCompute()
    })

  svg.call(zoom)
  ;(containerRef.value as any).__zoom = zoom
  ;(containerRef.value as any).__svg = svg
}

function bindCanvasEvents() {
  if (!canvasRef.value) return
  canvasRef.value.addEventListener('click', handleClick)
}

function unbindCanvasEvents() {
  if (!canvasRef.value) return
  canvasRef.value.removeEventListener('click', handleClick)
}

function resetZoom() {
  const zoom = (containerRef.value as any)?.__zoom
  const svg = (containerRef.value as any)?.__svg
  if (!zoom || !svg) return
  svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity)
}

function resize() {
  if (!containerRef.value || !canvasRef.value || !svgRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  width = Math.max(400, rect.width)
  height = 520
  innerW = width - margin.left - margin.right
  innerH = height - margin.top - margin.bottom

  canvasRef.value.width = width
  canvasRef.value.height = height
  d3.select(svgRef.value).attr('width', width).attr('height', height)

  xBase = d3.scaleLinear().domain([0, props.seq2.length || 1]).range([0, innerW])
  yBase = d3.scaleLinear().domain([0, props.seq1.length || 1]).range([innerH, 0])

  updateAxes()
  drawCanvas()
}

defineExpose({ resetZoom })

onMounted(() => {
  resize()
  setupZoom()
  bindCanvasEvents()
  scheduleCompute()
  window.addEventListener('resize', resize)
})
onUnmounted(() => {
  window.removeEventListener('resize', resize)
  unbindCanvasEvents()
  if (worker) worker.terminate()
  if (debounceTimer) clearTimeout(debounceTimer)
  cancelAnimationFrame(renderFrame)
})

watch(
  () => [props.seq1, props.seq2, props.kmer, props.step, props.highlight],
  () => {
    xBase = d3.scaleLinear().domain([0, props.seq2.length || 1]).range([0, innerW])
    yBase = d3.scaleLinear().domain([0, props.seq1.length || 1]).range([innerH, 0])
    scheduleCompute()
    updateAxes()
  },
)
</script>

<style scoped>
.dot-plot-wrapper {
  width: 100%;
}
.dot-plot-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
  color: #94a3b8;
}
.dot-plot-toolbar button {
  padding: 4px 10px;
  font-size: 12px;
}
.dot-info {
  flex: 1;
}
.dot-plot-container {
  position: relative;
  width: 100%;
  height: 520px;
  cursor: grab;
}
.dot-plot-container:active {
  cursor: grabbing;
}
.dot-plot-canvas {
  position: absolute;
  top: 0;
  left: 0;
  background: #0f172a;
  border-radius: 6px;
}
.dot-plot-svg {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}
.dot-plot-svg .x-axis,
.dot-plot-svg .y-axis {
  pointer-events: all;
}
.dot-plot-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  color: #e2e8f0;
  font-size: 13px;
}
.loading-spinner {
  width: 28px;
  height: 28px;
  margin: 0 auto 10px;
  border: 3px solid #334155;
  border-top-color: #38bdf8;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.loading-progress {
  margin-top: 6px;
  font-size: 11px;
  color: #94a3b8;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.dot-plot-tooltip-inline {
  margin-top: 8px;
  padding: 8px 12px;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  font-size: 12px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  color: #e2e8f0;
}
</style>
