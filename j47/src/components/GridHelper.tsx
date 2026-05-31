import { useRef, useEffect, useCallback } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { usePointCloudStore } from '@/store/pointCloudStore'

export default function GridHelper() {
  const pointCloudData = usePointCloudStore((s) => s.pointCloudData)
  const gridRef = useRef<THREE.GridHelper>(null)
  const axesRef = useRef<THREE.AxesHelper>(null)
  const { scene } = useThree()

  useEffect(() => {
    if (!pointCloudData) return

    const { boundingBox } = pointCloudData
    const sizeX = boundingBox.max[0] - boundingBox.min[0]
    const sizeZ = boundingBox.max[2] - boundingBox.min[2]
    const gridSize = Math.max(sizeX, sizeZ) * 1.5
    const divisions = 20

    if (gridRef.current) {
      scene.remove(gridRef.current)
      gridRef.current.geometry.dispose()
      ;(gridRef.current.material as THREE.Material).dispose()
    }

    const grid = new THREE.GridHelper(gridSize, divisions, 0x1a3a4a, 0x0d1f2a)
    grid.position.y = boundingBox.min[1]
    gridRef.current = grid
    scene.add(grid)

    if (axesRef.current) {
      scene.remove(axesRef.current)
    }
    const axes = new THREE.AxesHelper(gridSize * 0.3)
    axes.position.y = boundingBox.min[1]
    axesRef.current = axes
    scene.add(axes)

    return () => {
      if (gridRef.current) {
        scene.remove(gridRef.current)
        gridRef.current.geometry.dispose()
        ;(gridRef.current.material as THREE.Material).dispose()
      }
      if (axesRef.current) {
        scene.remove(axesRef.current)
      }
    }
  }, [pointCloudData, scene])

  return null
}
