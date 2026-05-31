import request from '@/utils/request'

export function getPendingApprovals(params) {
  return request({
    url: '/approvals/pending',
    method: 'get',
    params
  })
}

export function getAllApprovals(params) {
  return request({
    url: '/approvals',
    method: 'get',
    params
  })
}

export function getApproval(experimentId) {
  return request({
    url: `/approvals/experiment/${experimentId}`,
    method: 'get'
  })
}

export function approveExperiment(experimentId, reason) {
  return request({
    url: `/approvals/${experimentId}/approve`,
    method: 'post',
    data: { reason }
  })
}

export function rejectExperiment(experimentId, reason) {
  return request({
    url: `/approvals/${experimentId}/reject`,
    method: 'post',
    data: { reason }
  })
}
