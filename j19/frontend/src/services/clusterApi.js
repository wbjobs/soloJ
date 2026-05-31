import api from './api.js'

export const clusterApi = {
  list: () => api.get('/clusters'),
  get: (clusterId) => api.get(`/clusters/${clusterId}`),
  create: (data) => api.post('/clusters', data),
  update: (clusterId, data) => api.put(`/clusters/${clusterId}`, data),
  delete: (clusterId) => api.delete(`/clusters/${clusterId}`),
}

export const nodeApi = {
  list: (clusterId) => api.get(`/clusters/${clusterId}/nodes`),
  add: (clusterId, data) => api.post(`/clusters/${clusterId}/nodes`, data),
  update: (clusterId, nodeId, data) => api.put(`/clusters/${clusterId}/nodes/${nodeId}`, data),
  remove: (clusterId, nodeId) => api.delete(`/clusters/${clusterId}/nodes/${nodeId}`),
  getLoad: (clusterId, nodeId) => api.get(`/clusters/${clusterId}/nodes/${nodeId}/load`),
  getMetrics: (clusterId, nodeId) => api.get(`/clusters/${clusterId}/nodes/${nodeId}/metrics`),
  getAllMetrics: (clusterId) => api.get(`/clusters/${clusterId}/nodes/metrics`),
}

export const taskApi = {
  submit: (clusterId, data) => api.post(`/clusters/${clusterId}/tasks`, data),
  list: (clusterId) => api.get(`/clusters/${clusterId}/tasks`),
  get: (clusterId, taskId) => api.get(`/clusters/${clusterId}/tasks/${taskId}`),
  cancel: (clusterId, taskId) => api.post(`/clusters/${clusterId}/tasks/${taskId}/cancel`),
  getStatus: (clusterId, taskId) => api.get(`/clusters/${clusterId}/tasks/${taskId}/status`),
  getQueue: (clusterId) => api.get(`/clusters/${clusterId}/tasks/queue`),
  rebalance: (taskId) => api.post(`/clusters/tasks/${taskId}/rebalance`),
}

export const syncApi = {
  triggerSync: (clusterId) => api.post(`/clusters/${clusterId}/sync`),
  checkSyncStatus: (clusterId, syncId) => api.get(`/clusters/${clusterId}/sync/${syncId}`),
}
