import request from '@/utils/request'

export function getExperimentMetrics(experimentId, metricName) {
  return request({
    url: `/metrics/experiment/${experimentId}`,
    method: 'get',
    params: { metricName }
  })
}

export function getRealtimeMetrics(experimentId) {
  return request({
    url: `/metrics/experiment/${experimentId}/realtime`,
    method: 'get'
  })
}

export function getMetricComparison(experimentId) {
  return request({
    url: `/metrics/experiment/${experimentId}/comparison`,
    method: 'get'
  })
}
