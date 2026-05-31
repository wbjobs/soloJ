<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useFilesStore } from '@/stores/files'
import { useBrowserStore } from '@/stores/browser'
import DropZone from '@/components/FileUpload/DropZone.vue'
import { FileText, HardDrive, CheckCircle, Clock } from 'lucide-vue-next'

const filesStore = useFilesStore()
const browserStore = useBrowserStore()

onMounted(() => {
  filesStore.loadFiles()
})

const totalSize = computed(() =>
  filesStore.files.reduce((s, f) => s + f.size, 0)
)

const stats = computed(() => ({
  total: filesStore.files.length,
  ready: filesStore.readyFiles.length,
  bam: filesStore.bamFiles.length,
  vcf: filesStore.vcfFiles.length,
}))

function formatSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`
  return `${bytes} B`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-CN')
}

const typeColors: Record<string, string> = {
  bam: 'bg-genome-blue/20 text-genome-blue',
  vcf: 'bg-genome-green/20 text-genome-green',
  bed: 'bg-genome-orange/20 text-genome-orange',
  gff: 'bg-purple-500/20 text-purple-400',
  fasta: 'bg-cyan-500/20 text-cyan-400',
}

function selectFile(fileId: string) {
  browserStore.setActiveFile(fileId)
}
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-medium text-genome-text">文件管理</h1>
      <div class="text-xs text-genome-text-dim font-mono">
        共 {{ stats.total }} 个文件 · {{ formatSize(totalSize) }}
      </div>
    </div>

    <div class="grid grid-cols-4 gap-3">
      <div class="px-4 py-3 bg-genome-surface rounded-lg border border-genome-border">
        <FileText class="w-5 h-5 text-genome-blue mb-2" />
        <div class="text-xl font-mono text-genome-text">{{ stats.total }}</div>
        <div class="text-[10px] text-genome-text-dim">总文件数</div>
      </div>
      <div class="px-4 py-3 bg-genome-surface rounded-lg border border-genome-border">
        <CheckCircle class="w-5 h-5 text-genome-green mb-2" />
        <div class="text-xl font-mono text-genome-text">{{ stats.ready }}</div>
        <div class="text-[10px] text-genome-text-dim">就绪文件</div>
      </div>
      <div class="px-4 py-3 bg-genome-surface rounded-lg border border-genome-border">
        <HardDrive class="w-5 h-5 text-genome-orange mb-2" />
        <div class="text-xl font-mono text-genome-text">{{ stats.bam }}</div>
        <div class="text-[10px] text-genome-text-dim">BAM 文件</div>
      </div>
      <div class="px-4 py-3 bg-genome-surface rounded-lg border border-genome-border">
        <Clock class="w-5 h-5 text-genome-text-dim mb-2" />
        <div class="text-xl font-mono text-genome-text">{{ stats.vcf }}</div>
        <div class="text-[10px] text-genome-text-dim">VCF 文件</div>
      </div>
    </div>

    <DropZone />

    <div class="bg-genome-surface rounded-lg border border-genome-border overflow-hidden">
      <table class="w-full text-xs">
        <thead>
          <tr class="border-b border-genome-border bg-genome-surface-2">
            <th class="text-left px-4 py-2 text-genome-text-dim font-medium">文件名</th>
            <th class="text-left px-4 py-2 text-genome-text-dim font-medium">类型</th>
            <th class="text-left px-4 py-2 text-genome-text-dim font-medium">大小</th>
            <th class="text-left px-4 py-2 text-genome-text-dim font-medium">状态</th>
            <th class="text-left px-4 py-2 text-genome-text-dim font-medium">上传时间</th>
            <th class="text-right px-4 py-2 text-genome-text-dim font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="file in filesStore.files"
            :key="file.id"
            class="border-b border-genome-border/50 hover:bg-genome-surface-2 transition-colors"
          >
            <td class="px-4 py-2 text-genome-text font-mono">{{ file.name }}</td>
            <td class="px-4 py-2">
              <span class="px-2 py-0.5 rounded text-[10px] font-medium" :class="typeColors[file.type]">
                {{ file.type.toUpperCase() }}
              </span>
            </td>
            <td class="px-4 py-2 text-genome-text-muted font-mono">{{ formatSize(file.size) }}</td>
            <td class="px-4 py-2">
              <span
                class="px-2 py-0.5 rounded text-[10px]"
                :class="file.status === 'ready' ? 'bg-genome-green/20 text-genome-green' : file.status === 'error' ? 'bg-genome-red/20 text-genome-red' : 'bg-genome-orange/20 text-genome-orange'"
              >{{ file.status }}</span>
            </td>
            <td class="px-4 py-2 text-genome-text-dim">{{ formatDate(file.uploadedAt) }}</td>
            <td class="px-4 py-2 text-right">
              <button
                v-if="file.status === 'ready'"
                class="px-3 py-1 rounded text-[10px] bg-genome-blue/20 text-genome-blue hover:bg-genome-blue/30 transition-colors"
                @click="selectFile(file.id)"
              >查看</button>
              <button
                class="px-3 py-1 rounded text-[10px] bg-genome-red/20 text-genome-red hover:bg-genome-red/30 transition-colors ml-1"
                @click="filesStore.removeFile(file.id)"
              >删除</button>
            </td>
          </tr>
          <tr v-if="filesStore.files.length === 0">
            <td colspan="6" class="px-4 py-8 text-center text-genome-text-dim">暂无文件，请上传基因组数据文件</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
