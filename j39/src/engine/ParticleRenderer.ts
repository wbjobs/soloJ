import * as THREE from 'three';
import { randomRange, magnitude, remap } from '../utils';

export interface VelocityField {
  dimensions: [number, number, number];
  origin: THREE.Vector3;
  spacing: THREE.Vector3;
  getVelocityAt: (x: number, y: number, z: number) => THREE.Vector3;
}

export interface ParticleRendererOptions {
  particleCount?: number;
  particleSize?: number;
  trailLength?: number;
  bounds?: THREE.Box3;
  speedMultiplier?: number;
  colorMap?: 'viridis' | 'plasma' | 'rainbow' | 'coolwarm';
}

export class ParticleRenderer {
  private scene: THREE.Scene;
  private particleCount: number;
  private trailLength: number;
  private bounds: THREE.Box3;
  private speedMultiplier: number;
  private particleSystem: THREE.Points | null = null;
  private trailLines: THREE.Line[] = [];
  private positions: Float32Array;
  private velocities: Float32Array;
  private colors: Float32Array;
  private trailPositions: Float32Array[] = [];
  private geometry: THREE.BufferGeometry | null = null;
  private material: THREE.PointsMaterial | null = null;

  constructor(scene: THREE.Scene, options: ParticleRendererOptions = {}) {
    this.scene = scene;
    this.particleCount = options.particleCount ?? 10000;
    this.trailLength = options.trailLength ?? 20;
    this.bounds = options.bounds ?? new THREE.Box3(
      new THREE.Vector3(-1, -1, -1),
      new THREE.Vector3(1, 1, 1)
    );
    this.speedMultiplier = options.speedMultiplier ?? 1.0;

    this.positions = new Float32Array(this.particleCount * 3);
    this.velocities = new Float32Array(this.particleCount * 3);
    this.colors = new Float32Array(this.particleCount * 3);

    for (let i = 0; i < this.trailLength; i++) {
      this.trailPositions.push(new Float32Array(this.particleCount * 3));
    }

    this.initializeParticles();
    this.createParticleSystem(options.particleSize ?? 0.02);
  }

  private initializeParticles(): void {
    const min = this.bounds.min;
    const max = this.bounds.max;

    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;
      this.positions[i3] = randomRange(min.x, max.x);
      this.positions[i3 + 1] = randomRange(min.y, max.y);
      this.positions[i3 + 2] = randomRange(min.z, max.z);

      this.velocities[i3] = 0;
      this.velocities[i3 + 1] = 0;
      this.velocities[i3 + 2] = 0;

      this.colors[i3] = 1;
      this.colors[i3 + 1] = 1;
      this.colors[i3 + 2] = 1;

      for (let t = 0; t < this.trailLength; t++) {
        this.trailPositions[t][i3] = this.positions[i3];
        this.trailPositions[t][i3 + 1] = this.positions[i3 + 1];
        this.trailPositions[t][i3 + 2] = this.positions[i3 + 2];
      }
    }
  }

  private createParticleSystem(size: number): void {
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    this.material = new THREE.PointsMaterial({
      size,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    });

    this.particleSystem = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.particleSystem);

    this.createTrailLines();
  }

  private createTrailLines(): void {
    for (let t = 0; t < this.trailLength - 1; t++) {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(this.particleCount * 6);

      for (let i = 0; i < this.particleCount; i++) {
        const i6 = i * 6;
        const i3 = i * 3;
        positions[i6] = this.trailPositions[t][i3];
        positions[i6 + 1] = this.trailPositions[t][i3 + 1];
        positions[i6 + 2] = this.trailPositions[t][i3 + 2];
        positions[i6 + 3] = this.trailPositions[t + 1][i3];
        positions[i6 + 4] = this.trailPositions[t + 1][i3 + 1];
        positions[i6 + 5] = this.trailPositions[t + 1][i3 + 2];
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const material = new THREE.LineBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: (1 - t / this.trailLength) * 0.3,
      });

      const line = new THREE.LineSegments(geometry, material);
      this.trailLines.push(line);
      this.scene.add(line);
    }
  }

  update(velocityField: VelocityField, deltaTime: number): void {
    const min = this.bounds.min;
    const max = this.bounds.max;
    const dt = deltaTime * this.speedMultiplier;

    for (let t = this.trailLength - 1; t > 0; t--) {
      this.trailPositions[t].set(this.trailPositions[t - 1]);
    }

    let maxSpeed = 0;
    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;
      const x = this.positions[i3];
      const y = this.positions[i3 + 1];
      const z = this.positions[i3 + 2];

      const velocity = velocityField.getVelocityAt(x, y, z);
      this.velocities[i3] = velocity.x;
      this.velocities[i3 + 1] = velocity.y;
      this.velocities[i3 + 2] = velocity.z;

      const speed = magnitude(velocity.x, velocity.y, velocity.z);
      maxSpeed = Math.max(maxSpeed, speed);

      this.positions[i3] += velocity.x * dt;
      this.positions[i3 + 1] += velocity.y * dt;
      this.positions[i3 + 2] += velocity.z * dt;

      if (this.positions[i3] < min.x) this.positions[i3] = max.x;
      if (this.positions[i3] > max.x) this.positions[i3] = min.x;
      if (this.positions[i3 + 1] < min.y) this.positions[i3 + 1] = max.y;
      if (this.positions[i3 + 1] > max.y) this.positions[i3 + 1] = min.y;
      if (this.positions[i3 + 2] < min.z) this.positions[i3 + 2] = max.z;
      if (this.positions[i3 + 2] > max.z) this.positions[i3 + 2] = min.z;

      this.trailPositions[0][i3] = this.positions[i3];
      this.trailPositions[0][i3 + 1] = this.positions[i3 + 1];
      this.trailPositions[0][i3 + 2] = this.positions[i3 + 2];
    }

    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;
      const speed = magnitude(
        this.velocities[i3],
        this.velocities[i3 + 1],
        this.velocities[i3 + 2]
      );
      const t = maxSpeed > 0 ? remap(speed, 0, maxSpeed, 0, 1) : 0;

      const hue = (1 - t) * 240;
      const color = new THREE.Color().setHSL(hue / 360, 1, 0.5);
      this.colors[i3] = color.r;
      this.colors[i3 + 1] = color.g;
      this.colors[i3 + 2] = color.b;
    }

    if (this.geometry) {
      this.geometry.attributes.position.needsUpdate = true;
      this.geometry.attributes.color.needsUpdate = true;
    }

    this.trailLines.forEach((line, index) => {
      const positions = line.geometry.attributes.position.array as Float32Array;
      const nextIndex = Math.min(index + 1, this.trailLength - 1);

      for (let i = 0; i < this.particleCount; i++) {
        const i6 = i * 6;
        const i3 = i * 3;
        positions[i6] = this.trailPositions[index][i3];
        positions[i6 + 1] = this.trailPositions[index][i3 + 1];
        positions[i6 + 2] = this.trailPositions[index][i3 + 2];
        positions[i6 + 3] = this.trailPositions[nextIndex][i3];
        positions[i6 + 4] = this.trailPositions[nextIndex][i3 + 1];
        positions[i6 + 5] = this.trailPositions[nextIndex][i3 + 2];
      }
      line.geometry.attributes.position.needsUpdate = true;
    });
  }

  reset(): void {
    this.initializeParticles();
    if (this.geometry) {
      this.geometry.attributes.position.needsUpdate = true;
      this.geometry.attributes.color.needsUpdate = true;
    }
  }

  dispose(): void {
    if (this.particleSystem) {
      this.scene.remove(this.particleSystem);
      this.geometry?.dispose();
      this.material?.dispose();
    }

    this.trailLines.forEach(line => {
      this.scene.remove(line);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    });
    this.trailLines = [];
  }

  getParticleCount(): number {
    return this.particleCount;
  }

  getParticleSystem(): THREE.Points | null {
    return this.particleSystem;
  }

  setSpeedMultiplier(multiplier: number): void {
    this.speedMultiplier = multiplier;
  }

  setBounds(bounds: THREE.Box3): void {
    this.bounds = bounds;
  }
}

export default ParticleRenderer;
