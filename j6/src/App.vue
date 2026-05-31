<template>
  <div class="container">
    <div class="header">
      <h1>🐳 Docker 日志智能分析器</h1>
      <p>实时监控容器运行状态，AI 智能分析日志异常</p>
    </div>

    <div class="layout">
      <div class="card">
        <div class="card-header">
          <span class="card-title">容器列表</span>
          <button class="refresh-btn" @click="loadContainers" :disabled="loading">
            {{ loading ? '刷新中...' : '🔄 刷新' }}
          </button>
        </div>
        <div class="container-list">
          <div v-if="loading" class="empty-state">
            <div class="loading"></div>
            <p style="margin-top: 12px;">正在加载容器列表...</p>
          </div>
          <div v-else-if="containers.length === 0" class="empty-state">
            <div class="empty-state-icon">📦</div>
            <p>未检测到运行的 Docker 容器</p>
            <p style="font-size: 12px; margin-top: 8px;">请确保 Docker 服务已启动</p>
          </div>
          <div
            v-for="container in containers"
            :key="container.id"
            class="container-item"
            :class="{ selected: selectedContainer?.id === container.id }"
            @click="selectContainer(container)"
          >
            <div class="container-info">
              <div>
                <div class="container-name">{{ container.name }}</div>
                <div class="container-id">{{ container.id.slice(0, 12) }}</div>
              </div>
              <span class="status-badge" :class="getStatusClass(container.status)">
                {{ container.status }}
              </span>
            </div>
            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-label">CPU 使用率</div>
                <div class="stat-value">{{ container.cpu_usage }}%</div>
                <div class="stat-bar">
                  <div class="stat-bar-fill cpu" :style="{ width: Math.min(container.cpu_usage, 100) + '%' }"></div>
                </div>
              </div>
              <div class="stat-item">
                <div class="stat-label">内存使用率</div>
                <div class="stat-value">{{ container.memory_usage }}%</div>
                <div class="stat-bar">
                  <div class="stat-bar-fill memory" :style="{ width: Math.min(container.memory_usage, 100) + '%' }"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">AI 分析结果</span>
          <div class="analyze-actions">
            <span class="connection-status" :class="connectionStatus">
              <span v-if="connectionStatus === 'connected'">● 已连接</span>
              <span v-else-if="connectionStatus === 'connecting'">
                <span class="loading"></span> 连接中
              </span>
              <span v-else-if="connectionStatus === 'offline'">💾 离线缓存中</span>
              <span v-else-if="connectionStatus === 'caching'">📦 缓存日志</span>
              <span v-else-if="connectionStatus === 'resending'">🔄 重传中</span>
              <span v-else-if="connectionStatus === 'error'">● 连接错误</span>
              <span v-else>● 未连接</span>
            </span>
            <button
              v-if="isAnalyzing"
              class="btn btn-danger"
              @click="stopAnalysis"
            >
              停止分析
            </button>
            <button
              v-else
              class="btn btn-primary"
              :disabled="!selectedContainer || selectedContainer.status !== 'running'"
              @click="startAnalysis"
            >
              开始分析
            </button>
          </div>
        </div>
        <div class="analysis-panel">
          <div class="analysis-content">
            <div v-if="!selectedContainer" class="empty-state">
              <div class="empty-state-icon">👈</div>
              <p>请从左侧选择一个容器</p>
            </div>
            <div v-else-if="selectedContainer.status !== 'running'" class="empty-state">
              <div class="empty-state-icon">⏸️</div>
              <p>该容器未运行</p>
              <p style="font-size: 12px; margin-top: 8px;">请选择运行中的容器进行分析</p>
            </div>
            <div v-else-if="!isAnalyzing && analysisResults.length === 0 && ruleMatches.length === 0" class="empty-state">
              <div class="empty-state-icon">🤖</div>
              <p>点击"开始分析"启动 AI 日志分析</p>
              <p style="font-size: 12px; margin-top: 8px;">
                将实时转发 {{ selectedContainer.name }} 的日志到远程 AI 服务
              </p>
            </div>
            <div v-else>
              <div v-if="connectionStatus === 'offline' || connectionStatus === 'caching'"
                   class="analysis-result"
                   style="margin-bottom: 16px; border-left: 4px solid #f0883e; background: rgba(240, 136, 62, 0.1);">
                <div class="analysis-header">
                  <span class="analysis-level" style="color: #f0883e;">💾 离线模式</span>
                </div>
                <div class="analysis-message">
                  远程服务不可用，日志正在本地缓存<br>
                  <span v-if="cachedLogsCount > 0">
                    已缓存 {{ cachedLogsCount.toLocaleString() }} 条日志
                  </span>
                  <span v-else>等待网络恢复后自动重传</span>
                </div>
              </div>

              <div v-if="ruleMatches.length > 0"
                   class="analysis-result"
                   style="margin-bottom: 16px; border-left: 4px solid #db6d28; background: rgba(219, 109, 40, 0.1);">
                <div class="analysis-header">
                  <span class="analysis-level" style="color: #db6d28;">🔔 规则匹配通知</span>
                </div>
                <div class="analysis-message">
                  <div v-for="(match, idx) in ruleMatches.slice(0, 5)" :key="idx" class="rule-match-item">
                    <span class="rule-match-level" :class="match.level">[{{ match.level.toUpperCase() }}]</span>
                    <span class="rule-match-name">{{ match.rule_name }}</span>
                    <span class="rule-match-keyword">匹配: "{{ match.keyword }}"</span>
                  </div>
                  <div v-if="ruleMatches.length > 5" style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
                    还有 {{ ruleMatches.length - 5 }} 条匹配...
                  </div>
                </div>
              </div>

              <div v-if="rateLimiterStats && (rateLimiterStats.total_dropped_ui > 0 || rateLimiterStats.total_dropped_ws > 0)"
                   class="analysis-result warning"
                   style="margin-bottom: 16px;">
                <div class="analysis-header">
                  <span class="analysis-level warning">⚡ 流量控制</span>
                </div>
                <div class="analysis-message">
                  已接收 {{ rateLimiterStats.total_received.toLocaleString() }} 条日志<br>
                  UI 预览丢弃: {{ rateLimiterStats.total_dropped_ui.toLocaleString() }} 条 |
                  WebSocket 丢弃: {{ rateLimiterStats.total_dropped_ws.toLocaleString() }} 条<br>
                  <span style="font-size: 12px; color: var(--text-secondary);">
                    日志速率过高时，系统会自动丢弃部分日志以保护 UI 响应性和避免服务端限流
                  </span>
                </div>
              </div>

              <div v-if="recentLogs.length > 0" class="log-preview">
                <div style="font-size: 11px; color: #8b949e; margin-bottom: 8px;">最近日志</div>
                <div
                  v-for="(log, index) in recentLogs"
                  :key="index"
                  class="log-line"
                  :class="log.stream"
                >
                  {{ log.content }}
                </div>
              </div>
              <div
                v-for="(result, index) in analysisResults"
                :key="index"
                class="analysis-result"
                :class="result.level"
              >
                <div class="analysis-header">
                  <span class="analysis-level" :class="result.level">{{ result.level }}</span>
                  <span class="analysis-time">{{ formatTime(result.timestamp) }}</span>
                </div>
                <div class="analysis-message">{{ result.message }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

const containers = ref([])
const selectedContainer = ref(null)
const loading = ref(false)
const isAnalyzing = ref(false)
const connectionStatus = ref('disconnected')
const analysisResults = ref([])
const recentLogs = ref([])
const rateLimiterStats = ref(null)
const cachedLogsCount = ref(0)
const ruleMatches = ref([])

let statsInterval = null
let rateStatsInterval = null
let cachedLogsInterval = null
let analysisListener = null
let logListener = null
let statusListener = null
let ruleMatchListener = null

const loadContainers = async () => {
  loading.value = true
  try {
    const result = await invoke('list_containers')
    containers.value = result
  } catch (error) {
    console.error('加载容器列表失败:', error)
    containers.value = []
  } finally {
    loading.value = false
  }
}

const loadContainerStats = async () => {
  try {
    const stats = await invoke('get_containers_stats')
    containers.value = containers.value.map(container => {
      const stat = stats.find(s => s.id === container.id)
      return stat ? { ...container, ...stat } : container
    })
  } catch (error) {
    console.error('加载容器统计失败:', error)
  }
}

const loadCachedLogsCount = async () => {
  try {
    const count = await invoke('get_cached_logs_count')
    cachedLogsCount.value = count
  } catch (error) {
    console.error('加载缓存日志数失败:', error)
  }
}

const selectContainer = (container) => {
  if (isAnalyzing.value) {
    if (!confirm('正在分析中，切换容器将停止当前分析，是否继续？')) {
      return
    }
    stopAnalysis()
  }
  selectedContainer.value = container
}

const startAnalysis = async () => {
  if (!selectedContainer.value) return

  isAnalyzing.value = true
  connectionStatus.value = 'connecting'
  analysisResults.value = []
  recentLogs.value = []
  ruleMatches.value = []

  try {
    await invoke('start_analysis', {
      containerId: selectedContainer.value.id,
      containerName: selectedContainer.value.name
    })
  } catch (error) {
    console.error('启动分析失败:', error)
    connectionStatus.value = 'error'
    isAnalyzing.value = false
  }
}

const stopAnalysis = async () => {
  try {
    await invoke('stop_analysis')
  } catch (error) {
    console.error('停止分析失败:', error)
  }
  isAnalyzing.value = false
  connectionStatus.value = 'disconnected'
}

const getStatusClass = (status) => {
  if (status === 'running') return 'status-running'
  if (status === 'exited') return 'status-exited'
  return 'status-other'
}

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const loadRateStats = async () => {
  if (!isAnalyzing.value) return
  try {
    const stats = await invoke('get_rate_limiter_stats')
    rateLimiterStats.value = stats
  } catch (error) {
    console.error('加载速率限制统计失败:', error)
  }
}

onMounted(async () => {
  await loadContainers()
  await loadCachedLogsCount()
  statsInterval = setInterval(loadContainerStats, 2000)
  rateStatsInterval = setInterval(loadRateStats, 1000)
  cachedLogsInterval = setInterval(loadCachedLogsCount, 5000)

  analysisListener = await listen('analysis-result', (event) => {
    analysisResults.value.unshift(event.payload)
    if (analysisResults.value.length > 100) {
      analysisResults.value.pop()
    }
  })

  logListener = await listen('log-message', (event) => {
    recentLogs.value.push(event.payload)
    if (recentLogs.value.length > 50) {
      recentLogs.value.shift()
    }
  })

  statusListener = await listen('connection-status', (event) => {
    const prevStatus = connectionStatus.value
    connectionStatus.value = event.payload.status
    if (event.payload.status === 'disconnected' || event.payload.status === 'error') {
      isAnalyzing.value = false
      rateLimiterStats.value = null
    }
    if (event.payload.message) {
      console.log(`[${event.payload.status}] ${event.payload.message}`)
    }
  })

  ruleMatchListener = await listen('rule-match', (event) => {
    ruleMatches.value.unshift(event.payload)
    if (ruleMatches.value.length > 50) {
      ruleMatches.value.pop()
    }
  })
})

onUnmounted(() => {
  if (statsInterval) {
    clearInterval(statsInterval)
  }
  if (rateStatsInterval) {
    clearInterval(rateStatsInterval)
  }
  if (cachedLogsInterval) {
    clearInterval(cachedLogsInterval)
  }
  if (analysisListener) {
    analysisListener()
  }
  if (logListener) {
    logListener()
  }
  if (statusListener) {
    statusListener()
  }
  if (ruleMatchListener) {
    ruleMatchListener()
  }
  if (isAnalyzing.value) {
    stopAnalysis()
  }
})
</script>
