import { useRef, useEffect, useCallback } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { computeStatsLocally } from '../utils/pointCloudLoader'
import createApi from '../services/api'

export default function BoxSelectionTool({ pointCloudData, offsets }) {
  const { camera, gl, scene } = useThree()
  const raycaster = useRef(new THREE.Raycaster())
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0))
  
  const {
    isSelectionMode,
    selectionStart,
    selectionEnd,
    selectionBox,
    stats,
    setSelectionStart,
    setSelectionEnd,
    setSelectionBox,
    setStats,
    clearSelection,
    apiBase,
  } = useStore()
  
  const isDragging = useRef(false)
  const startPoint = useRef(null)
  
  const intersectPlane = useCallback((event) => {
    const rect = gl.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
    
    raycaster.current.setFromCamera(mouse, camera)
    const intersection = new THREE.Vector3()
    raycaster.current.ray.intersectPlane(plane.current, intersection)
    
    return intersection
  }, [camera, gl])
  
  const updatePlane = useCallback(() => {
    const normal = new THREE.Vector3()
    camera.getWorldDirection(normal)
    plane.current.setFromNormalAndCoplanarPoint(
      normal,
      camera.position.clone().add(normal.multiplyScalar(50))
    )
  }, [camera])
  
  const handlePointerDown = useCallback((event) => {
    if (!isSelectionMode) return
    
    updatePlane()
    const point = intersectPlane(event)
    if (point) {
      isDragging.current = true
      startPoint.current = point.clone()
      setSelectionStart({
        x: point.x,
        y: point.y,
        z: point.z,
      })
      setSelectionEnd({
        x: point.x,
        y: point.y,
        z: point.z,
      })
      setSelectionBox(null)
      setStats(null)
    }
  }, [isSelectionMode, intersectPlane, updatePlane, setSelectionStart, setSelectionEnd, setSelectionBox, setStats])
  
  const handlePointerMove = useCallback((event) => {
    if (!isSelectionMode || !isDragging.current || !startPoint.current) return
    
    updatePlane()
    const point = intersectPlane(event)
    if (point) {
      setSelectionEnd({
        x: point.x,
        y: point.y,
        z: point.z,
      })
    }
  }, [isSelectionMode, intersectPlane, updatePlane, setSelectionEnd])
  
  const handlePointerUp = useCallback((event) => {
    if (!isSelectionMode || !isDragging.current || !startPoint.current) {
      isDragging.current = false
      return
    }
    
    isDragging.current = false
    
    updatePlane()
    const point = intersectPlane(event)
    if (!point) return
    
    const start = startPoint.current
    const end = point
    
    const min = {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      z: Math.min(start.z, end.z),
    }
    const max = {
      x: Math.max(start.x, end.x),
      y: Math.max(start.y, end.y),
      z: Math.max(start.z, end.z),
    }
    
    const size = {
      x: max.x - min.x,
      y: max.y - min.y,
      z: max.z - min.z,
    }
    
    if (size.x < 0.1 && size.y < 0.1 && size.z < 0.1) {
      clearSelection()
      return
    }
    
    const box = { min, max }
    setSelectionBox(box)
    setSelectionStart(null)
    setSelectionEnd(null)
    
    if (pointCloudData?.original_positions) {
      const api = createApi(apiBase)
      const worldBounds = {
        min_x: min.x + offsets.x,
        max_x: max.x + offsets.x,
        min_y: min.y + offsets.y,
        max_y: max.y + offsets.y,
        min_z: min.z + offsets.z,
        max_z: max.z + offsets.z,
      }
      
      api.computeStats(useStore.getState().currentPointcloud, worldBounds)
        .then(response => {
          setStats(response.data)
        })
        .catch(error => {
          console.error('Failed to compute stats:', error)
          const localStats = computeStatsLocally(
            new Float32Array(pointCloudData.original_positions),
            box,
            offsets
          )
          setStats(localStats)
        })
    }
  }, [isSelectionMode, intersectPlane, updatePlane, clearSelection, setSelectionBox, setSelectionStart, setSelectionEnd, setStats, pointCloudData, offsets, apiBase])
  
  useEffect(() => {
    const domElement = gl.domElement
    
    domElement.addEventListener('pointerdown', handlePointerDown)
    domElement.addEventListener('pointermove', handlePointerMove)
    domElement.addEventListener('pointerup', handlePointerUp)
    domElement.addEventListener('pointerleave', handlePointerUp)
    
    return () => {
      domElement.removeEventListener('pointerdown', handlePointerDown)
      domElement.removeEventListener('pointermove', handlePointerMove)
      domElement.removeEventListener('pointerup', handlePointerUp)
      domElement.removeEventListener('pointerleave', handlePointerUp)
    }
  }, [handlePointerDown, handlePointerMove, handlePointerUp, gl])
  
  return null
}
