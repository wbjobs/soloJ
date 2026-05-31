export interface CutRequest {
  positions: number[]
  colors: number[] | null
  normals: number[] | null
  pointCount: number
  selectedIndices: number[]
  fileName?: string
}

export async function cutAndDownloadPLY(request: CutRequest): Promise<void> {
  const res = await fetch('/api/cut', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }

  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition')
  let fileName = 'pointcloud_selected.ply'

  if (disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/)
    if (match && match[1]) {
      fileName = match[1]
    }
  }

  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}
