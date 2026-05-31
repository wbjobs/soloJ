import { Suspense, useRef, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, Environment, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import LODPointCloud from './LODPointCloud.jsx'
import SelectionBox from './SelectionBox.jsx'
import ImprovedBoxSelection from './ImprovedBoxSelection.jsx'
import { useStore } from '../store'

function SceneContent({ 
  currentPointcloud, 
  offsets, 
  pointSize, 
  colorMode,
  onPointCloudReady 
}) {
  const { camera } = useThree()
  const { pointcloudData } = useStore()
  
  useEffect(() => {
    if (pointcloudData?.bounds) {
      const bounds = pointcloudData.bounds
      const center = new THREE.Vector3(
        (bounds.min_x + bounds.max_x) / 2 - offsets.x,
        (bounds.min_y + bounds.max_y) / 2 - offsets.y,
        (bounds.min_z + bounds.max_z) / 2 - offsets.z,
      )
      const size = new THREE.Vector3(
        bounds.max_x - bounds.min_x,
        bounds.max_y - bounds.min_y,
        bounds.max_z - bounds.min_z,
      )
      
      const maxDim = Math.max(size.x, size.y, size.z)
      const fov = camera.fov * (Math.PI / 180)
      const cameraZ = Math.abs(maxDim / Math.sin(fov / 2))
      
      camera.position.set(
        center.x + cameraZ * 0.5,
        center.y + cameraZ * 0.5,
        center.z + cameraZ * 0.5,
      )
      camera.lookAt(center)
      
      if (onPointCloudReady) {
        onPointCloudReady({ center, size })
      }
    }
  }, [pointcloudData, offsets, camera, onPointCloudReady])
  
  return (
    <>
      {currentPointcloud && (
        <LODPointCloud
          name={currentPointcloud}
          pointSize={pointSize}
          colorMode={colorMode}
        />
      )}
      
      <ImprovedBoxSelection 
        pointCloudData={pointcloudData}
        offsets={offsets}
      />
      <SelectionBox />
      
      <Grid 
        infiniteGrid 
        fadeDistance={300}
        fadeStrength={1}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#6f6f6f"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#9d4b4b"
      />
      
      <axesHelper args={[10]} />
      
      <OrbitControls 
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={1}
        maxDistance={1000}
      />
      
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
    </>
  )
}

export default function Scene({ 
  currentPointcloud, 
  offsets, 
  pointSize, 
  colorMode 
}) {
  const [isReady, setIsReady] = useState(false)
  
  return (
    <Canvas
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
      }}
      dpr={[1, 2]}
      style={{ width: '100%', height: '100%' }}
    >
      <PerspectiveCamera 
        makeDefault 
        position={[50, 50, 50]} 
        fov={60}
        near={0.1}
        far={10000}
      />
      
      <color attach="background" args={['#1a1a1a']} />
      <fog attach="fog" args={['#1a1a1a', 100, 500]} />
      
      <Suspense fallback={null}>
        <Environment preset="city" />
        <SceneContent
          currentPointcloud={currentPointcloud}
          offsets={offsets}
          pointSize={pointSize}
          colorMode={colorMode}
          onPointCloudReady={() => setIsReady(true)}
        />
      </Suspense>
    </Canvas>
  )
}
