<template>
  <div class="service-management">
    <div class="page-card">
      <div class="card-header">
        <h3>服务列表</h3>
        <div class="header-actions">
          <el-button type="primary" @click="handleRefresh">
            <el-icon><Refresh /></el-icon>
            刷新服务
          </el-button>
          <el-button @click="handleAddInstance">
            <el-icon><Plus /></el-icon>
            添加实例
          </el-button>
        </div>
      </div>

      <el-row :gutter="24">
        <el-col :span="8" v-for="service in groupedServices" :key="service.name">
          <div class="service-card">
            <div class="service-header">
              <div class="service-name">
                <el-icon><Service /></el-icon>
                <span>{{ service.name }}</span>
              </div>
              <el-tag :type="service.healthyCount === service.instances.length ? 'success' : 'warning'">
                {{ service.healthyCount }}/{{ service.instances.length }} 健康
              </el-tag>
            </div>
            <div class="instance-list">
              <div
                class="instance-item"
                v-for="instance in service.instances"
                :key="instance.id"
              >
                <div class="instance-info">
                  <span class="instance-host">{{ instance.host }}:{{ instance.port }}</span>
                  <el-tag :type="getSourceTag(instance.source)" size="small">
                    {{ instance.source }}
                  </el-tag>
                </div>
                <el-tag :type="getHealthTag(instance.healthStatus)" size="small">
                  {{ instance.healthStatus }}
                </el-tag>
              </div>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>

    <el-dialog v-model="addDialogVisible" title="添加服务实例" width="500px">
      <el-form :model="addForm" label-width="100px">
        <el-form-item label="服务名称">
          <el-input v-model="addForm.serviceName" placeholder="请输入服务名称" />
        </el-form-item>
        <el-form-item label="主机地址">
          <el-input v-model="addForm.host" placeholder="请输入主机地址" />
        </el-form-item>
        <el-form-item label="端口">
          <el-input-number v-model="addForm.port" :min="1" :max="65535" />
        </el-form-item>
        <el-form-item label="来源">
          <el-select v-model="addForm.source" placeholder="请选择来源">
            <el-option label="手动" value="MANUAL" />
            <el-option label="Consul" value="CONSUL" />
            <el-option label="Etcd" value="ETCD" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmitAdd">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getAllServices, refreshServices, addServiceInstance } from '@/api/service'

const services = ref([])
const addDialogVisible = ref(false)
const addForm = ref({
  serviceName: '',
  host: '',
  port: 8080,
  source: 'MANUAL'
})

const groupedServices = computed(() => {
  const groups = {}
  services.value.forEach(instance => {
    if (!groups[instance.serviceName]) {
      groups[instance.serviceName] = {
        name: instance.serviceName,
        instances: [],
        healthyCount: 0
      }
    }
    groups[instance.serviceName].instances.push(instance)
    if (instance.healthStatus === 'HEALTHY') {
      groups[instance.serviceName].healthyCount++
    }
  })
  return Object.values(groups)
})

function loadServices() {
  getAllServices().then(res => {
    services.value = res
  })
}

function handleRefresh() {
  refreshServices().then(() => {
    ElMessage.success('服务列表已刷新')
    loadServices()
  })
}

function handleAddInstance() {
  addForm.value = {
    serviceName: '',
    host: '',
    port: 8080,
    source: 'MANUAL'
  }
  addDialogVisible.value = true
}

function handleSubmitAdd() {
  if (!addForm.value.serviceName || !addForm.value.host) {
    ElMessage.warning('请填写完整信息')
    return
  }

  addServiceInstance({
    ...addForm.value,
    healthStatus: 'HEALTHY'
  }).then(() => {
    ElMessage.success('添加成功')
    addDialogVisible.value = false
    loadServices()
  })
}

function getSourceTag(source) {
  const tagMap = {
    'MANUAL': 'info',
    'CONSUL': 'success',
    'ETCD': 'warning'
  }
  return tagMap[source] || 'info'
}

function getHealthTag(status) {
  const tagMap = {
    'HEALTHY': 'success',
    'UNHEALTHY': 'danger',
    'UNKNOWN': 'info'
  }
  return tagMap[status] || 'info'
}

onMounted(() => {
  loadServices()
})
</script>

<style lang="scss" scoped>
.service-management {
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

    .header-actions {
      display: flex;
      gap: 12px;
    }
  }

  .service-card {
    background: #f5f6fa;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 24px;

    .service-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e8e8e8;

      .service-name {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        font-weight: 600;
        color: #1a1a2e;
      }
    }

    .instance-list {
      .instance-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;

        .instance-info {
          display: flex;
          align-items: center;
          gap: 8px;

          .instance-host {
            font-family: 'Monaco', monospace;
            font-size: 13px;
            color: #333;
          }
        }
      }
    }
  }
}
</style>
