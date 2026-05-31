export type WorkerRequest =
  | { type: 'align'; payload: { seq1: string; seq2: string; matrix: string; gap_open: number; gap_ext: number } }
  | { type: 'cancel' }

export type WorkerProgress = {
  type: 'progress'
  stage: string
  percent: number
}

export type WorkerResult = {
  type: 'result'
  ok: boolean
  error?: string
  alignment?: {
    score: number
    matches: number
    mismatches: number
    gaps: number
    length: number
    seq1_start: number
    seq1_end: number
    seq2_start: number
    seq2_end: number
    aligned_seq1: string
    aligned_seq2: string
    midline: string
  }
}

export type WorkerMessage = WorkerProgress | WorkerResult
