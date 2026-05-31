<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useFilesStore } from '@/stores/files'
import { useBrowserStore } from '@/stores/browser'
import { compareSamples } from '@/api'
import DualTrackView from '@/components/SampleCompare/DualTrackView.vue'
import ChromosomeSelector from '@/components/GenomeBrowser/ChromosomeSelector.vue'
import type { SamplePair } from '@/types'

const filesStore = useFilesStore()
const browserStore = useBrowserStore()

const selectedFileA = ref<string>('')
const selectedFileB = ref<string>('')
const comparing = ref(false)
const currentPair = ref<SamplePair | null>(null)
const error = ref<string | null>(null)

onMounted(() => {
  filesStore.loadFiles()
})

const bamAndVcfFiles = computed(() =>
  filesStore.files.filter((f) => f.status === 'ready' && (f.type === 'bam' || f.type === 'vcf'))
)

const fileA = computed(() => filesStore.getFileById(selectedFileA.value))
const fileB = computed(() => filesStore.getFileById(selectedFileB.value))

const buildMismatch = computed(() => {
  if (!fileA.value || !fileB.value) return false
  if (!fileA.value.genomeBuild || !fileB.value.genomeBuild) return false
  return fileA.value.genomeBuild !== fileB.value.genomeBuild
})

async function startCompare() {
  if (!selectedFileA.value || !selectedFileB.value) return
  comparing.value = true
  error.value = null
  try {
    currentPair.value = await compareSamples(
      selectedFileA.value,
      selectedFileB.value,
      browserStore.currentChrom,
      browserStore.regionStart,
      browserStore.regionEnd,
      fileA.value?.genomeBuild,
      fileB.value?.genomeBuild
    )
  } catch (e: any) {
    error.value = e.message
  } finally {
    comparing.value = false
  }
}
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-medium text-genome-text">样本比较</h1>
    </div>

    <div class="bg-genome-surface rounded-lg border border-genome-border p-4 space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="text-xs text-genome-text-dim mb-1 block">样本 A (正常)</label>
          <select
            v-model="selectedFileA"
            class="w-full px-3 py-2 bg-genome-surface-2 rounded-lg border border-genome-border text-xs text-genome-text focus:outline-none focus:border-genome-blue"
          >
            <option value="">选择文件...</option>
            <option v-for="f in bamAndVcfFiles" :key="f.id" :value="f.id">
              {{ f.name }} ({{ f.type.toUpperCase() }}){{ f.genomeBuild ? ` [${f.genomeBuild}]` : '' }}
            </option>
          </select>
        </div>
        <div>
          <label class="text-xs text-genome-text-dim mb-1 block">样本 B (肿瘤)</label>
          <select
            v-model="selectedFileB"
            class="w-full px-3 py-2 bg-genome-surface-2 rounded-lg border border-genome-border text-xs text-genome-text focus:outline-none focus:border-genome-blue"
          >
            <option value="">选择文件...</option>
            <option v-for="f in bamAndVcfFiles" :key="f.id" :value="f.id">
              {{ f.name }} ({{ f.type.toUpperCase() }}){{ f.genomeBuild ? ` [${f.genomeBuild}]` : '' }}
            </option>
          </select>
        </div>
      </div>

      <div v-if="buildMismatch" class="px-4 py-3 bg-genome-red/10 border border-genome-red/30 rounded-lg text-xs text-genome-red">
        基因组版本不匹配：样本 A 为 {{ fileA?.genomeBuild }}，样本 B 为 {{ fileB?.genomeBuild }}，比较结果可能不准确
      </div>

      <div class="flex items-center gap-3">
        <ChromosomeSelector />
        <button
          class="px-4 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :class="comparing ? 'bg-genome-surface-2 text-genome-text-dim' : 'bg-genome-blue text-white hover:bg-genome-blue-dark'"
          :disabled="comparing || !selectedFileA || !selectedFileB"
          @click="startCompare"
        >
          {{ comparing ? '比较中...' : '开始比较' }}
        </button>
      </div>
    </div>

    <div v-if="error" class="px-4 py-3 bg-genome-red/10 border border-genome-red/30 rounded-lg text-xs text-genome-red">
      {{ error }}
    </div>

    <div v-if="selectedFileA && selectedFileB" class="bg-genome-surface rounded-lg border border-genome-border p-4">
      <DualTrackView :file-a-id="selectedFileA" :file-b-id="selectedFileB" />
    </div>

    <div v-if="currentPair?.diffRegions && currentPair.diffRegions.length > 0" class="bg-genome-surface rounded-lg border border-genome-border p-4">
      <h3 class="text-xs font-medium text-genome-text-muted mb-3">
        差异区域 (体细胞突变候选)
        <span v-if="currentPair.buildA || currentPair.buildB" class="ml-2 text-genome-text-dim font-normal">
          [{{ currentPair.buildA || '?' }} vs {{ currentPair.buildB || '?' }}]
        </span>
      </h3>
      <div class="space-y-2">
        <div
          v-for="(region, idx) in currentPair.diffRegions"
          :key="idx"
          class="flex items-center gap-3 px-3 py-2 bg-genome-surface-2 rounded-lg text-xs"
        >
          <span class="font-mono text-genome-text">{{ region.chrom }}:{{ region.start.toLocaleString() }}-{{ region.end.toLocaleString() }}</span>
          <span class="text-genome-blue font-mono">{{ region.coverageA.toFixed(1) }}x</span>
          <span class="text-genome-text-dim">vs</span>
          <span class="text-genome-green font-mono">{{ region.coverageB.toFixed(1) }}x</span>
          <span class="ml-auto font-mono" :class="region.foldChange > 2 ? 'text-genome-red' : 'text-genome-text-dim'">
            FC {{ region.foldChange.toFixed(2) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
