import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'workspace',
    component: () => import('@/pages/WorkspacePage.vue'),
  },
  {
    path: '/files',
    name: 'files',
    component: () => import('@/pages/FilesPage.vue'),
  },
  {
    path: '/compare',
    name: 'compare',
    component: () => import('@/pages/ComparePage.vue'),
  },
  {
    path: '/tasks',
    name: 'tasks',
    component: () => import('@/pages/TasksPage.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
