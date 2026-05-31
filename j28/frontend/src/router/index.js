import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue')
  },
  {
    path: '/experiments',
    name: 'ExperimentList',
    component: () => import('@/views/ExperimentList.vue')
  },
  {
    path: '/experiments/create',
    name: 'CreateExperiment',
    component: () => import('@/views/CreateExperiment.vue')
  },
  {
    path: '/experiments/:id',
    name: 'ExperimentDetail',
    component: () => import('@/views/ExperimentDetail.vue')
  },
  {
    path: '/approvals',
    name: 'ApprovalCenter',
    component: () => import('@/views/ApprovalCenter.vue')
  },
  {
    path: '/services',
    name: 'ServiceManagement',
    component: () => import('@/views/ServiceManagement.vue')
  },
  {
    path: '/exploration',
    name: 'SmartExploration',
    component: () => import('@/views/SmartExploration.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
