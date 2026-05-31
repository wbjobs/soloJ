<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useTasksStore } from '@/stores/tasks'
import { CheckCircle, XCircle, Clock, Loader2, Trash2 } from 'lucide-vue-next'
import type { Task } from '@/types'

const tasksStore = useTasksStore()

onMounted(() => {
  tasksStore.loadTasks()
  if (tasksStore.hasActiveTasks) {
    tasksStore.startPolling()
  }
})

const typeLabels: Record<string, string> = {
  upload: '文件上传',
  index: '建立索引',
  annotate: '变异注释',
  compare: '样本比较',
  export: '数据导出',
}

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-genome-text-dim', label: '等待中' },
  running: { icon: Loader2, color: 'text-genome-orange', label: '运行中' },
  completed: { icon: CheckCircle, color: 'text-genome-green', label: '已完成' },
  failed: { icon: XCircle, color: 'text-genome-red', label: '失败' },
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-CN')
}

function getProgressColor(task: Task): string {
  if (task.status === 'completed') return 'bg-genome-green'
  if (task.status === 'failed') return 'bg-genome-red'
  if (task.status === 'running') return 'bg-genome-blue'
  return 'bg-genome-text-dim'
}
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-medium text-genome-text">任务中心</h1>
      <div class="flex items-center gap-4 text-xs">
        <span class="flex items-center gap-1 text-genome-orange">
          <Loader2 class="w-3 h-3 animate-spin" />
          {{ tasksStore.pendingTasks.length }} 运行中
        </span>
        <span class="flex items-center gap-1 text-genome-green">
          <CheckCircle class="w-3 h-3" />
          {{ tasksStore.completedTasks.length }} 已完成
        </span>
        <span class="flex items-center gap-1 text-genome-red">
          <XCircle class="w-3 h-3" />
          {{ tasksStore.failedTasks.length }} 失败
        </span>
      </div>
    </div>

    <div class="bg-genome-surface rounded-lg border border-genome-border overflow-hidden">
      <table class="w-full text-xs">
        <thead>
          <tr class="border-b border-genome-border bg-genome-surface-2">
            <th class="text-left px-4 py-2 text-genome-text-dim font-medium">任务类型</th>
            <th class="text-left px-4 py-2 text-genome-text-dim font-medium">状态</th>
            <th class="text-left px-4 py-2 text-genome-text-dim font-medium">进度</th>
            <th class="text-left px-4 py-2 text-genome-text-dim font-medium">消息</th>
            <th class="text-left px-4 py-2 text-genome-text-dim font-medium">创建时间</th>
            <th class="text-right px-4 py-2 text-genome-text-dim font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="task in tasksStore.tasks"
            :key="task.id"
            class="border-b border-genome-border/50 hover:bg-genome-surface-2 transition-colors"
          >
            <td class="px-4 py-2 text-genome-text">{{ typeLabels[task.type] || task.type }}</td>
            <td class="px-4 py-2">
              <span class="flex items-center gap-1" :class="statusConfig[task.status]?.color">
                <component
                  :is="statusConfig[task.status]?.icon"
                  class="w-3 h-3"
                  :class="task.status === 'running' ? 'animate-spin' : ''"
                />
                {{ statusConfig[task.status]?.label || task.status }}
              </span>
            </td>
            <td class="px-4 py-2">
              <div class="flex items-center gap-2">
                <div class="w-24 h-1.5 bg-genome-surface-2 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-300"
                    :class="getProgressColor(task)"
                    :style="{ width: `${task.progress}%` }"
                  />
                </div>
                <span class="font-mono text-genome-text-dim">{{ task.progress }}%</span>
              </div>
            </td>
            <td class="px-4 py-2 text-genome-text-dim max-w-48 truncate">{{ task.message || '-' }}</td>
            <td class="px-4 py-2 text-genome-text-dim">{{ formatDate(task.createdAt) }}</td>
            <td class="px-4 py-2 text-right">
              <button
                class="p-1 rounded hover:bg-genome-red/20 text-genome-text-dim hover:text-genome-red transition-colors"
                @click="tasksStore.removeTask(task.id)"
              >
                <Trash2 class="w-3 h-3" />
              </button>
            </td>
          </tr>
          <tr v-if="tasksStore.tasks.length === 0">
            <td colspan="6" class="px-4 py-8 text-center text-genome-text-dim">暂无任务</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
