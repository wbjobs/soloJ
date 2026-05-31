import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useThree, useFrame } from '@react-three/fiber'
import { usePointCloudStore } from '@/store/pointCloudStore'

export default function CameraController() {
  const pointCloudData = usePointCloudStore((s) => s.pointCloudData)
  const cameraResetTrigger = usePointCloudStore((s) => s.cameraResetTrigger)
  const { camera } = useThree()
  const initialized = useRef(false)

  useEffect(() => {
    if (!pointCloudData) return
    initialized.current = false
  }, [pointCloudData])

  useFrame(() => {
    if (!pointCloudData || initialized.current) return

    const { boundingBox } = pointCloudData
    const center = new THREE.Vector3(
      (boundingBox.min[0] + boundingBox.max[0]) / 2,
      (boundingBox.min[1] + boundingBox.max[1]) / 2,
      (boundingBox.min[2] + boundingBox.max[2]) / 2
    )

    const size = new THREE.Vector3(
      boundingBox.max[0] - boundingBox.min[0],
      boundingBox.max[1] - boundingBox.min[1],
      boundingBox.max[2] - boundingBox.min[2]
    )

    const maxDim = Math.max(size.x, size.y, size.z)
    const distance = maxDim * 2

    camera.position.set(center.x + distance * 0.5, center.y + distance * 0.3, center.z + distance * 0.5)
    camera.lookAt(center)
    camera.updateProjectionMatrix()

    initialized.current = true
  })

  useEffect(() => {
    if (!pointCloudData || cameraResetTrigger === 0) return

    const { boundingBox } = pointCloudData
    const center = new THREE.Vector3(
      (boundingBox.min[0] + boundingBox.max[0]) / 2,
      (boundingBox.min[1] + boundingBox.max[1]) / 2,
      (boundingBox.min[2] + boundingBox.max[2]) / 2
    )

    const size = new THREE.Vector3(
      boundingBox.max[0] - boundingBox.min[0],
      boundingBox.max[1] - boundingBox.min[1],
      boundingBox.max[2] - boundingBox.min[2]
    )

    const maxDim = Math.max(size.x, size.y, size.z)
    const distance = maxDim * 2

    camera.position.set(center.x + distance * 0.5, center.y + distance * 0.3, center.z + distance * 0.5)
    camera.lookAt(center)
    camera.updateProjectionMatrix()
  }, [cameraResetTrigger, pointCloudData, camera])

  return null
}
