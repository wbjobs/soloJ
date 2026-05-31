import axios from 'axios'

const createApi = (baseURL) => {
  const api = axios.create({
    baseURL,
    timeout: 60000,
  })

  return {
    listPointclouds: () => api.get('/pointclouds'),
    getPointcloudInfo: (name) => api.get(`/pointclouds/${name}`),
    getPointcloudTile: (name, params = {}) => 
      api.get(`/pointclouds/${name}/tile`, { params }),
    computeStats: (name, bounds) => 
      api.post(`/pointclouds/${name}/compute-stats`, bounds),
    saveSelection: (data) => api.post('/selection', data),
    getSelections: () => api.get('/selection'),
    getSelection: (id) => api.get(`/selection/${id}`),
    deleteSelection: (id) => api.delete(`/selection/${id}`),
    uploadPointcloud: (file) => {
      const formData = new FormData()
      formData.append('file', file)
      return api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    
    getOctreeInfo: (name) => api.get(`/pointclouds/${name}/octree/info`),
    getVisibleNodes: (name, cameraPos, maxScreenError = 2.0, maxNodes = 50) => 
      api.post(`/pointclouds/${name}/octree/visible-nodes`, {
        camera_x: cameraPos.x,
        camera_y: cameraPos.y,
        camera_z: cameraPos.z,
        max_screen_error: maxScreenError,
        max_nodes: maxNodes,
      }),
    getOctreeNode: (name, nodeId) => 
      api.get(`/pointclouds/${name}/octree/node/${nodeId}`),
    
    getClassificationRules: () => api.get('/classification/rules'),
    classifyPointcloud: (name, method = 'rgb', bounds = null) => 
      api.post(`/pointclouds/${name}/classify`, {
        method,
        bounds,
      }),
    getPointcloudClassification: (name, method = 'rgb', bounds = null) => 
      api.get(`/pointclouds/${name}/classification`, {
        params: {
          method,
          ...(bounds || {}),
        },
      }),
  }
}

export default createApi
