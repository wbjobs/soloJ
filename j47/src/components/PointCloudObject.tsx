import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { usePointCloudStore } from '@/store/pointCloudStore'
import { usePointCloudGeometry } from '@/hooks/usePointCloudGeometry'

const vertexShader = `
  uniform float uSize;
  varying vec3 vColor;
  void main() {
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const fragmentShader = `
  varying vec3 vColor;
  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
    gl_FragColor = vec4(vColor, alpha);
  }
`

export default function PointCloudObject() {
  const pointCloudData = usePointCloudStore((s) => s.pointCloudData)
  const pointSize = usePointCloudStore((s) => s.pointSize)
  const { geometry, updateSelection } = usePointCloudGeometry()
  const pointsRef = useRef<THREE.Points>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  useEffect(() => {
    updateSelection()
  }, [updateSelection])

  useFrame(() => {
    if (materialRef.current && materialRef.current.uniforms.uSize) {
      if (materialRef.current.uniforms.uSize.value !== pointSize) {
        materialRef.current.uniforms.uSize.value = pointSize
      }
    }
  })

  if (!geometry || !pointCloudData) return null

  return (
    <points ref={pointsRef} geometry={geometry}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        vertexColors
        transparent
        depthWrite={false}
        uniforms={{
          uSize: { value: pointSize },
        }}
      />
    </points>
  )
}
