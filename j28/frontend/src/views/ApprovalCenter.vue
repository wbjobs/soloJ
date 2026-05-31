<template>
  <div class="approval-center">
    <div class="page-card">
      <div class="card-header">
        <h3>待审批实验</h3>
        <el-tag type="warning" v-if="pendingCount > 0">{{ pendingCount }} 个待审批</el-tag>
      </div>

      <el-table :data="approvals" style="width: 100%" v-loading="loading">
        <el-table-column prop="experimentId" label="实验ID" width="140" />
        <el-table-column prop="experimentName" label="实验名称" min-width="180" />
        <el-table-column prop="chaosType" label="故障类型" width="120">
          <template #default="{ row }">
            <el-tag :type="getChaosTypeTag(row.chaosType)">{{ getChaosTypeName(row.chaosType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="applicantName" label="申请人" width="100" />
        <el-table-column prop="createdAt" label="申请时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button type="success" link @click="handleApprove(row)">
              通过
            </el-button>
            <el-button type="danger" link @click="handleReject(row)">
              拒绝
            </el-button>
            <el-button type="primary" link @click="viewDetail(row.experimentId)">
              详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && approvals.length === 0" description="暂无待审批实验" />
    </div>

    <div class="page-card">
      <div class="card-header">
        <h3>审批历史</h3>
      </div>

      <el-table :data="historyApprovals" style="width: 100%">
        <el-table-column prop="experimentId" label="实验ID" width="140" />
        <el-table-column prop="experimentName" label="实验名称" min-width="180" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <span :class="getStatusClass(row.status)">{{ getStatusName(row.status) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="approverName" label="审批人" width="100" />
        <el-table-column prop="approvedAt" label="审批时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.approvedAt) }}
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="审批意见" />
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, ElInput } from 'element-plus'
import { getPendingApprovals, getAllApprovals, approveExperiment, rejectExperiment } from '@/api/approval'

const router = useRouter()

const approvals = ref([])
const historyApprovals = ref([])
const loading = ref(false)
const pendingCount = ref(0)

function loadPendingApprovals() {
  loading.value = true
  getPendingApprovals({ size: 100 }).then(res => {
    approvals.value = res.content || []
    pendingCount.value = res.totalElements || 0
    loading.value = false
  })
}

function loadHistoryApprovals() {
  getAllApprovals({ size: 20, sort: 'approvedAt,desc' }).then(res => {
    historyApprovals.value = (res.content || []).filter(a => a.status !== 'PENDING')
  })
}

function handleApprove(row) {
  ElMessageBox.prompt('请输入审批意见（可选）', '审批通过', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputType: 'textarea',
    inputPlaceholder: '请输入审批意见...',
    beforeClose: (action, instance, done) => {
      if (action === 'confirm') {
        approveExperiment(row.experimentId, instance.inputValue).then(() => {
          ElMessage.success('审批通过')
          loadPendingApprovals()
          loadHistoryApprovals()
        })
        done()
      } else {
        done()
      }
    }
  })
}

function handleReject(row) {
  ElMessageBox.prompt('请输入拒绝原因', '拒绝审批', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputType: 'textarea',
    inputValidator: (value) => {
      if (!value || value.trim() === '') {
        return '请输入拒绝原因'
      }
      return true
    },
    beforeClose: (action, instance, done) => {
      if (action === 'confirm') {
        rejectExperiment(row.experimentId, instance.inputValue).then(() => {
          ElMessage.success('已拒绝')
          loadPendingApprovals()
          loadHistoryApprovals()
        })
        done()
      } else {
        done()
      }
    }
  })
}

function viewDetail(experimentId) {
  router.push(`/experiments/${experimentId}`)
}

function getStatusClass(status) {
  const statusMap = {
    'APPROVED': 'status-approved',
    'REJECTED': 'status-rejected'
  }
  return statusMap[status] || ''
}

function getStatusName(status) {
  const statusMap = {
    'APPROVED': '已通过',
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

onMounted(() => {
  loadPendingApprovals()
  loadHistoryApprovals()
})
</script>

<style lang="scss" scoped>
.approval-center {
  .card-header {
    display: flex;
    align-items: center;
    margin-bottom: 20px;

    h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #1a1a2e;
      margin-right: 16px;
    }
  }
}
</style>
