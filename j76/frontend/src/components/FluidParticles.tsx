import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface FluidParticlesProps {
  positions: Float32Array;
  colors: Float32Array;
  count: number;
}

export function FluidParticles({ positions, colors, count }: FluidParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const geometryRef = useRef<THREE.BufferGeometry>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { gl } = useThree();

  const particleSize = useMemo(() => {
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      sizes[i] = 0.08 + Math.random() * 0.04;
    }
    return sizes;
  }, [count]);

  const uniforms = useMemo(() => ({
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 3) },
  }), []);

  useFrame(() => {
    if (geometryRef.current) {
      const posAttr = geometryRef.current.attributes.position as THREE.BufferAttribute;
      const colAttr = geometryRef.current.attributes.color as THREE.BufferAttribute;
      
      posAttr.array = positions;
      colAttr.array = colors;
      
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
    }

    if (materialRef.current) {
      materialRef.current.uniforms.uPixelRatio.value = Math.min(gl.getPixelRatio(), 3);
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
          usage={THREE.DynamicDrawUsage}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colors}
          itemSize={3}
          usage={THREE.DynamicDrawUsage}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={particleSize}
          itemSize={1}
          usage={THREE.StaticDrawUsage}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexColors
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          attribute float size;
          varying vec3 vColor;
          uniform float uPixelRatio;
          void main() {
            vColor = color;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            float baseSize = size * (300.0 / -mvPosition.z);
            gl_PointSize = baseSize * uPixelRatio;
            gl_Position = projectionMatrix * mvPosition;
          }
        `}
        fragmentShader={`
          varying vec3 vColor;
          void main() {
            vec2 coord = gl_PointCoord - vec2(0.5);
            float dist = length(coord);
            float radius = 0.5;
            float feather = fwidth(dist);
            float alpha = 1.0 - smoothstep(radius - feather * 1.5, radius, dist);
            float glow = exp(-dist * dist * 8.0);
            alpha *= glow;
            vec3 finalColor = vColor * (1.0 + glow * 0.5);
            gl_FragColor = vec4(finalColor, alpha * 0.85);
          }
        `}
      />
    </points>
  );
}
