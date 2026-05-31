// Smith-Waterman implementation for the Web Worker.
// Used for client-side, offline alignment to avoid backend dependency.

interface MatrixMap {
  [key: string]: number
}

const DNA_MATRIX: MatrixMap = {}
const DNA_BASES = ['A', 'T', 'G', 'C', 'N']
for (const a of DNA_BASES) {
  for (const b of DNA_BASES) {
    DNA_MATRIX[a + b] = a === b ? 2 : a === 'N' || b === 'N' ? 0 : -1
  }
}

// Compact BLOSUM62 (PAML order A R N D C Q E G H I L K M F P S T W Y V)
const BLOSUM62_ORDER = 'ARNDCQEGHILKMFPSTWYV'
const BLOSUM62_ROWS: Record<string, number[]> = {
  A: [4, -1, -2, -2, 0, -1, -1, 0, -2, -1, -1, -1, -1, -2, -1, 1, 0, -3, -2, 0],
  R: [-1, 5, 0, -2, -3, 1, 0, -2, 0, -3, -2, 2, -1, -3, -2, -1, -1, -3, -2, -3],
  N: [-2, 0, 6, 1, -3, 0, 0, 0, 1, -3, -3, 0, -2, -3, -2, 1, 0, -4, -2, -3],
  D: [-2, -2, 1, 6, -3, 0, 2, -1, -1, -3, -4, -1, -3, -3, -1, 0, -1, -4, -3, -3],
  C: [0, -3, -3, -3, 9, -3, -4, -3, -3, -1, -1, -3, -1, -2, -3, -1, -1, -2, -2, -1],
  Q: [-1, 1, 0, 0, -3, 5, 2, -2, 0, -3, -2, 1, 0, -3, -1, 0, -1, -2, -1, -2],
  E: [-1, 0, 0, 2, -4, 2, 5, -2, 0, -3, -3, 1, -2, -3, -1, 0, -1, -3, -2, -2],
  G: [0, -2, 0, -1, -3, -2, -2, 6, -2, -4, -4, -2, -3, -3, -2, 0, -2, -2, -3, -3],
  H: [-2, 0, 1, -1, -3, 0, 0, -2, 8, -3, -3, -1, -2, -1, -2, -1, -2, -2, 2, -3],
  I: [-1, -3, -3, -3, -1, -3, -3, -4, -3, 4, 2, -3, 1, 0, -3, -2, -1, -3, -1, 3],
  L: [-1, -2, -3, -4, -1, -2, -3, -4, -3, 2, 4, -2, 2, 0, -3, -2, -1, -2, -1, 1],
  K: [-1, 2, 0, -1, -3, 1, 1, -2, -1, -3, -2, 5, -1, -3, -1, 0, -1, -3, -2, -2],
  M: [-1, -1, -2, -3, -1, 0, -2, -3, -2, 1, 2, -1, 5, 0, -2, -1, -1, -1, -1, 1],
  F: [-2, -3, -3, -3, -2, -3, -3, -3, -1, 0, 0, -3, 0, 6, -4, -2, -2, 1, 3, -1],
  P: [-1, -2, -2, -1, -3, -1, -1, -2, -2, -3, -3, -1, -2, -4, 7, -1, -1, -4, -3, -2],
  S: [1, -1, 1, 0, -1, 0, 0, 0, -1, -2, -2, 0, -1, -2, -1, 4, 1, -3, -2, -2],
  T: [0, -1, 0, -1, -1, -1, -1, -2, -2, -1, -1, -1, -1, -2, -1, 1, 5, -2, -2, 0],
  W: [-3, -3, -4, -4, -2, -2, -3, -2, -2, -3, -2, -3, -1, 1, -4, -3, -2, 11, 2, -3],
  Y: [-2, -2, -2, -3, -2, -1, -2, -3, 2, -1, -1, -2, -1, 3, -3, -2, -2, 2, 7, -1],
  V: [0, -3, -3, -3, -1, -2, -2, -3, -3, 3, 1, -2, 1, -1, -2, -2, 0, -3, -1, 4],
}

function blosum62(a: string, b: string): number {
  const ai = BLOSUM62_ORDER.indexOf(a.toUpperCase())
  const bi = BLOSUM62_ORDER.indexOf(b.toUpperCase())
  if (ai < 0 || bi < 0) return -4
  return BLOSUM62_ROWS[a.toUpperCase()][bi]
}

const PAM250_ORDER = 'ARNDCQEGHILKMFPSTWYV'
const PAM250_ROWS: Record<string, number[]> = {
  A: [2, -2, 0, 0, -2, 0, 0, 1, -1, -1, -2, -1, -1, -3, 1, 1, 1, -6, -3, 0],
  R: [-2, 6, 0, -1, -4, 1, -1, -3, 2, -2, -3, 3, 0, -4, 0, 0, -1, 2, -4, -2],
  N: [0, 0, 2, 2, -4, 1, 2, 0, 2, -2, -3, 1, -2, -3, 0, 1, 0, -4, -2, -2],
  D: [0, -1, 2, 4, -5, 2, 3, 1, 1, -2, -4, 0, -3, -6, -1, 0, 0, -7, -4, -2],
  C: [-2, -4, -4, -5, 12, -5, -5, -3, -3, -2, -6, -5, -5, -4, -3, 0, -2, -8, 0, -2],
  Q: [0, 1, 1, 2, -5, 4, 2, -1, 3, -2, -2, 1, -1, -5, 0, -1, -1, -5, -4, -2],
  E: [0, -1, 2, 3, -5, 2, 4, 0, 1, -2, -3, 0, -2, -5, -1, 0, 0, -7, -4, -2],
  G: [1, -3, 0, 1, -3, -1, 0, 5, -2, -3, -4, -2, -3, -5, 0, 1, -1, -7, -5, -1],
  H: [-1, 2, 2, 1, -3, 3, 1, -2, 6, -2, -2, 0, -2, -2, 0, -1, -1, -3, 0, -2],
  I: [-1, -2, -2, -2, -2, -2, -2, -3, -2, 5, 2, -2, 2, 1, -2, -1, 0, -5, -1, 4],
  L: [-2, -3, -3, -4, -6, -2, -3, -4, -2, 2, 6, -3, 4, 2, -3, -3, -2, -2, -1, 2],
  K: [-1, 3, 1, 0, -5, 1, 0, -2, 0, -2, -3, 5, 0, -5, -1, 0, 0, -3, -4, -2],
  M: [-1, 0, -2, -3, -5, -1, -2, -3, -2, 2, 4, 0, 6, 0, -2, -2, -1, -4, -2, 2],
  F: [-3, -4, -3, -6, -4, -5, -5, -5, -2, 1, 2, -5, 0, 9, -5, -3, -3, 0, 7, -1],
  P: [1, 0, 0, -1, -3, 0, -1, 0, 0, -2, -3, -1, -2, -5, 6, 1, 0, -6, -5, -1],
  S: [1, 0, 1, 0, 0, -1, 0, 1, -1, -1, -3, 0, -2, -3, 1, 2, 1, -2, -3, -1],
  T: [1, -1, 0, 0, -2, -1, 0, -1, -1, 0, -2, 0, -1, -3, 0, 1, 3, -5, -3, 0],
  W: [-6, 2, -4, -7, -8, -5, -7, -7, -3, -5, -2, -3, -4, 0, -6, -2, -5, 17, 0, -6],
  Y: [-3, -4, -2, -4, 0, -4, -4, -5, 0, -1, -1, -4, -2, 7, -5, -3, -3, 0, 10, -2],
  V: [0, -2, -2, -2, -2, -2, -2, -1, -2, 4, 2, -2, 2, -1, -1, -1, 0, -6, -2, 4],
}

function pam250(a: string, b: string): number {
  const ai = PAM250_ORDER.indexOf(a.toUpperCase())
  const bi = PAM250_ORDER.indexOf(b.toUpperCase())
  if (ai < 0 || bi < 0) return -4
  return PAM250_ROWS[a.toUpperCase()][bi]
}

function scoreFn(matrix: string): (a: string, b: string) => number {
  const m = matrix.toLowerCase()
  if (m === 'blosum62') return blosum62
  if (m === 'pam250') return pam250
  return (a: string, b: string) => DNA_MATRIX[(a + b).toUpperCase()] ?? -1
}

export interface AlignOutput {
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

export function smithWaterman(
  seq1: string,
  seq2: string,
  matrix: string,
  gapOpen: number,
  gapExt: number,
  onProgress?: (stage: string, percent: number) => void,
  shouldCancel?: () => boolean,
): AlignOutput {
  const n = seq1.length
  const m = seq2.length
  const sc = scoreFn(matrix)

  // Full DP for short sequences; for longer ones use block-row approach with
  // traceback window.
  const useBlock = n > 2000 || m > 2000

  if (useBlock) {
    return blockSW(seq1, seq2, sc, gapOpen, gapExt, onProgress, shouldCancel)
  }
  return fullSW(seq1, seq2, sc, gapOpen, gapExt, onProgress, shouldCancel)
}

function fullSW(
  seq1: string,
  seq2: string,
  sc: (a: string, b: string) => number,
  gapOpen: number,
  gapExt: number,
  onProgress?: (stage: string, percent: number) => void,
  shouldCancel?: () => boolean,
): AlignOutput {
  const n = seq1.length
  const m = seq2.length
  const H: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  const E: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(-Infinity))
  const F: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(-Infinity))
  const trace: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))

  let maxScore = 0
  let bi = 0
  let bj = 0

  for (let i = 1; i <= n; i++) {
    if (shouldCancel?.()) throw new Error('cancelled')
    if (i % 50 === 0) onProgress?.('dp', (i / n) * 80)
    for (let j = 1; j <= m; j++) {
      const s = sc(seq1[i - 1], seq2[j - 1])
      E[i][j] = Math.max(H[i][j - 1] + gapOpen, E[i][j - 1] + gapExt)
      F[i][j] = Math.max(H[i - 1][j] + gapOpen, F[i - 1][j] + gapExt)
      const diag = H[i - 1][j - 1] + s
      const best = Math.max(0, diag, E[i][j], F[i][j])
      H[i][j] = best
      if (best === 0) trace[i][j] = 0
      else if (best === diag) trace[i][j] = 1
      else if (best === E[i][j]) trace[i][j] = 2
      else trace[i][j] = 3
      if (best > maxScore) {
        maxScore = best
        bi = i
        bj = j
      }
    }
  }

  return traceback(seq1, seq2, H, trace, bi, bj, maxScore, onProgress)
}

function blockSW(
  seq1: string,
  seq2: string,
  sc: (a: string, b: string) => number,
  gapOpen: number,
  gapExt: number,
  onProgress?: (stage: string, percent: number) => void,
  shouldCancel?: () => boolean,
): AlignOutput {
  const n = seq1.length
  const m = seq2.length
  let prevH = new Int32Array(m + 1)
  let prevE = new Int32Array(m + 1)
  for (let j = 0; j <= m; j++) prevE[j] = -(10 ** 9)

  let maxScore = 0
  let bi = 0
  let bj = 0

  for (let i = 1; i <= n; i++) {
    if (shouldCancel?.()) throw new Error('cancelled')
    if (i % 200 === 0) onProgress?.('dp', (i / n) * 70)
    const H = new Int32Array(m + 1)
    const E = new Int32Array(m + 1)
    E[0] = prevH[0] + gapOpen
    for (let j = 1; j <= m; j++) {
      E[j] = Math.max(prevH[j] + gapOpen, E[j - 1] + gapExt)
    }
    const aChar = seq1[i - 1]
    for (let j = 1; j <= m; j++) {
      const s = sc(aChar, seq2[j - 1])
      const diag = prevH[j - 1] + s
      const up = prevH[j] + gapOpen
      const best = Math.max(0, diag, E[j], up)
      H[j] = best
      if (best > maxScore) {
        maxScore = best
        bi = i
        bj = j
      }
    }
    prevH = H
    prevE = E
  }

  onProgress?.('traceback', 80)
  const window = Math.min(4000, Math.max(500, maxScore * 4))
  const iLo = Math.max(1, bi - window)
  const jLo = Math.max(1, bj - window)
  const iHi = Math.min(n, bi + window)
  const jHi = Math.min(m, bj + window)
  const sub1 = seq1.slice(iLo - 1, iHi)
  const sub2 = seq2.slice(jLo - 1, jHi)
  const local = fullSW(sub1, sub2, sc, gapOpen, gapExt, undefined, shouldCancel)
  local.seq1_start += iLo - 1
  local.seq1_end += iLo - 1
  local.seq2_start += jLo - 1
  local.seq2_end += jLo - 1
  return local
}

function traceback(
  seq1: string,
  seq2: string,
  H: number[][],
  trace: number[][],
  bi: number,
  bj: number,
  maxScore: number,
  onProgress?: (stage: string, percent: number) => void,
): AlignOutput {
  onProgress?.('traceback', 85)
  const a1: string[] = []
  const a2: string[] = []
  const mid: string[] = []
  let i = bi
  let j = bj
  while (i > 0 && j > 0 && H[i][j] > 0) {
    const t = trace[i][j]
    if (t === 1) {
      a1.push(seq1[i - 1])
      a2.push(seq2[j - 1])
      mid.push(seq1[i - 1] === seq2[j - 1] ? '|' : '.')
      i--
      j--
    } else if (t === 2) {
      a1.push('-')
      a2.push(seq2[j - 1])
      mid.push(' ')
      j--
    } else if (t === 3) {
      a1.push(seq1[i - 1])
      a2.push('-')
      mid.push(' ')
      i--
    } else {
      break
    }
  }
  a1.reverse()
  a2.reverse()
  mid.reverse()
  const aligned1 = a1.join('')
  const aligned2 = a2.join('')
  const midline = mid.join('')
  const length = aligned1.length
  let matches = 0
  let gaps = 0
  for (let k = 0; k < length; k++) {
    if (aligned1[k] === '-' || aligned2[k] === '-') gaps++
    else if (aligned1[k] === aligned2[k]) matches++
  }
  onProgress?.('done', 100)
  return {
    score: maxScore,
    matches,
    mismatches: length - matches - gaps,
    gaps,
    length,
    seq1_start: i,
    seq1_end: bi - 1,
    seq2_start: j,
    seq2_end: bj - 1,
    aligned_seq1: aligned1,
    aligned_seq2: aligned2,
    midline,
  }
}
