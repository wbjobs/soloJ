import { useRef, useMemo, useCallback } from 'react'
import * as THREE from 'three'
import { usePointCloudStore, type PointCloudData } from '@/store/pointCloudStore'

function computeHeightColors(positions: Float32Array, bbox: PointCloudData['boundingBox']): Float32Array {
  const colors = new Float32Array(positions.length)
  const minY = bbox.min[1]
  const maxY = bbox.max[1]
  const rangeY = maxY - minY || 1

  for (let i = 0; i < positions.length; i += 3) {
    const t = (positions[i + 1] - minY) / rangeY
    const r = Math.min(1, Math.max(0, 1.5 - Math.abs(t - 0.75) * 4))
    const g = Math.min(1, Math.max(0, 1.5 - Math.abs(t - 0.5) * 4))
    const b = Math.min(1, Math.max(0, 1.5 - Math.abs(t - 0.25) * 4))
    colors[i] = r
    colors[i + 1] = g
    colors[i + 2] = b
  }

  return colors
}

function computeDistanceColors(positions: Float32Array, bbox: PointCloudData['boundingBox']): Float32Array {
  const colors = new Float32Array(positions.length)
  const cx = (bbox.min[0] + bbox.max[0]) / 2
  const cy = (bbox.min[1] + bbox.max[1]) / 2
  const cz = (bbox.min[2] + bbox.max[2]) / 2
  const maxDist = Math.sqrt(
    (bbox.max[0] - cx) ** 2 + (bbox.max[1] - cy) ** 2 + (bbox.max[2] - cz) ** 2
  ) || 1

  for (let i = 0; i < positions.length; i += 3) {
    const dx = positions[i] - cx
    const dy = positions[i + 1] - cy
    const dz = positions[i + 2] - cz
    const t = Math.sqrt(dx * dx + dy * dy + dz * dz) / maxDist
    colors[i] = t
    colors[i + 1] = 1 - t
    colors[i + 2] = 0.5
  }

  return colors
}

export function usePointCloudGeometry() {
  const pointCloudData = usePointCloudStore((s) => s.pointCloudData)
  const colorMode = usePointCloudStore((s) => s.colorMode)
  const selectionBox = usePointCloudStore((s) => s.selectionBox)
  const setSelectedPointIndices = usePointCloudStore((s) => s.setSelectedPointIndices)
  const setSelectedPointCount = usePointCloudStore((s) => s.setSelectedPointCount)
  const selectedPointIndices = usePointCloudStore((s) => s.selectedPointIndices)

  const prevSelectionBoxRef = useRef<string>('')

  const geometry = useMemo(() => {
    if (!pointCloudData) return null

    const { positions, colors: originalColors, boundingBox } = pointCloudData

    let displayColors: Float32Array
    if (colorMode === 'height') {
      displayColors = computeHeightColors(positions, boundingBox)
    } else if (colorMode === 'distance') {
      displayColors = computeDistanceColors(positions, boundingBox)
    } else {
      if (originalColors) {
        displayColors = originalColors
      } else {
        displayColors = new Float32Array(positions.length).fill(1)
      }
    }

    if (selectedPointIndices) {
      const blended = new Float32Array(displayColors.length)
      blended.set(displayColors)
      for (let i = 0; i < selectedPointIndices.length; i++) {
        if (selectedPointIndices[i]) {
          const idx = i * 3
          blended[idx] = 1.0
          blended[idx + 1] = 0.42
          blended[idx + 2] = 0.21
        }
      }
      displayColors = blended
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(displayColors, 3))
    geo.computeBoundingSphere()

    return geo
  }, [pointCloudData, colorMode, selectedPointIndices])

  const updateSelection = useCallback(() => {
    if (!pointCloudData || !selectionBox) {
      setSelectedPointIndices(null)
      setSelectedPointCount(0)
      return
    }

    const boxKey = `${selectionBox.min.join(',')}-${selectionBox.max.join(',')}`
    if (boxKey === prevSelectionBoxRef.current) return
    prevSelectionBoxRef.current = boxKey

    const { positions, pointCount } = pointCloudData
    const indices = new Uint8Array(pointCount)
    let count = 0

    const minX = Math.min(selectionBox.min[0], selectionBox.max[0])
    const maxX = Math.max(selectionBox.min[0], selectionBox.max[0])
    const minY = Math.min(selectionBox.min[1], selectionBox.max[1])
    const maxY = Math.max(selectionBox.min[1], selectionBox.max[1])
    const minZ = Math.min(selectionBox.min[2], selectionBox.max[2])
    const maxZ = Math.max(selectionBox.min[2], selectionBox.max[2])

    for (let i = 0; i < pointCount; i++) {
      const x = positions[i * 3]
      const y = positions[i * 3 + 1]
      const z = positions[i * 3 + 2]
      if (x >= minX && x <= maxX && y >= minY && y <= maxY && z >= minZ && z <= maxZ) {
        indices[i] = 1
        count++
      }
    }

    setSelectedPointIndices(indices)
    setSelectedPointCount(count)
  }, [pointCloudData, selectionBox, setSelectedPointIndices, setSelectedPointCount])

  return { geometry, updateSelection }
}
