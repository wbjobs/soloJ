<template>
  <div class="app">
    <aside class="panel">
      <h1>DNA Sequence Alignment</h1>
      <div class="subtitle">Smith-Waterman · Dot Plot · Multi-seq · GFF3</div>

      <div class="form-row">
        <label>Upload FASTA (up to 5 sequences, ≤ 100k bases each)</label>
        <div class="file-drop" @click="triggerFile" @drop.prevent="onDrop" @dragover.prevent>
          <div>Click to choose or drop a .fa/.fasta file</div>
          <small>{{ sequences.length }}/5 sequences loaded</small>
          <input ref="fileInputRef" type="file" accept=".fa,.fasta,.txt" style="display: none" @change="onFile" />
        </div>
      </div>

      <div v-for="(seq, idx) in sequences" :key="idx" class="form-row">
        <label>Sequence {{ idx + 1 }} <button class="btn-tiny" @click="removeSequence(idx)" :disabled="sequences.length <= 2">✕</button></label>
        <textarea v-model="seq.sequence" rows="3" placeholder="ATCG..."></textarea>
        <div class="hint">{{ seq.header || `seq${idx+1}` }} · {{ seq.sequence.length }} bp</div>
      </div>

      <div v-if="sequences.length < 5" class="form-row">
        <button class="btn-small" @click="addSequence">+ Add sequence</button>
      </div>

      <div v-if="sequences.length >= 2" class="form-row">
        <label>Pair for analysis</label>
        <div class="inline">
          <select v-model="pairA">
            <option v-for="(_, i) in sequences" :key="i" :value="i">Sequence {{ i + 1 }}</option>
          </select>
          <span class="pair-sep">vs</span>
          <select v-model="pairB">
            <option v-for="(_, i) in sequences" :key="i" :value="i">Sequence {{ i + 1 }}</option>
          </select>
        </div>
      </div>

      <div v-if="sequences.length > 2" class="form-row">
        <label>Multi-sequence mode</label>
        <div class="inline">
          <button :disabled="multiRunning" @click="runMultiAlign" class="btn-small">
            {{ multiRunning ? 'Running…' : 'All pairs align' }}
          </button>
          <button :disabled="simRunning" @click="runSimilarityMulti" class="btn-small">
            {{ simRunning ? 'Running…' : 'All pairs similarity' }}
          </button>
        </div>
      </div>

      <div class="form-row">
        <label>Scoring matrix</label>
        <select v-model="matrix">
          <option v-for="m in matrices" :key="m" :value="m">{{ m }}</option>
        </select>
      </div>

      <div class="form-row">
        <label>Gap penalties</label>
        <div class="inline">
          <div>
            <label>Open</label>
            <input v-model.number="gapOpen" type="number" step="1" />
          </div>
          <div>
            <label>Extend</label>
            <input v-model.number="gapExt" type="number" step="1" />
          </div>
        </div>
      </div>

      <div class="form-row">
        <label>Sliding window</label>
        <div class="inline">
          <div>
            <label>Window</label>
            <input v-model.number="windowSize" type="number" min="10" max="2000" />
          </div>
          <div>
            <label>Step</label>
            <input v-model.number="windowStep" type="number" min="1" max="100" />
          </div>
          <div>
            <label>Min sim</label>
            <input v-model.number="minSimilarity" type="number" min="0.5" max="1" step="0.05" />
          </div>
        </div>
      </div>

      <div class="form-row">
        <label>Dot plot</label>
        <div class="inline">
          <div>
            <label>k-mer</label>
            <input v-model.number="kmer" type="number" min="3" max="31" />
          </div>
          <div>
            <label>step</label>
            <input v-model.number="step" type="number" min="1" max="20" />
          </div>
        </div>
      </div>

      <div class="form-row">
        <label>Compute</label>
        <div class="inline">
          <button :disabled="!canAlign || aligning" @click="runAlignBackend">
            {{ aligning ? 'Running…' : 'Align (backend)' }}
          </button>
          <button :disabled="!canAlign || workerRunning" @click="runAlignWorker">
            {{ workerRunning ? 'Worker…' : 'Align (Worker)' }}
          </button>
        </div>
        <div class="inline" style="margin-top: 6px">
          <button :disabled="!canAlign || simRunning" @click="runSimilarity">
            {{ simRunning ? 'Running…' : 'Find similarity' }}
          </button>
          <button :disabled="!similarityRegions.length" @click="downloadGff" class="btn-export">
            Export GFF3
          </button>
        </div>
      </div>

      <div v-if="status" class="status" :class="statusClass">{{ status }}</div>
      <div v-if="workerProgress.stage" class="status info">Worker: {{ workerProgress.stage }} ({{ workerProgress.percent.toFixed(0) }}%)</div>
    </aside>

    <main class="content">
      <div class="tabs">
        <div class="tab" :class="{ active: tab === 'dotplot' }" @click="tab = 'dotplot'">Dot Plot</div>
        <div class="tab" :class="{ active: tab === 'heatmap' }" @click="tab = 'heatmap'">Heatmap</div>
        <div class="tab" :class="{ active: tab === 'alignment' }" @click="tab = 'alignment'">Alignment</div>
        <div class="tab" :class="{ active: tab === 'similarity' }" @click="tab = 'similarity'">Similarity</div>
        <div v-if="multiAlignResults" class="tab" :class="{ active: tab === 'multi' }" @click="tab = 'multi'">Multi-seq ({{ multiPairKeys.length }})</div>
        <div v-if="multiSimilarityResults" class="tab" :class="{ active: tab === 'multisim' }" @click="tab = 'multisim'">Multi-sim</div>
      </div>

      <div v-if="alignResult" class="stats-grid">
        <div class="stat-card"><div class="label">Score</div><div class="value">{{ alignResult.score }}</div></div>
        <div class="stat-card"><div class="label">Identity</div><div class="value">{{ alignResult.score_percent.toFixed(1) }}%</div></div>
        <div class="stat-card"><div class="label">Length</div><div class="value">{{ alignResult.length }}</div></div>
        <div class="stat-card"><div class="label">Matches</div><div class="value">{{ alignResult.matches }}</div></div>
        <div class="stat-card"><div class="label">Mismatches</div><div class="value">{{ alignResult.mismatches }}</div></div>
        <div class="stat-card"><div class="label">Gaps</div><div class="value">{{ alignResult.gaps }}</div></div>
      </div>

      <div v-if="tab === 'dotplot'" class="chart-card">
        <h3>Dot Plot: seq{{ pairA + 1 }} vs seq{{ pairB + 1 }}</h3>
        <DotPlot
          ref="dotPlotRef"
          :seq1="currentSeq1"
          :seq2="currentSeq2"
          :kmer="kmer"
          :step="step"
          :highlight="highlightBox"
          @cell-click="clickedCell = $event"
        />
        <div class="hint">Scroll to zoom, drag to pan, click to inspect.</div>
      </div>

      <div v-if="tab === 'heatmap' && alignResult" class="chart-card">
        <h3>Alignment Heatmap</h3>
        <HeatMap
          ref="heatMapRef"
          :data="alignResult.heatmap.data"
          :rows="alignResult.heatmap.rows"
          :cols="alignResult.heatmap.cols"
          :seq1-len="alignResult.heatmap.seq1_len"
          :seq2-len="alignResult.heatmap.seq2_len"
          :diff-regions="diffRegions"
          @cell-click="clickedHeat = $event"
        />
      </div>

      <div v-if="tab === 'alignment' && alignResult" class="chart-card">
        <h3>Local alignment</h3>
        <AlignmentViewer
          :aligned-seq1="alignResult.seq1.aligned"
          :aligned-seq2="alignResult.seq2.aligned"
          :midline="alignResult.midline"
          :start1="alignResult.seq1.start"
          :start2="alignResult.seq2.start"
        />
      </div>

      <div v-if="tab === 'similarity'" class="chart-card">
        <h3>Similarity regions (> {{ (minSimilarity * 100).toFixed(0) }}%)</h3>
        <div class="toolbar">
          <button @click="runSimilarity" :disabled="simRunning">Refresh</button>
          <button @click="downloadGff" :disabled="!similarityRegions.length" class="btn-export">
            Export GFF3 ({{ similarityRegions.length }} regions)
          </button>
        </div>
        <div class="diff-list" v-if="similarityRegions.length">
          <div class="diff-row header">
            <span>Region</span><span>Start</span><span>End</span><span>Length</span><span>Score</span>
          </div>
          <div v-for="(r, idx) in similarityRegions" :key="idx" class="diff-row">
            <span>{{ idx + 1 }}</span>
            <span>{{ r.start }}</span>
            <span>{{ r.end }}</span>
            <span>{{ r.length }}</span>
            <span>{{ (r.score * 100).toFixed(1) }}%</span>
          </div>
        </div>
        <div v-else class="hint">Run similarity scan to find high-identity regions.</div>
      </div>

      <div v-if="tab === 'multi' && multiAlignResults" class="chart-card">
        <h3>Multi-sequence pairwise alignments ({{ multiPairKeys.length }} pairs)</h3>
        <div class="pair-selector">
          <button
            v-for="key in multiPairKeys"
            :key="key"
            class="btn-tiny"
            :class="{ active: selectedMultiPair === key }"
            @click="selectedMultiPair = key"
          >
            {{ key }}
          </button>
        </div>
        <div v-if="selectedMultiPair && multiAlignResults.pairs[selectedMultiPair]" class="multi-detail">
          <div class="stats-grid" style="grid-template-columns: repeat(4, 1fr);">
            <div class="stat-card"><div class="label">Score</div><div class="value">{{ multiAlignResults.pairs[selectedMultiPair].score }}</div></div>
            <div class="stat-card"><div class="label">Identity</div><div class="value">{{ (multiAlignResults.pairs[selectedMultiPair].score_percent).toFixed(1) }}%</div></div>
            <div class="stat-card"><div class="label">Matches</div><div class="value">{{ multiAlignResults.pairs[selectedMultiPair].matches }}</div></div>
            <div class="stat-card"><div class="label">Length</div><div class="value">{{ multiAlignResults.pairs[selectedMultiPair].length }}</div></div>
          </div>
          <AlignmentViewer
            :aligned-seq1="multiAlignResults.pairs[selectedMultiPair].aligned_seq1"
            :aligned-seq2="multiAlignResults.pairs[selectedMultiPair].aligned_seq2"
            :midline="multiAlignResults.pairs[selectedMultiPair].midline"
            :start1="multiAlignResults.pairs[selectedMultiPair].seq1_start"
            :start2="multiAlignResults.pairs[selectedMultiPair].seq2_start"
          />
        </div>
      </div>

      <div v-if="tab === 'multisim' && multiSimilarityResults" class="chart-card">
        <h3>Multi-sequence similarity scan</h3>
        <div class="pair-selector">
          <button
            v-for="key in Object.keys(multiSimilarityResults.pairs)"
            :key="key"
            class="btn-tiny"
            :class="{ active: selectedMultiSimPair === key }"
            @click="selectedMultiSimPair = key"
          >
            {{ key }} ({{ (multiSimilarityResults.pairs[key] || []).length }})
          </button>
        </div>
        <div v-if="selectedMultiSimPair && multiSimilarityResults.pairs[selectedMultiSimPair]" class="diff-list">
          <div class="diff-row header">
            <span>Region</span><span>Start</span><span>End</span><span>Length</span><span>Score</span>
          </div>
          <div v-for="(r, idx) in multiSimilarityResults.pairs[selectedMultiSimPair]" :key="idx" class="diff-row">
            <span>{{ idx + 1 }}</span>
            <span>{{ r.start }}</span>
            <span>{{ r.end }}</span>
            <span>{{ r.length }}</span>
            <span>{{ (r.score * 100).toFixed(1) }}%</span>
          </div>
          <div v-if="!multiSimilarityResults.pairs[selectedMultiSimPair].length" class="hint">No high-similarity regions found.</div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import DotPlot from './components/DotPlot.vue'
import HeatMap from './components/HeatMap.vue'
import AlignmentViewer from './components/AlignmentViewer.vue'
import * as api from './api'
import type { AlignResponse, MultiAlignResponse, MultiSimilarityResponse, SimilarityRegion } from './types'
import type { WorkerMessage } from './workerTypes'

const MAX_SEQUENCES = 5

interface SeqRecord {
  header: string
  sequence: string
}

const fileInputRef = ref<HTMLInputElement | null>(null)
const sequences = ref<SeqRecord[]>([
  { header: 'seq1', sequence: '' },
  { header: 'seq2', sequence: '' },
])
const pairA = ref(0)
const pairB = ref(1)
const matrix = ref('DNA')
const matrices = ref<string[]>(['DNA'])
const gapOpen = ref(-10)
const gapExt = ref(-2)
const windowSize = ref(100)
const windowStep = ref(10)
const minSimilarity = ref(0.85)
const kmer = ref(11)
const step = ref(3)
const diffThreshold = ref(0.6)

const tab = ref<'dotplot' | 'heatmap' | 'alignment' | 'similarity' | 'multi' | 'multisim'>('dotplot')

const aligning = ref(false)
const simRunning = ref(false)
const multiRunning = ref(false)
const workerRunning = ref(false)
const workerProgress = ref<{ stage: string; percent: number }>({ stage: '', percent: 0 })
const status = ref('')
const statusClass = ref<'info' | 'success' | 'error' | ''>('info')
const alignResult = ref<AlignResponse | null>(null)
const diffRegions = ref<{ row: number; col_start: number; col_end: number }[]>([])
const similarityRegions = ref<SimilarityRegion[]>([])
const multiAlignResults = ref<MultiAlignResponse | null>(null)
const multiSimilarityResults = ref<MultiSimilarityResponse | null>(null)
const selectedMultiPair = ref<string | null>(null)
const selectedMultiSimPair = ref<string | null>(null)

const dotPlotRef = ref<InstanceType<typeof DotPlot> | null>(null)
const heatMapRef = ref<InstanceType<typeof HeatMap> | null>(null)
const clickedCell = ref<{ i: number; j: number; baseA: string; baseB: string; kmers: string[] } | null>(null)
const clickedHeat = ref<{ binRow: number; binCol: number; seq1Pos: number; seq2Pos: number; score: number } | null>(null)

const currentSeq1 = computed(() => sequences.value[pairA.value]?.sequence || '')
const currentSeq2 = computed(() => sequences.value[pairB.value]?.sequence || '')
const canAlign = computed(() => currentSeq1.value.length > 0 && currentSeq2.value.length > 0 && pairA.value !== pairB.value)

const multiPairKeys = computed(() => {
  if (!multiAlignResults.value) return []
  return Object.keys(multiAlignResults.value.pairs)
})

const highlightBox = computed(() => {
  const r = alignResult.value
  if (!r) return null
  return {
    seq1_start: r.seq1.start,
    seq1_end: r.seq1.end,
    seq2_start: r.seq2.start,
    seq2_end: r.seq2.end,
  }
})

onMounted(async () => {
  try {
    matrices.value = await api.listMatrices()
  } catch {
    // keep default
  }
})

function addSequence() {
  if (sequences.value.length >= MAX_SEQUENCES) return
  sequences.value.push({ header: `seq${sequences.value.length + 1}`, sequence: '' })
}

function removeSequence(idx: number) {
  if (sequences.value.length <= 2) return
  sequences.value.splice(idx, 1)
  if (pairA.value >= sequences.value.length) pairA.value = 0
  if (pairB.value >= sequences.value.length) pairB.value = Math.min(1, sequences.value.length - 1)
  if (pairA.value === pairB.value && pairB.value + 1 < sequences.value.length) pairB.value++
}

function triggerFile() {
  fileInputRef.value?.click()
}

async function onFile(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (!file) return
  await parseFile(file)
}

async function onDrop(ev: DragEvent) {
  const file = ev.dataTransfer?.files?.[0]
  if (!file) return
  await parseFile(file)
}

async function parseFile(file: File) {
  try {
    const text = await file.text()
    const records = await api.parseFasta(text)
    if (records.length < 2) {
      setStatus(`Expected at least 2 sequences, got ${records.length}`, 'error')
      return
    }
    const imported = records.slice(0, MAX_SEQUENCES).map((r) => ({
      header: r.header,
      sequence: r.sequence,
    }))
    sequences.value = imported
    setStatus(`Loaded ${imported.length} sequences from ${file.name}`, 'success')
  } catch (err) {
    setStatus((err as Error).message, 'error')
  }
}

function setStatus(msg: string, cls: 'info' | 'success' | 'error' = 'info') {
  status.value = msg
  statusClass.value = cls
}

async function runAlignBackend() {
  aligning.value = true
  setStatus('Aligning via backend…', 'info')
  try {
    const res = await api.align({
      seq1: currentSeq1.value,
      seq2: currentSeq2.value,
      matrix: matrix.value,
      gap_open: gapOpen.value,
      gap_ext: gapExt.value,
    })
    alignResult.value = res
    setStatus(
      `Backend ${res.cached ? 'cache hit' : 'computed'}: score=${res.score}, length=${res.length}`,
      'success',
    )
    await loadDiffRegions()
  } catch (err) {
    setStatus((err as Error).message, 'error')
  } finally {
    aligning.value = false
  }
}

let worker: Worker | null = null
function runAlignWorker() {
  if (worker) worker.terminate()
  worker = new Worker(new URL('./sw.worker.ts', import.meta.url), { type: 'module' })
  workerRunning.value = true
  workerProgress.value = { stage: '', percent: 0 }
  setStatus('Running Smith-Waterman in Web Worker…', 'info')
  worker.onmessage = (ev: MessageEvent<WorkerMessage>) => {
    const msg = ev.data
    if (msg.type === 'progress') {
      workerProgress.value = { stage: msg.stage, percent: msg.percent }
    } else if (msg.type === 'result') {
      workerRunning.value = false
      workerProgress.value = { stage: '', percent: 0 }
      if (!msg.ok) {
        setStatus(msg.error || 'worker failed', 'error')
        return
      }
      const al = msg.alignment!
      alignResult.value = {
        cached: false,
        score: al.score,
        score_percent: (100 * al.matches) / Math.max(1, al.length),
        length: al.length,
        matches: al.matches,
        mismatches: al.mismatches,
        gaps: al.gaps,
        seq1: {
          start: al.seq1_start,
          end: al.seq1_end,
          length: currentSeq1.value.length,
          aligned: al.aligned_seq1,
        },
        seq2: {
          start: al.seq2_start,
          end: al.seq2_end,
          length: currentSeq2.value.length,
          aligned: al.aligned_seq2,
        },
        midline: al.midline,
        heatmap: alignResult.value?.heatmap || {
          rows: 0,
          cols: 0,
          data: [],
          seq1_len: currentSeq1.value.length,
          seq2_len: currentSeq2.value.length,
        },
      }
      setStatus(`Worker: score=${al.score}, length=${al.length}`, 'success')
    }
  }
  worker.postMessage({
    type: 'align',
    payload: {
      seq1: currentSeq1.value,
      seq2: currentSeq2.value,
      matrix: matrix.value,
      gap_open: gapOpen.value,
      gap_ext: gapExt.value,
    },
  })
}

async function runSimilarity() {
  simRunning.value = true
  setStatus('Scanning for similarity regions…', 'info')
  try {
    const res = await api.similarityWindows(
      currentSeq1.value,
      currentSeq2.value,
      {
        window_size: windowSize.value,
        step: windowStep.value,
        min_similarity: minSimilarity.value,
      },
    )
    similarityRegions.value = res.regions
    setStatus(`Found ${res.regions.length} similarity regions`, 'success')
    if (res.regions.length > 0) tab.value = 'similarity'
  } catch (err) {
    setStatus((err as Error).message, 'error')
  } finally {
    simRunning.value = false
  }
}

async function runMultiAlign() {
  multiRunning.value = true
  setStatus('Running multi-sequence alignment…', 'info')
  try {
    const res = await api.alignMulti(
      sequences.value.map((s) => s.sequence),
      matrix.value,
      gapOpen.value,
      gapExt.value,
    )
    multiAlignResults.value = res
    selectedMultiPair.value = Object.keys(res.pairs)[0] || null
    setStatus(`Aligned ${res.num_pairs} pairs`, 'success')
    tab.value = 'multi'
  } catch (err) {
    setStatus((err as Error).message, 'error')
  } finally {
    multiRunning.value = false
  }
}

async function runSimilarityMulti() {
  simRunning.value = true
  setStatus('Scanning multi-sequence similarity…', 'info')
  try {
    const res = await api.similarityMulti(
      sequences.value.map((s) => s.sequence),
      {
        window_size: windowSize.value,
        step: windowStep.value,
        min_similarity: minSimilarity.value,
      },
    )
    multiSimilarityResults.value = res
    selectedMultiSimPair.value = Object.keys(res.pairs)[0] || null
    setStatus('Multi-sequence similarity scan complete', 'success')
    tab.value = 'multisim'
  } catch (err) {
    setStatus((err as Error).message, 'error')
  } finally {
    simRunning.value = false
  }
}

async function downloadGff() {
  if (!similarityRegions.value.length) return
  try {
    await api.exportGff3(similarityRegions.value, {
      ref_seq: 'reference',
      source: `window_${windowSize.value}`,
    })
    setStatus(`Exported ${similarityRegions.value.length} regions as GFF3`, 'success')
  } catch (err) {
    setStatus(`Export failed: ${(err as Error).message}`, 'error')
  }
}

async function loadDiffRegions() {
  const hm = alignResult.value?.heatmap.data
  if (!hm || hm.length === 0) {
    diffRegions.value = []
    return
  }
  try {
    const res = await api.getDiffRegions(hm, diffThreshold.value)
    diffRegions.value = res.regions
  } catch {
    diffRegions.value = []
  }
}
</script>

<style>
.btn-tiny {
  padding: 2px 6px !important;
  font-size: 11px !important;
  line-height: 1 !important;
  min-width: 20px;
}
.btn-small {
  padding: 4px 10px !important;
  font-size: 12px !important;
}
.btn-export {
  background: #059669 !important;
  border-color: #10b981 !important;
}
.btn-export:hover:not(:disabled) {
  background: #10b981 !important;
}
.pair-sep {
  align-self: center;
  color: #64748b;
  font-size: 12px;
}
.pair-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
}
.pair-selector button.active {
  background: #38bdf8;
  border-color: #38bdf8;
  color: #0f172a;
}
.multi-detail {
  margin-top: 16px;
}
</style>
