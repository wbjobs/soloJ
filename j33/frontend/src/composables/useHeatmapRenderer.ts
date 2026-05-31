import { ref, onUnmounted, type Ref } from 'vue'
import { Application, Container, Graphics, Text, TextStyle, FederatedPointerEvent, FederatedWheelEvent } from 'pixi.js'
import type { HeatmapCell } from '@/types'

const COLOR_STOPS = [
  { t: 0.0, r: 0x0A, g: 0x0E, b: 0x1A },
  { t: 0.2, r: 0x16, g: 0x5D, b: 0xFF },
  { t: 0.5, r: 0x00, g: 0xB4, b: 0x2A },
  { t: 0.8, r: 0xFF, g: 0x7D, b: 0x00 },
  { t: 1.0, r: 0xF5, g: 0x3F, b: 0x3F },
]

function lerpColor(t: number): number {
  const clamped = Math.max(0, Math.min(1, t))
  let lo = COLOR_STOPS[0]
  let hi = COLOR_STOPS[COLOR_STOPS.length - 1]
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    if (clamped >= COLOR_STOPS[i].t && clamped <= COLOR_STOPS[i + 1].t) {
      lo = COLOR_STOPS[i]
      hi = COLOR_STOPS[i + 1]
      break
    }
  }
  const range = hi.t - lo.t
  const frac = range === 0 ? 0 : (clamped - lo.t) / range
  const r = Math.round(lo.r + (hi.r - lo.r) * frac)
  const g = Math.round(lo.g + (hi.g - lo.g) * frac)
  const b = Math.round(lo.b + (hi.b - lo.b) * frac)
  return (r << 16) | (g << 8) | b
}

interface HeatmapRendererOptions {
  canvasRef: Ref<HTMLCanvasElement | null>
  width: Ref<number>
  height: Ref<number>
  chrom: Ref<string>
  regionStart: Ref<number>
  regionEnd: Ref<number>
  heatmapCells: Ref<HeatmapCell[]>
  onCellClick?: (cell: HeatmapCell) => void
  onRegionChange?: (start: number, end: number) => void
}

export function useHeatmapRenderer(options: HeatmapRendererOptions) {
  const {
    canvasRef, width, height, chrom, regionStart, regionEnd,
    heatmapCells, onCellClick, onRegionChange,
  } = options

  let app: Application | null = null
  let cellLayer: Container = new Container()
  let rulerLayer: Container = new Container()
  let tooltipLayer: Container = new Container()

  const hoveredCell = ref<HeatmapCell | null>(null)
  const tooltipPos = ref({ x: 0, y: 0 })
  const tooltipText = ref('')

  let isDragging = false
  let dragStartX = 0
  let dragStartRegionStart = 0
  let dragStartRegionEnd = 0
  let cellGraphics: Map<string, Graphics> = new Map()

  const rulerTextStyle = new TextStyle({
    fontFamily: 'JetBrains Mono',
    fontSize: 10,
    fill: 0x9CA3AF,
  })

  async function init() {
    if (!canvasRef.value) return
    app = new Application({
      view: canvasRef.value,
      width: width.value,
      height: height.value,
      backgroundColor: 0x0A0E1A,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })

    cellLayer = new Container()
    rulerLayer = new Container()
    tooltipLayer = new Container()

    app!.stage.addChild(rulerLayer)
    app!.stage.addChild(cellLayer)
    app!.stage.addChild(tooltipLayer)

    setupInteraction()
    render()
  }

  function setupInteraction() {
    if (!app) return
    const stage = app.stage
    stage.eventMode = 'static'
    stage.hitArea = { contains: () => true }

    stage.on('pointerdown', (e: FederatedPointerEvent) => {
      isDragging = true
      dragStartX = e.globalX
      dragStartRegionStart = regionStart.value
      dragStartRegionEnd = regionEnd.value
    })

    stage.on('pointermove', (e: FederatedPointerEvent) => {
      if (isDragging) {
        const dx = e.globalX - dragStartX
        const span = dragStartRegionEnd - dragStartRegionStart
        const delta = -(dx / width.value) * span
        onRegionChange?.(
          Math.max(0, Math.floor(dragStartRegionStart + delta)),
          Math.max(0, Math.ceil(dragStartRegionEnd + delta))
        )
      }
    })

    stage.on('pointerup', () => { isDragging = false })
    stage.on('pointerupoutside', () => { isDragging = false })

    stage.on('wheel', (e: FederatedWheelEvent) => {
      const delta = e.deltaY || 0
      const factor = delta > 0 ? 1.2 : 1 / 1.2
      const span = regionEnd.value - regionStart.value
      const mouseRatio = e.globalX / width.value
      const newSpan = span * factor
      const anchor = regionStart.value + span * mouseRatio
      const newStart = anchor - newSpan * mouseRatio
      const newEnd = anchor + newSpan * (1 - mouseRatio)
      onRegionChange?.(Math.max(0, Math.floor(newStart)), Math.ceil(newEnd))
    })
  }

  function render() {
    if (!app) return
    app.renderer.resize(width.value, height.value)
    renderRuler()
    renderCells()
    renderTooltip()
  }

  function renderRuler() {
    rulerLayer.removeChildren()
    const g = new Graphics()
    const start = regionStart.value
    const end = regionEnd.value
    const span = end - start

    g.beginFill(0x0A0E1A)
    g.drawRect(0, 0, width.value, 28)
    g.endFill()

    g.lineStyle(1, 0x374151)
    const tickInterval = calculateTickInterval(span)
    const firstTick = Math.ceil(start / tickInterval) * tickInterval
    for (let pos = firstTick; pos <= end; pos += tickInterval) {
      const x = positionToX(pos)
      g.moveTo(x, 0)
      g.lineTo(x, 28)
      const label = formatPosition(pos)
      const text = new Text(label, rulerTextStyle)
      text.x = x + 2
      text.y = 14
      rulerLayer.addChild(text)
    }

    const chromLabel = new Text(`${chrom.value}:${formatPosition(start)}-${formatPosition(end)}`, {
      ...rulerTextStyle,
      fontSize: 11,
      fill: 0xF3F4F6,
    })
    chromLabel.x = 4
    chromLabel.y = 2

    rulerLayer.addChild(g)
    rulerLayer.addChild(chromLabel)
  }

  function renderCells() {
    cellLayer.removeChildren()
    cellGraphics.clear()

    const cells = heatmapCells.value
    if (!cells || cells.length === 0) return

    const start = regionStart.value
    const end = regionEnd.value
    const span = end - start
    const gridTop = 32
    const gridHeight = height.value - gridTop - 4

    const cols = Math.min(cells.length, Math.max(20, Math.ceil(width.value / 8)))
    const rows = 1

    const colWidth = width.value / cols
    const rowHeight = gridHeight / rows

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]
      const cellStart = cell.start
      const cellEnd = cell.end
      const x1 = positionToX(cellStart)
      const x2 = positionToX(cellEnd)
      const cw = Math.max(x2 - x1, 2)

      const color = lerpColor(cell.enrichmentScore)
      const g = new Graphics()

      g.beginFill(color, 0.85)
      g.drawRect(x1, gridTop, cw, gridHeight)
      g.endFill()

      g.lineStyle(0.5, 0x1F2937, 0.3)
      g.drawRect(x1, gridTop, cw, gridHeight)

      g.eventMode = 'static'
      g.cursor = 'pointer'
      g.on('pointerover', () => {
        hoveredCell.value = cell
        tooltipText.value = `${cell.chrom}:${cell.start}-${cell.end} | 变异: ${cell.variantCount} | 富集: ${cell.enrichmentScore.toFixed(2)}`
        tooltipPos.value = { x: (x1 + x2) / 2, y: gridTop }
        renderTooltip()
      })
      g.on('pointerout', () => {
        hoveredCell.value = null
        renderTooltip()
      })
      g.on('pointerdown', () => {
        onCellClick?.(cell)
      })

      cellGraphics.set(`${cell.start}-${cell.end}`, g)
      cellLayer.addChild(g)
    }
  }

  function renderTooltip() {
    tooltipLayer.removeChildren()
    if (!hoveredCell.value) return

    const g = new Graphics()
    const tx = Math.min(tooltipPos.value.x + 12, width.value - 280)
    const ty = tooltipPos.value.y - 30

    g.beginFill(0x1F2937, 0.95)
    g.lineStyle(1, 0x374151)
    g.drawRoundedRect(tx, ty, 270, 24, 4)
    g.endFill()

    const text = new Text(tooltipText.value, {
      ...rulerTextStyle,
      fontSize: 10,
      fill: 0xF3F4F6,
    })
    text.x = tx + 6
    text.y = ty + 6

    tooltipLayer.addChild(g)
    tooltipLayer.addChild(text)
  }

  function positionToX(pos: number): number {
    const span = regionEnd.value - regionStart.value
    if (span === 0) return 0
    return ((pos - regionStart.value) / span) * width.value
  }

  function calculateTickInterval(span: number): number {
    const bases = [1e9, 5e8, 1e8, 5e7, 1e7, 5e6, 1e6, 5e5, 1e5, 5e4, 1e4, 5e3, 1e3, 500, 100, 50, 10]
    const targetTicks = width.value / 120
    for (const b of bases) {
      if (span / b <= targetTicks) return b
    }
    return 1
  }

  function formatPosition(pos: number): string {
    if (pos >= 1e6) return `${(pos / 1e6).toFixed(1)}Mb`
    if (pos >= 1e3) return `${(pos / 1e3).toFixed(1)}kb`
    return `${pos}bp`
  }

  function destroy() {
    if (app) {
      app.destroy(true)
      app = null
    }
    cellGraphics.clear()
  }

  function resize(w: number, h: number) {
    width.value = w
    height.value = h
    render()
  }

  onUnmounted(() => {
    destroy()
  })

  return {
    init,
    render,
    destroy,
    resize,
    hoveredCell,
    tooltipPos,
    tooltipText,
  }
}
