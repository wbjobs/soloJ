import { useRef, useMemo, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import './PointCloudMaterial.jsx'
import { useStore } from '../store'
import { createPointCloudGeometry } from '../utils/pointCloudLoader'

export default function PointCloud({ data, pointSize = 2.0, colorMode = 'height' }) {
  const pointsRef = useRef()
  const materialRef = useRef()
  const { camera } = useThree()
  
  const geometry = useMemo(() => {
    if (!data) return null
    return createPointCloudGeometry(data)
  }, [data])
  
  const materialProps = useMemo(() => {
    const hasColors = data?.colors?.length > 0
    const hasIntensity = data?.intensities?.length > 0
    const hasClassification = data?.classifications?.length > 0
    
    return {
      pointSize,
      useIntensity: colorMode === 'intensity' && hasIntensity,
      useClassification: colorMode === 'classification' && hasClassification,
      heightMin: data?.bounds?.min_z || 0,
      heightMax: data?.bounds?.max_z || 100,
    }
  }, [data, pointSize, colorMode])
  
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.pointSize = materialProps.pointSize
      materialRef.current.useIntensity = materialProps.useIntensity
      materialRef.current.useClassification = materialProps.useClassification
      materialRef.current.heightMin = materialProps.heightMin
      materialRef.current.heightMax = materialProps.heightMax
    }
  }, [materialProps])
  
  if (!geometry) return null
  
  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointCloudMaterial ref={materialRef} {...materialProps} />
    </points>
  )
}
