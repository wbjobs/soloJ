export interface Vector2 {
  x: number;
  y: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Vector4 {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface FluidField {
  velocity: GPUTexture;
  density: GPUTexture;
  pressure: GPUTexture;
  vorticity: GPUTexture;
  divergence: GPUTexture;
}

export interface PingPongField {
  read: FluidField;
  write: FluidField;
}

export interface FluidSolverConfig {
  resolution: number;
  timeStep: number;
  viscosity: number;
  vorticityConfinement: number;
  pressureIterations: number;
  dissipation: {
    velocity: number;
    density: number;
  };
  workgroupSize: number;
}

export interface SimulationStats {
  fps: number;
  frameTime: number;
  stepTime: {
    externalForces: number;
    vorticity: number;
    divergence: number;
    pressure: number;
    advection: number;
    render: number;
  };
}

export type ForceType = 'attract' | 'repel' | 'vortex';

export interface ForcePoint {
  position: Vector2;
  strength: number;
  radius: number;
  type: ForceType;
  color?: Vector4;
}

export interface ColorMapPoint {
  position: number;
  color: Vector4;
}

export interface WebGPUBufferInfo {
  buffer: GPUBuffer;
  size: number;
  usage: GPUBufferUsageFlags;
}

export interface ComputePipelineInfo {
  pipeline: GPUComputePipeline;
  bindGroupLayout: GPUBindGroupLayout;
  bindGroups: GPUBindGroup[];
}

export interface RenderPipelineInfo {
  pipeline: GPURenderPipeline;
  bindGroupLayout: GPUBindGroupLayout;
  bindGroups: GPUBindGroup[];
}

export type TextureFormat = 'r32float' | 'rg32float' | 'rgba32float' | 'rgba8unorm';

export interface TextureInfo {
  texture: GPUTexture;
  format: TextureFormat;
  width: number;
  height: number;
}

export const DEFAULT_FLUID_CONFIG: FluidSolverConfig = {
  resolution: 256,
  timeStep: 0.016,
  viscosity: 0.0001,
  vorticityConfinement: 0.5,
  pressureIterations: 20,
  dissipation: {
    velocity: 0.998,
    density: 0.998,
  },
  workgroupSize: 8,
};

export const WORKGROUP_SIZE = 8;
