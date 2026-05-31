import axios from 'axios'
import type {
  GenomicFile,
  RegionData,
  Variant,
  VariantAnnotation,
  Task,
  SamplePair,
  PathogenicityResult,
  HeatmapCell,
  VariantExportFilters,
} from '@/types'

const CHUNK_SIZE = 10 * 1024 * 1024

const api = axios.create({
  baseURL: '/api',
  timeout: 300000,
  headers: { 'Content-Type': 'application/json' },
})

const chunkApi = axios.create({
  baseURL: '/api',
  timeout: 120000,
  headers: { 'Content-Type': 'multipart/form-data' },
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err.response?.data?.detail || err.message || '请求失败'
    return Promise.reject(new Error(message))
  }
)

chunkApi.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err.response?.data?.detail || err.message || '请求失败'
    return Promise.reject(new Error(message))
  }
)

export async function uploadFile(file: File, onProgress?: (pct: number) => void): Promise<GenomicFile> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<GenomicFile>('/files/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
    onUploadProgress: (e) => {
      if (e.total && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    },
  })
  return data
}

export async function initChunkUpload(
  fileName: string,
  fileSize: number,
  fileType: string,
  totalChunks: number,
  sampleName = ''
): Promise<{ upload_id: string; file_id: string }> {
  const { data } = await api.post<{ upload_id: string; file_id: string }>('/files/chunk-upload/init/', {
    filename: fileName,
    file_size: fileSize,
    file_type: fileType,
    total_chunks: totalChunks,
    sample_name: sampleName,
  })
  return data
}

export async function uploadChunk(
  uploadId: string,
  chunkIndex: number,
  chunkData: Blob
): Promise<void> {
  const form = new FormData()
  form.append('upload_id', uploadId)
  form.append('chunk_index', String(chunkIndex))
  form.append('chunk_file', chunkData)
  await chunkApi.post('/files/chunk-upload/chunk/', form)
}

export async function completeChunkUpload(uploadId: string): Promise<GenomicFile> {
  const { data } = await api.post<GenomicFile>('/files/chunk-upload/complete/', {
    upload_id: uploadId,
  })
  return data
}

export async function fetchFileStatus(fileId: string): Promise<GenomicFile> {
  const { data } = await api.get<GenomicFile>(`/files/${fileId}/`)
  return data
}

export async function chunkedUpload(
  file: File,
  fileType: string,
  onProgress?: (pct: number) => void,
  sampleName = ''
): Promise<GenomicFile> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
  const { upload_id } = await initChunkUpload(file.name, file.size, fileType, totalChunks, sampleName)

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)
    await uploadChunk(upload_id, i, chunk)
    if (onProgress) {
      onProgress(Math.round(((i + 1) / totalChunks) * 95))
    }
  }

  const result = await completeChunkUpload(upload_id)
  if (onProgress) onProgress(100)
  return result
}

export async function fetchFiles(): Promise<GenomicFile[]> {
  const { data } = await api.get<GenomicFile[]>('/files')
  return data
}

export async function deleteFile(fileId: string): Promise<void> {
  await api.delete(`/files/${fileId}`)
}

export async function fetchRegion(
  fileId: string,
  chrom: string,
  start: number,
  end: number
): Promise<RegionData> {
  const { data } = await api.get<RegionData>(`/files/${fileId}/region`, {
    params: { chrom, start, end },
  })
  return data
}

export async function fetchCoverage(
  fileId: string,
  chrom: string,
  start: number,
  end: number,
  buckets = 500
): Promise<{ position: number; depth: number }[]> {
  const { data } = await api.get(`/files/${fileId}/coverage`, {
    params: { chrom, start, end, buckets },
  })
  return data
}

export async function fetchVariants(
  fileId: string,
  chrom: string,
  start: number,
  end: number
): Promise<Variant[]> {
  const { data } = await api.get<Variant[]>(`/files/${fileId}/variants`, {
    params: { chrom, start, end },
  })
  return data
}

export async function fetchVariantAnnotation(variantId: string): Promise<VariantAnnotation> {
  const { data } = await api.get<VariantAnnotation>(`/variants/${variantId}/annotation`)
  return data
}

export async function fetchTasks(): Promise<Task[]> {
  const { data } = await api.get<Task[]>('/tasks')
  return data
}

export async function fetchTask(taskId: string): Promise<Task> {
  const { data } = await api.get<Task>(`/tasks/${taskId}`)
  return data
}

export async function compareSamples(
  fileAId: string,
  fileBId: string,
  chrom: string,
  start: number,
  end: number,
  genomeBuildA?: string,
  genomeBuildB?: string
): Promise<SamplePair> {
  const payload: Record<string, unknown> = {
    file_a_id: fileAId,
    file_b_id: fileBId,
    chrom,
    start,
    end,
  }
  if (genomeBuildA) payload.genome_build_a = genomeBuildA
  if (genomeBuildB) payload.genome_build_b = genomeBuildB
  const { data } = await api.post<SamplePair>('/compare', payload)
  return data
}

export async function fetchSamplePairs(): Promise<SamplePair[]> {
  const { data } = await api.get<SamplePair[]>('/compare')
  return data
}

export async function predictPathogenicity(
  features: Record<string, number>
): Promise<PathogenicityResult> {
  const { data } = await api.post<PathogenicityResult>('/prediction/predict/', features)
  return data
}

export async function exportVariants(
  fileId: string,
  chrom: string,
  start: number,
  end: number,
  filters?: VariantExportFilters
): Promise<Blob> {
  const { data } = await api.post<Blob>(`/files/${fileId}/export`, {
    chrom,
    start,
    end,
    ...filters,
  }, {
    responseType: 'blob',
  })
  return data
}

export async function fetchHeatmapData(
  fileId: string,
  chrom: string,
  start: number,
  end: number
): Promise<HeatmapCell[]> {
  const { data } = await api.get<HeatmapCell[]>(`/browser/${fileId}/heatmap/`, {
    params: { chrom, start, end },
  })
  return data
}

export default api
