<template>
  <div class="experiment-detail">
    <div class="page-card" v-if="experiment">
      <div class="card-header">
        <div>
          <h3>{{ experiment.name }}</h3>
          <span :class="getStatusClass(experiment.status)">{{ getStatusName(experiment.status) }}</span>
        </div>
        <div class="action-buttons">
          <el-button
            v-if="experiment.status === 'APPROVED'"
            type="success"
            @click="handleStart"
          >
            开始实验
          </el-button>
          <el-button
            v-if="experiment.status === 'RUNNING'"
            type="warning"
            @click="handleStop"
          >
            停止实验
          </el-button>
          <el-button
            v-if="['COMPLETED', 'FAILED', 'ROLLED_BACK'].includes(experiment.status)"
            type="primary"
            @click="handleReplay"
          >
            <el-icon><Refresh /></el-icon>
            回放实验
          </el-button>
          <el-button @click="$router.back()">返回</el-button>
        </div>
      </div>

      <el-descriptions :column="3" border>
        <el-descriptions-item label="实验ID">{{ experiment.experimentId }}</el-descriptions-item>
        <el-descriptions-item label="故障类型">{{ getChaosTypeName(experiment.chaosType) }}</el-descriptions-item>
        <el-descriptions-item label="目标服务">{{ experiment.targetService || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建人">{{ experiment.creatorName }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDate(experiment.createdAt) }}</el-descriptions-item>
        <el-descriptions-item label="持续时间">{{ experiment.durationSeconds }}秒</el-descriptions-item>
        <el-descriptions-item label="开始时间" :span="1.5">{{ formatDate(experiment.startTime) }}</el-descriptions-item>
        <el-descriptions-item label="结束时间" :span="1.5">{{ formatDate(experiment.endTime) }}</el-descriptions-item>
      </el-descriptions>
    </div>

    <div class="page-card">
      <div class="card-header">
        <h3>指标对比</h3>
      </div>
      <el-row :gutter="24">
        <el-col :span="6" v-for="metric in metricList" :key="metric.key">
          <div class="metric-compare">
            <div class="metric-name">{{ metric.name }}</div>
            <div class="metric-values">
              <div class="metric-item">
                <span class="label">实验前</span>
                <span class="value before">{{ getMetricValue('before', metric.key) }}</span>
              </div>
              <div class="metric-item">
                <span class="label">实验中</span>
                <span class="value during">{{ getMetricValue('during', metric.key) }}</span>
              </div>
              <div class="metric-item">
                <span class="label">实验后</span>
                <span class="value after">{{ getMetricValue('after', metric.key) }}</span>
              </div>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>

    <el-row :gutter="24">
      <el-col :span="12">
        <div class="page-card">
          <div class="card-header">
            <h3>业务指标趋势</h3>
          </div>
          <v-chart class="metric-chart" :option="businessChartOption" autoresize />
        </div>
      </el-col>
      <el-col :span="12">
        <div class="page-card">
          <div class="card-header">
            <h3>系统指标趋势</h3>
          </div>
          <v-chart class="metric-chart" :option="systemChartOption" autoresize />
        </div>
      </el-col>
    </el-row>

    <div class="page-card">
      <div class="card-header">
        <h3>YAML配置</h3>
      </div>
      <pre class="yaml-content">{{ experiment?.configYaml }}</pre>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getExperiment, startExperiment, stopExperiment } from '@/api/experiment'
import { getExperimentMetrics, getMetricComparison } from '@/api/metric'
import { replayExperiment } from '@/api/exploration'

const route = useRoute()
const experimentId = route.params.id

const experiment = ref(null)
const metrics = ref([])
const metricComparison = ref({})
let refreshTimer = null

const metricList = [
  { key: 'rps', name: 'RPS (请求/秒)' },
  { key: 'p99_latency', name: 'P99 延迟 (ms)' },
  { key: 'error_rate', name: '错误率 (%)' },
  { key: 'cpu_usage', name: 'CPU使用率 (%)' },
  { key: 'memory_usage', name: '内存使用率 (%)' }
]

const businessChartOption = computed(() => {
  const timestamps = [...new Set(metrics.value.map(m => new Date(m.timestamp).toLocaleTimeString('zh-CN')))]
  const rpsData = metrics.value.filter(m => m.metricName === 'rps').map(m => m.value)
  const latencyData = metrics.value.filter(m => m.metricName === 'p99_latency').map(m => m.value)
  const errorData = metrics.value.filter(m => m.metricName === 'error_rate').map(m => m.value)

  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['RPS', 'P99延迟', '错误率'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: timestamps },
    yAxis: { type: 'value' },
    series: [
      { name: 'RPS', type: 'line', smooth: true, data: rpsData, itemStyle: { color: '#667eea' } },
      { name: 'P99延迟', type: 'line', smooth: true, data: latencyData, itemStyle: { color: '#11998e' } },
      { name: '错误率', type: 'line', smooth: true, data: errorData, itemStyle: { color: '#f5576c' } }
    ]
  }
})

const systemChartOption = computed(() => {
  const timestamps = [...new Set(metrics.value.map(m => new Date(m.timestamp).toLocaleTimeString('zh-CN')))]
  const cpuData = metrics.value.filter(m => m.metricName === 'cpu_usage').map(m => m.value)
  const memoryData = metrics.value.filter(m => m.metricName === 'memory_usage').map(m => m.value)

  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['CPU使用率', '内存使用率'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: timestamps },
    yAxis: { type: 'value', max: 100 },
    series: [
      { name: 'CPU使用率', type: 'line', smooth: true, data: cpuData, itemStyle: { color: '#f093fb' } },
      { name: '内存使用率', type: 'line', smooth: true, data: memoryData, itemStyle: { color: '#4facfe' } }
    ]
  }
})

function loadExperiment() {
  getExperiment(experimentId).then(res => {
    experiment.value = res
  })
}

function loadMetrics() {
  getExperimentMetrics(experimentId).then(res => {
    metrics.value = res
  })
  getMetricComparison(experimentId).then(res => {
    metricComparison.value = res
  })
}

function getMetricValue(phase, metricKey) {
  const phaseData = metricComparison.value[phase] || {}
  const value = phaseData[metricKey]
  return value ? parseFloat(value).toFixed(2) : '-'
}

function handleStart() {
  ElMessageBox.confirm('确定要开始该实验吗？', '确认开始', { type: 'warning' }).then(() => {
    startExperiment(experimentId).then(() => {
      ElMessage.success('实验已开始')
      loadExperiment()
      startRefresh()
    })
  })
}

function handleStop() {
  ElMessageBox.confirm('确定要停止并回滚该实验吗？', '确认停止', { type: 'warning' }).then(() => {
    stopExperiment(experimentId).then(() => {
      ElMessage.success('实验已停止并回滚')
      loadExperiment()
      stopRefresh()
    })
  })
}

function handleReplay() {
  ElMessageBox.confirm('确定要回放该实验吗？系统将创建一个新的回放实验并自动执行。', '确认回放', { type: 'info' }).then(() => {
    replayExperiment(experimentId).then(res => {
      ElMessage.success(`回放实验已启动: ${res.replayId}`)
    })
  })
}

function startRefresh() {
  stopRefresh()
  refreshTimer = setInterval(() => {
    loadMetrics()
    loadExperiment()
  }, 2000)
}

function stopRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

function getStatusClass(status) {
  const statusMap = {
    'PENDING': 'status-pending',
    'APPROVED': 'status-approved',
    'RUNNING': 'status-running',
    'COMPLETED': 'status-completed',
    'FAILED': 'status-failed',
    'ROLLED_BACK': 'status-rolled-back',
    'REJECTED': 'status-rejected'
  }
  return statusMap[status] || ''
}

function getStatusName(status) {
  const statusMap = {
    'PENDING': '待审批',
    'APPROVED': '已审批',
    'RUNNING': '运行中',
    'COMPLETED': '已完成',
    'FAILED': '失败',
    'ROLLED_BACK': '已回滚',
    'REJECTED': '已拒绝'
  }
  return statusMap[status] || status
}

function getChaosTypeName(type) {
  const typeMap = {
    'latency': '延迟注入',
    'podKill': 'Pod杀掉',
    'cpuLoad': 'CPU负载',
    'memoryLoad': '内存负载',
    'exception': '异常注入'
  }
  return typeMap[type] || type
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

onMounted(() => {
  loadExperiment()
  loadMetrics()
  startRefresh()
})

onUnmounted(() => {
  stopRefresh()
})
</script>

<style lang="scss" scoped>
.experiment-detail {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;

    h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #1a1a2e;
      display: inline-block;
      margin-right: 16px;
    }

    .status-tag {
      display: inline-block;
    }
  }

  .action-buttons {
    display: flex;
    gap: 12px;
  }

  .metric-compare {
    background: #f5f6fa;
    border-radius: 8px;
    padding: 16px;

    .metric-name {
      font-size: 14px;
      color: #666;
      margin-bottom: 12px;
    }

    .metric-values {
      display: flex;
      justify-content: space-between;

      .metric-item {
        text-align: center;

        .label {
          display: block;
          font-size: 12px;
          color: #999;
          margin-bottom: 4px;
        }

        .value {
          font-size: 18px;
          font-weight: 600;

          &.before { color: #667eea; }
          &.during { color: #f5576c; }
          &.after { color: #11998e; }
        }
      }
    }
  }

  .yaml-content {
    background: #1a1a2e;
    color: #a8a8b3;
    padding: 20px;
    border-radius: 8px;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 13px;
    line-height: 1.6;
    overflow-x: auto;
    margin: 0;
  }
}
</style>
