export interface UploadResponse {
  success: boolean
  data?: {
    pointCount: number
    positions: number[]
    colors: number[] | null
    normals: number[] | null
    boundingBox: {
      min: [number, number, number]
      max: [number, number, number]
    }
  }
  error?: string
}

export async function uploadPointCloudFile(file: File): Promise<UploadResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }

  return res.json()
}
