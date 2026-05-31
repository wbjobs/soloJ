import { useRef, useMemo, useEffect, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import './PointCloudMaterial.jsx'
import { useStore } from '../store'
import { useLODPointCloud } from '../hooks/useLODPointCloud.js'

export default function LODPointCloud({ name, pointSize = 2.0, colorMode = 'height' }) {
  const { camera, scene } = useThree()
  const groupRef = useRef()
  const materialsRef = useRef(new Map())
  const geometriesRef = useRef(new Map())
  
  const { apiBase, offsets, setPointcloudData, visibleClasses, classificationRules } = useStore()
  
  const {
    nodes,
    loading,
    totalPoints,
    octreeInfo,
    updateVisibleNodes,
    getAllPositions,
    getAllOriginalPositions,
  } = useLODPointCloud(name, apiBase, offsets, camera)
  
  const heightBounds = useMemo(() => {
    if (!octreeInfo?.root_bounds) return { min: 0, max: 100 }
    return {
      min: octreeInfo.root_bounds.min_z - offsets.z,
      max: octreeInfo.root_bounds.max_z - offsets.z,
    }
  }, [octreeInfo, offsets])
  
  const createGeometry = useCallback((nodeData) => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(nodeData.positions, 3))
    
    if (nodeData.colors) {
      geometry.setAttribute('color', new THREE.BufferAttribute(nodeData.colors, 3))
    }
    if (nodeData.intensities) {
      geometry.setAttribute('intensity', new THREE.BufferAttribute(nodeData.intensities, 1))
    }
    if (nodeData.classifications) {
      geometry.setAttribute('classification', new THREE.BufferAttribute(nodeData.classifications, 1))
    }
    
    return geometry
  }, [])
  
  const getOrCreateMaterial = useCallback((nodeId) => {
    if (!materialsRef.current.has(nodeId)) {
      const classColors = new Float32Array(32 * 3)
      classificationRules.forEach(rule => {
        const idx = rule.class_id * 3
        classColors[idx] = rule.color[0] / 255
        classColors[idx + 1] = rule.color[1] / 255
        classColors[idx + 2] = rule.color[2] / 255
      })
      
      const visibleMask = new Float32Array(32)
      visibleClasses.forEach(classId => {
        visibleMask[classId] = 1.0
      })
      
      const material = new THREE.ShaderMaterial({
        uniforms: {
          pointSize: { value: pointSize },
          useIntensity: { value: false },
          useClassification: { value: false },
          heightMin: { value: heightBounds.min },
          heightMax: { value: heightBounds.max },
          classColors: { value: classColors },
          visibleMask: { value: visibleMask },
        },
        vertexShader: `
          attribute float intensity;
          attribute float classification;
          
          varying vec3 vColor;
          varying float vIntensity;
          varying float vClassification;
          varying vec3 vPosition;
          varying float vVisible;
          
          uniform float pointSize;
          uniform bool useIntensity;
          uniform bool useClassification;
          uniform float heightMin;
          uniform float heightMax;
          uniform vec3 classColors[32];
          uniform float visibleMask[32];
          
          vec3 getHeightColor(float height) {
            float t = (height - heightMin) / (heightMax - heightMin);
            t = clamp(t, 0.0, 1.0);
            
            vec3 color0 = vec3(0.0, 0.0, 0.5);
            vec3 color1 = vec3(0.0, 0.5, 1.0);
            vec3 color2 = vec3(0.0, 1.0, 0.5);
            vec3 color3 = vec3(1.0, 1.0, 0.0);
            vec3 color4 = vec3(1.0, 0.5, 0.0);
            vec3 color5 = vec3(1.0, 0.0, 0.0);
            
            if (t < 0.2) return mix(color0, color1, t * 5.0);
            else if (t < 0.4) return mix(color1, color2, (t - 0.2) * 5.0);
            else if (t < 0.6) return mix(color2, color3, (t - 0.4) * 5.0);
            else if (t < 0.8) return mix(color3, color4, (t - 0.6) * 5.0);
            else return mix(color4, color5, (t - 0.8) * 5.0);
          }
          
          vec3 getClassificationColor(float cls) {
            int c = int(cls + 0.5);
            if (c >= 0 && c < 32) {
              return classColors[c];
            }
            return vec3(0.7, 0.7, 0.7);
          }
          
          bool isClassVisible(float cls) {
            int c = int(cls + 0.5);
            if (c >= 0 && c < 32) {
              return visibleMask[c] > 0.5;
            }
            return true;
          }
          
          void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            
            vVisible = 1.0;
            if (useClassification && !isClassVisible(classification)) {
              vVisible = 0.0;
            }
            
            if (useIntensity) {
              float i = clamp(intensity / 65535.0, 0.0, 1.0);
              vColor = vec3(i);
            } else if (useClassification) {
              vColor = getClassificationColor(classification);
            } else if (color != vec3(0.0)) {
              vColor = color;
            } else {
              vColor = getHeightColor(position.z);
            }
            
            vIntensity = intensity;
            vClassification = classification;
            vPosition = position;
            
            gl_PointSize = pointSize * (300.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          varying float vIntensity;
          varying float vClassification;
          varying vec3 vPosition;
          varying float vVisible;
          
          void main() {
            if (vVisible < 0.5) {
              discard;
            }
            
            vec2 center = gl_PointCoord - vec2(0.5);
            float dist = length(center);
            
            if (dist > 0.5) {
              discard;
            }
            
            float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
            alpha = clamp(alpha, 0.3, 1.0);
            
            gl_FragColor = vec4(vColor, alpha);
          }
        `,
        transparent: true,
        vertexColors: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      materialsRef.current.set(nodeId, material)
    }
    return materialsRef.current.get(nodeId)
  }, [pointSize, colorMode, heightBounds, classificationRules, visibleClasses])

  useEffect(() => {
    if (!groupRef.current) return
    
    const classColors = new Float32Array(32 * 3)
    classificationRules.forEach(rule => {
      const idx = rule.class_id * 3
      classColors[idx] = rule.color[0] / 255
      classColors[idx + 1] = rule.color[1] / 255
      classColors[idx + 2] = rule.color[2] / 255
    })
    
    const visibleMask = new Float32Array(32)
    visibleClasses.forEach(classId => {
      visibleMask[classId] = 1.0
    })
    
    groupRef.current.children.forEach(child => {
      if (child.material?.uniforms) {
        child.material.uniforms.pointSize.value = pointSize
        child.material.uniforms.heightMin.value = heightBounds.min
        child.material.uniforms.heightMax.value = heightBounds.max
        child.material.uniforms.useIntensity.value = colorMode === 'intensity'
        child.material.uniforms.useClassification.value = colorMode === 'classification'
        child.material.uniforms.classColors.value = classColors
        child.material.uniforms.visibleMask.value = visibleMask
        child.material.uniformsNeedUpdate = true
      }
    })
  }, [pointSize, colorMode, heightBounds, classificationRules, visibleClasses])
  
  useEffect(() => {
    if (!groupRef.current) return
    
    const currentNodeIds = new Set(nodes.keys())
    const childrenToRemove = []
    
    for (let i = groupRef.current.children.length - 1; i >= 0; i--) {
      const child = groupRef.current.children[i]
      if (!currentNodeIds.has(child.userData.nodeId)) {
        childrenToRemove.push(child)
      }
    }
    
    childrenToRemove.forEach(child => {
      groupRef.current.remove(child)
      child.geometry?.dispose()
      child.material?.dispose()
      geometriesRef.current.delete(child.userData.nodeId)
      materialsRef.current.delete(child.userData.nodeId)
    })
    
    nodes.forEach((nodeData, nodeId) => {
      const existing = groupRef.current.children.find(c => c.userData.nodeId === nodeId)
      if (!existing) {
        const geometry = createGeometry(nodeData)
        geometriesRef.current.set(nodeId, geometry)
        
        const material = getOrCreateMaterial(nodeId)
        material.uniforms.pointSize.value = pointSize
        material.uniforms.heightMin.value = heightBounds.min
        material.uniforms.heightMax.value = heightBounds.max
        material.uniforms.useIntensity.value = colorMode === 'intensity' && !!nodeData.intensities
        material.uniforms.useClassification.value = colorMode === 'classification' && !!nodeData.classifications
        
        const points = new THREE.Points(geometry, material)
        points.userData.nodeId = nodeId
        groupRef.current.add(points)
      } else {
        const material = existing.material
        if (material?.uniforms) {
          material.uniforms.pointSize.value = pointSize
          material.uniforms.heightMin.value = heightBounds.min
          material.uniforms.heightMax.value = heightBounds.max
          material.uniforms.useIntensity.value = colorMode === 'intensity'
          material.uniforms.useClassification.value = colorMode === 'classification'
        }
      }
    })
  }, [nodes, pointSize, colorMode, heightBounds, createGeometry, getOrCreateMaterial])
  
  let lastUpdateTime = 0
  useFrame(() => {
    const now = Date.now()
    if (now - lastUpdateTime > 500) {
      lastUpdateTime = now
      updateVisibleNodes()
    }
  })
  
  useEffect(() => {
    if (totalPoints > 0) {
      setPointcloudData({
        positions: getAllPositions(),
        original_positions: getAllOriginalPositions(),
        point_count: totalPoints,
        bounds: octreeInfo?.root_bounds,
      })
    }
  }, [totalPoints, octreeInfo, getAllPositions, getAllOriginalPositions, setPointcloudData])
  
  return (
    <group ref={groupRef}>
      {loading && (
        <pointLight position={[0, 0, 0]} intensity={0} />
      )}
    </group>
  )
}
