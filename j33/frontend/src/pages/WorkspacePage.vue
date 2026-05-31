<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useBrowserStore } from '@/stores/browser'
import { useFilesStore } from '@/stores/files'
import GenomeView from '@/components/GenomeBrowser/GenomeView.vue'
import HeatmapView from '@/components/GenomeBrowser/HeatmapView.vue'
import CoverageTrack from '@/components/GenomeBrowser/CoverageTrack.vue'
import VariantTrack from '@/components/GenomeBrowser/VariantTrack.vue'
import DropZone from '@/components/FileUpload/DropZone.vue'
import FileList from '@/components/FileUpload/FileList.vue'
import VariantModal from '@/components/VariantDetail/VariantModal.vue'
import ExportPanel from '@/components/VariantDetail/ExportPanel.vue'

const browserStore = useBrowserStore()
const filesStore = useFilesStore()

const showExport = computed(() => !!browserStore.activeFileId)

const pathogenicitySummary = computed(() => {
  const variants = browserStore.variantsData
  if (!variants.length) return null
  const withPath = variants.filter((v) => v.pathogenicity)
  if (!withPath.length) return null
  const pathCount = withPath.filter((v) => v.pathogenicity!.classification === 'pathogenic' || v.pathogenicity!.classification === 'likely_pathogenic').length
  const benignCount = withPath.filter((v) => v.pathogenicity!.classification === 'benign' || v.pathogenicity!.classification === 'likely_benign').length
  const vusCount = withPath.filter((v) => v.pathogenicity!.classification === 'VUS').length
  const avgScore = withPath.reduce((s, v) => s + v.pathogenicity!.pathogenicityScore, 0) / withPath.length
  return { total: withPath.length, pathCount, benignCount, vusCount, avgScore }
})

onMounted(() => {
  filesStore.loadFiles()
})
</script>

<template>
  <div class="flex h-full">
    <div class="flex-1 flex flex-col p-4 gap-3 min-w-0">
      <div class="flex items-center justify-between">
        <h1 class="text-lg font-medium text-genome-text">基因组浏览器</h1>
        <div class="text-xs font-mono text-genome-text-dim">
          {{ browserStore.currentChrom }}:{{ browserStore.regionStart.toLocaleString() }}-{{ browserStore.regionEnd.toLocaleString() }}
        </div>
      </div>
      <div class="flex-1 min-h-0">
        <GenomeView v-if="browserStore.viewMode === 'standard'" class="h-full" />
        <HeatmapView v-else class="h-full" />
      </div>
      <div v-if="browserStore.viewMode === 'standard'" class="flex gap-3">
        <CoverageTrack class="flex-1" />
        <VariantTrack class="flex-1" />
      </div>
    </div>
    <aside class="w-72 flex-shrink-0 border-l border-genome-border bg-genome-surface p-4 space-y-4 overflow-y-auto">
      <div>
        <h3 class="text-xs font-medium text-genome-text-muted mb-2">视图模式</h3>
        <div class="flex rounded-lg overflow-hidden border border-genome-border">
          <button
            class="flex-1 px-3 py-1.5 text-xs transition-colors"
            :class="browserStore.viewMode === 'standard'
              ? 'bg-genome-blue/20 text-genome-blue'
              : 'bg-genome-surface text-genome-text-dim hover:bg-genome-surface-2'"
            @click="browserStore.setViewMode('standard')"
          >标准视图</button>
          <button
            class="flex-1 px-3 py-1.5 text-xs transition-colors"
            :class="browserStore.viewMode === 'heatmap'
              ? 'bg-genome-blue/20 text-genome-blue'
              : 'bg-genome-surface text-genome-text-dim hover:bg-genome-surface-2'"
            @click="browserStore.setViewMode('heatmap')"
          >热力图</button>
        </div>
      </div>
      <div>
        <h3 class="text-xs font-medium text-genome-text-muted mb-2">文件上传</h3>
        <DropZone />
      </div>
      <div>
        <h3 class="text-xs font-medium text-genome-text-muted mb-2">已上传文件</h3>
        <FileList />
      </div>
      <div v-if="browserStore.activeFileId" class="space-y-2">
        <h3 class="text-xs font-medium text-genome-text-muted">当前文件统计</h3>
        <div class="grid grid-cols-2 gap-2">
          <div class="px-3 py-2 bg-genome-surface-2 rounded-lg">
            <div class="text-[10px] text-genome-text-dim">覆盖度</div>
            <div class="text-sm font-mono text-genome-blue">
              {{ browserStore.coverageData.length ? Math.round(browserStore.coverageData.reduce((s, p) => s + p.depth, 0) / browserStore.coverageData.length) : 0 }}x
            </div>
          </div>
          <div class="px-3 py-2 bg-genome-surface-2 rounded-lg">
            <div class="text-[10px] text-genome-text-dim">变异数</div>
            <div class="text-sm font-mono text-genome-green">{{ browserStore.variantsData.length }}</div>
          </div>
        </div>
      </div>
      <div v-if="pathogenicitySummary" class="space-y-2">
        <h3 class="text-xs font-medium text-genome-text-muted">致病性预测摘要</h3>
        <div class="space-y-1.5">
          <div class="flex items-center justify-between px-3 py-1.5 bg-genome-surface-2 rounded-lg">
            <span class="text-[10px] text-genome-text-dim">平均致病概率</span>
            <span class="text-xs font-mono text-genome-orange">{{ (pathogenicitySummary.avgScore * 100).toFixed(1) }}%</span>
          </div>
          <div class="flex items-center justify-between px-3 py-1.5 bg-genome-surface-2 rounded-lg">
            <span class="text-[10px] text-genome-red">致病/可能致病</span>
            <span class="text-xs font-mono text-genome-red">{{ pathogenicitySummary.pathCount }}</span>
          </div>
          <div class="flex items-center justify-between px-3 py-1.5 bg-genome-surface-2 rounded-lg">
            <span class="text-[10px] text-genome-text-muted">意义不明</span>
            <span class="text-xs font-mono text-genome-text-muted">{{ pathogenicitySummary.vusCount }}</span>
          </div>
          <div class="flex items-center justify-between px-3 py-1.5 bg-genome-surface-2 rounded-lg">
            <span class="text-[10px] text-genome-green">良性/可能良性</span>
            <span class="text-xs font-mono text-genome-green">{{ pathogenicitySummary.benignCount }}</span>
          </div>
        </div>
      </div>
      <div v-if="showExport">
        <h3 class="text-xs font-medium text-genome-text-muted mb-2">变异导出</h3>
        <ExportPanel />
      </div>
    </aside>
    <VariantModal />
  </div>
</template>
