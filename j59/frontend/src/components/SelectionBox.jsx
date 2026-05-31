import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'

export default function SelectionBox() {
  const groupRef = useRef()
  const edgesRef = useRef()
  
  const { selectionBox, isSelectionMode, selectionStart, selectionEnd } = useStore()
  
  const boxGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const edgesGeometry = useMemo(() => new THREE.EdgesGeometry(boxGeometry), [boxGeometry])
  
  const boxTransform = useMemo(() => {
    if (!selectionBox) return null
    
    const { min, max } = selectionBox
    const center = new THREE.Vector3(
      (min.x + max.x) / 2,
      (min.y + max.y) / 2,
      (min.z + max.z) / 2,
    )
    const size = new THREE.Vector3(
      max.x - min.x,
      max.y - min.y,
      max.z - min.z,
    )
    
    return { position: center, scale: size }
  }, [selectionBox])
  
  const previewTransform = useMemo(() => {
    if (!isSelectionMode || !selectionStart || !selectionEnd) return null
    
    const min = new THREE.Vector3(
      Math.min(selectionStart.x, selectionEnd.x),
      Math.min(selectionStart.y, selectionEnd.y),
      Math.min(selectionStart.z, selectionEnd.z),
    )
    const max = new THREE.Vector3(
      Math.max(selectionStart.x, selectionEnd.x),
      Math.max(selectionStart.y, selectionEnd.y),
      Math.max(selectionStart.z, selectionEnd.z),
    )
    
    const center = new THREE.Vector3(
      (min.x + max.x) / 2,
      (min.y + max.y) / 2,
      (min.z + max.z) / 2,
    )
    const size = new THREE.Vector3(
      max.x - min.x,
      max.y - min.y,
      max.z - min.z,
    )
    
    return { position: center, scale: size }
  }, [isSelectionMode, selectionStart, selectionEnd])
  
  useEffect(() => {
    if (groupRef.current) {
      if (boxTransform) {
        groupRef.current.position.copy(boxTransform.position)
        groupRef.current.scale.copy(boxTransform.scale)
        groupRef.current.visible = true
      } else if (previewTransform) {
        groupRef.current.position.copy(previewTransform.position)
        groupRef.current.scale.copy(previewTransform.scale)
        groupRef.current.visible = true
      } else {
        groupRef.current.visible = false
      }
    }
  }, [boxTransform, previewTransform])
  
  useFrame(() => {
    if (edgesRef.current && groupRef.current?.visible) {
      const time = Date.now() * 0.003
      const pulse = 0.7 + 0.3 * Math.sin(time)
      edgesRef.current.material.color.setHSL(0.6, 1, 0.5 * pulse + 0.3)
    }
  })
  
  return (
    <group ref={groupRef} visible={false}>
      <mesh geometry={boxGeometry}>
        <meshBasicMaterial
          color="#00ffff"
          transparent
          opacity={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
      <lineSegments ref={edgesRef} geometry={edgesGeometry}>
        <lineBasicMaterial color="#00ffff" linewidth={2} />
      </lineSegments>
    </group>
  )
}
