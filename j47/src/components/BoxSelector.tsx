import { useRef, useState, useCallback, useEffect } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { usePointCloudStore } from '@/store/pointCloudStore'

interface BoxSelectorProps {
  onSelectionRectChange?: (rect: { left: number; top: number; width: number; height: number } | null) => void
}

export default function BoxSelector({ onSelectionRectChange }: BoxSelectorProps) {
  const selectionMode = usePointCloudStore((s) => s.selectionMode)
  const pointCloudData = usePointCloudStore((s) => s.pointCloudData)
  const setSelectionBox = usePointCloudStore((s) => s.setSelectionBox)
  const setSelectedPointIndices = usePointCloudStore((s) => s.setSelectedPointIndices)
  const setSelectedPointCount = usePointCloudStore((s) => s.setSelectedPointCount)
  const selectionBox = usePointCloudStore((s) => s.selectionBox)

  const [isDragging, setIsDragging] = useState(false)
  const [startScreen, setStartScreen] = useState<{ x: number; y: number } | null>(null)
  const [endScreen, setEndScreen] = useState<{ x: number; y: number } | null>(null)

  const { camera, gl } = useThree()
  const tempVector = useRef(new THREE.Vector3())

  const selectPointsInScreenRect = useCallback(
    (rect: { left: number; top: number; right: number; bottom: number }) => {
      if (!pointCloudData) return

      const { positions, pointCount } = pointCloudData
      const indices = new Uint8Array(pointCount)
      let count = 0

      const { left, right, top, bottom } = rect
      const width = gl.domElement.clientWidth
      const height = gl.domElement.clientHeight

      for (let i = 0; i < pointCount; i++) {
        const x = positions[i * 3]
        const y = positions[i * 3 + 1]
        const z = positions[i * 3 + 2]

        tempVector.current.set(x, y, z)
        tempVector.current.project(camera)

        const screenX = ((tempVector.current.x + 1) / 2) * width
        const screenY = ((1 - tempVector.current.y) / 2) * height

        if (screenX >= left && screenX <= right && screenY >= top && screenY <= bottom) {
          indices[i] = 1
          count++
        }
      }

      setSelectedPointIndices(indices)
      setSelectedPointCount(count)

      if (count > 0) {
        let minX = Infinity,
          minY = Infinity,
          minZ = Infinity
        let maxX = -Infinity,
          maxY = -Infinity,
          maxZ = -Infinity
        for (let i = 0; i < pointCount; i++) {
          if (indices[i]) {
            const x = positions[i * 3]
            const y = positions[i * 3 + 1]
            const z = positions[i * 3 + 2]
            minX = Math.min(minX, x)
            minY = Math.min(minY, y)
            minZ = Math.min(minZ, z)
            maxX = Math.max(maxX, x)
            maxY = Math.max(maxY, y)
            maxZ = Math.max(maxZ, z)
          }
        }
        setSelectionBox({
          min: [minX, minY, minZ] as [number, number, number],
          max: [maxX, maxY, maxZ] as [number, number, number],
        })
      } else {
        setSelectionBox(null)
      }
    },
    [pointCloudData, camera, gl, setSelectedPointIndices, setSelectedPointCount, setSelectionBox]
  )

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (!selectionMode || e.button !== 0) return

      const rect = gl.domElement.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      setIsDragging(true)
      setStartScreen({ x, y })
      setEndScreen({ x, y })
      setSelectionBox(null)
      setSelectedPointIndices(null)
      setSelectedPointCount(0)
      onSelectionRectChange?.(null)
      e.stopPropagation()
      e.preventDefault()
    },
    [selectionMode, gl, setSelectionBox, setSelectedPointIndices, setSelectedPointCount, onSelectionRectChange]
  )

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDragging || !startScreen) return

      const rect = gl.domElement.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      setEndScreen({ x, y })

      const left = Math.min(startScreen.x, x)
      const right = Math.max(startScreen.x, x)
      const top = Math.min(startScreen.y, y)
      const bottom = Math.max(startScreen.y, y)

      onSelectionRectChange?.({
        left,
        top,
        width: right - left,
        height: bottom - top,
      })
    },
    [isDragging, startScreen, gl, onSelectionRectChange]
  )

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (!isDragging || !startScreen) {
        setIsDragging(false)
        onSelectionRectChange?.(null)
        return
      }

      const rect = gl.domElement.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const left = Math.min(startScreen.x, x)
      const right = Math.max(startScreen.x, x)
      const top = Math.min(startScreen.y, y)
      const bottom = Math.max(startScreen.y, y)

      const minSize = 5
      if (right - left > minSize || bottom - top > minSize) {
        selectPointsInScreenRect({ left, right, top, bottom })
      }

      setIsDragging(false)
      setStartScreen(null)
      setEndScreen(null)
      onSelectionRectChange?.(null)
    },
    [isDragging, startScreen, gl, selectPointsInScreenRect, onSelectionRectChange]
  )

  useEffect(() => {
    const canvas = gl.domElement
    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('pointerleave', handlePointerUp)
    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('pointerleave', handlePointerUp)
    }
  }, [gl, handlePointerDown, handlePointerMove, handlePointerUp])

  if (!selectionMode) return null

  if (!selectionBox) return null

  const boxPosition: [number, number, number] = [
    (selectionBox.min[0] + selectionBox.max[0]) / 2,
    (selectionBox.min[1] + selectionBox.max[1]) / 2,
    (selectionBox.min[2] + selectionBox.max[2]) / 2,
  ]
  const boxScale: [number, number, number] = [
    Math.max(0.001, selectionBox.max[0] - selectionBox.min[0]),
    Math.max(0.001, selectionBox.max[1] - selectionBox.min[1]),
    Math.max(0.001, selectionBox.max[2] - selectionBox.min[2]),
  ]

  return (
    <mesh position={boxPosition}>
      <boxGeometry args={boxScale} />
      <meshBasicMaterial
        color="#00ffa3"
        wireframe
        transparent
        opacity={0.8}
      />
    </mesh>
  )
}
