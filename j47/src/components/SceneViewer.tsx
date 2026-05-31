import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { usePointCloudStore } from '@/store/pointCloudStore'
import PointCloudObject from './PointCloudObject'
import BoxSelector from './BoxSelector'
import CameraController from './CameraController'
import GridHelper from './GridHelper'

export default function SceneViewer() {
  const selectionMode = usePointCloudStore((s) => s.selectionMode)
  const [selectionRect, setSelectionRect] = useState<{
    left: number
    top: number
    width: number
    height: number
  } | null>(null)

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ fov: 60, near: 0.01, far: 10000 }}
        style={{ background: '#0a0e17' }}
        gl={{ antialias: true, alpha: false }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />

        <PointCloudObject />
        <BoxSelector onSelectionRectChange={setSelectionRect} />
        <CameraController />
        <GridHelper />

        <OrbitControls
          enabled={!selectionMode}
          enableDamping
          dampingFactor={0.1}
          rotateSpeed={0.8}
          zoomSpeed={1.2}
          panSpeed={0.8}
        />
      </Canvas>

      {selectionRect && (
        <div
          style={{
            position: 'absolute',
            left: selectionRect.left,
            top: selectionRect.top,
            width: selectionRect.width,
            height: selectionRect.height,
            border: '2px solid #00ffa3',
            backgroundColor: 'rgba(0, 255, 163, 0.1)',
            pointerEvents: 'none',
            boxSizing: 'border-box',
            borderRadius: 1,
          }}
        />
      )}
    </div>
  )
}
