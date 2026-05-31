// Dot plot k-mer matching worker - runs in background to avoid UI blocking

export interface DotWorkerRequest {
  type: 'compute'
  payload: {
    seq1: string
    seq2: string
    kmer: number
    step: number
    // Viewport constraints (optional) for view-frustum culling
    viewport?: {
      iMin: number
      iMax: number
      jMin: number
      jMax: number
    }
    // Max dots before switching to density mode
    maxDots: number
    // Density grid size for heatmap fallback
    densityBins: number
  }
}

export interface DotWorkerProgress {
  type: 'progress'
  stage: string
  percent: number
}

export interface DotWorkerResult {
  type: 'result'
  ok: boolean
  error?: string
  dots?: { i: number; j: number }[]
  // If too many dots, return density heatmap instead
  density?: {
    bins: number
    data: Uint32Array
    iMin: number
    iMax: number
    jMin: number
    jMax: number
  }
  totalMatches: number
  mode: 'dots' | 'density'
}

export type DotWorkerMessage = DotWorkerProgress | DotWorkerResult

function buildIndex(seq: string, kmer: number, step: number, onProgress: (p: number) => void): Map<string, number[]> {
  const index = new Map<string, number[]>()
  const total = Math.max(1, Math.floor((seq.length - kmer) / step) + 1)
  let count = 0
  for (let j = 0; j + kmer <= seq.length; j += step) {
    const k = seq.slice(j, j + kmer)
    if (!index.has(k)) index.set(k, [])
    index.get(k)!.push(j)
    count++
    if (count % 5000 === 0) onProgress(count / total * 50)
  }
  return index
}

function computeDots(
  seq1: string,
  seq2: string,
  kmer: number,
  step: number,
  viewport: { iMin: number; iMax: number; jMin: number; jMax: number } | undefined,
  maxDots: number,
  densityBins: number,
  onProgress: (stage: string, p: number) => void,
): { dots?: { i: number; j: number }[]; density?: DotWorkerResult['density']; totalMatches: number; mode: 'dots' | 'density' } {
  onProgress('indexing', 10)
  const index = buildIndex(seq2, kmer, step, (p) => onProgress('indexing', 10 + p * 0.4))

  onProgress('matching', 50)

  const iMin = viewport?.iMin ?? 0
  const iMax = viewport?.iMax ?? seq1.length
  const jMin = viewport?.jMin ?? 0
  const jMax = viewport?.jMax ?? seq2.length

  // Round i start to step-aligned
  const iStart = Math.ceil(iMin / step) * step
  const totalI = Math.max(1, Math.floor((Math.min(seq1.length - kmer, iMax) - iStart) / step) + 1)

  const dots: { i: number; j: number }[] = []
  let totalMatches = 0
  let count = 0
  let overflow = false

  // Density grid for overflow case
  const diMin = Math.floor(iMin / step) * step
  const diMax = Math.ceil(iMax / step) * step
  const djMin = Math.floor(jMin / step) * step
  const djMax = Math.ceil(jMax / step) * step
  const binSizeI = Math.max(1, Math.ceil((diMax - diMin) / densityBins / step) * step)
  const binSizeJ = Math.max(1, Math.ceil((djMax - djMin) / densityBins / step) * step)
  const binsI = Math.ceil((diMax - diMin) / binSizeI) + 1
  const binsJ = Math.ceil((djMax - djMin) / binSizeJ) + 1
  const densityData = new Uint32Array(binsI * binsJ)

  for (let i = iStart; i + kmer <= seq1.length && i <= iMax; i += step) {
    const k = seq1.slice(i, i + kmer)
    const hits = index.get(k)
    if (hits) {
      for (const j of hits) {
        if (j < jMin || j > jMax) continue
        totalMatches++
        if (!overflow) {
          dots.push({ i, j })
          if (dots.length > maxDots) {
            overflow = true
            // Convert existing dots to density
            for (const d of dots) {
              const bi = Math.floor((d.i - diMin) / binSizeI)
              const bj = Math.floor((d.j - djMin) / binSizeJ)
              if (bi >= 0 && bi < binsI && bj >= 0 && bj < binsJ) {
                densityData[bi * binsJ + bj]++
              }
            }
            dots.length = 0
          }
        } else {
          const bi = Math.floor((i - diMin) / binSizeI)
          const bj = Math.floor((j - djMin) / binSizeJ)
          if (bi >= 0 && bi < binsI && bj >= 0 && bj < binsJ) {
            densityData[bi * binsJ + bj]++
          }
        }
      }
    }
    count++
    if (count % 2000 === 0) onProgress('matching', 50 + (count / totalI) * 50)
  }

  if (overflow) {
    return {
      density: {
        bins: densityBins,
        data: densityData,
        iMin: diMin,
        iMax: diMax,
        jMin: djMin,
        jMax: djMax,
      },
      totalMatches,
      mode: 'density',
    }
  }
  return { dots, totalMatches, mode: 'dots' }
}

self.onmessage = (e: MessageEvent<DotWorkerRequest>) => {
  const msg = e.data
  if (msg.type !== 'compute') return
  try {
    const { seq1, seq2, kmer, step, viewport, maxDots, densityBins } = msg.payload
    const result = computeDots(
      seq1,
      seq2,
      kmer,
      step,
      viewport,
      maxDots,
      densityBins,
      (stage, p) => {
        const out: DotWorkerMessage = { type: 'progress', stage, percent: p }
        self.postMessage(out)
      },
    )
    const out: DotWorkerMessage = { type: 'result', ok: true, ...result }
    self.postMessage(out, result.density ? [result.density.data.buffer] : [])
  } catch (err) {
    const out: DotWorkerMessage = {
      type: 'result',
      ok: false,
      error: (err as Error).message,
      totalMatches: 0,
      mode: 'dots',
    }
    self.postMessage(out)
  }
}

export {}
