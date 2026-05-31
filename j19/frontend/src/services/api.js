import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
}

export const deviceApi = {
  list: () => api.get('/devices'),
  connect: (deviceId) => api.post(`/devices/${deviceId}/connect`),
  disconnect: (deviceId) => api.post(`/devices/${deviceId}/disconnect`),
  status: (deviceId) => api.get(`/devices/${deviceId}/status`),
}

export const bitstreamApi = {
  list: () => api.get('/bitstreams'),
  upload: (formData, onProgress) =>
    api.post('/bitstreams', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total))
        }
      },
    }),
  delete: (id) => api.delete(`/bitstreams/${id}`),
  burn: (id, deviceId) => api.post(`/bitstreams/${id}/burn`, { deviceId }),
  burnStatus: (burnId) => api.get(`/burn/${burnId}/status`),
}

export const userApi = {
  list: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  changeRole: (id, role) => api.put(`/users/${id}/role`, { role }),
}

export default api
