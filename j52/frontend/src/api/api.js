import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

export const checkHealth = async () => {
  const response = await api.get('/health')
  return response.data
}

export const getDevices = async () => {
  const response = await api.get('/devices')
  return response.data
}

export const getLatestData = async (deviceId = null) => {
  const params = deviceId ? { device_id: deviceId } : {}
  const response = await api.get('/data/latest', { params })
  return response.data
}

export const getHistoryData = async (registerName, deviceId = null, timeRange = '-1h') => {
  const params = {
    time_range: timeRange,
    ...(deviceId && { device_id: deviceId }),
  }
  const response = await api.get(`/data/history/${registerName}`, { params })
  return response.data
}

export const getStats = async () => {
  const response = await api.get('/stats')
  return response.data
}

export const getRegisterList = async (deviceId = null) => {
  const params = deviceId ? { device_id: deviceId } : {}
  const response = await api.get('/registers', { params })
  return response.data
}

export default api
