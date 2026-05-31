<template>
  <div class="experiment-list">
    <div class="page-card">
      <div class="card-header">
        <div class="header-left">
          <h3>实验列表</h3>
          <el-select v-model="filterStatus" placeholder="筛选状态" clearable style="width: 140px; margin-left: 16px">
            <el-option label="待审批" value="PENDING" />
            <el-option label="已审批" value="APPROVED" />
            <el-option label="运行中" value="RUNNING" />
            <el-option label="已完成" value="COMPLETED" />
            <el-option label="失败" value="FAILED" />
            <el-option label="已回滚" value="ROLLED_BACK" />
          </el-select>
        </div>
        <el-button type="primary" @click="goToCreate">
          <el-icon><Plus /></el-icon>
          创建实验
        </el-button>
      </div>

      <el-table :data="experiments" style="width: 100%" v-loading="loading">
        <el-table-column prop="experimentId" label="实验ID" width="140" />
        <el-table-column prop="name" label="实验名称" min-width="180">
          <template #default="{ row }">
            <el-link type="primary" @click="goToDetail(row.experimentId)">
              {{ row.name }}
            </el-link>
          </template>
        </el-table-column>
        <el-table-column prop="chaosType" label="故障类型" width="120">
          <template #default="{ row }">
            <el-tag :type="getChaosTypeTag(row.chaosType)">{{ getChaosTypeName(row.chaosType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="targetService" label="目标服务" width="160" />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <span :class="getStatusClass(row.status)">{{ getStatusName(row.status) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="creatorName" label="创建人" width="100" />
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="goToDetail(row.experimentId)">
              详情
            </el-button>
            <el-button
              v-if="row.status === 'APPROVED'"
              type="success"
              link
              @click="handleStart(row)"
            >
              开始
            </el-button>
            <el-button
              v-if="row.status === 'RUNNING'"
              type="warning"
              link
              @click="handleStop(row)"
            >
              停止
            </el-button>
            <el-button
              v-if="row.status !== 'RUNNING'"
              type="danger"
              link
              @click="handleDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="page"
        v-model:page-size="size"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        style="margin-top: 20px; justify-content: flex-end"
        @size-change="loadExperiments"
        @current-change="loadExperiments"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getExperiments, startExperiment, stopExperiment, deleteExperiment } from '@/api/experiment'

const router = useRouter()

const experiments = ref([])
const loading = ref(false)
const page = ref(1)
const size = ref(20)
const total = ref(0)
const filterStatus = ref('')

function loadExperiments() {
  loading.value = true
  const params = {
    page: page.value - 1,
    size: size.value,
    sort: 'createdAt,desc'
  }
  if (filterStatus.value) {
    params.status = filterStatus.value
  }

  getExperiments(params).then(res => {
    experiments.value = res.content || []
    total.value = res.totalElements || 0
    loading.value = false
  }).catch(() => {
    loading.value = false
  })
}

function handleStart(row) {
  ElMessageBox.confirm(
    `确定要开始实验 "${row.name}" 吗？`,
    '确认开始',
    { type: 'warning' }
  ).then(() => {
    startExperiment(row.experimentId).then(() => {
      ElMessage.success('实验已开始')
      loadExperiments()
    })
  })
}

function handleStop(row) {
  ElMessageBox.confirm(
    `确定要停止并回滚实验 "${row.name}" 吗？`,
    '确认停止',
    { type: 'warning' }
  ).then(() => {
    stopExperiment(row.experimentId).then(() => {
      ElMessage.success('实验已停止并回滚')
      loadExperiments()
    })
  })
}

function handleDelete(row) {
  ElMessageBox.confirm(
    `确定要删除实验 "${row.name}" 吗？`,
    '确认删除',
    { type: 'warning' }
  ).then(() => {
    deleteExperiment(row.experimentId).then(() => {
      ElMessage.success('删除成功')
      loadExperiments()
    })
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

function getChaosTypeTag(type) {
  const typeMap = {
    'latency': 'info',
    'podKill': 'danger',
    'cpuLoad': 'warning',
    'memoryLoad': 'success',
    'exception': 'danger'
  }
  return typeMap[type] || 'info'
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

function goToCreate() {
  router.push('/experiments/create')
}

function goToDetail(id) {
  router.push(`/experiments/${id}`)
}

onMounted(() => {
  loadExperiments()
})
</script>

<style lang="scss" scoped>
.experiment-list {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;

    .header-left {
      display: flex;
      align-items: center;

      h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #1a1a2e;
      }
    }
  }
}
</style>
