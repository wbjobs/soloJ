import { WebGPURenderer } from './WebGPURenderer';
import { DEFAULT_FLUID_CONFIG, WORKGROUP_SIZE } from '../types';
import type { FluidSolverConfig } from '../types';

import ftleShader from './shaders/ftle.wgsl?raw';

export interface LCSConfig {
  integrationTime: number;
  integrationSteps: number;
  ftleThreshold: number;
  ridgeThreshold: number;
  computeBackwardFTLE: boolean;
}

export interface LCSStats {
  forwardFTLEMax: number;
  backwardFTLEMax: number;
  computationTime: number;
}

export const DEFAULT_LCS_CONFIG: LCSConfig = {
  integrationTime: 2.0,
  integrationSteps: 40,
  ftleThreshold: 0.1,
  ridgeThreshold: 5.0,
  computeBackwardFTLE: true,
};

export class LCSSolver {
  private renderer: WebGPURenderer;
  private config: FluidSolverConfig;
  private lcsConfig: LCSConfig;

  private paramsBuffer!: GPUBuffer;

  private fields: {
    particleStart: GPUTexture;
    particleEnd: GPUTexture;
    ftleForward: GPUTexture;
    ftleBackward: GPUTexture;
    lcsRidges: GPUTexture;
  } = {} as typeof this.fields;

  private stats: LCSStats = {
    forwardFTLEMax: 0,
    backwardFTLEMax: 0,
    computationTime: 0,
  };

  private paramsData: Float32Array = new Float32Array(4);

  constructor(
    renderer: WebGPURenderer,
    config?: Partial<FluidSolverConfig>,
    lcsConfig?: Partial<LCSConfig>
  ) {
    this.renderer = renderer;
    this.config = { ...DEFAULT_FLUID_CONFIG, ...config };
    this.lcsConfig = { ...DEFAULT_LCS_CONFIG, ...lcsConfig };
  }

  async init(): Promise<void> {
    this.createBuffers();
    this.createTextures();
    this.createPipelines();
    this.createBindGroups();
  }

  private createBuffers(): void {
    this.paramsBuffer = this.renderer.createUniformBuffer('lcsParams', this.paramsData);
  }

  private createTextures(): void {
    const { resolution } = this.config;

    this.fields.particleStart = this.renderer.createTexture(
      'particleStart',
      resolution,
      resolution,
      'rg32float'
    );

    this.fields.particleEnd = this.renderer.createTexture(
      'particleEnd',
      resolution,
      resolution,
      'rg32float'
    );

    this.fields.ftleForward = this.renderer.createTexture(
      'ftleForward',
      resolution,
      resolution,
      'r32float'
    );

    this.fields.ftleBackward = this.renderer.createTexture(
      'ftleBackward',
      resolution,
      resolution,
      'r32float'
    );

    this.fields.lcsRidges = this.renderer.createTexture(
      'lcsRidges',
      resolution,
      resolution,
      'r32float'
    );
  }

  private createPipelines(): void {
    const lcsBindGroupLayout: GPUBindGroupLayoutDescriptor = {
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' as const } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float' as const } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float' as const } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float' as const } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, storageTexture: { format: 'r32float' as const } },
        { binding: 5, visibility: GPUShaderStage.COMPUTE, sampler: { type: 'filtering' as const } },
      ],
    };

    this.renderer.createComputePipeline(
      'advectForward',
      ftleShader,
      'advectParticlesForward',
      [lcsBindGroupLayout]
    );

    this.renderer.createComputePipeline(
      'advectBackward',
      ftleShader,
      'advectParticlesBackward',
      [lcsBindGroupLayout]
    );

    this.renderer.createComputePipeline(
      'computeFTLE',
      ftleShader,
      'computeFTLE',
      [lcsBindGroupLayout]
    );

    this.renderer.createComputePipeline(
      'computeLCSRidges',
      ftleShader,
      'computeLCS',
      [lcsBindGroupLayout]
    );
  }

  private createBindGroups(): void {
    const ftleBindings: GPUBindGroupEntry[] = [
      { binding: 0, resource: { buffer: this.paramsBuffer } },
      { binding: 1, resource: this.fields.ftleForward.createView() },
      { binding: 2, resource: this.fields.particleStart.createView() },
      { binding: 3, resource: this.fields.particleEnd.createView() },
      { binding: 4, resource: this.fields.ftleForward.createView() },
      { binding: 5, resource: this.renderer.getSampler('linear') },
    ];

    this.renderer.createBindGroup('advectForward', ftleBindings);
    this.renderer.createBindGroup('advectBackward', ftleBindings);
    this.renderer.createBindGroup('computeFTLE', ftleBindings);

    const lcsBindings: GPUBindGroupEntry[] = [
      { binding: 0, resource: { buffer: this.paramsBuffer } },
      { binding: 1, resource: this.fields.ftleForward.createView() },
      { binding: 2, resource: this.fields.particleStart.createView() },
      { binding: 3, resource: this.fields.particleEnd.createView() },
      { binding: 4, resource: this.fields.lcsRidges.createView() },
      { binding: 5, resource: this.renderer.getSampler('linear') },
    ];

    this.renderer.createBindGroup('computeLCSRidges', lcsBindings);
  }

  private resetParticles(): void {
    const { resolution } = this.config;
    const data = new Float32Array(resolution * resolution * 2);

    for (let y = 0; y < resolution; y++) {
      for (let x = 0; x < resolution; x++) {
        const idx = (y * resolution + x) * 2;
        data[idx] = (x + 0.5) / resolution;
        data[idx + 1] = (y + 0.5) / resolution;
      }
    }

    this.renderer.device.queue.writeTexture(
      { texture: this.fields.particleStart },
      data,
      { bytesPerRow: resolution * 2 * 4, rowsPerImage: resolution },
      { width: resolution, height: resolution, depthOrArrayLayers: 1 }
    );
  }

  computeForwardFTLE(velocityTexture: GPUTexture): void {
    const startTime = performance.now();
    const { resolution } = this.config;
    const dt = this.lcsConfig.integrationTime / this.lcsConfig.integrationSteps;
    const workgroups = Math.ceil(resolution / WORKGROUP_SIZE);

    this.resetParticles();

    this.paramsData[0] = resolution;
    this.paramsData[1] = resolution;
    this.paramsData[2] = dt;
    this.paramsData[3] = this.lcsConfig.integrationSteps;
    this.renderer.updateBuffer('lcsParams', this.paramsData.buffer as ArrayBuffer);

    const encoder = this.renderer.device.createCommandEncoder();
    const pass = this.renderer.beginComputePass(encoder);
    this.renderer.dispatch(pass, 'advectForward', workgroups, workgroups);
    pass.end();
    this.renderer.device.queue.submit([encoder.finish()]);

    this.paramsData[2] = this.lcsConfig.integrationTime;
    this.renderer.updateBuffer('lcsParams', this.paramsData.buffer as ArrayBuffer);

    const encoder2 = this.renderer.device.createCommandEncoder();
    const pass2 = this.renderer.beginComputePass(encoder2);
    this.renderer.dispatch(pass2, 'computeFTLE', workgroups, workgroups);
    pass2.end();
    this.renderer.device.queue.submit([encoder2.finish()]);

    this.stats.forwardFTLEMax = 1.0;
    this.stats.computationTime = performance.now() - startTime;
  }

  computeBackwardFTLE(velocityTexture: GPUTexture): void {
    if (!this.lcsConfig.computeBackwardFTLE) return;

    const startTime = performance.now();
    const { resolution } = this.config;
    const dt = this.lcsConfig.integrationTime / this.lcsConfig.integrationSteps;
    const workgroups = Math.ceil(resolution / WORKGROUP_SIZE);

    this.resetParticles();

    this.paramsData[0] = resolution;
    this.paramsData[1] = resolution;
    this.paramsData[2] = dt;
    this.paramsData[3] = this.lcsConfig.integrationSteps;
    this.renderer.updateBuffer('lcsParams', this.paramsData.buffer as ArrayBuffer);

    const encoder = this.renderer.device.createCommandEncoder();
    const pass = this.renderer.beginComputePass(encoder);
    this.renderer.dispatch(pass, 'advectBackward', workgroups, workgroups);
    pass.end();
    this.renderer.device.queue.submit([encoder.finish()]);

    const copyEncoder = this.renderer.device.createCommandEncoder();
    copyEncoder.copyTextureToTexture(
      { texture: this.fields.ftleForward },
      { texture: this.fields.ftleBackward },
      { width: resolution, height: resolution, depthOrArrayLayers: 1 }
    );
    this.renderer.device.queue.submit([copyEncoder.finish()]);

    this.stats.backwardFTLEMax = 1.0;
    this.stats.computationTime = performance.now() - startTime;
  }

  computeLCSRidges(): void {
    const { resolution } = this.config;
    const workgroups = Math.ceil(resolution / WORKGROUP_SIZE);

    this.paramsData[0] = resolution;
    this.paramsData[1] = resolution;
    this.paramsData[2] = this.lcsConfig.ridgeThreshold;
    this.paramsData[3] = 0;
    this.renderer.updateBuffer('lcsParams', this.paramsData.buffer as ArrayBuffer);

    const encoder = this.renderer.device.createCommandEncoder();
    const pass = this.renderer.beginComputePass(encoder);
    this.renderer.dispatch(pass, 'computeLCSRidges', workgroups, workgroups);
    pass.end();
    this.renderer.device.queue.submit([encoder.finish()]);
  }

  computeFullLCS(velocityTexture: GPUTexture): void {
    this.computeForwardFTLE(velocityTexture);
    if (this.lcsConfig.computeBackwardFTLE) {
      this.computeBackwardFTLE(velocityTexture);
    }
    this.computeLCSRidges();
  }

  getStats(): LCSStats {
    return { ...this.stats };
  }

  getForwardFTLE(): GPUTexture {
    return this.fields.ftleForward;
  }

  getBackwardFTLE(): GPUTexture {
    return this.fields.ftleBackward;
  }

  getLCSRidges(): GPUTexture {
    return this.fields.lcsRidges;
  }

  updateConfig(lcsConfig: Partial<LCSConfig>): void {
    this.lcsConfig = { ...this.lcsConfig, ...lcsConfig };
  }

  dispose(): void {
    this.fields.particleStart.destroy();
    this.fields.particleEnd.destroy();
    this.fields.ftleForward.destroy();
    this.fields.ftleBackward.destroy();
    this.fields.lcsRidges.destroy();
    this.paramsBuffer.destroy();
  }
}
