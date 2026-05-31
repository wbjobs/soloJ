<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useBrowserStore } from '@/stores/browser'
import { exportVariants } from '@/api'
import { Download, Loader2 } from 'lucide-vue-next'

const browserStore = useBrowserStore()
const { activeFileId, currentChrom, regionStart, regionEnd } = storeToRefs(browserStore)

const minQuality = ref(0)
const variantType = ref('')
const minPathogenicity = ref(0)
const exporting = ref(false)
const exportProgress = ref(0)

const variantTypes = [
  { label: '全部', value: '' },
  { label: 'SNP', value: 'SNP' },
  { label: 'INS', value: 'INS' },
  { label: 'DEL', value: 'DEL' },
  { label: 'MNP', value: 'MNP' },
]

const canExport = computed(() => !!activeFileId.value && !exporting.value)

async function handleExport() {
  if (!activeFileId.value) return
  exporting.value = true
  exportProgress.value = 0
  try {
    const blob = await exportVariants(
      activeFileId.value,
      currentChrom.value,
      regionStart.value,
      regionEnd.value,
      {
        minQuality: minQuality.value > 0 ? minQuality.value : undefined,
        variantType: variantType.value || undefined,
        minPathogenicity: minPathogenicity.value > 0 ? minPathogenicity.value : undefined,
      }
    )
    exportProgress.value = 100
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `variants_${currentChrom.value}_${regionStart.value}-${regionEnd.value}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch {
    exportProgress.value = 0
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="space-y-3">
    <div>
      <label class="text-[10px] text-genome-text-dim block mb-1">最低质量分数: {{ minQuality }}</label>
      <input
        v-model.number="minQuality"
        type="range"
        min="0"
        max="100"
        step="1"
        class="w-full h-1.5 bg-genome-surface-2 rounded-lg appearance-none cursor-pointer accent-genome-blue"
      />
    </div>
    <div>
      <label class="text-[10px] text-genome-text-dim block mb-1">变异类型</label>
      <select
        v-model="variantType"
        class="w-full px-2 py-1.5 text-xs bg-genome-surface-2 text-genome-text border border-genome-border rounded-lg focus:outline-none focus:border-genome-blue"
      >
        <option v-for="t in variantTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
      </select>
    </div>
    <div>
      <label class="text-[10px] text-genome-text-dim block mb-1">最低致病性概率: {{ minPathogenicity.toFixed(2) }}</label>
      <input
        v-model.number="minPathogenicity"
        type="range"
        min="0"
        max="1"
        step="0.01"
        class="w-full h-1.5 bg-genome-surface-2 rounded-lg appearance-none cursor-pointer accent-genome-blue"
      />
    </div>
    <div v-if="exporting" class="w-full h-1.5 bg-genome-surface-2 rounded-full overflow-hidden">
      <div
        class="h-full bg-genome-blue rounded-full transition-all duration-300"
        :style="{ width: `${exportProgress}%` }"
      />
    </div>
    <button
      :disabled="!canExport"
      class="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors"
      :class="canExport
        ? 'bg-genome-blue text-white hover:bg-genome-blue-light'
        : 'bg-genome-surface-2 text-genome-text-dim cursor-not-allowed'"
      @click="handleExport"
    >
      <Loader2 v-if="exporting" class="w-3.5 h-3.5 animate-spin" />
      <Download v-else class="w-3.5 h-3.5" />
      {{ exporting ? '导出中...' : '导出变异' }}
    </button>
  </div>
</template>
