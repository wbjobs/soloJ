export interface FastaRecord {
  header: string
  sequence: string
  length: number
}

export interface AlignRequest {
  seq1: string
  seq2: string
  matrix?: string
  gap_open?: number
  gap_ext?: number
  heatmap_bins?: number
}

export interface AlignResponse {
  cached: boolean
  score: number
  score_percent: number
  length: number
  matches: number
  mismatches: number
  gaps: number
  seq1: {
    start: number
    end: number
    length: number
    aligned: string
  }
  seq2: {
    start: number
    end: number
    length: number
    aligned: string
  }
  midline: string
  heatmap: {
    rows: number
    cols: number
    data: number[][]
    seq1_len: number
    seq2_len: number
  }
}

export interface DiffRegion {
  row: number
  col_start: number
  col_end: number
}

export interface SimilarityRegion {
  seq_id: string
  start: number
  end: number
  score: number
  length: number
}

export interface SimilarityWindowsResponse {
  window_size: number
  step: number
  min_similarity: number
  regions: SimilarityRegion[]
}

export interface MultiAlignResponse {
  num_sequences: number
  num_pairs: number
  pairs: Record<
    string,
    {
      score: number
      score_percent: number
      length: number
      matches: number
      mismatches: number
      gaps: number
      seq1_start: number
      seq1_end: number
      seq2_start: number
      seq2_end: number
      aligned_seq1: string
      aligned_seq2: string
      midline: string
      heatmap: { rows: number; cols: number; data: number[][] }
    }
  >
}

export interface MultiSimilarityResponse {
  num_sequences: number
  window_size: number
  min_similarity: number
  pairs: Record<string, SimilarityRegion[]>
}
