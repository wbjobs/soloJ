import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '@/pages/HomePage.vue'
import SensorDetailPage from '@/pages/SensorDetailPage.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomePage,
  },
  {
    path: '/workshop/:id',
    name: 'workshop',
    component: HomePage,
  },
  {
    path: '/sensor/:workshop/:sensorId',
    name: 'sensor-detail',
    component: SensorDetailPage,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
