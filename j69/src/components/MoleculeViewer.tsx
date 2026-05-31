import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import MoleculeModel from "./MoleculeModel";
import type { Atom, Bond } from "@/types/molecule";

function Scene({ atoms, bonds }: { atoms: Atom[]; bonds: Bond[] }) {
  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[0, 0, 10]}
        fov={45}
        near={0.01}
        far={200}
      />
      <OrbitControls
        enableDamping
        dampingFactor={0.12}
        rotateSpeed={0.8}
        zoomSpeed={1.2}
        minDistance={2}
        maxDistance={50}
        enablePan
      />
      <ambientLight intensity={0.5} />
      <directionalLight position={[8, 10, 8]} intensity={1.2} color="#ffffff" />
      <directionalLight position={[-6, -4, -6]} intensity={0.35} color="#00ffc8" />
      <pointLight position={[0, 6, 0]} intensity={0.6} color="#ff6b35" distance={25} />
      <pointLight position={[-6, 2, 6]} intensity={0.3} color="#ffffff" distance={25} />
      <MoleculeModel atoms={atoms} bonds={bonds} />
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.15}
          luminanceSmoothing={0.9}
          intensity={0.7}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

export default function MoleculeViewer({ atoms, bonds }: { atoms: Atom[]; bonds: Bond[] }) {
  return (
    <div className="w-full h-full">
      <Canvas
        gl={{
          antialias: true,
          alpha: false,
          logarithmicDepthBuffer: true,
          powerPreference: "high-performance",
        }}
        style={{ background: "#0a0e17" }}
        dpr={[1, 2]}
        frameloop="always"
      >
        <color attach="background" args={["#0a0e17"]} />
        <fog attach="fog" args={["#0a0e17", 18, 45]} />
        <Scene atoms={atoms} bonds={bonds} />
      </Canvas>
    </div>
  );
}
