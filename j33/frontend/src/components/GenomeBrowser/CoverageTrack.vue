<script setup lang="ts">
import { computed } from 'vue'
import { useBrowserStore } from '@/stores/browser'

const browserStore = useBrowserStore()

const coverageTrack = computed(() =>
  browserStore.tracks.find((t) => t.type === 'coverage')
)

const maxDepth = computed(() => {
  const data = browserStore.coverageData
  if (!data || data.length === 0) return 0
  return Math.max(...data.map((p) => p.depth))
})

const avgDepth = computed(() => {
  const data = browserStore.coverageData
  if (!data || data.length === 0) return 0
  const sum = data.reduce((s, p) => s + p.depth, 0)
  return Math.round(sum / data.length)
})

const pathD = computed(() => {
  const data = browserStore.coverageData
  if (!data || data.length < 2) return ''
  const start = browserStore.regionStart
  const span = browserStore.regionEnd - start
  if (span === 0) return ''
  const h = 60
  const max = maxDepth.value || 1
  const points = data.map((p) => {
    const x = ((p.position - start) / span) * 100
    const y = h - (p.depth / max) * h
    return `${x},${y}`
  })
  return `M${points.join(' L')}`
})
</script>

<template>
  <div class="flex items-center gap-3 px-3 py-2 bg-genome-surface-2 rounded-lg border border-genome-border">
    <div class="text-xs text-genome-text-muted">覆盖度</div>
    <div class="flex-1 h-16 relative" v-if="coverageTrack?.visible">
      <svg class="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 60">
        <path
          v-if="pathD"
          :d="pathD"
          fill="none"
          stroke="#165DFF"
          stroke-width="1.5"
          vector-effect="non-scaling-stroke"
        />
      </svg>
    </div>
    <div class="text-right">
      <div class="text-[10px] font-mono text-genome-blue">{{ avgDepth }}x</div>
      <div class="text-[9px] font-mono text-genome-text-dim">max {{ maxDepth }}x</div>
    </div>
  </div>
</template>
