import request from '@/utils/request'

export function startExploration(data) {
  return request({
    url: '/exploration/start',
    method: 'post',
    data
  })
}

export function executeAutoExperiments(data) {
  return request({
    url: '/exploration/execute',
    method: 'post',
    data
  })
}

export function replayExperiment(experimentId) {
  return request({
    url: `/exploration/replay/${experimentId}`,
    method: 'post'
  })
}

export function getReplayComparison(originalId, replayId) {
  return request({
    url: '/exploration/replay/comparison',
    method: 'get',
    params: { originalId, replayId }
  })
}

export function getExplorationReport(explorationId) {
  return request({
    url: `/exploration/report/${explorationId}`,
    method: 'get'
  })
}

export function stopExploration(explorationId) {
  return request({
    url: `/exploration/stop/${explorationId}`,
    method: 'post'
  })
}
