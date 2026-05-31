import { ref, computed } from 'vue'
import { fetchFiles } from './api'

export function useFiles() {
  const files = ref([])
  const loading = ref(false)
  const error = ref(null)

  async function loadFiles() {
    loading.value = true
    error.value = null
    try {
      const data = await fetchFiles()
      files.value = data.files || []
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  const totalSize = computed(() =>
    files.value.reduce((sum, f) => sum + (f.size || 0), 0)
  )

  const fileCount = computed(() => files.value.length)

  return { files, loading, error, loadFiles, totalSize, fileCount }
}
