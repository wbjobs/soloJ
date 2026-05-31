<template>
  <div class="heatmap-container" ref="containerRef"></div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import * as d3 from 'd3'

const props = withDefaults(
  defineProps<{
    data: number[][]
    rows: number
    cols: number
    seq1Len: number
    seq2Len: number
    diffRegions?: { row: number; col_start: number; col_end: number }[]
  }>(),
  {
    diffRegions: () => [],
  },
)

const emit = defineEmits<{
  (e: 'cell-click', payload: { binRow: number; binCol: number; seq1Pos: number; seq2Pos: number; score: number }): void
}>()

const containerRef = ref<HTMLDivElement | null>(null)

function render() {
  if (!containerRef.value || !props.data || props.data.length === 0) return
  const el = containerRef.value
  d3.select(el).selectAll('*').remove()

  const rect = el.getBoundingClientRect()
  const width = Math.max(400, rect.width)
  const height = 520
  const margin = { top: 20, right: 80, bottom: 40, left: 60 }
  const innerW = width - margin.left - margin.right
  const innerH = height - margin.top - margin.bottom

  const rows = props.rows
  const cols = props.cols

  const svg = d3.select(el).append('svg').attr('width', width).attr('height', height)
  const root = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  const xBase = d3.scaleLinear().domain([0, cols]).range([0, innerW])
  const yBase = d3.scaleLinear().domain([0, rows]).range([innerH, 0])

  const xAxisG = root.append('g').attr('transform', `translate(0,${innerH})`)
  const yAxisG = root.append('g')

  const ticks = 8
  const xTickVals = d3.range(0, cols + 1, Math.max(1, Math.floor(cols / ticks)))
  const yTickVals = d3.range(0, rows + 1, Math.max(1, Math.floor(rows / ticks)))

  const xAxis = d3
    .axisBottom(xBase)
    .tickValues(xTickVals as any)
    .tickFormat((d) => {
      const v = d as number
      return Math.round((v / cols) * props.seq2Len).toString()
    })
  const yAxis = d3
    .axisLeft(yBase)
    .tickValues(yTickVals as any)
    .tickFormat((d) => {
      const v = d as number
      return Math.round((v / rows) * props.seq1Len).toString()
    })
  xAxisG.call(xAxis as any).attr('color', '#64748b')
  yAxisG.call(yAxis as any).attr('color', '#64748b')

  // Flatten data
  const flat: { r: number; c: number; v: number }[] = []
  for (let r = 0; r < rows; r++) {
    const row = props.data[r] || []
    for (let c = 0; c < cols; c++) {
      flat.push({ r, c, v: row[c] || 0 })
    }
  }
  const maxV = d3.max(flat, (d) => d.v) || 1
  const color = d3
    .scaleSequential(d3.interpolateViridis)
    .domain([0, maxV])

  const cellW = innerW / cols
  const cellH = innerH / rows

  const g = root.append('g')
  g.selectAll('rect')
    .data(flat)
    .join('rect')
    .attr('x', (d) => d.c * cellW)
    .attr('y', (d) => innerH - (d.r + 1) * cellH)
    .attr('width', cellW)
    .attr('height', cellH)
    .attr('fill', (d) => color(d.v))
    .attr('opacity', 0.9)

  // Diff region overlay
  if (props.diffRegions && props.diffRegions.length > 0) {
    root
      .append('g')
      .selectAll('rect')
      .data(props.diffRegions)
      .join('rect')
      .attr('x', (d) => d.col_start * cellW)
      .attr('y', (d) => innerH - (d.row + 1) * cellH)
      .attr('width', (d) => (d.col_end - d.col_start + 1) * cellW)
      .attr('height', cellH)
      .attr('fill', 'none')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 1)
      .attr('opacity', 0.8)
  }

  // Color legend
  const legendW = 16
  const legendH = innerH
  const legendX = innerW + 20
  const legendScale = d3.scaleLinear().domain([0, maxV]).range([legendH, 0])
  const defs = svg.append('defs')
  const gradientId = 'heatmap-gradient'
  const gradient = defs
    .append('linearGradient')
    .attr('id', gradientId)
    .attr('x1', '0%')
    .attr('y1', '100%')
    .attr('x2', '0%')
    .attr('y2', '0%')
  const stops = 10
  for (let i = 0; i <= stops; i++) {
    const t = i / stops
    gradient
      .append('stop')
      .attr('offset', `${t * 100}%`)
      .attr('stop-color', color(t * maxV) as string)
  }
  const legendG = svg.append('g').attr('transform', `translate(${margin.left + legendX},${margin.top})`)
  legendG
    .append('rect')
    .attr('width', legendW)
    .attr('height', legendH)
    .style('fill', `url(#${gradientId})`)
  const legendAxis = d3.axisRight(legendScale).ticks(6)
  legendG.append('g').attr('transform', `translate(${legendW},0)`).call(legendAxis as any).attr('color', '#64748b')

  // Zoom / pan
  const mainG = g
  const zoom = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([1, 20])
    .on('zoom', (event) => {
      const zx = event.transform.rescaleX(xBase)
      const zy = event.transform.rescaleY(yBase)
      const newCellW = innerW / cols * event.transform.k
      const newCellH = innerH / rows * event.transform.k
      mainG
        .selectAll<SVGRectElement, { r: number; c: number; v: number }>('rect')
        .attr('x', (d) => zx(d.c))
        .attr('y', (d) => zy(d.r + 1))
        .attr('width', newCellW)
        .attr('height', newCellH)
      // Recompute axis with new scale
      xAxisG.call(
        d3
          .axisBottom(zx)
          .tickValues(xTickVals as any)
          .tickFormat((d) =>
            Math.round(((d as number) / cols) * props.seq2Len).toString(),
          ) as any,
      )
      yAxisG.call(
        d3
          .axisLeft(zy)
          .tickValues(yTickVals as any)
          .tickFormat((d) =>
            Math.round(((d as number) / rows) * props.seq1Len).toString(),
          ) as any,
      )
    })

  svg.call(zoom)

  // Tooltip
  const tooltip = d3
    .select('body')
    .append('div')
    .attr('class', 'tooltip')
    .style('display', 'none')

  mainG.selectAll<SVGRectElement, { r: number; c: number; v: number }>('rect').on('click', (event, d) => {
    event.stopPropagation()
    const seq1Pos = Math.round((d.r / rows) * props.seq1Len)
    const seq2Pos = Math.round((d.c / cols) * props.seq2Len)
    emit('cell-click', {
      binRow: d.r,
      binCol: d.c,
      seq1Pos,
      seq2Pos,
      score: d.v,
    })
    tooltip
      .style('display', 'block')
      .style('left', event.pageX + 12 + 'px')
      .style('top', event.pageY + 12 + 'px')
      .html(
        `<div><b>Bin</b> (${d.r},${d.c})</div>` +
          `<div><b>~pos</b> seq1:${seq1Pos}, seq2:${seq2Pos}</div>` +
          `<div><b>Score</b> ${d.v}</div>`,
      )
    setTimeout(() => tooltip.style('display', 'none'), 2500)
  })

  function resetZoom() {
    svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity)
  }
  ;(el as any).__resetZoom = resetZoom
  const existing = document.querySelector('.tooltip')
  if (existing && existing !== tooltip.node()) existing.remove()
  ;(el as any).__tooltip = tooltip
}

function resetZoom() {
  const el = containerRef.value as any
  if (el?.__resetZoom) el.__resetZoom()
}

defineExpose({ resetZoom })

onMounted(() => {
  render()
  window.addEventListener('resize', render)
})
onUnmounted(() => {
  window.removeEventListener('resize', render)
})
watch(
  () => [props.data, props.rows, props.cols, props.seq1Len, props.seq2Len, props.diffRegions],
  () => render(),
)
</script>
