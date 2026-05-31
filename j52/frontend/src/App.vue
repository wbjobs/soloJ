<template>
  <el-container class="layout-container">
    <el-header class="header">
      <div class="header-title">
        <el-icon :size="28"><Monitor /></el-icon>
        <span>Modbus 工业数据监控平台</span>
      </div>
      <div class="header-status">
        <div v-if="healthStatus">
          <span class="status-badge status-online">
            <span class="status-dot"></span>
            系统运行正常
          </span>
        </div>
        <div v-else>
          <span class="status-badge status-offline">
            <span class="status-dot"></span>
            连接断开
          </span>
        </div>
        <div class="last-update">
          最后更新: {{ lastUpdateTime }}
        </div>
      </div>
    </el-header>
    
    <el-container>
      <el-aside width="200px" style="background: #1f2937;">
        <el-menu
          :default-active="activeMenu"
          class="el-menu-vertical-demo"
          background-color="#1f2937"
          text-color="#9ca3af"
          active-text-color="#3b82f6"
          router
        >
          <el-menu-item index="/">
            <el-icon><Odometer /></el-icon>
            <span>实时监控</span>
          </el-menu-item>
          <el-menu-item index="/history">
            <el-icon><DataLine /></el-icon>
            <span>历史数据</span>
          </el-menu-item>
          <el-menu-item index="/devices">
            <el-icon><Cpu /></el-icon>
            <span>设备管理</span>
          </el-menu-item>
          <el-menu-item index="/playback">
            <el-icon><VideoPlay /></el-icon>
            <span>数据回放</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      
      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { checkHealth } from './api/api'

const route = useRoute()
const activeMenu = ref('/')
const healthStatus = ref(true)
const lastUpdateTime = ref('--')

let healthCheckInterval = null

const fetchHealth = async () => {
  try {
    const data = await checkHealth()
    healthStatus.value = data.status === 'healthy'
    lastUpdateTime.value = new Date(data.timestamp).toLocaleString('zh-CN')
  } catch (error) {
    healthStatus.value = false
  }
}

onMounted(() => {
  activeMenu.value = route.path
  fetchHealth()
  healthCheckInterval = setInterval(fetchHealth, 5000)
})

onUnmounted(() => {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval)
  }
})
</script>
