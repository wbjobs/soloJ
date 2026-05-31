<script setup lang="ts">
import { useBrowserStore } from '@/stores/browser'
import { Eye, EyeOff } from 'lucide-vue-next'

const browserStore = useBrowserStore()

const trackIcons: Record<string, string> = {
  coverage: '▁',
  variants: '◆',
  reads: '≡',
  genes: '◗',
}
</script>

<template>
  <div class="flex items-center gap-1">
    <div
      v-for="track in browserStore.tracks"
      :key="track.id"
      class="flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer transition-all duration-150"
      :class="track.visible
        ? 'bg-genome-blue/20 text-genome-blue'
        : 'bg-genome-surface text-genome-text-dim hover:bg-genome-surface-2'"
      @click="browserStore.updateTrack(track.id, { visible: !track.visible })"
    >
      <span class="font-mono text-[10px]">{{ trackIcons[track.type] || '●' }}</span>
      <span>{{ track.label }}</span>
      <component :is="track.visible ? Eye : EyeOff" class="w-3 h-3" />
    </div>
  </div>
</template>
