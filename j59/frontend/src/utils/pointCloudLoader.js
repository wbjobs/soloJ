import * as THREE from 'three'
import createApi from '../services/api'

export async function loadPointCloud(name, apiBase, params = {}) {
  const api = createApi(apiBase)
  
  try {
    const response = await api.getPointcloudTile(name, {
      max_points: 500000,
      lod: 0,
      ...params,
    })
    return response.data
  } catch (error) {
    console.error('Failed to load point cloud:', error)
    throw error
  }
}

export function createPointCloudGeometry(data) {
  const geometry = new THREE.BufferGeometry()
  
  const positions = new Float32Array(data.positions)
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  
  if (data.colors) {
    const colors = new Float32Array(data.colors)
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  }
  
  if (data.intensities) {
    const intensities = new Float32Array(data.intensities)
    geometry.setAttribute('intensity', new THREE.BufferAttribute(intensities, 1))
  }
  
  if (data.classifications) {
    const classifications = new Float32Array(data.classifications)
    geometry.setAttribute('classification', new THREE.BufferAttribute(classifications, 1))
  }
  
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  
  return geometry
}

export function getOriginalBounds(data, centeredBounds) {
  const offsets = data.offsets
  return {
    min_x: centeredBounds.min_x + offsets.x,
    max_x: centeredBounds.max_x + offsets.x,
    min_y: centeredBounds.min_y + offsets.y,
    max_y: centeredBounds.max_y + offsets.y,
    min_z: centeredBounds.min_z + offsets.z,
    max_z: centeredBounds.max_z + offsets.z,
  }
}

export function computeStatsLocally(positions, selectionBox, offsets) {
  if (!positions || !selectionBox) {
    return null
  }
  
  const { min: boxMin, max: boxMax } = selectionBox
  
  const worldMin = {
    x: boxMin.x + offsets.x,
    y: boxMin.y + offsets.y,
    z: boxMin.z + offsets.z,
  }
  const worldMax = {
    x: boxMax.x + offsets.x,
    y: boxMax.y + offsets.y,
    z: boxMax.z + offsets.z,
  }
  
  let count = 0
  let sumZ = 0
  let minZ = Infinity
  let maxZ = -Infinity
  
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i] + offsets.x
    const y = positions[i + 1] + offsets.y
    const z = positions[i + 2] + offsets.z
    
    if (
      x >= worldMin.x && x <= worldMax.x &&
      y >= worldMin.y && y <= worldMax.y &&
      z >= worldMin.z && z <= worldMax.z
    ) {
      count++
      sumZ += z
      minZ = Math.min(minZ, z)
      maxZ = Math.max(maxZ, z)
    }
  }
  
  const volume = 
    (worldMax.x - worldMin.x) *
    (worldMax.y - worldMin.y) *
    (worldMax.z - worldMin.z)
  
  if (count === 0) {
    return {
      point_count: 0,
      average_height: 0,
      volume,
      min_height: 0,
      max_height: 0,
      height_std: 0,
    }
  }
  
  const avgZ = sumZ / count
  
  let variance = 0
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i] + offsets.x
    const y = positions[i + 1] + offsets.y
    const z = positions[i + 2] + offsets.z
    
    if (
      x >= worldMin.x && x <= worldMax.x &&
      y >= worldMin.y && y <= worldMax.y &&
      z >= worldMin.z && z <= worldMax.z
    ) {
      variance += Math.pow(z - avgZ, 2)
    }
  }
  
  const stdZ = Math.sqrt(variance / count)
  
  return {
    point_count: count,
    average_height: avgZ,
    volume,
    min_height: minZ,
    max_height: maxZ,
    height_std: stdZ,
  }
}
