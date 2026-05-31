import request from '@/utils/request'

export function getAllServices() {
  return request({
    url: '/services',
    method: 'get'
  })
}

export function getServiceInstances(serviceName) {
  return request({
    url: `/services/${serviceName}/instances`,
    method: 'get'
  })
}

export function getHealthyInstances(serviceName) {
  return request({
    url: `/services/${serviceName}/healthy`,
    method: 'get'
  })
}

export function refreshServices() {
  return request({
    url: '/services/refresh',
    method: 'post'
  })
}

export function addServiceInstance(data) {
  return request({
    url: '/services',
    method: 'post',
    data
  })
}
