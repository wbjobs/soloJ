import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Task } from '@/types'
import { fetchTasks, fetchTask } from '@/api'

export const useTasksStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  let pollTimer: ReturnType<typeof setInterval> | null = null

  const pendingTasks = computed(() =>
    tasks.value.filter((t) => t.status === 'pending' || t.status === 'running')
  )

  const completedTasks = computed(() =>
    tasks.value.filter((t) => t.status === 'completed')
  )

  const failedTasks = computed(() =>
    tasks.value.filter((t) => t.status === 'failed')
  )

  const hasActiveTasks = computed(() => pendingTasks.value.length > 0)

  async function loadTasks() {
    loading.value = true
    error.value = null
    try {
      tasks.value = await fetchTasks()
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function refreshTask(taskId: string) {
    try {
      const updated = await fetchTask(taskId)
      const idx = tasks.value.findIndex((t) => t.id === taskId)
      if (idx !== -1) {
        tasks.value[idx] = updated
      } else {
        tasks.value.unshift(updated)
      }
    } catch (e: any) {
      error.value = e.message
    }
  }

  function startPolling(interval = 3000) {
    stopPolling()
    pollTimer = setInterval(async () => {
      if (!hasActiveTasks.value) {
        stopPolling()
        return
      }
      for (const task of pendingTasks.value) {
        await refreshTask(task.id)
      }
    }, interval)
  }

  function stopPolling() {
    if (pollTimer !== null) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function addTask(task: Task) {
    tasks.value.unshift(task)
    if (task.status === 'pending' || task.status === 'running') {
      startPolling()
    }
  }

  function removeTask(taskId: string) {
    tasks.value = tasks.value.filter((t) => t.id !== taskId)
  }

  return {
    tasks,
    loading,
    error,
    pendingTasks,
    completedTasks,
    failedTasks,
    hasActiveTasks,
    loadTasks,
    refreshTask,
    startPolling,
    stopPolling,
    addTask,
    removeTask,
  }
})
