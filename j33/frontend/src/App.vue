<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import {
  Dna, FolderOpen, GitCompareArrows, ListTodo
} from 'lucide-vue-next'

const route = useRoute()

const navItems = [
  { path: '/', name: 'workspace', label: '工作台', icon: Dna },
  { path: '/files', name: 'files', label: '文件管理', icon: FolderOpen },
  { path: '/compare', name: 'compare', label: '样本比较', icon: GitCompareArrows },
  { path: '/tasks', name: 'tasks', label: '任务中心', icon: ListTodo },
]

const activeNav = computed(() => route.name as string)
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-genome-bg">
    <aside class="w-16 flex flex-col items-center py-4 bg-genome-surface border-r border-genome-border flex-shrink-0">
      <div class="w-9 h-9 rounded-lg bg-genome-blue flex items-center justify-center mb-6">
        <Dna class="w-5 h-5 text-white" />
      </div>
      <nav class="flex flex-col gap-1 flex-1">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="w-11 h-11 rounded-lg flex items-center justify-center transition-all duration-200"
          :class="activeNav === item.name
            ? 'bg-genome-blue/20 text-genome-blue'
            : 'text-genome-text-dim hover:bg-genome-surface-2 hover:text-genome-text-muted'"
        >
          <component :is="item.icon" class="w-5 h-5" />
        </RouterLink>
      </nav>
      <div class="text-[10px] text-genome-text-dim font-mono">v1.0</div>
    </aside>
    <main class="flex-1 overflow-auto">
      <router-view />
    </main>
  </div>
</template>
