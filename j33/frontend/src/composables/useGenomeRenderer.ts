import { ref, onUnmounted, type Ref } from 'vue'
import { Application, Container, Graphics, Text, TextStyle, FederatedPointerEvent, FederatedWheelEvent } from 'pixi.js'
import type { Variant, CoveragePoint, TrackConfig } from '@/types'

const COLORS = {
  bg: 0x0A0E1A,
  ruler: 0x374151,
  rulerText: 0x9CA3AF,
  coverage: 0x165DFF,
  coverageAlpha: 0.3,
  variantSnp: 0x00B42A,
  variantIns: 0xFF7D00,
  variantDel: 0xF53F3F,
  variantDefault: 0x9CA3AF,
  hover: 0xFFFFFF,
  gridLine: 0x1F2937,
}

interface RendererOptions {
  canvasRef: Ref<HTMLCanvasElement | null>
  width: Ref<number>
  height: Ref<number>
  chrom: Ref<string>
  regionStart: Ref<number>
  regionEnd: Ref<number>
  tracks: Ref<TrackConfig[]>
  onVariantClick?: (variant: Variant) => void
  onRegionChange?: (start: number, end: number) => void
}

export function useGenomeRenderer(options: RendererOptions) {
  const {
    canvasRef, width, height, chrom, regionStart, regionEnd,
    tracks, onVariantClick, onRegionChange,
  } = options

  let app: Application | null = null
  let bgLayer: Container = new Container()
  let coverageLayer: Container = new Container()
  let variantLayer: Container = new Container()
  let infoLayer: Container = new Container()
  let isDragging = false
  let dragStartX = 0
  let dragStartRegionStart = 0
  let dragStartRegionEnd = 0
  let variantGraphics: Map<string, Graphics> = new Map()

  const hoveredVariant = ref<Variant | null>(null)
  const tooltipPos = ref({ x: 0, y: 0 })
  const tooltipText = ref('')

  const rulerTextStyle = new TextStyle({
    fontFamily: 'JetBrains Mono',
    fontSize: 10,
    fill: COLORS.rulerText,
  })

  async function init() {
    if (!canvasRef.value) return
    app = new Application({
      view: canvasRef.value,
      width: width.value,
      height: height.value,
      backgroundColor: COLORS.bg,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })

    bgLayer = new Container()
    coverageLayer = new Container()
    variantLayer = new Container()
    infoLayer = new Container()

    app!.stage.addChild(bgLayer)
    app!.stage.addChild(coverageLayer)
    app!.stage.addChild(variantLayer)
    app!.stage.addChild(infoLayer)

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
    renderBackground()
    renderCoverage()
    renderVariants()
    renderInfo()
  }

  function renderBackground() {
    bgLayer.removeChildren()
    const g = new Graphics()
    const start = regionStart.value
    const end = regionEnd.value
    const span = end - start
    const trackList = tracks.value.filter((t) => t.visible)

    g.lineStyle(1, COLORS.gridLine)
    let y = 28
    for (const track of trackList) {
      g.moveTo(0, y)
      g.lineTo(width.value, y)
      y += track.height
    }

    const tickInterval = calculateTickInterval(span)
    const firstTick = Math.ceil(start / tickInterval) * tickInterval
    for (let pos = firstTick; pos <= end; pos += tickInterval) {
      const x = positionToX(pos)
      g.moveTo(x, 0)
      g.lineTo(x, 28)
      g.lineStyle(1, COLORS.ruler, 0.3)
      g.moveTo(x, 28)
      g.lineTo(x, height.value)
      g.lineStyle(1, COLORS.ruler)
      const label = formatPosition(pos)
      const text = new Text(label, rulerTextStyle)
      text.x = x + 2
      text.y = 14
      bgLayer.addChild(text)
    }

    g.lineStyle(0)
    g.beginFill(COLORS.bg)
    g.drawRect(0, 0, width.value, 28)
    g.endFill()

    const chromLabel = new Text(`${chrom.value}:${formatPosition(start)}-${formatPosition(end)}`, {
      ...rulerTextStyle,
      fontSize: 11,
      fill: 0xF3F4F6,
    })
    chromLabel.x = 4
    chromLabel.y = 2
    bgLayer.addChild(chromLabel)

    bgLayer.addChild(g)
  }

  function renderCoverage() {
    coverageLayer.removeChildren()
    const covTrack = tracks.value.find((t) => t.type === 'coverage' && t.visible)
    if (!covTrack) return

    const coverageData = getCachedCoverage()
    if (!coverageData || coverageData.length === 0) return

    const g = new Graphics()
    const yBase = 28
    const trackH = covTrack.height - 4
    const maxDepth = Math.max(...coverageData.map((p) => p.depth), 1)
    const color = parseInt(covTrack.color.replace('#', ''), 16)

    g.beginFill(color, COLORS.coverageAlpha)
    g.moveTo(0, yBase + trackH)

    for (const point of coverageData) {
      const x = positionToX(point.position)
      const y = yBase + trackH - (point.depth / maxDepth) * trackH
      g.lineTo(x, y)
    }

    g.lineTo(width.value, yBase + trackH)
    g.closePath()
    g.endFill()

    g.lineStyle(1.5, color, 0.9)
    g.moveTo(positionToX(coverageData[0].position),
      yBase + trackH - (coverageData[0].depth / maxDepth) * trackH)

    for (let i = 1; i < coverageData.length; i++) {
      const x = positionToX(coverageData[i].position)
      const y = yBase + trackH - (coverageData[i].depth / maxDepth) * trackH
      g.lineTo(x, y)
    }

    coverageLayer.addChild(g)

    const depthLabel = new Text(`Max: ${maxDepth}x`, {
      ...rulerTextStyle,
      fontSize: 9,
      fill: COLORS.rulerText,
    })
    depthLabel.x = width.value - 70
    depthLabel.y = yBase + 2
    coverageLayer.addChild(depthLabel)
  }

  function renderVariants() {
    variantLayer.removeChildren()
    variantGraphics.clear()
    const varTrack = tracks.value.find((t) => t.type === 'variants' && t.visible)
    if (!varTrack) return

    const variants = getCachedVariants()
    if (!variants || variants.length === 0) return

    const yBase = 28 + (tracks.value.find((t) => t.type === 'coverage' && t.visible)?.height ?? 0)
    const trackH = varTrack.height - 4
    const visibleVariants = filterVisibleVariants(variants)

    for (const v of visibleVariants) {
      const x = positionToX(v.position)
      if (x < -10 || x > width.value + 10) continue

      const color = getVariantColor(v)
      const g = new Graphics()
      const size = v.type === 'SNP' ? 4 : 5

      g.beginFill(color)
      if (v.type === 'SNP') {
        g.drawCircle(x, yBase + trackH / 2, size)
      } else if (v.type === 'INS') {
        g.drawPolygon([x, yBase + trackH / 2 - size - 2, x - size, yBase + trackH / 2 + size - 2, x + size, yBase + trackH / 2 + size - 2])
      } else if (v.type === 'DEL') {
        g.drawPolygon([x, yBase + trackH / 2 + size + 2, x - size, yBase + trackH / 2 - size + 2, x + size, yBase + trackH / 2 - size + 2])
      } else {
        g.drawRect(x - size, yBase + trackH / 2 - size, size * 2, size * 2)
      }
      g.endFill()

      g.eventMode = 'static'
      g.cursor = 'pointer'
      g.on('pointerover', () => {
        hoveredVariant.value = v
        tooltipText.value = `${v.chrom}:${v.position} ${v.ref}>${v.alt} [${v.type}]`
        tooltipPos.value = { x, y: yBase }
      })
      g.on('pointerout', () => {
        hoveredVariant.value = null
      })
      g.on('pointerdown', () => {
        onVariantClick?.(v)
      })

      variantGraphics.set(v.id, g)
      variantLayer.addChild(g)
    }
  }

  function renderInfo() {
    infoLayer.removeChildren()
    if (!hoveredVariant.value) return

    const g = new Graphics()
    const tx = Math.min(tooltipPos.value.x + 12, width.value - 200)
    const ty = tooltipPos.value.y - 30

    g.beginFill(0x1F2937, 0.95)
    g.lineStyle(1, 0x374151)
    g.drawRoundedRect(tx, ty, 190, 24, 4)
    g.endFill()

    const text = new Text(tooltipText.value, {
      ...rulerTextStyle,
      fontSize: 10,
      fill: 0xF3F4F6,
    })
    text.x = tx + 6
    text.y = ty + 6

    infoLayer.addChild(g)
    infoLayer.addChild(text)
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

  function getVariantColor(v: Variant): number {
    switch (v.type) {
      case 'SNP': return COLORS.variantSnp
      case 'INS': return COLORS.variantIns
      case 'DEL': return COLORS.variantDel
      default: return COLORS.variantDefault
    }
  }

  function filterVisibleVariants(variants: Variant[]): Variant[] {
    const span = regionEnd.value - regionStart.value
    const pixelPerBase = width.value / span
    if (pixelPerBase > 0.5) return variants
    return variants.filter((v) => v.type !== 'SNP' || v.quality > 20)
  }

  let _coverageCache: CoveragePoint[] = []
  let _variantsCache: Variant[] = []

  function setCoverageData(data: CoveragePoint[]) {
    _coverageCache = data
  }

  function setVariantsData(data: Variant[]) {
    _variantsCache = data
  }

  function getCachedCoverage() { return _coverageCache }
  function getCachedVariants() { return _variantsCache }

  function destroy() {
    if (app) {
      app.destroy(true)
      app = null
    }
    variantGraphics.clear()
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
    setCoverageData,
    setVariantsData,
    hoveredVariant,
    tooltipPos,
    tooltipText,
  }
}
