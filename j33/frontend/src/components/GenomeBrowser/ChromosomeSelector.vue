<script setup lang="ts">
import { useBrowserStore } from '@/stores/browser'
import { CHROMOSOMES, CHROM_LENGTHS, type ChromosomeName } from '@/types'

const browserStore = useBrowserStore()

function selectChrom(chrom: ChromosomeName) {
  const length = CHROM_LENGTHS[chrom]
  browserStore.navigateTo(chrom, 0, Math.min(length, 1e7))
}
</script>

<template>
  <div class="flex items-center gap-1 overflow-x-auto py-1" style="scrollbar-width: none">
    <button
      v-for="chrom in CHROMOSOMES"
      :key="chrom"
      class="flex-shrink-0 px-2 py-0.5 text-[10px] font-mono rounded transition-all duration-150"
      :class="browserStore.currentChrom === chrom
        ? 'bg-genome-blue text-white'
        : 'bg-genome-surface text-genome-text-dim hover:bg-genome-blue/20 hover:text-genome-blue'"
      :style="{
        minWidth: `${Math.max(24, (CHROM_LENGTHS[chrom] / 2.5e8) * 40 + 20)}px`,
      }"
      @click="selectChrom(chrom)"
    >
      {{ chrom.replace('chr', '') }}
    </button>
  </div>
</template>
