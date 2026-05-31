<script setup lang="ts">
import { ref, computed } from 'vue'
import { UploadCloud } from 'lucide-vue-next'
import { useFilesStore } from '@/stores/files'

const filesStore = useFilesStore()
const isDragOver = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const acceptTypes = '.bam,.vcf,.vcf.gz,.bed,.gff,.fasta,.fa'

const uploading = computed(() => Object.keys(filesStore.uploadProgress).length > 0)
const uploadPct = computed(() => {
  const keys = Object.keys(filesStore.uploadProgress)
  if (keys.length === 0) return 0
  const vals = keys.map((k) => filesStore.uploadProgress[k])
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
})
const isMerging = computed(() => uploadPct.value >= 95 && uploadPct.value < 100)
const isLargeUpload = computed(() => uploadPct.value > 0 && uploadPct.value <= 95 && Object.keys(filesStore.uploadProgress).length > 0)

function onDragOver(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = true
}

function onDragLeave() {
  isDragOver.value = false
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = false
  const files = e.dataTransfer?.files
  if (files) handleFiles(files)
}

function onClick() {
  fileInput.value?.click()
}

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files) handleFiles(target.files)
  target.value = ''
}

async function handleFiles(fileList: FileList) {
  for (const file of Array.from(fileList)) {
    try {
      await filesStore.upload(file)
    } catch {
      // error handled in store
    }
  }
}

function formatSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`
  return `${bytes} B`
}
</script>

<template>
  <div
    class="border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 cursor-pointer"
    :class="isDragOver
      ? 'border-genome-blue bg-genome-blue/10'
      : 'border-genome-border hover:border-genome-blue/50 hover:bg-genome-surface-2'"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
    @click="onClick"
  >
    <input
      ref="fileInput"
      type="file"
      :accept="acceptTypes"
      multiple
      class="hidden"
      @change="onFileChange"
    />
    <UploadCloud class="w-8 h-8 mx-auto mb-2" :class="isDragOver ? 'text-genome-blue' : 'text-genome-text-dim'" />
    <p v-if="!uploading" class="text-sm text-genome-text-muted">
      {{ isDragOver ? '释放文件以上传' : '拖拽文件到此处或点击上传' }}
    </p>
    <template v-else>
      <div class="w-full bg-genome-surface-2 rounded-full h-2 mb-2">
        <div
          class="bg-genome-blue h-2 rounded-full transition-all duration-300"
          :style="{ width: uploadPct + '%' }"
        />
      </div>
      <p class="text-xs text-genome-text-muted">
        <template v-if="isMerging">服务端处理中...</template>
        <template v-else-if="isLargeUpload">分片上传中... {{ uploadPct }}%</template>
        <template v-else>上传中... {{ uploadPct }}%</template>
      </p>
    </template>
    <p v-if="!uploading" class="text-[10px] text-genome-text-dim mt-1 font-mono">
      支持 BAM / VCF / BED / GFF / FASTA
    </p>
  </div>
</template>
