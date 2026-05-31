import { useRef, useMemo, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Atom, Bond } from "@/types/molecule";
import { ELEMENT_COLORS, ELEMENT_RADII } from "@/types/molecule";
import { useMoleculeStore } from "@/store/moleculeStore";

function AtomSphere({
  atom,
  index,
  scale,
  isSelected,
  explodeOffset,
  onClick,
}: {
  atom: Atom;
  index: number;
  scale: number;
  isSelected: boolean;
  explodeOffset: THREE.Vector3;
  onClick: (index: number) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = ELEMENT_COLORS[atom.element] || "#aa55ff";
  const baseRadius = ELEMENT_RADII[atom.element] || 0.7;
  const radius = baseRadius * scale;

  const basePos = useMemo(
    () => new THREE.Vector3(atom.x * scale * 2, atom.y * scale * 2, atom.z * scale * 2),
    [atom.x, atom.y, atom.z, scale]
  );

  useFrame(() => {
    if (meshRef.current) {
      const target = basePos.clone().add(explodeOffset);
      meshRef.current.position.lerp(target, 0.12);

      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      if (isSelected) {
        mat.emissiveIntensity = 0.5 + Math.sin(Date.now() * 0.005) * 0.2;
        mat.emissive.set("#00ffc8");
      } else {
        mat.emissiveIntensity = 0.15 + Math.sin(Date.now() * 0.002) * 0.05;
        mat.emissive.set(color);
      }
    }
  });

  const handleClick = useCallback(
    (e: THREE.Event) => {
      (e as unknown as { stopPropagation: () => void }).stopPropagation();
      onClick(index);
    },
    [index, onClick]
  );

  return (
    <mesh
      ref={meshRef}
      position={basePos}
      onClick={handleClick}
      onPointerOver={() => {
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      <sphereGeometry args={[isSelected ? radius * 1.08 : radius, 32, 32]} />
      <meshStandardMaterial
        color={color}
        metalness={0.3}
        roughness={0.25}
        emissive={isSelected ? "#00ffc8" : color}
        emissiveIntensity={0.15}
        depthWrite
        depthTest
      />
    </mesh>
  );
}

function BondCylinder({
  fromAtom,
  toAtom,
  fromOffset,
  toOffset,
  order,
  scale,
}: {
  fromAtom: Atom;
  toAtom: Atom;
  fromOffset: THREE.Vector3;
  toOffset: THREE.Vector3;
  order: number;
  scale: number;
}) {
  const fromRadius = (ELEMENT_RADII[fromAtom.element] || 0.7) * scale;
  const toRadius = (ELEMENT_RADII[toAtom.element] || 0.7) * scale;

  const startBase = useMemo(
    () => new THREE.Vector3(fromAtom.x * scale * 2, fromAtom.y * scale * 2, fromAtom.z * scale * 2),
    [fromAtom.x, fromAtom.y, fromAtom.z, scale]
  );
  const endBase = useMemo(
    () => new THREE.Vector3(toAtom.x * scale * 2, toAtom.y * scale * 2, toAtom.z * scale * 2),
    [toAtom.x, toAtom.y, toAtom.z, scale]
  );

  const { fromSurface, toSurface, dir, perpDir } = useMemo(() => {
    const s = startBase.clone().add(fromOffset);
    const e = endBase.clone().add(toOffset);
    const dirVec = new THREE.Vector3().subVectors(e, s);
    dirVec.normalize();

    const fromSurf = s.clone().add(dirVec.clone().multiplyScalar(fromRadius));
    const toSurf = e.clone().sub(dirVec.clone().multiplyScalar(toRadius));

    let perp = new THREE.Vector3();
    if (Math.abs(dirVec.x) < 0.9) {
      perp.crossVectors(dirVec, new THREE.Vector3(1, 0, 0)).normalize();
    } else {
      perp.crossVectors(dirVec, new THREE.Vector3(0, 1, 0)).normalize();
    }

    return { fromSurface: fromSurf, toSurface: toSurf, dir: dirVec, perpDir: perp };
  }, [startBase, endBase, fromOffset, toOffset, fromRadius, toRadius]);

  const bondRadius = 0.07 * scale;
  const offset = 0.15 * scale;

  const cylinders = useMemo(() => {
    const result: { position: THREE.Vector3; quaternion: THREE.Quaternion; length: number }[] = [];

    const bondLength = fromSurface.distanceTo(toSurface);
    if (bondLength <= 0) return result;

    const mid = new THREE.Vector3().addVectors(fromSurface, toSurface).multiplyScalar(0.5);
    const quat = new THREE.Quaternion();
    quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

    if (order === 1) {
      result.push({ position: mid, quaternion: quat, length: bondLength });
    } else if (order === 2) {
      result.push({
        position: mid.clone().add(perpDir.clone().multiplyScalar(offset)),
        quaternion: quat,
        length: bondLength,
      });
      result.push({
        position: mid.clone().add(perpDir.clone().multiplyScalar(-offset)),
        quaternion: quat,
        length: bondLength,
      });
    } else if (order >= 3) {
      result.push({ position: mid.clone(), quaternion: quat, length: bondLength });
      result.push({
        position: mid.clone().add(perpDir.clone().multiplyScalar(offset)),
        quaternion: quat,
        length: bondLength,
      });
      result.push({
        position: mid.clone().add(perpDir.clone().multiplyScalar(-offset)),
        quaternion: quat,
        length: bondLength,
      });
    }
    return result;
  }, [fromSurface, toSurface, dir, perpDir, order, offset]);

  return (
    <>
      {cylinders.map((c, i) => (
        <mesh key={i} position={c.position} quaternion={c.quaternion}>
          <cylinderGeometry args={[bondRadius, bondRadius, c.length, 12]} />
          <meshStandardMaterial color="#9a9a9a" metalness={0.5} roughness={0.28} depthWrite depthTest />
        </mesh>
      ))}
    </>
  );
}

export default function MoleculeModel({ atoms, bonds }: { atoms: Atom[]; bonds: Bond[] }) {
  const groupRef = useRef<THREE.Group>(null);
  const scale = 1.5;
  const { selectedAtomIndex, explodeFactor, selectAtom } = useMoleculeStore();

  const { center } = useMemo(() => {
    if (atoms.length === 0) return { center: new THREE.Vector3() };
    const cx = atoms.reduce((s, a) => s + a.x, 0) / atoms.length;
    const cy = atoms.reduce((s, a) => s + a.y, 0) / atoms.length;
    const cz = atoms.reduce((s, a) => s + a.z, 0) / atoms.length;
    return { center: new THREE.Vector3(cx * scale * 2, cy * scale * 2, cz * scale * 2) };
  }, [atoms, scale]);

  const explodeOffsets = useMemo(() => {
    if (atoms.length === 0) return [];
    return atoms.map((atom) => {
      const pos = new THREE.Vector3(atom.x * scale * 2, atom.y * scale * 2, atom.z * scale * 2);
      const dir = pos.clone().sub(center);
      const len = dir.length();
      if (len > 0.001) {
        dir.normalize();
      } else {
        dir.set(0, 1, 0);
      }
      return dir.multiplyScalar(explodeFactor * 2.5);
    });
  }, [atoms, scale, center, explodeFactor]);

  const handleAtomClick = useCallback(
    (index: number) => {
      selectAtom(selectedAtomIndex === index ? null : index);
    },
    [selectAtom, selectedAtomIndex]
  );

  const handleBackgroundClick = useCallback(() => {
    selectAtom(null);
  }, [selectAtom]);

  return (
    <group ref={groupRef} position={[-center.x, -center.y, -center.z]}>
      <mesh visible={false} onClick={handleBackgroundClick}>
        <sphereGeometry args={[50, 8, 8]} />
        <meshBasicMaterial side={THREE.BackSide} />
      </mesh>
      {atoms.map((atom, i) => (
        <AtomSphere
          key={`atom-${i}`}
          atom={atom}
          index={i}
          scale={scale}
          isSelected={selectedAtomIndex === i}
          explodeOffset={explodeOffsets[i] || new THREE.Vector3()}
          onClick={handleAtomClick}
        />
      ))}
      {bonds.map((bond, i) => (
        <BondCylinder
          key={`bond-${i}`}
          fromAtom={atoms[bond.from]}
          toAtom={atoms[bond.to]}
          fromOffset={explodeOffsets[bond.from] || new THREE.Vector3()}
          toOffset={explodeOffsets[bond.to] || new THREE.Vector3()}
          order={bond.order}
          scale={scale}
        />
      ))}
    </group>
  );
}
