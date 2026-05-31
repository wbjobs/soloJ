<template>
  <div class="app-container">
    <el-container class="main-container">
      <el-aside width="240px" class="sidebar">
        <div class="logo">
          <el-icon class="logo-icon"><Warning /></el-icon>
          <span class="logo-text">混沌工程平台</span>
        </div>
        <el-menu
          :default-active="activeMenu"
          router
          background-color="#1a1a2e"
          text-color="#a8a8b3"
          active-text-color="#00d4ff"
          class="sidebar-menu"
        >
          <el-menu-item index="/dashboard">
            <el-icon><DataBoard /></el-icon>
            <span>仪表盘</span>
          </el-menu-item>
          <el-menu-item index="/experiments">
            <el-icon><List /></el-icon>
            <span>实验列表</span>
          </el-menu-item>
          <el-menu-item index="/experiments/create">
            <el-icon><Plus /></el-icon>
            <span>创建实验</span>
          </el-menu-item>
          <el-menu-item index="/approvals">
            <el-icon><CircleCheck /></el-icon>
            <span>审批中心</span>
          </el-menu-item>
          <el-menu-item index="/services">
            <el-icon><Service /></el-icon>
            <span>服务管理</span>
          </el-menu-item>
          <el-menu-item index="/exploration">
            <el-icon><Cpu /></el-icon>
            <span>智能探索</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-container>
        <el-header class="header">
          <div class="header-left">
            <h2 class="page-title">{{ pageTitle }}</h2>
          </div>
          <div class="header-right">
            <el-avatar :size="32" class="user-avatar">
              <el-icon><User /></el-icon>
            </el-avatar>
            <span class="user-name">管理员</span>
          </div>
        </el-header>
        <el-main class="main-content">
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const activeMenu = computed(() => route.path)

const pageTitle = computed(() => {
  const titles = {
    '/dashboard': '仪表盘',
    '/experiments': '实验列表',
    '/experiments/create': '创建实验',
    '/approvals': '审批中心',
    '/services': '服务管理',
    '/exploration': '智能探索'
  }
  return titles[route.path] || '混沌工程平台'
})
</script>

<style lang="scss" scoped>
.app-container {
  min-height: 100vh;
}

.main-container {
  min-height: 100vh;
}

.sidebar {
  background: #1a1a2e;
  border-right: 1px solid #2a2a4e;

  .logo {
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 1px solid #2a2a4e;

    .logo-icon {
      font-size: 28px;
      color: #00d4ff;
      margin-right: 8px;
    }

    .logo-text {
      color: #fff;
      font-size: 18px;
      font-weight: 600;
    }
  }

  .sidebar-menu {
    border: none;
  }
}

.header {
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;

  .header-left {
    .page-title {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: #1a1a2e;
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;

    .user-avatar {
      background: #00d4ff;
    }

    .user-name {
      color: #666;
      font-size: 14px;
    }
  }
}

.main-content {
  background: #f5f6fa;
  padding: 24px;
}
</style>
