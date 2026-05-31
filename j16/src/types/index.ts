export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Vec4 {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Mat4 {
  m: Float32Array;
}

export interface Particle {
  position: Vec3;
  velocity: Vec3;
  density: number;
  pressure: number;
  force: Vec3;
}

export enum FluidType {
  WATER = 0,
  OIL = 1,
  BUBBLE = 2,
}

export interface FluidProperty {
  type: FluidType;
  restDensity: number;
  viscosity: number;
  pressureCoeff: number;
  color: Vec3;
  mass: number;
}

export interface SimulationParams {
  particleRadius: number;
  restDensity: number;
  viscosity: number;
  pressureCoeff: number;
  gravityX: number;
  gravityY: number;
  gravityZ: number;
  dt: number;
  substeps: number;
  smoothingRadius: number;
  particleMass: number;
  boundsMin: Vec3;
  boundsMax: Vec3;
  gravityStrength: number;
  surfaceTension: number;
  adhesionStrength: number;
  repulsionStrength: number;
}

export interface SpatialHashCell {
  start: number;
  count: number;
}

export type RenderMode = 'particles' | 'surface' | 'rayTrace';

export interface CameraParams {
  position: Vec3;
  target: Vec3;
  up: Vec3;
  fov: number;
  aspect: number;
  near: number;
  far: number;
}

export interface CameraUniforms {
  viewProj: number[];
  view: number[];
  proj: number[];
  cameraPos: number[];
}

export const FLUID_PROPERTIES: Record<FluidType, FluidProperty> = {
  [FluidType.WATER]: {
    type: FluidType.WATER,
    restDensity: 1000,
    viscosity: 250,
    pressureCoeff: 2000,
    color: { x: 0.1, y: 0.4, z: 0.9 },
    mass: 1.0,
  },
  [FluidType.OIL]: {
    type: FluidType.OIL,
    restDensity: 700,
    viscosity: 500,
    pressureCoeff: 1500,
    color: { x: 0.9, y: 0.6, z: 0.1 },
    mass: 0.7,
  },
  [FluidType.BUBBLE]: {
    type: FluidType.BUBBLE,
    restDensity: 100,
    viscosity: 50,
    pressureCoeff: 500,
    color: { x: 0.9, y: 0.95, z: 1.0 },
    mass: 0.1,
  },
};