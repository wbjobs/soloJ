import type { SimulationParams, FluidType } from '../types/index';
import { FLUID_PROPERTIES } from '../types/index';

export const PARTICLE_SIZE = 20 * 4;

export const PARTICLE_STRUCT = {
  position: { offset: 0, size: 12 },
  velocity: { offset: 16, size: 12 },
  density: { offset: 32, size: 4 },
  pressure: { offset: 36, size: 4 },
  type: { offset: 40, size: 4 },
  force: { offset: 48, size: 12 },
  color: { offset: 64, size: 12 },
};

export interface ParticleData {
  positions: Float32Array;
  velocities: Float32Array;
  densities: Float32Array;
  pressures: Float32Array;
  types: Int32Array;
  forces: Float32Array;
  colors: Float32Array;
}

export function createParticleData(count: number): ParticleData {
  return {
    positions: new Float32Array(count * 3),
    velocities: new Float32Array(count * 3),
    densities: new Float32Array(count),
    pressures: new Float32Array(count),
    types: new Int32Array(count),
    forces: new Float32Array(count * 3),
    colors: new Float32Array(count * 3),
  };
}

export function computeParamsBytes(params: SimulationParams): Float32Array {
  return new Float32Array([
    params.particleRadius,
    0,
    params.gravityX,
    params.gravityY,
    params.gravityZ,
    params.dt,
    params.substeps,
    params.smoothingRadius,
    params.boundsMin ? params.boundsMin.x : 0,
    params.boundsMin ? params.boundsMin.y : 0,
    params.boundsMin ? params.boundsMin.z : 0,
    params.boundsMax ? params.boundsMax.x : 0,
    params.boundsMax ? params.boundsMax.y : 0,
    params.boundsMax ? params.boundsMax.z : 0,
    params.surfaceTension,
    params.adhesionStrength,
    params.repulsionStrength,
    0.98,
    0, 0, 0
  ]);
}

export const FLUID_PROPS_ARRAY: number[] = (() => {
  const arr: number[] = [];
  for (let i = 0; i < 3; i++) {
    const prop = FLUID_PROPERTIES[i as FluidType];
    arr.push(prop.restDensity);
    arr.push(prop.viscosity);
    arr.push(prop.pressureCoeff);
    arr.push(prop.mass);
    arr.push(prop.color.x);
    arr.push(prop.color.y);
    arr.push(prop.color.z);
    arr.push(0);
  }
  return arr;
})();

export const SPH_CONSTANTS = {
  POLY6_COEFF: 315.0 / (64.0 * Math.PI),
  SPIKY_GRAD_COEFF: -45.0 / Math.PI,
  VISC_LAP_COEFF: 45.0 / Math.PI,
};

export function computePoly6(rSq: number, h: number): number {
  const h2 = h * h;
  if (rSq >= h2) return 0;
  const diff = h2 - rSq;
  return SPH_CONSTANTS.POLY6_COEFF * diff * diff * diff / Math.pow(h, 9);
}

export function computeSpikyGrad(r: number, h: number): number {
  if (r >= h || r < 1e-8) return 0;
  const diff = h - r;
  return SPH_CONSTANTS.SPIKY_GRAD_COEFF * diff * diff / Math.pow(h, 6);
}

export function computeViscLap(r: number, h: number): number {
  if (r >= h) return 0;
  return SPH_CONSTANTS.VISC_LAP_COEFF * (h - r) / Math.pow(h, 6);
}