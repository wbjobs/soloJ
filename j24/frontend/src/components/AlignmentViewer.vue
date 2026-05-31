<template>
  <div class="alignment-viewer">
    <div class="toolbar">
      <label>
        Wrap width
        <select v-model.number="wrapWidth">
          <option v-for="n in [60, 80, 100, 120, 200]" :key="n" :value="n">{{ n }}</option>
        </select>
      </label>
      <button @click="prevPage" :disabled="page === 0">← Prev</button>
      <span class="page-info">Page {{ page + 1 }} / {{ totalPages }}</span>
      <button @click="nextPage" :disabled="page >= totalPages - 1">Next →</button>
    </div>
    <pre class="alignment-block"><code>{{ formatted }}</code></pre>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    alignedSeq1: string
    alignedSeq2: string
    midline: string
    start1?: number
    start2?: number
  }>(),
  {
    start1: 0,
    start2: 0,
  },
)

const wrapWidth = ref(100)
const page = ref(0)

const totalPages = computed(() =>
  Math.max(1, Math.ceil(props.alignedSeq1.length / wrapWidth.value)),
)

const formatted = computed(() => {
  const n = props.alignedSeq1.length
  if (n === 0) return ''
  const w = wrapWidth.value
  const pages = Math.ceil(n / w)
  const p = Math.min(page.value, pages - 1)
  page.value = p
  const start = p * w
  const end = Math.min(n, start + w)
  const a1 = props.alignedSeq1.slice(start, end)
  const a2 = props.alignedSeq2.slice(start, end)
  const mid = props.midline.slice(start, end)
  const labelW = String(n).length + 2
  const pad = (s: string) => s.padStart(labelW, ' ')
  const lbl1 = `seq1 ${pad(String(props.start1 + start + 1))} `
  const lbl2 = `seq2 ${pad(String(props.start2 + start + 1))} `
  const lblM = ' '.repeat(lbl1.length)
  return `${lbl1}${a1}\n${lblM}${mid}\n${lbl2}${a2}\n`
})

function nextPage() {
  if (page.value < totalPages.value - 1) page.value++
}

function prevPage() {
  if (page.value > 0) page.value--
}
</script>
