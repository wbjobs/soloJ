import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { GenomicFile } from '@/types'
import { uploadFile, fetchFiles, deleteFile as apiDeleteFile, chunkedUpload, fetchFileStatus } from '@/api'

const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024

export const useFilesStore = defineStore('files', () => {
  const files = ref<GenomicFile[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const uploadProgress = ref<Record<string, number>>({})

  const bamFiles = computed(() => files.value.filter((f) => f.type === 'bam'))
  const vcfFiles = computed(() => files.value.filter((f) => f.type === 'vcf'))
  const readyFiles = computed(() => files.value.filter((f) => f.status === 'ready'))

  async function loadFiles() {
    loading.value = true
    error.value = null
    try {
      files.value = await fetchFiles()
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function waitForFileReady(fileId: string, tempId: string): Promise<GenomicFile> {
    const pollInterval = 2000
    const maxAttempts = 150
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const file = await fetchFileStatus(fileId)
      if (file.status === 'processing' || file.status === 'ready') {
        uploadProgress.value[tempId] = 100
        return file
      }
      if (file.status === 'error') {
        throw new Error('文件处理失败')
      }
      await new Promise((r) => setTimeout(r, pollInterval))
    }
    throw new Error('文件处理超时')
  }

  function detectFileType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop()
    if (ext === 'bam') return 'BAM'
    if (ext === 'vcf' || filename.toLowerCase().endsWith('.vcf.gz')) return 'VCF'
    return 'BAM'
  }

  async function upload(file: File) {
    const fileId = `upload-${Date.now()}`
    uploadProgress.value[fileId] = 0
    const fileType = detectFileType(file.name)
    try {
      let result: GenomicFile
      if (file.size > LARGE_FILE_THRESHOLD) {
        result = await chunkedUpload(file, fileType, (pct) => {
          uploadProgress.value[fileId] = pct
        }, file.name.replace(/\.(bam|vcf)(\.gz)?$/i, ''))
        const ready = await waitForFileReady(result.id, fileId)
        result = ready
      } else {
        result = await uploadFile(file, (pct) => {
          uploadProgress.value[fileId] = pct
        })
      }
      files.value.push(result)
      return result
    } catch (e: any) {
      error.value = e.message
      throw e
    } finally {
      delete uploadProgress.value[fileId]
    }
  }

  async function removeFile(fileId: string) {
    try {
      await apiDeleteFile(fileId)
      files.value = files.value.filter((f) => f.id !== fileId)
    } catch (e: any) {
      error.value = e.message
    }
  }

  function getFileById(fileId: string) {
    return files.value.find((f) => f.id === fileId)
  }

  return {
    files,
    loading,
    error,
    uploadProgress,
    bamFiles,
    vcfFiles,
    readyFiles,
    loadFiles,
    upload,
    removeFile,
    getFileById,
  }
})
