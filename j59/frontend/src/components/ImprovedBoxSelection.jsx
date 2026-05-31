import { useRef, useEffect, useCallback, useState } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { computeStatsLocally } from '../utils/pointCloudLoader'
import createApi from '../services/api'

export default function ImprovedBoxSelection({ pointCloudData, offsets }) {
  const { camera, gl, scene } = useThree()
  const raycaster = useRef(new THREE.Raycaster())
  const tempVector = useRef(new THREE.Vector3())
  const tempMatrix = useRef(new THREE.Matrix4())
  const selectionPlane = useRef(new THREE.Mesh())
  const selectionPlaneHelper = useRef(new THREE.Mesh())
  
  const {
    isSelectionMode,
    selectionBox,
    stats,
    setSelectionStart,
    setSelectionEnd,
    setSelectionBox,
    setStats,
    clearSelection,
    apiBase,
    currentPointcloud,
  } = useStore()
  
  const isDragging = useRef(false)
  const dragStartPoint = useRef(null)
  const [isPlaneVisible, setIsPlaneVisible] = useState(false)
  const [planePosition, setPlanePosition] = useState({ x: 0, y: 0, z: 0 })
  
  const api = createApi(apiBase)
  
  const getClosestPoint = useCallback((screenX, screenY) => {
    if (!pointCloudData?.positions) return null
    
    const rect = gl.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((screenX - rect.left) / rect.width) * 2 - 1,
      -((screenY - rect.top) / rect.height) * 2 + 1,
    )
    
    raycaster.current.setFromCamera(mouse, camera)
    
    const positions = pointCloudData.positions
    const position = new THREE.Vector3()
    const direction = new THREE.Vector3()
    raycaster.current.ray.origin.copy(raycaster.current.ray.origin)
    raycaster.current.ray.direction.copy(raycaster.current.ray.direction)
    
    let closestPoint = null
    let closestDistance = Infinity
    const threshold = 5.0
    
    for (let i = 0; i < positions.length; i += 3) {
      position.set(
        positions[i],
        positions[i + 1],
        positions[i + 2]
      )
      
      const distance = raycaster.current.ray.distanceToPoint(position)
      
      if (distance < threshold && distance < closestDistance) {
        closestDistance = distance
        closestPoint = position.clone()
      }
    }
    
    return closestPoint
  }, [pointCloudData, camera, gl])
  
  const getSelectionPlanePoint = useCallback((screenX, screenY) => {
    const rect = gl.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((screenX - rect.left) / rect.width) * 2 - 1,
      -((screenY - rect.top) / rect.height) * 2 + 1,
    )
    
    raycaster.current.setFromCamera(mouse, camera)
    
    const planeNormal = new THREE.Vector3()
    camera.getWorldDirection(planeNormal)
    planeNormal.negate()
    
    const planePoint = new THREE.Vector3(
      planePosition.x,
      planePosition.y,
      planePosition.z
    )
    
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, planePoint)
    const intersection = new THREE.Vector3()
    
    raycaster.current.ray.intersectPlane(plane, intersection)
    
    return intersection
  }, [camera, gl, planePosition])
  
  const updateSelectionPlane = useCallback(() => {
    if (!pointCloudData?.positions || pointCloudData.positions.length === 0) return
    
    const positions = pointCloudData.positions
    let centerX = 0, centerY = 0, centerZ = 0
    const sampleCount = Math.min(1000, positions.length / 3)
    
    for (let i = 0; i < sampleCount * 3; i += 3) {
      centerX += positions[i]
      centerY += positions[i + 1]
      centerZ += positions[i + 2]
    }
    
    centerX /= sampleCount
    centerY /= sampleCount
    centerZ /= sampleCount
    
    setPlanePosition({ x: centerX, y: centerY, z: centerZ })
  }, [pointCloudData])
  
  const handlePointerDown = useCallback((event) => {
    if (!isSelectionMode) return
    
    updateSelectionPlane()
    setIsPlaneVisible(true)
    
    let point = getClosestPoint(event.clientX, event.clientY)
    
    if (!point) {
      point = getSelectionPlanePoint(event.clientX, event.clientY)
    }
    
    if (point) {
      isDragging.current = true
      dragStartPoint.current = point.clone()
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
  }, [isSelectionMode, updateSelectionPlane, getClosestPoint, getSelectionPlanePoint, setSelectionStart, setSelectionEnd, setSelectionBox, setStats])
  
  const handlePointerMove = useCallback((event) => {
    if (!isSelectionMode || !isDragging.current || !dragStartPoint.current) return
    
    let point = getClosestPoint(event.clientX, event.clientY)
    
    if (!point) {
      point = getSelectionPlanePoint(event.clientX, event.clientY)
    }
    
    if (point) {
      setSelectionEnd({
        x: point.x,
        y: point.y,
        z: point.z,
      })
    }
  }, [isSelectionMode, getClosestPoint, getSelectionPlanePoint, setSelectionEnd])
  
  const handlePointerUp = useCallback((event) => {
    if (!isSelectionMode || !isDragging.current || !dragStartPoint.current) {
      isDragging.current = false
      setIsPlaneVisible(false)
      return
    }
    
    isDragging.current = false
    setIsPlaneVisible(false)
    
    let endPoint = getClosestPoint(event.clientX, event.clientY)
    if (!endPoint) {
      endPoint = getSelectionPlanePoint(event.clientX, event.clientY)
    }
    
    if (!endPoint) return
    
    const start = dragStartPoint.current
    const end = endPoint
    
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
    
    const minSize = 0.5
    if (size.x < minSize && size.y < minSize && size.z < minSize) {
      const expand = minSize / 2
      min.x -= expand
      max.x += expand
      min.y -= expand
      max.y += expand
      min.z -= expand
      max.z += expand
    }
    
    const box = { min, max }
    setSelectionBox(box)
    setSelectionStart(null)
    setSelectionEnd(null)
    
    if (pointCloudData?.original_positions && currentPointcloud) {
      const worldBounds = {
        min_x: min.x + offsets.x,
        max_x: max.x + offsets.x,
        min_y: min.y + offsets.y,
        max_y: max.y + offsets.y,
        min_z: min.z + offsets.z,
        max_z: max.z + offsets.z,
      }
      
      api.computeStats(currentPointcloud, worldBounds)
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
  }, [isSelectionMode, getClosestPoint, getSelectionPlanePoint, setSelectionBox, setSelectionStart, setSelectionEnd, setStats, pointCloudData, offsets, api, currentPointcloud])
  
  useEffect(() => {
    if (!pointCloudData?.bounds) return
    
    const bounds = pointCloudData.bounds
    selectionPlane.current.visible = false
    
    const geometry = new THREE.PlaneGeometry(1000, 1000)
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.05,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    
    const helperGeometry = new THREE.PlaneGeometry(1000, 1000)
    const helperMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
      wireframe: true,
      depthWrite: false,
    })
    
    selectionPlane.current.geometry = geometry
    selectionPlane.current.material = material
    selectionPlaneHelper.current.geometry = helperGeometry
    selectionPlaneHelper.current.material = helperMaterial
    
    scene.add(selectionPlane.current)
    scene.add(selectionPlaneHelper.current)
    
    return () => {
      scene.remove(selectionPlane.current)
      scene.remove(selectionPlaneHelper.current)
      geometry.dispose()
      material.dispose()
      helperGeometry.dispose()
      helperMaterial.dispose()
    }
  }, [pointCloudData, scene])
  
  useFrame(() => {
    if (isPlaneVisible && selectionPlane.current.visible !== undefined) {
      selectionPlane.current.visible = true
      selectionPlaneHelper.current.visible = true
      
      const normal = new THREE.Vector3()
      camera.getWorldDirection(normal)
      normal.negate()
      
      selectionPlane.current.position.set(planePosition.x, planePosition.y, planePosition.z)
      selectionPlane.current.lookAt(
        planePosition.x + normal.x,
        planePosition.y + normal.y,
        planePosition.z + normal.z
      )
      
      selectionPlaneHelper.current.position.copy(selectionPlane.current.position)
      selectionPlaneHelper.current.quaternion.copy(selectionPlane.current.quaternion)
    } else if (selectionPlane.current.visible !== undefined) {
      selectionPlane.current.visible = false
      selectionPlaneHelper.current.visible = false
    }
  })
  
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
