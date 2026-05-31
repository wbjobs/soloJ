import { WebGPURenderer } from './WebGPURenderer';
import type {
  FluidSolverConfig,
  SimulationStats,
  ForcePoint,
  ForceType,
  Vector2,
  Vector4,
} from '../types';
import { DEFAULT_FLUID_CONFIG, WORKGROUP_SIZE } from '../types';
import { vec2, vec4 } from '../utils/math';

import advectionShader from './shaders/advection.wgsl?raw';
import divergenceShader from './shaders/divergence.wgsl?raw';
import vorticityShader from './shaders/vorticity.wgsl?raw';
import pressureShader from './shaders/pressure.wgsl?raw';
import renderShader from './shaders/render.wgsl?raw';
import forcesShader from './shaders/forces.wgsl?raw';

export class FluidSolver {
  private renderer: WebGPURenderer;
  private config: FluidSolverConfig;

  private paramsBuffer!: GPUBuffer;
  private forceDataBuffer!: GPUBuffer;

  private fields: {
    velocity: { read: GPUTexture; write: GPUTexture };
    density: { read: GPUTexture; write: GPUTexture };
    pressure: { read: GPUTexture; write: GPUTexture };
    vorticity: GPUTexture;
    divergence: GPUTexture;
  } = {} as typeof this.fields;

  private forcePoints: ForcePoint[] = [];
  private forceData: Float32Array;

  private stats: SimulationStats = {
    fps: 0,
    frameTime: 0,
    stepTime: {
      externalForces: 0,
      vorticity: 0,
      divergence: 0,
      pressure: 0,
      advection: 0,
      render: 0,
    },
  };

  private paramsData: Float32Array = new Float32Array(4);

  private lastFrameTime = 0;
  private frameCount = 0;
  private fpsUpdateTime = 0;

  constructor(renderer: WebGPURenderer, config?: Partial<FluidSolverConfig>) {
    this.renderer = renderer;
    this.config = { ...DEFAULT_FLUID_CONFIG, ...config };
    this.forceData = new Float32Array(64 * 4 * 3);
  }

  async init(): Promise<void> {
    this.createTextures();
    this.createBuffers();
    this.createPipelines();
    this.createBindGroups();
    this.clearFields();
  }

  private createTextures(): void {
    const { resolution } = this.config;

    this.fields.velocity = {
      read: this.renderer.createTexture('velocityRead', resolution, resolution, 'rg32float'),
      write: this.renderer.createTexture('velocityWrite', resolution, resolution, 'rg32float'),
    };

    this.fields.density = {
      read: this.renderer.createTexture('densityRead', resolution, resolution, 'rgba32float'),
      write: this.renderer.createTexture('densityWrite', resolution, resolution, 'rgba32float'),
    };

    this.fields.pressure = {
      read: this.renderer.createTexture('pressureRead', resolution, resolution, 'r32float'),
      write: this.renderer.createTexture('pressureWrite', resolution, resolution, 'r32float'),
    };

    this.fields.vorticity = this.renderer.createTexture(
      'vorticity',
      resolution,
      resolution,
      'r32float'
    );

    this.fields.divergence = this.renderer.createTexture(
      'divergence',
      resolution,
      resolution,
      'r32float'
    );
  }

  private createBuffers(): void {
    this.paramsBuffer = this.renderer.createUniformBuffer(
      'params',
      new Float32Array([this.config.resolution, this.config.timeStep, 0, 0])
    );

    this.forceDataBuffer = this.renderer.createStorageBuffer(
      'forceData',
      this.forceData.byteLength
    );
  }

  private createPipelines(): void {
    const commonBindings = [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' as const } },
    ];

    this.renderer.createComputePipeline(
      'externalForces',
      forcesShader,
      'main',
      [{
        entries: [
          ...commonBindings,
          { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' as const } },
          { binding: 2, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float' as const } },
          { binding: 3, visibility: GPUShaderStage.COMPUTE, storageTexture: { format: 'rg32float' as const } },
          { binding: 4, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float' as const } },
          { binding: 5, visibility: GPUShaderStage.COMPUTE, storageTexture: { format: 'rgba32float' as const } },
        ],
      }]
    );

    this.renderer.createComputePipeline(
      'vorticity',
      vorticityShader,
      'computeVorticity',
      [{
        entries: [
          ...commonBindings,
          { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float' as const } },
          { binding: 2, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float' as const } },
          { binding: 3, visibility: GPUShaderStage.COMPUTE, storageTexture: { format: 'r32float' as const } },
          { binding: 4, visibility: GPUShaderStage.COMPUTE, storageTexture: { format: 'rg32float' as const } },
        ],
      }]
    );

    this.renderer.createComputePipeline(
      'confinement',
      vorticityShader,
      'applyConfinement',
      [{
        entries: [
          ...commonBindings,
          { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float' as const } },
          { binding: 2, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float' as const } },
          { binding: 3, visibility: GPUShaderStage.COMPUTE, storageTexture: { format: 'r32float' as const } },
          { binding: 4, visibility: GPUShaderStage.COMPUTE, storageTexture: { format: 'rg32float' as const } },
        ],
      }]
    );

    this.renderer.createComputePipeline(
      'divergence',
      divergenceShader,
      'main',
      [{
        entries: [
          ...commonBindings,
          { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float' as const } },
          { binding: 2, visibility: GPUShaderStage.COMPUTE, storageTexture: { format: 'r32float' as const } },
        ],
      }]
    );

    this.renderer.createComputePipeline(
      'pressureJacobi',
      pressureShader,
      'jacobiIteration',
      [{
        entries: [
          ...commonBindings,
          { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float' as const } },
          { binding: 2, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float' as const } },
          { binding: 3, visibility: GPUShaderStage.COMPUTE, storageTexture: { format: 'r32float' as const } },
          { binding: 4, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float' as const } },
          { binding: 5, visibility: GPUShaderStage.COMPUTE, storageTexture: { format: 'rg32float' as const } },
        ],
      }]
    );

    this.renderer.createComputePipeline(
      'subtractGradient',
      pressureShader,
      'subtractGradient',
      [{
        entries: [
          ...commonBindings,
          { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float' as const } },
          { binding: 2, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float' as const } },
          { binding: 3, visibility: GPUShaderStage.COMPUTE, storageTexture: { format: 'r32float' as const } },
          { binding: 4, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float' as const } },
          { binding: 5, visibility: GPUShaderStage.COMPUTE, storageTexture: { format: 'rg32float' as const } },
        ],
      }]
    );

    this.renderer.createComputePipeline(
      'advection',
      advectionShader,
      'main',
      [{
        entries: [
          ...commonBindings,
          { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float' as const } },
          { binding: 2, visibility: GPUShaderStage.COMPUTE, storageTexture: { format: 'rg32float' as const } },
          { binding: 3, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float' as const } },
          { binding: 4, visibility: GPUShaderStage.COMPUTE, storageTexture: { format: 'rgba32float' as const } },
        ],
      }]
    );

    this.renderer.createRenderPipeline(
      'fluidRender',
      renderShader,
      [{
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'storage' as const } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' as const } },
          { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' as const } },
        ],
      }]
    );
  }

  private createBindGroups(): void {
    const workgroupCount = this.config.resolution / this.config.workgroupSize;

    const sampler = this.renderer.getSampler('linear');

    this.renderer.createBindGroup('externalForces', [
      { binding: 0, resource: { buffer: this.paramsBuffer } },
      { binding: 1, resource: { buffer: this.forceDataBuffer } },
      { binding: 2, resource: this.fields.velocity.read.createView() },
      { binding: 3, resource: this.fields.velocity.write.createView() },
      { binding: 4, resource: this.fields.density.read.createView() },
      { binding: 5, resource: this.fields.density.write.createView() },
    ]);

    this.renderer.createBindGroup('vorticity', [
      { binding: 0, resource: { buffer: this.paramsBuffer } },
      { binding: 1, resource: this.fields.velocity.read.createView() },
      { binding: 2, resource: this.fields.vorticity.createView() },
      { binding: 3, resource: this.fields.vorticity.createView() },
      { binding: 4, resource: this.fields.velocity.write.createView() },
    ]);

    this.renderer.createBindGroup('confinement', [
      { binding: 0, resource: { buffer: this.paramsBuffer } },
      { binding: 1, resource: this.fields.velocity.read.createView() },
      { binding: 2, resource: this.fields.vorticity.createView() },
      { binding: 3, resource: this.fields.vorticity.createView() },
      { binding: 4, resource: this.fields.velocity.write.createView() },
    ]);

    this.renderer.createBindGroup('divergence', [
      { binding: 0, resource: { buffer: this.paramsBuffer } },
      { binding: 1, resource: this.fields.velocity.read.createView() },
      { binding: 2, resource: this.fields.divergence.createView() },
    ]);

    this.renderer.createBindGroup('pressureJacobi', [
      { binding: 0, resource: { buffer: this.paramsBuffer } },
      { binding: 1, resource: this.fields.pressure.read.createView() },
      { binding: 2, resource: this.fields.divergence.createView() },
      { binding: 3, resource: this.fields.pressure.write.createView() },
      { binding: 4, resource: this.fields.velocity.read.createView() },
      { binding: 5, resource: this.fields.velocity.write.createView() },
    ]);

    this.renderer.createBindGroup('subtractGradient', [
      { binding: 0, resource: { buffer: this.paramsBuffer } },
      { binding: 1, resource: this.fields.pressure.read.createView() },
      { binding: 2, resource: this.fields.divergence.createView() },
      { binding: 3, resource: this.fields.pressure.write.createView() },
      { binding: 4, resource: this.fields.velocity.read.createView() },
      { binding: 5, resource: this.fields.velocity.write.createView() },
    ]);

    this.renderer.createBindGroup('advection', [
      { binding: 0, resource: { buffer: this.paramsBuffer } },
      { binding: 1, resource: this.fields.velocity.read.createView() },
      { binding: 2, resource: this.fields.velocity.write.createView() },
      { binding: 3, resource: this.fields.density.read.createView() },
      { binding: 4, resource: this.fields.density.write.createView() },
    ]);

    this.renderer.createRenderBindGroup('fluidRender', [
      { binding: 0, resource: { buffer: this.paramsBuffer } },
      { binding: 1, resource: this.fields.density.read.createView() },
      { binding: 2, resource: this.fields.velocity.read.createView() },
    ]);
  }

  private clearFields(): void {
    this.renderer.clearTexture('velocityRead');
    this.renderer.clearTexture('velocityWrite');
    this.renderer.clearTexture('densityRead');
    this.renderer.clearTexture('densityWrite');
    this.renderer.clearTexture('pressureRead', 0);
    this.renderer.clearTexture('pressureWrite', 0);
    this.renderer.clearTexture('vorticity', 0);
    this.renderer.clearTexture('divergence', 0);
  }

  addForce(
    position: Vector2,
    strength: number,
    radius: number,
    type: ForceType,
    color?: Vector4
  ): void {
    if (this.forcePoints.length >= 20) {
      this.forcePoints.shift();
    }

    this.forcePoints.push({
      position,
      strength,
      radius,
      type,
      color,
    });
  }

  clearForces(): void {
    this.forcePoints = [];
  }

  private updateForceData(): void {
    this.forceData.fill(0);

    for (let i = 0; i < Math.min(this.forcePoints.length, 20); i++) {
      const force = this.forcePoints[i];
      const baseIdx = i * 3 * 4;

      this.forceData[baseIdx] = force.position.x;
      this.forceData[baseIdx + 1] = force.position.y;
      this.forceData[baseIdx + 2] = 0;
      this.forceData[baseIdx + 3] = 0;

      this.forceData[baseIdx + 4] = force.strength;
      this.forceData[baseIdx + 5] = force.radius;
      this.forceData[baseIdx + 6] = force.type === 'attract' ? 0 : force.type === 'repel' ? 1 : 2;
      this.forceData[baseIdx + 7] = 0;

      const color = force.color || vec4(0.5, 0.7, 1.0, 0.5);
      this.forceData[baseIdx + 8] = color.x;
      this.forceData[baseIdx + 9] = color.y;
      this.forceData[baseIdx + 10] = color.z;
      this.forceData[baseIdx + 11] = color.w;
    }

    this.renderer.updateBuffer('forceData', this.forceData.buffer);
  }

  private swapVelocity(): void {
    const temp = this.fields.velocity.read;
    this.fields.velocity.read = this.fields.velocity.write;
    this.fields.velocity.write = temp;
  }

  private swapDensity(): void {
    const temp = this.fields.density.read;
    this.fields.density.read = this.fields.density.write;
    this.fields.density.write = temp;
  }

  private swapPressure(): void {
    const temp = this.fields.pressure.read;
    this.fields.pressure.read = this.fields.pressure.write;
    this.fields.pressure.write = temp;
  }

  private rebuildBindGroup(pipelineName: string): void {
    if (pipelineName === 'pressureJacobi') {
      this.renderer.createBindGroup('pressureJacobi', [
        { binding: 0, resource: { buffer: this.paramsBuffer } },
        { binding: 1, resource: this.fields.pressure.read.createView() },
        { binding: 2, resource: this.fields.divergence.createView() },
        { binding: 3, resource: this.fields.pressure.write.createView() },
        { binding: 4, resource: this.fields.velocity.read.createView() },
        { binding: 5, resource: this.fields.velocity.write.createView() },
      ]);
    } else if (pipelineName === 'subtractGradient') {
      this.renderer.createBindGroup('subtractGradient', [
        { binding: 0, resource: { buffer: this.paramsBuffer } },
        { binding: 1, resource: this.fields.pressure.read.createView() },
        { binding: 2, resource: this.fields.divergence.createView() },
        { binding: 3, resource: this.fields.pressure.write.createView() },
        { binding: 4, resource: this.fields.velocity.read.createView() },
        { binding: 5, resource: this.fields.velocity.write.createView() },
      ]);
    }
  }

  step(): void {
    const now = performance.now();
    const workgroupCount = this.config.resolution / this.config.workgroupSize;

    this.updateForceData();

    const encoder = this.renderer.createCommandEncoder();

    if (this.forcePoints.length > 0) {
      this.updateParams(this.config.resolution, this.config.timeStep, this.forcePoints.length, 0);

      const computePass = this.renderer.beginComputePass(encoder);
      this.renderer.dispatch(computePass, 'externalForces', workgroupCount, workgroupCount);
      computePass.end();

      this.swapVelocity();
      this.swapDensity();

      this.stats.stepTime.externalForces = performance.now() - now;
    }

    const vorticityStart = performance.now();
    {
      this.updateParams(this.config.resolution, 0, 0, 0);

      const computePass = this.renderer.beginComputePass(encoder);
      this.renderer.dispatch(computePass, 'vorticity', workgroupCount, workgroupCount);
      computePass.end();

      this.stats.stepTime.vorticity = performance.now() - vorticityStart;
    }

    const confinementStart = performance.now();
    {
      this.updateParams(
        this.config.resolution,
        1e-5,
        this.config.vorticityConfinement,
        this.config.timeStep
      );

      const computePass = this.renderer.beginComputePass(encoder);
      this.renderer.dispatch(computePass, 'confinement', workgroupCount, workgroupCount);
      computePass.end();

      this.swapVelocity();

      this.stats.stepTime.vorticity += performance.now() - confinementStart;
    }

    const divergenceStart = performance.now();
    {
      this.updateParams(this.config.resolution, 0, 0, 0);

      const computePass = this.renderer.beginComputePass(encoder);
      this.renderer.dispatch(computePass, 'divergence', workgroupCount, workgroupCount);
      computePass.end();

      this.stats.stepTime.divergence = performance.now() - divergenceStart;
    }

    const pressureStart = performance.now();
    {
      this.updateParams(this.config.resolution, 0, 0, 0);

      const computePass = this.renderer.beginComputePass(encoder);
      for (let i = 0; i < this.config.pressureIterations; i++) {
        this.renderer.dispatch(computePass, 'pressureJacobi', workgroupCount, workgroupCount);
        this.swapPressure();
        this.rebuildBindGroup('pressureJacobi');
      }
      computePass.end();

      this.stats.stepTime.pressure = performance.now() - pressureStart;
    }

    const gradientStart = performance.now();
    {
      const computePass = this.renderer.beginComputePass(encoder);
      this.renderer.dispatch(computePass, 'subtractGradient', workgroupCount, workgroupCount);
      computePass.end();

      this.swapVelocity();

      this.stats.stepTime.pressure += performance.now() - gradientStart;
    }

    const advectionStart = performance.now();
    {
      this.updateParams(
        this.config.resolution,
        this.config.timeStep,
        this.config.dissipation.velocity,
        this.config.dissipation.density
      );

      const computePass = this.renderer.beginComputePass(encoder);
      this.renderer.dispatch(computePass, 'advection', workgroupCount, workgroupCount);
      computePass.end();

      this.swapVelocity();
      this.swapDensity();

      this.stats.stepTime.advection = performance.now() - advectionStart;
    }

    const renderStart = performance.now();
    {
      const renderPass = this.renderer.beginRenderPass(encoder, {
        r: 0.02,
        g: 0.02,
        b: 0.05,
        a: 1,
      });
      this.renderer.draw(renderPass, 'fluidRender', 6);
      renderPass.end();

      this.stats.stepTime.render = performance.now() - renderStart;
    }

    this.renderer.submit(encoder);

    this.clearForces();

    this.updateFps();
  }

  private updateParams(x: number, y: number, z: number, w: number): void {
    this.paramsData[0] = x;
    this.paramsData[1] = y;
    this.paramsData[2] = z;
    this.paramsData[3] = w;
    this.renderer.updateBuffer('params', this.paramsData.buffer as ArrayBuffer);
  }

  private updateFps(): void {
    const now = performance.now();
    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;

    this.stats.frameTime = delta;
    this.frameCount++;

    if (now - this.fpsUpdateTime > 500) {
      this.stats.fps = (this.frameCount * 1000) / (now - this.fpsUpdateTime);
      this.frameCount = 0;
      this.fpsUpdateTime = now;
    }
  }

  getStats(): SimulationStats {
    return { ...this.stats };
  }

  getConfig(): FluidSolverConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<FluidSolverConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getVelocityRead(): GPUTexture {
    return this.fields.velocity.read;
  }

  getVelocityReadView(): GPUTextureView {
    return this.fields.velocity.read.createView();
  }

  getVelocityWrite(): GPUTexture {
    return this.fields.velocity.write;
  }

  getDensityRead(): GPUTexture {
    return this.fields.density.read;
  }

  getDensityReadView(): GPUTextureView {
    return this.fields.density.read.createView();
  }

  getPressureRead(): GPUTexture {
    return this.fields.pressure.read;
  }

  getVorticity(): GPUTexture {
    return this.fields.vorticity;
  }

  addDensity(position: Vector2, radius: number, color: Vector4): void {
    this.addForce(position, 0, radius, 'attract', color);
  }

  addVelocity(position: Vector2, direction: Vector2, radius: number): void {
    const strength = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    this.addForce(position, strength, radius, 'repel', vec4(0, 0, 0, 0));
  }

  addVortex(position: Vector2, strength: number, radius: number): void {
    this.addForce(position, strength, radius, 'vortex');
  }

  addAttractor(position: Vector2, strength: number, radius: number): void {
    this.addForce(position, strength, radius, 'attract');
  }

  addRepeller(position: Vector2, strength: number, radius: number): void {
    this.addForce(position, strength, radius, 'repel');
  }

  reset(): void {
    this.clearFields();
    this.clearForces();
  }

  dispose(): void {
    this.forcePoints = [];
    this.fields.velocity.read.destroy();
    this.fields.velocity.write.destroy();
    this.fields.density.read.destroy();
    this.fields.density.write.destroy();
    this.fields.pressure.read.destroy();
    this.fields.pressure.write.destroy();
    this.fields.vorticity.destroy();
    this.fields.divergence.destroy();

    this.paramsBuffer.destroy();
    this.forceDataBuffer.destroy();

    this.renderer.dispose();
  }
}
