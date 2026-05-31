import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from './views/Dashboard.vue'
import History from './views/History.vue'
import Devices from './views/Devices.vue'
import Playback from './views/Playback.vue'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard,
  },
  {
    path: '/history',
    name: 'History',
    component: History,
  },
  {
    path: '/devices',
    name: 'Devices',
    component: Devices,
  },
  {
    path: '/playback',
    name: 'Playback',
    component: Playback,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
