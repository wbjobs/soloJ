import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ForceIndicatorProps {
  isActive: boolean;
  position: [number, number, number];
  radius: number;
}

export function ForceIndicator({ isActive, position, radius }: ForceIndicatorProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [visible, setVisible] = useState(false);
  const scaleRef = useRef(0);
  const opacityRef = useRef(0);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.position.set(position[0], position[1], position[2]);
      
      const targetScale = isActive ? 1 : 0;
      const targetOpacity = isActive ? 0.6 : 0;
      
      scaleRef.current += (targetScale - scaleRef.current) * delta * 10;
      opacityRef.current += (targetOpacity - opacityRef.current) * delta * 10;
      
      const pulse = 1 + Math.sin(performance.now() * 0.005) * 0.1;
      meshRef.current.scale.setScalar(scaleRef.current * pulse * radius);
      
      const material = meshRef.current.material as THREE.MeshBasicMaterial;
      if (material.opacity !== opacityRef.current) {
        material.opacity = opacityRef.current;
      }
      
      setVisible(scaleRef.current > 0.01);
    }
  });

  if (!visible) return null;

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color="#00f5d4"
          transparent
          opacity={0}
          wireframe
        />
      </mesh>
      <mesh position={position}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial
          color="#9b5de5"
          transparent
          opacity={isActive ? 0.8 : 0}
        />
      </mesh>
    </group>
  );
}
