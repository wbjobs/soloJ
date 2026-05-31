import request from '@/utils/request'

export function getExperiments(params) {
  return request({
    url: '/experiments',
    method: 'get',
    params
  })
}

export function getExperiment(id) {
  return request({
    url: `/experiments/${id}`,
    method: 'get'
  })
}

export function createExperiment(data) {
  return request({
    url: '/experiments',
    method: 'post',
    data
  })
}

export function startExperiment(id) {
  return request({
    url: `/experiments/${id}/start`,
    method: 'post'
  })
}

export function stopExperiment(id) {
  return request({
    url: `/experiments/${id}/stop`,
    method: 'post'
  })
}

export function deleteExperiment(id) {
  return request({
    url: `/experiments/${id}`,
    method: 'delete'
  })
}

export function getStatistics() {
  return request({
    url: '/experiments/statistics',
    method: 'get'
  })
}
