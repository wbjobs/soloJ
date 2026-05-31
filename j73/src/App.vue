<template>
  <div class="app">
    <header class="app-header">
      <div class="header-left">
        <h1 class="logo">🗄️ Git LFS Server</h1>
        <span class="status-badge" :class="serverOnline ? 'online' : 'offline'">
          {{ serverOnline ? '运行中' : '已停止' }}
        </span>
      </div>
      <div class="header-right">
        <span class="server-url" v-if="serverOnline">
          {{ serverUrl }}
        </span>
      </div>
    </header>

    <nav class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="['tab-btn', { active: activeTab === tab.key }]"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </nav>

    <main class="content">
      <FileList
        v-if="activeTab === 'files'"
        :files="files"
        :loading="loading"
        :total-size="totalSize"
        :file-count="fileCount"
        :stats="stats"
        @refresh="loadData"
        @delete="handleDelete"
      />
      <SetupGuide
        v-else-if="activeTab === 'setup'"
        :server-url="serverUrl"
      />
      <Settings
        v-else-if="activeTab === 'settings'"
        :config="config"
        @update="handleConfigUpdate"
      />
    </main>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useFiles } from './composables'
import { fetchStats, fetchConfig, updateConfig, deleteFile } from './api'
import FileList from './components/FileList.vue'
import SetupGuide from './components/SetupGuide.vue'
import Settings from './components/Settings.vue'

export default {
  name: 'App',
  components: { FileList, SetupGuide, Settings },
  setup() {
    const activeTab = ref('files')
    const serverOnline = ref(false)
    const stats = ref({ fileCount: 0, totalSize: 0, diskAvailable: 0 })
    const config = ref({ port: 3200, dataDir: '' })

    const tabs = [
      { key: 'files', label: '📁 文件列表' },
      { key: 'setup', label: '🔧 配置指南' },
      { key: 'settings', label: '⚙️ 设置' }
    ]

    const { files, loading, loadFiles, totalSize, fileCount } = useFiles()

    const serverUrl = computed(() => {
      return `http://localhost:${config.value.port || 3200}`
    })

    async function loadData() {
      try {
        const [statsData, configData] = await Promise.all([
          fetchStats(),
          fetchConfig()
        ])
        stats.value = statsData
        config.value = configData
        serverOnline.value = true
        await loadFiles()
      } catch (e) {
        serverOnline.value = false
      }
    }

    async function handleDelete(oid) {
      await deleteFile(oid)
      await loadData()
    }

    async function handleConfigUpdate(newConfig) {
      await updateConfig(newConfig)
      config.value = newConfig
    }

    onMounted(loadData)

    return {
      activeTab, tabs, serverOnline, stats, config,
      files, loading, totalSize, fileCount, serverUrl,
      loadData, handleDelete, handleConfigUpdate
    }
  }
}
</script>

<style>
:root {
  --bg: #0f1117;
  --bg-card: #1a1d27;
  --bg-hover: #252836;
  --border: #2d3148;
  --text: #e1e4ed;
  --text-dim: #8b8fa3;
  --primary: #6c8cff;
  --primary-dim: #4a62b8;
  --danger: #ff6b6b;
  --success: #51cf66;
  --warning: #ffd43b;
  --radius: 10px;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  overflow: hidden;
  height: 100vh;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  -webkit-app-region: drag;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.logo {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.status-badge {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 20px;
  font-weight: 600;
}
.status-badge.online {
  background: rgba(81, 207, 102, 0.15);
  color: var(--success);
}
.status-badge.offline {
  background: rgba(255, 107, 107, 0.15);
  color: var(--danger);
}

.server-url {
  font-size: 13px;
  color: var(--text-dim);
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  background: var(--bg);
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid var(--border);
}

.tabs {
  display: flex;
  gap: 4px;
  padding: 8px 24px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
}

.tab-btn {
  background: transparent;
  border: none;
  color: var(--text-dim);
  padding: 8px 18px;
  border-radius: var(--radius);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}
.tab-btn:hover { background: var(--bg-hover); color: var(--text); }
.tab-btn.active {
  background: var(--primary);
  color: white;
}

.content {
  flex: 1;
  overflow: auto;
  padding: 20px 24px;
}

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-dim); }
</style>
