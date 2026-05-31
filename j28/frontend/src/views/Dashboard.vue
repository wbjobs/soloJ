<template>
  <div class="dashboard">
    <el-row :gutter="24">
      <el-col :span="6" v-for="(item, index) in statCards" :key="index">
        <div class="stat-card" :style="{ background: item.color }">
          <div class="stat-icon">
            <el-icon :size="40"><component :is="item.icon" /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ item.value }}</div>
            <div class="stat-label">{{ item.label }}</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="24" style="margin-top: 24px">
      <el-col :span="16">
        <div class="page-card">
          <div class="card-header">
            <h3>实验执行趋势</h3>
          </div>
          <v-chart class="metric-chart" :option="trendChartOption" autoresize />
        </div>
      </el-col>
      <el-col :span="8">
        <div class="page-card">
          <div class="card-header">
            <h3>故障类型分布</h3>
          </div>
          <v-chart class="metric-chart" :option="typeChartOption" autoresize />
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="24" style="margin-top: 24px">
      <el-col :span="24">
        <div class="page-card">
          <div class="card-header">
            <h3>最近实验</h3>
            <el-button type="primary" link @click="goToExperiments">查看全部</el-button>
          </div>
          <el-table :data="recentExperiments" style="width: 100%">
            <el-table-column prop="experimentId" label="实验ID" width="140" />
            <el-table-column prop="name" label="实验名称" />
            <el-table-column prop="chaosType" label="故障类型" width="120">
              <template #default="{ row }">
                <el-tag :type="getChaosTypeTag(row.chaosType)">{{ row.chaosType }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="120">
              <template #default="{ row }">
                <span :class="getStatusClass(row.status)">{{ row.status }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="创建时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.createdAt) }}
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { getStatistics, getExperiments } from '@/api/experiment'

const router = useRouter()

const statistics = ref({})
const recentExperiments = ref([])

const statCards = computed(() => [
  { label: '实验总数', value: statistics.value.total || 0, icon: 'List', color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { label: '运行中', value: statistics.value.running || 0, icon: 'VideoPlay', color: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
  { label: '待审批', value: statistics.value.pending || 0, icon: 'Clock', color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { label: '已完成', value: statistics.value.completed || 0, icon: 'CircleCheck', color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }
])

const trendChartOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: { data: ['实验数量'] },
  grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
  xAxis: {
    type: 'category',
    data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  },
  yAxis: { type: 'value' },
  series: [{
    name: '实验数量',
    type: 'line',
    smooth: true,
    data: [12, 19, 15, 25, 18, 8, 10],
    areaStyle: {
      color: {
        type: 'linear',
        x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [
          { offset: 0, color: 'rgba(102, 126, 234, 0.5)' },
          { offset: 1, color: 'rgba(102, 126, 234, 0.05)' }
        ]
      }
    },
    lineStyle: { color: '#667eea', width: 2 },
    itemStyle: { color: '#667eea' }
  }]
}))

const typeChartOption = computed(() => ({
  tooltip: { trigger: 'item' },
  legend: { orient: 'vertical', left: 'left' },
  series: [{
    type: 'pie',
    radius: ['40%', '70%'],
    avoidLabelOverlap: false,
    itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
    label: { show: false },
    emphasis: {
      label: { show: true, fontSize: 16, fontWeight: 'bold' }
    },
    labelLine: { show: false },
    data: [
      { value: 35, name: '延迟注入', itemStyle: { color: '#667eea' } },
      { value: 25, name: 'Pod杀掉', itemStyle: { color: '#f5576c' } },
      { value: 20, name: 'CPU负载', itemStyle: { color: '#11998e' } },
      { value: 15, name: '内存负载', itemStyle: { color: '#f093fb' } },
      { value: 5, name: '异常注入', itemStyle: { color: '#4facfe' } }
    ]
  }]
}))

function loadStatistics() {
  getStatistics().then(res => {
    statistics.value = res
  })
}

function loadRecentExperiments() {
  getExperiments({ page: 0, size: 5 }).then(res => {
    recentExperiments.value = res.content || []
  })
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

function getChaosTypeTag(type) {
  const typeMap = {
    'latency': 'info',
    'podKill': 'danger',
    'cpuLoad': 'warning',
    'memoryLoad': 'success'
  }
  return typeMap[type] || 'info'
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

function goToExperiments() {
  router.push('/experiments')
}

onMounted(() => {
  loadStatistics()
  loadRecentExperiments()
})
</script>

<style lang="scss" scoped>
.dashboard {
  .stat-card {
    border-radius: 12px;
    padding: 24px;
    display: flex;
    align-items: center;
    gap: 20px;
    color: #fff;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);

    .stat-icon {
      opacity: 0.9;
    }

    .stat-content {
      flex: 1;

      .stat-value {
        font-size: 32px;
        font-weight: 700;
        line-height: 1.2;
      }

      .stat-label {
        font-size: 14px;
        opacity: 0.9;
        margin-top: 4px;
      }
    }
  }

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
    }
  }
}
</style>
