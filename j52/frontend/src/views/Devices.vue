<template>
  <div>
    <div class="section-title">
      <el-icon :size="22" color="#3b82f6"><Cpu /></el-icon>
      <span>设备管理</span>
    </div>

    <el-row :gutter="16" style="margin-bottom: 24px;">
      <el-col :span="24">
        <div class="table-container">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <div class="section-title" style="margin-bottom: 0;">
              <el-icon :size="20" color="#3b82f6"><List /></el-icon>
              <span>设备列表</span>
            </div>
            <el-button type="primary" @click="refreshData">
              <el-icon><Refresh /></el-icon>
              刷新数据
            </el-button>
          </div>
          
          <el-table :data="devices" stripe style="width: 100%;">
            <el-table-column prop="device_id" label="设备 ID" width="180" />
            <el-table-column prop="device_name" label="设备名称" width="220" />
            <el-table-column label="状态" width="120">
              <template #default="scope">
                <span class="status-badge status-online">
                  <span class="status-dot"></span>
                  在线
                </span>
              </template>
            </el-table-column>
            <el-table-column label="监控指标数量">
              <template #default="scope">
                <el-tag type="primary">
                  {{ getDeviceRegisterCount(scope.row.device_id) }} 个
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="最近更新">
              <template #default="scope">
                {{ getDeviceLastUpdate(scope.row.device_id) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150">
              <template #default="scope">
                <el-button type="primary" link @click="viewDeviceData(scope.row)">
                  查看数据
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" v-if="selectedDevice">
      <el-col :span="24">
        <div class="chart-container">
          <div class="section-title" style="margin-bottom: 20px;">
            <el-icon :size="20" color="#3b82f6"><DataAnalysis /></el-icon>
            <span>设备详情 - {{ selectedDevice.device_name }}</span>
            <el-button link @click="selectedDevice = null" style="margin-left: auto;">
              关闭
            </el-button>
          </div>
          
          <el-table
            :data="getDeviceData(selectedDevice.device_id)"
            stripe
            style="width: 100%;"
          >
            <el-table-column prop="register_address" label="地址" width="100" />
            <el-table-column prop="register_name" label="数据项" width="200" />
            <el-table-column prop="value" label="当前值" width="150">
              <template #default="scope">
                <el-tag :type="getValueTagType(scope.row.register_name)" size="large">
                  {{ scope.row.value }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="time" label="更新时间">
              <template #default="scope">
                {{ formatTime(scope.row.time) }}
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-bottom: 24px;">
      <el-col :span="24">
        <div class="chart-container">
          <div class="section-title" style="margin-bottom: 20px;">
            <el-icon :size="20" color="#f59e0b"><Setting /></el-icon>
            <span>网关配置信息</span>
          </div>
          
          <el-descriptions :column="2" border>
            <el-descriptions-item label="gRPC 服务地址">
              <el-tag type="info">localhost:50051</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="REST API 地址">
              <el-tag type="info">localhost:8000</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="Modbus 轮询间隔">
              <el-tag type="warning">1000 ms</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="InfluxDB 地址">
              <el-tag type="info">localhost:8086</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="通信协议">
              <el-tag type="success">Modbus TCP / gRPC</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="数据存储">
              <el-tag type="success">InfluxDB (时序数据库)</el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { getDevices, getLatestData } from '../api/api'

const devices = ref([])
const latestData = ref([])
const selectedDevice = ref(null)

let refreshInterval = null

const formatTime = (time) => {
  if (!time) return '--'
  return new Date(time).toLocaleString('zh-CN')
}

const getValueTagType = (name) => {
  if (name.includes('Temperature')) return 'warning'
  if (name.includes('Pressure')) return 'danger'
  if (name.includes('Status')) return 'success'
  return 'primary'
}

const getDeviceRegisterCount = (deviceId) => {
  return latestData.value.filter((d) => d.device_id === deviceId).length
}

const getDeviceLastUpdate = (deviceId) => {
  const deviceData = latestData.value.filter((d) => d.device_id === deviceId)
  if (deviceData.length === 0) return '--'
  const latest = deviceData.reduce((a, b) =>
    new Date(a.time) > new Date(b.time) ? a : b
  )
  return formatTime(latest.time)
}

const getDeviceData = (deviceId) => {
  return latestData.value
    .filter((d) => d.device_id === deviceId)
    .sort((a, b) => a.register_address - b.register_address)
}

const viewDeviceData = (device) => {
  selectedDevice.value = device
}

const refreshData = async () => {
  try {
    const [devData, data] = await Promise.all([
      getDevices(),
      getLatestData(),
    ])
    devices.value = devData
    latestData.value = data
  } catch (error) {
    console.error('Failed to refresh data:', error)
  }
}

onMounted(() => {
  refreshData()
  refreshInterval = setInterval(refreshData, 3000)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>
