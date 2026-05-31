<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useBrowserStore } from '@/stores/browser'
import { fetchVariantAnnotation, predictPathogenicity } from '@/api'
import { X, ExternalLink } from 'lucide-vue-next'
import type { VariantAnnotation, PathogenicityResult } from '@/types'

const browserStore = useBrowserStore()
const annotation = ref<VariantAnnotation | null>(null)
const loading = ref(false)
const pathogenicityResult = ref<PathogenicityResult | null>(null)
const pathLoading = ref(false)

const variant = computed(() => browserStore.selectedVariant)

watch(variant, async (v) => {
  if (!v) {
    annotation.value = null
    pathogenicityResult.value = null
    return
  }
  loading.value = true
  try {
    annotation.value = await fetchVariantAnnotation(v.id)
  } catch {
    annotation.value = null
  } finally {
    loading.value = false
  }
  if (v.pathogenicity) {
    pathogenicityResult.value = v.pathogenicity
  } else {
    pathogenicityResult.value = null
  }
})

async function fetchDetailedPrediction() {
  if (!variant.value) return
  pathLoading.value = true
  try {
    const features: Record<string, number> = {
      quality: variant.value.quality,
      position: variant.value.position,
    }
    if (annotation.value?.sift) features.sift_score = annotation.value.sift.score
    if (annotation.value?.polyPhen) features.polyphen_score = annotation.value.polyPhen.score
    if (annotation.value?.cadd) features.cadd_score = annotation.value.cadd
    if (annotation.value?.af) features.allele_frequency = annotation.value.af
    pathogenicityResult.value = await predictPathogenicity(features)
  } catch {
    pathogenicityResult.value = null
  } finally {
    pathLoading.value = false
  }
}

function close() {
  browserStore.selectVariant(null)
}

const impactColors: Record<string, string> = {
  HIGH: 'bg-genome-red text-white',
  MODERATE: 'bg-genome-orange text-white',
  LOW: 'bg-genome-green text-white',
  MODIFIER: 'bg-genome-surface-2 text-genome-text-muted',
}

const clinvarColors: Record<string, string> = {
  Pathogenic: 'text-genome-red',
  Likely_pathogenic: 'text-genome-orange',
  Uncertain_significance: 'text-genome-text-muted',
  Likely_benign: 'text-genome-green',
  Benign: 'text-genome-green',
}

function formatClinvar(key: string): string {
  return key.replace(/_/g, ' ')
}

const classificationColors: Record<string, string> = {
  pathogenic: 'bg-genome-red text-white',
  likely_pathogenic: 'bg-genome-orange text-white',
  VUS: 'bg-genome-surface-2 text-genome-text-muted',
  likely_benign: 'bg-genome-green text-white',
  benign: 'bg-green-800 text-white',
}

const classificationLabels: Record<string, string> = {
  pathogenic: '致病',
  likely_pathogenic: '可能致病',
  VUS: '意义不明',
  likely_benign: '可能良性',
  benign: '良性',
}

const confidenceColors: Record<string, string> = {
  high: 'text-genome-green',
  medium: 'text-genome-orange',
  low: 'text-genome-red',
}

function getCircleDash(score: number): string {
  const circumference = 2 * Math.PI * 40
  return `${(score * circumference).toFixed(2)} ${circumference.toFixed(2)}`
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="variant"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        @click.self="close"
      >
        <div class="w-[480px] max-h-[80vh] overflow-y-auto bg-genome-surface rounded-lg border border-genome-border shadow-2xl animate-fade-in">
          <div class="flex items-center justify-between px-5 py-3 border-b border-genome-border">
            <div>
              <div class="text-sm font-medium text-genome-text">变异详情</div>
              <div class="text-xs font-mono text-genome-text-muted mt-0.5">
                {{ variant.chrom }}:{{ variant.position }} {{ variant.ref }} &gt; {{ variant.alt }}
              </div>
            </div>
            <button
              class="p-1.5 rounded-lg hover:bg-genome-surface-2 text-genome-text-dim hover:text-genome-text transition-colors"
              @click="close"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="p-5 space-y-4">
            <div class="grid grid-cols-3 gap-3 text-xs">
              <div class="px-3 py-2 bg-genome-surface-2 rounded-lg">
                <div class="text-genome-text-dim mb-1">类型</div>
                <div class="font-mono text-genome-text">{{ variant.type }}</div>
              </div>
              <div class="px-3 py-2 bg-genome-surface-2 rounded-lg">
                <div class="text-genome-text-dim mb-1">质量</div>
                <div class="font-mono text-genome-text">{{ variant.quality.toFixed(1) }}</div>
              </div>
              <div class="px-3 py-2 bg-genome-surface-2 rounded-lg">
                <div class="text-genome-text-dim mb-1">过滤</div>
                <div class="font-mono text-genome-text">{{ variant.filter || 'PASS' }}</div>
              </div>
            </div>

            <div v-if="loading" class="text-center py-4 text-xs text-genome-text-dim">
              加载注释信息...
            </div>

            <template v-if="annotation">
              <div class="px-3 py-2 bg-genome-surface-2 rounded-lg">
                <div class="text-[10px] text-genome-text-dim mb-1">基因 / 转录本</div>
                <div class="text-sm font-mono text-genome-blue">{{ annotation.gene }}
                  <span class="text-genome-text-dim">{{ annotation.transcript }}</span>
                </div>
                <div class="text-xs text-genome-text-muted mt-1">{{ annotation.consequence }}</div>
              </div>

              <div class="flex items-center gap-2">
                <span
                  class="px-2 py-0.5 rounded text-[10px] font-medium"
                  :class="impactColors[annotation.impact]"
                >{{ annotation.impact }}</span>
              </div>

              <div v-if="annotation.clinVar" class="px-3 py-2 bg-genome-surface-2 rounded-lg">
                <div class="text-[10px] text-genome-text-dim mb-1">ClinVar</div>
                <div
                  class="text-sm font-medium"
                  :class="clinvarColors[annotation.clinVar.significance]"
                >{{ formatClinvar(annotation.clinVar.significance) }}</div>
                <div class="text-[10px] text-genome-text-dim">{{ annotation.clinVar.reviewStatus }}</div>
                <div v-if="annotation.clinVar.condition" class="text-xs text-genome-text-muted mt-1">
                  {{ annotation.clinVar.condition }}
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div v-if="annotation.sift" class="px-3 py-2 bg-genome-surface-2 rounded-lg">
                  <div class="text-[10px] text-genome-text-dim mb-1">SIFT</div>
                  <div class="text-xs font-mono" :class="annotation.sift.prediction === 'damaging' ? 'text-genome-red' : 'text-genome-green'">
                    {{ annotation.sift.score.toFixed(3) }} ({{ annotation.sift.prediction }})
                  </div>
                </div>
                <div v-if="annotation.polyPhen" class="px-3 py-2 bg-genome-surface-2 rounded-lg">
                  <div class="text-[10px] text-genome-text-dim mb-1">PolyPhen</div>
                  <div class="text-xs font-mono" :class="annotation.polyPhen.prediction.includes('damaging') ? 'text-genome-red' : 'text-genome-green'">
                    {{ annotation.polyPhen.score.toFixed(3) }} ({{ annotation.polyPhen.prediction }})
                  </div>
                </div>
              </div>

              <div class="px-3 py-3 bg-genome-surface-2 rounded-lg">
                <div class="flex items-center justify-between mb-2">
                  <div class="text-[10px] text-genome-text-dim">致病性预测</div>
                  <button
                    v-if="!pathogenicityResult && !pathLoading"
                    class="text-[10px] px-2 py-0.5 rounded bg-genome-blue/20 text-genome-blue hover:bg-genome-blue/30 transition-colors"
                    @click="fetchDetailedPrediction"
                  >详细预测</button>
                </div>
                <div v-if="pathLoading" class="text-center py-2 text-[10px] text-genome-text-dim">
                  预测中...
                </div>
                <template v-if="pathogenicityResult">
                  <div class="flex items-center gap-4">
                    <svg width="88" height="88" viewBox="0 0 100 100" class="flex-shrink-0">
                      <circle
                        cx="50" cy="50" r="40"
                        fill="none"
                        stroke="#1F2937"
                        stroke-width="6"
                      />
                      <circle
                        cx="50" cy="50" r="40"
                        fill="none"
                        :stroke="pathogenicityResult.pathogenicityScore > 0.8 ? '#F53F3F' : pathogenicityResult.pathogenicityScore > 0.5 ? '#FF7D00' : pathogenicityResult.pathogenicityScore > 0.2 ? '#165DFF' : '#00B42A'"
                        stroke-width="6"
                        stroke-linecap="round"
                        :stroke-dasharray="getCircleDash(pathogenicityResult.pathogenicityScore)"
                        transform="rotate(-90 50 50)"
                      />
                      <text
                        x="50" y="46"
                        text-anchor="middle"
                        fill="#F3F4F6"
                        font-size="18"
                        font-family="JetBrains Mono, monospace"
                      >{{ Math.round(pathogenicityResult.pathogenicityScore * 100) }}%</text>
                      <text
                        x="50" y="62"
                        text-anchor="middle"
                        fill="#6B7280"
                        font-size="9"
                        font-family="Noto Sans SC, sans-serif"
                      >致病概率</text>
                    </svg>
                    <div class="space-y-2 flex-1">
                      <div>
                        <span
                          class="inline-block px-2 py-0.5 rounded text-[10px] font-medium"
                          :class="classificationColors[pathogenicityResult.classification]"
                        >{{ classificationLabels[pathogenicityResult.classification] }}</span>
                      </div>
                      <div class="text-[10px] text-genome-text-dim">
                        置信度: <span :class="confidenceColors[pathogenicityResult.confidence]">{{ pathogenicityResult.confidence }}</span>
                      </div>
                    </div>
                  </div>
                  <div v-if="Object.keys(pathogenicityResult.featureContributions).length > 0" class="mt-3 space-y-1.5">
                    <div class="text-[10px] text-genome-text-dim mb-1">特征贡献</div>
                    <div
                      v-for="(value, key) in pathogenicityResult.featureContributions"
                      :key="key"
                      class="flex items-center gap-2"
                    >
                      <span class="text-[9px] text-genome-text-muted w-20 truncate font-mono">{{ key }}</span>
                      <div class="flex-1 h-2 bg-genome-bg rounded-full overflow-hidden">
                        <div
                          class="h-full rounded-full transition-all duration-500"
                          :style="{
                            width: `${Math.abs(value) * 100}%`,
                            backgroundColor: value > 0 ? '#F53F3F' : '#165DFF'
                          }"
                        />
                      </div>
                      <span class="text-[9px] font-mono text-genome-text-muted w-10 text-right">{{ value.toFixed(3) }}</span>
                    </div>
                  </div>
                </template>
              </div>

              <div class="flex flex-wrap gap-2 text-[10px] font-mono">
                <span v-if="annotation.dbSnpId" class="px-2 py-0.5 rounded bg-genome-blue/20 text-genome-blue">
                  {{ annotation.dbSnpId }}
                </span>
                <span v-if="annotation.cosmicId" class="px-2 py-0.5 rounded bg-genome-orange/20 text-genome-orange">
                  {{ annotation.cosmicId }}
                </span>
                <span v-if="annotation.cadd" class="px-2 py-0.5 rounded bg-genome-surface-2 text-genome-text-muted">
                  CADD {{ annotation.cadd.toFixed(1) }}
                </span>
                <span v-if="annotation.af" class="px-2 py-0.5 rounded bg-genome-surface-2 text-genome-text-muted">
                  AF {{ annotation.af.toFixed(4) }}
                </span>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
