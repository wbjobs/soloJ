import { smithWaterman } from './sw'
import type { WorkerMessage, WorkerRequest } from './workerTypes'

let cancelled = false

function shouldCancel() {
  return cancelled
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data
  if (msg.type === 'cancel') {
    cancelled = true
    return
  }
  if (msg.type === 'align') {
    cancelled = false
    const { seq1, seq2, matrix, gap_open, gap_ext } = msg.payload
    try {
      const result = smithWaterman(
        seq1,
        seq2,
        matrix,
        gap_open,
        gap_ext,
        (stage, percent) => {
          const out: WorkerMessage = { type: 'progress', stage, percent }
          self.postMessage(out)
        },
        shouldCancel,
      )
      const out: WorkerMessage = { type: 'result', ok: true, alignment: result }
      self.postMessage(out)
    } catch (err) {
      const out: WorkerMessage = {
        type: 'result',
        ok: false,
        error: (err as Error).message,
      }
      self.postMessage(out)
    }
  }
}

export {}
