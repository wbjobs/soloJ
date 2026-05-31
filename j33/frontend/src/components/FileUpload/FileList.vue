<script setup lang="ts">
import { computed } from 'vue'
import { useFilesStore } from '@/stores/files'
import { useBrowserStore } from '@/stores/browser'
import { FileText, Trash2, CheckCircle, AlertCircle, Loader2, Download } from 'lucide-vue-next'
import type { GenomicFile } from '@/types'

const filesStore = useFilesStore()
const browserStore = useBrowserStore()

const sortedFiles = computed(() =>
  [...filesStore.files].sort((a, b) =>
    new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  )
)

function formatSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`
  return `${bytes} B`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function getStatusIcon(file: GenomicFile) {
  switch (file.status) {
    case 'ready': return CheckCircle
    case 'error': return AlertCircle
    case 'uploading':
    case 'processing': return Loader2
    default: return FileText
  }
}

function getStatusColor(file: GenomicFile): string {
  switch (file.status) {
    case 'ready': return 'text-genome-green'
    case 'error': return 'text-genome-red'
    case 'uploading':
    case 'processing': return 'text-genome-orange'
    default: return 'text-genome-text-dim'
  }
}

function selectFile(file: GenomicFile) {
  if (file.status !== 'ready') return
  browserStore.setActiveFile(file.id)
}

function isActive(file: GenomicFile): boolean {
  return browserStore.activeFileId === file.id
}

function scrollToExport() {
  browserStore.setActiveFile(browserStore.activeFileId ?? '')
}
</script>

<template>
  <div class="space-y-1 max-h-64 overflow-y-auto">
    <div
      v-for="file in sortedFiles"
      :key="file.id"
      class="flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 cursor-pointer"
      :class="isActive(file)
        ? 'bg-genome-blue/20 border border-genome-blue/40'
        : 'hover:bg-genome-surface-2 border border-transparent'"
      @click="selectFile(file)"
    >
      <component
        :is="getStatusIcon(file)"
        class="w-4 h-4 flex-shrink-0"
        :class="[getStatusColor(file), file.status === 'processing' ? 'animate-spin' : '']"
      />
      <div class="flex-1 min-w-0">
        <div class="text-xs text-genome-text truncate">{{ file.name }}</div>
        <div class="text-[10px] font-mono text-genome-text-dim">
          {{ file.type.toUpperCase() }} · {{ formatSize(file.size) }} · {{ formatDate(file.uploadedAt) }}
        </div>
      </div>
      <button
        v-if="isActive(file) && file.type === 'vcf'"
        class="p-1 rounded hover:bg-genome-blue/20 text-genome-text-dim hover:text-genome-blue transition-colors"
        title="导出变异"
        @click.stop="scrollToExport"
      >
        <Download class="w-3 h-3" />
      </button>
      <button
        class="p-1 rounded hover:bg-genome-red/20 text-genome-text-dim hover:text-genome-red transition-colors"
        @click.stop="filesStore.removeFile(file.id)"
      >
        <Trash2 class="w-3 h-3" />
      </button>
    </div>
    <div
      v-if="sortedFiles.length === 0"
      class="text-center py-4 text-xs text-genome-text-dim"
    >
      暂无文件
    </div>
  </div>
</template>
