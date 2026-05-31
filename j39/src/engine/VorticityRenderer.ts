import * as THREE from 'three';
import { magnitude, remap, clamp, lerp } from '../utils';

export interface ScalarField2D {
  dimensions: [number, number];
  origin: THREE.Vector2;
  spacing: THREE.Vector2;
  getValueAt: (x: number, y: number) => number;
}

export interface VorticityRendererOptions {
  isoLevels?: number[];
  slicePlane?: 'xy' | 'xz' | 'yz';
  sliceIndex?: number;
  minLineWidth?: number;
  maxLineWidth?: number;
  colorMap?: 'viridis' | 'plasma' | 'rainbow' | 'coolwarm';
  bounds?: THREE.Box3;
}

export interface Isoline {
  value: number;
  segments: THREE.Vector2[][];
  line: THREE.LineSegments;
}

const EDGE_TABLE: number[] = [
  0b0000, 0b1001, 0b0011, 0b1010,
  0b0110, 0b1111, 0b0101, 0b1100,
  0b1100, 0b0101, 0b1111, 0b0110,
  0b1010, 0b0011, 0b1001, 0b0000,
];

const TRIANGULATION_TABLE: number[][] = [
  [],
  [0, 3, -1, -1, -1, -1],
  [0, 1, -1, -1, -1, -1],
  [1, 3, -1, -1, -1, -1],
  [1, 2, -1, -1, -1, -1],
  [0, 3, 1, 2, -1, -1],
  [0, 2, -1, -1, -1, -1],
  [2, 3, -1, -1, -1, -1],
  [2, 3, -1, -1, -1, -1],
  [0, 2, -1, -1, -1, -1],
  [0, 1, 2, 3, -1, -1],
  [1, 2, -1, -1, -1, -1],
  [1, 3, -1, -1, -1, -1],
  [0, 1, -1, -1, -1, -1],
  [0, 3, -1, -1, -1, -1],
  [],
];

export class VorticityRenderer {
  private scene: THREE.Scene;
  private isoLevels: number[];
  private slicePlane: 'xy' | 'xz' | 'yz';
  private sliceIndex: number;
  private minLineWidth: number;
  private maxLineWidth: number;
  private bounds: THREE.Box3;
  private isolines: Isoline[] = [];

  constructor(scene: THREE.Scene, options: VorticityRendererOptions = {}) {
    this.scene = scene;
    this.isoLevels = options.isoLevels ?? [0.1, 0.3, 0.5, 0.7, 0.9];
    this.slicePlane = options.slicePlane ?? 'xy';
    this.sliceIndex = options.sliceIndex ?? 0;
    this.minLineWidth = options.minLineWidth ?? 1;
    this.maxLineWidth = options.maxLineWidth ?? 3;
    this.bounds = options.bounds ?? new THREE.Box3(
      new THREE.Vector3(-1, -1, -1),
      new THREE.Vector3(1, 1, 1)
    );
  }

  private interpolateEdge(
    p1: THREE.Vector2,
    p2: THREE.Vector2,
    v1: number,
    v2: number,
    isoValue: number
  ): THREE.Vector2 {
    const t = (isoValue - v1) / (v2 - v1);
    return new THREE.Vector2(
      lerp(p1.x, p2.x, t),
      lerp(p1.y, p2.y, t)
    );
  }

  private marchingSquares(
    scalarField: ScalarField2D,
    isoValue: number
  ): THREE.Vector2[][] {
    const [nx, ny] = scalarField.dimensions;
    const segments: THREE.Vector2[][] = [];

    const cornerValues = new Float32Array(4);
    const cornerPositions: THREE.Vector2[] = [];

    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const x0 = scalarField.origin.x + i * scalarField.spacing.x;
        const y0 = scalarField.origin.y + j * scalarField.spacing.y;
        const x1 = x0 + scalarField.spacing.x;
        const y1 = y0 + scalarField.spacing.y;

        cornerPositions[0] = new THREE.Vector2(x0, y0);
        cornerPositions[1] = new THREE.Vector2(x1, y0);
        cornerPositions[2] = new THREE.Vector2(x1, y1);
        cornerPositions[3] = new THREE.Vector2(x0, y1);

        cornerValues[0] = scalarField.getValueAt(x0, y0);
        cornerValues[1] = scalarField.getValueAt(x1, y0);
        cornerValues[2] = scalarField.getValueAt(x1, y1);
        cornerValues[3] = scalarField.getValueAt(x0, y1);

        let cubeIndex = 0;
        for (let k = 0; k < 4; k++) {
          if (cornerValues[k] >= isoValue) {
            cubeIndex |= (1 << k);
          }
        }

        if (EDGE_TABLE[cubeIndex] === 0) continue;

        const edgePoints: (THREE.Vector2 | null)[] = [null, null, null, null];

        if (EDGE_TABLE[cubeIndex] & 0b0001) {
          edgePoints[0] = this.interpolateEdge(
            cornerPositions[0], cornerPositions[1],
            cornerValues[0], cornerValues[1], isoValue
          );
        }
        if (EDGE_TABLE[cubeIndex] & 0b0010) {
          edgePoints[1] = this.interpolateEdge(
            cornerPositions[1], cornerPositions[2],
            cornerValues[1], cornerValues[2], isoValue
          );
        }
        if (EDGE_TABLE[cubeIndex] & 0b0100) {
          edgePoints[2] = this.interpolateEdge(
            cornerPositions[2], cornerPositions[3],
            cornerValues[2], cornerValues[3], isoValue
          );
        }
        if (EDGE_TABLE[cubeIndex] & 0b1000) {
          edgePoints[3] = this.interpolateEdge(
            cornerPositions[3], cornerPositions[0],
            cornerValues[3], cornerValues[0], isoValue
          );
        }

        const tri = TRIANGULATION_TABLE[cubeIndex];
        for (let k = 0; tri[k] !== -1; k += 2) {
          const p1 = edgePoints[tri[k]];
          const p2 = edgePoints[tri[k + 1]];
          if (p1 && p2) {
            segments.push([p1.clone(), p2.clone()]);
          }
        }
      }
    }

    return segments;
  }

  private extract2DSlice(
    vorticityField: {
      dimensions: [number, number, number];
      origin: THREE.Vector3;
      spacing: THREE.Vector3;
      getVorticityAt: (x: number, y: number, z: number) => THREE.Vector3;
    },
    plane: 'xy' | 'xz' | 'yz',
    index: number
  ): ScalarField2D {
    const [nx, ny, nz] = vorticityField.dimensions;

    let dims: [number, number];
    let origin: THREE.Vector2;
    let spacing: THREE.Vector2;

    switch (plane) {
      case 'xy':
        dims = [nx, ny];
        origin = new THREE.Vector2(vorticityField.origin.x, vorticityField.origin.y);
        spacing = new THREE.Vector2(vorticityField.spacing.x, vorticityField.spacing.y);
        break;
      case 'xz':
        dims = [nx, nz];
        origin = new THREE.Vector2(vorticityField.origin.x, vorticityField.origin.z);
        spacing = new THREE.Vector2(vorticityField.spacing.x, vorticityField.spacing.z);
        break;
      case 'yz':
        dims = [ny, nz];
        origin = new THREE.Vector2(vorticityField.origin.y, vorticityField.origin.z);
        spacing = new THREE.Vector2(vorticityField.spacing.y, vorticityField.spacing.z);
        break;
    }

    const clampedIndex = clamp(index, 0, (plane === 'xy' ? nz : plane === 'xz' ? ny : nx) - 1);

    return {
      dimensions: dims,
      origin,
      spacing,
      getValueAt: (x: number, y: number): number => {
        let wx: number, wy: number, wz: number;
        switch (plane) {
          case 'xy':
            wx = x;
            wy = y;
            wz = vorticityField.origin.z + clampedIndex * vorticityField.spacing.z;
            break;
          case 'xz':
            wx = x;
            wy = vorticityField.origin.y + clampedIndex * vorticityField.spacing.y;
            wz = y;
            break;
          case 'yz':
            wx = vorticityField.origin.x + clampedIndex * vorticityField.spacing.x;
            wy = x;
            wz = y;
            break;
        }
        const vort = vorticityField.getVorticityAt(wx, wy, wz);
        return magnitude(vort.x, vort.y, vort.z);
      },
    };
  }

  update(vorticityField: {
    dimensions: [number, number, number];
    origin: THREE.Vector3;
    spacing: THREE.Vector3;
    getVorticityAt: (x: number, y: number, z: number) => THREE.Vector3;
  }): void {
    this.clear();

    const scalarField = this.extract2DSlice(vorticityField, this.slicePlane, this.sliceIndex);

    let maxMagnitude = 0;
    const [nx, ny] = scalarField.dimensions;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const x = scalarField.origin.x + i * scalarField.spacing.x;
        const y = scalarField.origin.y + j * scalarField.spacing.y;
        maxMagnitude = Math.max(maxMagnitude, scalarField.getValueAt(x, y));
      }
    }

    this.isoLevels.forEach((level, levelIndex) => {
      const isoValue = level * maxMagnitude;
      const segments = this.marchingSquares(scalarField, isoValue);

      if (segments.length === 0) return;

      const positions = new Float32Array(segments.length * 6);
      const colors = new Float32Array(segments.length * 6);

      segments.forEach((segment, i) => {
        const i6 = i * 6;

        let p1: THREE.Vector3, p2: THREE.Vector3;
        switch (this.slicePlane) {
          case 'xy':
            p1 = new THREE.Vector3(segment[0].x, segment[0].y, vorticityField.origin.z + this.sliceIndex * vorticityField.spacing.z);
            p2 = new THREE.Vector3(segment[1].x, segment[1].y, vorticityField.origin.z + this.sliceIndex * vorticityField.spacing.z);
            break;
          case 'xz':
            p1 = new THREE.Vector3(segment[0].x, vorticityField.origin.y + this.sliceIndex * vorticityField.spacing.y, segment[0].y);
            p2 = new THREE.Vector3(segment[1].x, vorticityField.origin.y + this.sliceIndex * vorticityField.spacing.y, segment[1].y);
            break;
          case 'yz':
            p1 = new THREE.Vector3(vorticityField.origin.x + this.sliceIndex * vorticityField.spacing.x, segment[0].x, segment[0].y);
            p2 = new THREE.Vector3(vorticityField.origin.x + this.sliceIndex * vorticityField.spacing.x, segment[1].x, segment[1].y);
            break;
        }

        positions[i6] = p1.x;
        positions[i6 + 1] = p1.y;
        positions[i6 + 2] = p1.z;
        positions[i6 + 3] = p2.x;
        positions[i6 + 4] = p2.y;
        positions[i6 + 5] = p2.z;

        const t = levelIndex / (this.isoLevels.length - 1 || 1);
        const hue = (1 - t) * 240;
        const color = new THREE.Color().setHSL(hue / 360, 1, 0.5);

        colors[i6] = color.r;
        colors[i6 + 1] = color.g;
        colors[i6 + 2] = color.b;
        colors[i6 + 3] = color.r;
        colors[i6 + 4] = color.g;
        colors[i6 + 5] = color.b;
      });

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const lineWidth = lerp(this.minLineWidth, this.maxLineWidth, levelIndex / (this.isoLevels.length - 1 || 1));

      const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        linewidth: lineWidth,
      });

      const line = new THREE.LineSegments(geometry, material);
      this.scene.add(line);

      this.isolines.push({
        value: isoValue,
        segments,
        line,
      });
    });
  }

  clear(): void {
    this.isolines.forEach(isoline => {
      this.scene.remove(isoline.line);
      isoline.line.geometry.dispose();
      (isoline.line.material as THREE.Material).dispose();
    });
    this.isolines = [];
  }

  reset(): void {
    this.clear();
  }

  dispose(): void {
    this.clear();
  }

  setSlicePlane(plane: 'xy' | 'xz' | 'yz'): void {
    this.slicePlane = plane;
  }

  setSliceIndex(index: number): void {
    this.sliceIndex = index;
  }

  setIsoLevels(levels: number[]): void {
    this.isoLevels = levels;
  }

  getIsoLevels(): number[] {
    return this.isoLevels;
  }

  getIsolineCount(): number {
    return this.isolines.length;
  }

  setBounds(bounds: THREE.Box3): void {
    this.bounds = bounds;
  }
}

export default VorticityRenderer;
