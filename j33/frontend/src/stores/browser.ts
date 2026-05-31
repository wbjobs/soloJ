import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { CHROMOSOMES, CHROM_LENGTHS } from '@/types'
import type { Variant, TrackConfig, ChromosomeName, HeatmapCell } from '@/types'

export const useBrowserStore = defineStore('browser', () => {
  const currentChrom = ref<ChromosomeName>('chr1')
  const regionStart = ref(0)
  const regionEnd = ref(CHROM_LENGTHS['chr1'])
  const zoomLevel = ref(1)
  const selectedVariant = ref<Variant | null>(null)
  const isNavigating = ref(false)

  const viewMode = ref<'standard' | 'heatmap'>('standard')
  const heatmapCells = ref<HeatmapCell[]>([])

  const tracks = ref<TrackConfig[]>([
    { id: 'coverage-1', type: 'coverage', label: '覆盖度', visible: true, height: 120, color: '#165DFF', fileId: '' },
    { id: 'variants-1', type: 'variants', label: '变异', visible: true, height: 80, color: '#00B42A', fileId: '' },
  ])

  const activeFileId = ref<string | null>(null)
  const coverageData = ref<{ position: number; depth: number }[]>([])
  const variantsData = ref<Variant[]>([])

  const chromosomes = computed(() =>
    CHROMOSOMES.map((c) => ({
      name: c,
      length: CHROM_LENGTHS[c],
    }))
  )

  const regionSpan = computed(() => regionEnd.value - regionStart.value)

  const centerPosition = computed(() =>
    Math.floor((regionStart.value + regionEnd.value) / 2)
  )

  function navigateTo(chrom: ChromosomeName, start: number, end: number) {
    const length = CHROM_LENGTHS[chrom] ?? 1e8
    currentChrom.value = chrom
    regionStart.value = Math.max(0, Math.floor(start))
    regionEnd.value = Math.min(length, Math.ceil(end))
    zoomLevel.value = length / (regionEnd.value - regionStart.value)
  }

  function zoomIn(factor = 2) {
    const center = centerPosition.value
    const halfSpan = regionSpan.value / (2 * factor)
    navigateTo(currentChrom.value, center - halfSpan, center + halfSpan)
  }

  function zoomOut(factor = 2) {
    const center = centerPosition.value
    const halfSpan = (regionSpan.value * factor) / 2
    navigateTo(currentChrom.value, center - halfSpan, center + halfSpan)
  }

  function panTo(position: number) {
    const halfSpan = regionSpan.value / 2
    navigateTo(currentChrom.value, position - halfSpan, position + halfSpan)
  }

  function panBy(delta: number) {
    panTo(centerPosition.value + delta)
  }

  function selectVariant(variant: Variant | null) {
    selectedVariant.value = variant
  }

  function updateTrack(trackId: string, updates: Partial<TrackConfig>) {
    const idx = tracks.value.findIndex((t) => t.id === trackId)
    if (idx !== -1) {
      tracks.value[idx] = { ...tracks.value[idx], ...updates }
    }
  }

  function addTrack(track: TrackConfig) {
    tracks.value.push(track)
  }

  function removeTrack(trackId: string) {
    tracks.value = tracks.value.filter((t) => t.id !== trackId)
  }

  function setActiveFile(fileId: string | null) {
    activeFileId.value = fileId
  }

  function setCoverageData(data: { position: number; depth: number }[]) {
    coverageData.value = data
  }

  function setVariantsData(data: Variant[]) {
    variantsData.value = data
  }

  function setViewMode(mode: 'standard' | 'heatmap') {
    viewMode.value = mode
  }

  function setHeatmapCells(cells: HeatmapCell[]) {
    heatmapCells.value = cells
  }

  return {
    currentChrom,
    regionStart,
    regionEnd,
    zoomLevel,
    selectedVariant,
    isNavigating,
    tracks,
    activeFileId,
    coverageData,
    variantsData,
    viewMode,
    heatmapCells,
    chromosomes,
    regionSpan,
    centerPosition,
    navigateTo,
    zoomIn,
    zoomOut,
    panTo,
    panBy,
    selectVariant,
    updateTrack,
    addTrack,
    removeTrack,
    setActiveFile,
    setCoverageData,
    setVariantsData,
    setViewMode,
    setHeatmapCells,
  }
})
