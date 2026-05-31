import type {
  AlignRequest,
  AlignResponse,
  FastaRecord,
  MultiAlignResponse,
  MultiSimilarityResponse,
  SimilarityWindowsResponse,
} from './types'

const API_BASE = (import.meta.env.VITE_API_BASE as string) || ''

async function postJson<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`
    try {
      const err = await res.json()
      if (err?.error) msg = err.error
    } catch {
      // ignore
    }
    throw new Error(msg)
  }
  return (await res.json()) as T
}

export async function parseFasta(text: string): Promise<FastaRecord[]> {
  const res = await postJson<{ records: FastaRecord[] }>('/api/parse-fasta', { text })
  return res.records
}

export async function listMatrices(): Promise<string[]> {
  const res = await fetch(API_BASE + '/api/matrices').then((r) => r.json())
  return (res as { matrices: string[] }).matrices
}

export async function align(req: AlignRequest): Promise<AlignResponse> {
  return postJson<AlignResponse>('/api/align', req)
}

export async function alignMulti(
  sequences: string[],
  matrix?: string,
  gap_open?: number,
  gap_ext?: number,
): Promise<MultiAlignResponse> {
  return postJson<MultiAlignResponse>('/api/align/multi', {
    sequences,
    matrix,
    gap_open,
    gap_ext,
  })
}

export async function similarityWindows(
  seq1: string,
  seq2: string,
  options?: {
    window_size?: number
    step?: number
    min_similarity?: number
    min_region_length?: number
    merge_distance?: number
  },
): Promise<SimilarityWindowsResponse> {
  return postJson<SimilarityWindowsResponse>('/api/similarity/windows', {
    seq1,
    seq2,
    ...options,
  })
}

export async function similarityMulti(
  sequences: string[],
  options?: {
    window_size?: number
    step?: number
    min_similarity?: number
  },
): Promise<MultiSimilarityResponse> {
  return postJson<MultiSimilarityResponse>('/api/similarity/multi', {
    sequences,
    ...options,
  })
}

export async function exportGff3(
  regions: Array<{
    seq_id?: string
    start: number
    end: number
    score: number
    source?: string
    feature?: string
  }>,
  options?: { ref_seq?: string; source?: string; seq_id_prefix?: string },
): Promise<void> {
  const res = await fetch(API_BASE + '/api/export/gff3', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ regions, ...options }),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'similarity_regions.gff3'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function getDiffRegions(
  heatmap: number[][],
  threshold = 0.5,
): Promise<{ threshold: number; regions: { row: number; col_start: number; col_end: number }[] }> {
  return postJson('/api/heatmap/diff', { heatmap, threshold })
}
