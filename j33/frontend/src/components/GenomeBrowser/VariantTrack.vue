<script setup lang="ts">
import { computed } from 'vue'
import { useBrowserStore } from '@/stores/browser'

const browserStore = useBrowserStore()

const visibleVariants = computed(() => browserStore.variantsData)

const snpCount = computed(() => visibleVariants.value.filter((v) => v.type === 'SNP').length)
const insCount = computed(() => visibleVariants.value.filter((v) => v.type === 'INS').length)
const delCount = computed(() => visibleVariants.value.filter((v) => v.type === 'DEL').length)

const variantTypeColor: Record<string, string> = {
  SNP: 'bg-genome-green',
  INS: 'bg-genome-orange',
  DEL: 'bg-genome-red',
  MNP: 'bg-genome-text-dim',
  BND: 'bg-genome-text-dim',
}
</script>

<template>
  <div class="flex items-center gap-3 px-3 py-2 bg-genome-surface-2 rounded-lg border border-genome-border">
    <div class="text-xs text-genome-text-muted">变异</div>
    <div class="flex gap-3 text-[10px] font-mono">
      <span class="flex items-center gap-1">
        <span class="w-2 h-2 rounded-full bg-genome-green" />
        <span class="text-genome-text-muted">SNP {{ snpCount }}</span>
      </span>
      <span class="flex items-center gap-1">
        <span class="w-2 h-2 rounded-full bg-genome-orange" />
        <span class="text-genome-text-muted">INS {{ insCount }}</span>
      </span>
      <span class="flex items-center gap-1">
        <span class="w-2 h-2 rounded-full bg-genome-red" />
        <span class="text-genome-text-muted">DEL {{ delCount }}</span>
      </span>
    </div>
    <div class="flex-1" />
    <div
      v-for="v in visibleVariants.slice(0, 50)"
      :key="v.id"
      class="w-1.5 h-3 rounded-sm cursor-pointer transition-transform hover:scale-150"
      :class="variantTypeColor[v.type] || 'bg-genome-text-dim'"
      :title="`${v.chrom}:${v.position} ${v.ref}>${v.alt}`"
      @click="browserStore.selectVariant(v)"
    />
  </div>
</template>
