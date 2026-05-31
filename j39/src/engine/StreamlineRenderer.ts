import * as THREE from 'three';
import { magnitude, remap, clamp, lerp } from '../utils';

export interface VelocityField3D {
  dimensions: [number, number, number];
  origin: THREE.Vector3;
  spacing: THREE.Vector3;
  getVelocityAt: (x: number, y: number, z: number) => THREE.Vector3;
}

export interface StreamlineRendererOptions {
  gridResolution?: [number, number, number];
  maxSteps?: number;
  stepSize?: number;
  minLineWidth?: number;
  maxLineWidth?: number;
  bounds?: THREE.Box3;
  direction?: 'forward' | 'backward' | 'both';
  colorMap?: 'viridis' | 'plasma' | 'rainbow' | 'coolwarm';
}

export interface Streamline {
  points: THREE.Vector3[];
  velocities: THREE.Vector3[];
  line: THREE.Line;
}

export class StreamlineRenderer {
  private scene: THREE.Scene;
  private gridResolution: [number, number, number];
  private maxSteps: number;
  private stepSize: number;
  private minLineWidth: number;
  private maxLineWidth: number;
  private bounds: THREE.Box3;
  private direction: 'forward' | 'backward' | 'both';
  private streamlines: Streamline[] = [];
  private seedPoints: THREE.Vector3[] = [];

  constructor(scene: THREE.Scene, options: StreamlineRendererOptions = {}) {
    this.scene = scene;
    this.gridResolution = options.gridResolution ?? [5, 5, 5];
    this.maxSteps = options.maxSteps ?? 100;
    this.stepSize = options.stepSize ?? 0.05;
    this.minLineWidth = options.minLineWidth ?? 1;
    this.maxLineWidth = options.maxLineWidth ?? 4;
    this.bounds = options.bounds ?? new THREE.Box3(
      new THREE.Vector3(-1, -1, -1),
      new THREE.Vector3(1, 1, 1)
    );
    this.direction = options.direction ?? 'both';

    this.generateSeedPoints();
  }

  private generateSeedPoints(): void {
    this.seedPoints = [];
    const [nx, ny, nz] = this.gridResolution;
    const min = this.bounds.min;
    const max = this.bounds.max;

    for (let k = 0; k < nz; k++) {
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const x = lerp(min.x, max.x, (i + 0.5) / nx);
          const y = lerp(min.y, max.y, (j + 0.5) / ny);
          const z = lerp(min.z, max.z, (k + 0.5) / nz);
          this.seedPoints.push(new THREE.Vector3(x, y, z));
        }
      }
    }
  }

  private rk4Step(
    velocityField: VelocityField3D,
    position: THREE.Vector3,
    dt: number,
    direction: number
  ): THREE.Vector3 {
    const k1 = velocityField.getVelocityAt(position.x, position.y, position.z).multiplyScalar(dt * direction);

    const pos2 = position.clone().add(k1.clone().multiplyScalar(0.5));
    const k2 = velocityField.getVelocityAt(pos2.x, pos2.y, pos2.z).multiplyScalar(dt * direction);

    const pos3 = position.clone().add(k2.clone().multiplyScalar(0.5));
    const k3 = velocityField.getVelocityAt(pos3.x, pos3.y, pos3.z).multiplyScalar(dt * direction);

    const pos4 = position.clone().add(k3);
    const k4 = velocityField.getVelocityAt(pos4.x, pos4.y, pos4.z).multiplyScalar(dt * direction);

    return position.clone().add(
      k1.add(k2.multiplyScalar(2)).add(k3.multiplyScalar(2)).add(k4).multiplyScalar(1 / 6)
    );
  }

  private traceStreamline(
    velocityField: VelocityField3D,
    seedPoint: THREE.Vector3,
    direction: number
  ): { points: THREE.Vector3[]; velocities: THREE.Vector3[] } {
    const points: THREE.Vector3[] = [seedPoint.clone()];
    const velocities: THREE.Vector3[] = [];

    const initialVel = velocityField.getVelocityAt(seedPoint.x, seedPoint.y, seedPoint.z);
    velocities.push(initialVel.clone());

    let currentPos = seedPoint.clone();

    for (let step = 0; step < this.maxSteps; step++) {
      const nextPos = this.rk4Step(velocityField, currentPos, this.stepSize, direction);

      if (!this.bounds.containsPoint(nextPos)) {
        break;
      }

      const vel = velocityField.getVelocityAt(nextPos.x, nextPos.y, nextPos.z);
      const speed = magnitude(vel.x, vel.y, vel.z);

      if (speed < 1e-6) {
        break;
      }

      points.push(nextPos.clone());
      velocities.push(vel.clone());
      currentPos = nextPos;
    }

    return { points, velocities };
  }

  private createLineGeometry(points: THREE.Vector3[], velocities: THREE.Vector3[]): THREE.BufferGeometry {
    const positions = new Float32Array(points.length * 3);
    const colors = new Float32Array(points.length * 3);
    const widths = new Float32Array(points.length);

    let maxSpeed = 0;
    velocities.forEach(vel => {
      const speed = magnitude(vel.x, vel.y, vel.z);
      maxSpeed = Math.max(maxSpeed, speed);
    });

    points.forEach((point, i) => {
      const i3 = i * 3;
      positions[i3] = point.x;
      positions[i3 + 1] = point.y;
      positions[i3 + 2] = point.z;

      const speed = magnitude(velocities[i].x, velocities[i].y, velocities[i].z);
      const t = maxSpeed > 0 ? remap(speed, 0, maxSpeed, 0, 1) : 0;

      const hue = (1 - t) * 240;
      const color = new THREE.Color().setHSL(hue / 360, 1, 0.5);
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;

      widths[i] = lerp(this.minLineWidth, this.maxLineWidth, t);
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('width', new THREE.BufferAttribute(widths, 1));

    return geometry;
  }

  update(velocityField: VelocityField3D): void {
    this.clear();

    let globalMaxSpeed = 0;
    const allStreamlineData: {
      points: THREE.Vector3[];
      velocities: THREE.Vector3[];
    }[] = [];

    this.seedPoints.forEach(seedPoint => {
      if (this.direction === 'forward' || this.direction === 'both') {
        const forwardData = this.traceStreamline(velocityField, seedPoint, 1);
        allStreamlineData.push(forwardData);
        forwardData.velocities.forEach(vel => {
          globalMaxSpeed = Math.max(globalMaxSpeed, magnitude(vel.x, vel.y, vel.z));
        });
      }

      if (this.direction === 'backward' || this.direction === 'both') {
        const backwardData = this.traceStreamline(velocityField, seedPoint, -1);
        backwardData.points.reverse();
        backwardData.velocities.reverse();
        allStreamlineData.push(backwardData);
        backwardData.velocities.forEach(vel => {
          globalMaxSpeed = Math.max(globalMaxSpeed, magnitude(vel.x, vel.y, vel.z));
        });
      }
    });

    allStreamlineData.forEach(data => {
      if (data.points.length < 2) return;

      const positions = new Float32Array(data.points.length * 3);
      const colors = new Float32Array(data.points.length * 3);

      data.points.forEach((point, i) => {
        const i3 = i * 3;
        positions[i3] = point.x;
        positions[i3 + 1] = point.y;
        positions[i3 + 2] = point.z;

        const speed = magnitude(data.velocities[i].x, data.velocities[i].y, data.velocities[i].z);
        const t = globalMaxSpeed > 0 ? remap(speed, 0, globalMaxSpeed, 0, 1) : 0;
        const lineWidth = lerp(this.minLineWidth, this.maxLineWidth, t);

        const hue = (1 - t) * 240;
        const color = new THREE.Color().setHSL(hue / 360, 1, 0.5);
        colors[i3] = color.r;
        colors[i3 + 1] = color.g;
        colors[i3 + 2] = color.b;
      });

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
      });

      const line = new THREE.Line(geometry, material);
      this.scene.add(line);
      this.streamlines.push({
        points: data.points,
        velocities: data.velocities,
        line,
      });
    });
  }

  clear(): void {
    this.streamlines.forEach(streamline => {
      this.scene.remove(streamline.line);
      streamline.line.geometry.dispose();
      (streamline.line.material as THREE.Material).dispose();
    });
    this.streamlines = [];
  }

  reset(): void {
    this.clear();
    this.generateSeedPoints();
  }

  dispose(): void {
    this.clear();
    this.seedPoints = [];
  }

  getStreamlineCount(): number {
    return this.streamlines.length;
  }

  getSeedPoints(): THREE.Vector3[] {
    return this.seedPoints;
  }

  setGridResolution(resolution: [number, number, number]): void {
    this.gridResolution = resolution;
    this.generateSeedPoints();
  }

  setBounds(bounds: THREE.Box3): void {
    this.bounds = bounds;
    this.generateSeedPoints();
  }

  setMaxSteps(maxSteps: number): void {
    this.maxSteps = clamp(maxSteps, 10, 1000);
  }

  setStepSize(stepSize: number): void {
    this.stepSize = clamp(stepSize, 0.001, 0.5);
  }
}

export default StreamlineRenderer;
