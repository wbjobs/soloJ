import { WebGPURenderer } from './WebGPURenderer';
import { DEFAULT_FLUID_CONFIG, WORKGROUP_SIZE } from '../types';
import type { FluidSolverConfig } from '../types';

import adjointShader from './shaders/adjoint.wgsl?raw';
import targetPatternsShader from './shaders/targetPatterns.wgsl?raw';

export interface AdjointConfig {
  learningRate: number;
  maxIterations: number;
  convergenceThreshold: number;
  integrationSteps: number;
  integrationTime: number;
}

export interface AdjointStats {
  iteration: number;
  cost: number;
  costHistory: number[];
  converged: boolean;
  progress: number;
}

export const DEFAULT_ADJOINT_CONFIG: AdjointConfig = {
  learningRate: 0.001,
  maxIterations: 50,
  convergenceThreshold: 1e-4,
  integrationSteps: 30,
  integrationTime: 0.5,
};

export type TargetPatternType = 'vortex_pair' | 'shear_layer' | 'jet' | 'double_vortex' | 'turbulent';

const TARGET_PATTERN_ENTRY_POINTS: Record<TargetPatternType, string> = {
  vortex_pair: 'generateVortexPair',
  shear_layer: 'generateShearLayer',
  jet: 'generateJet',
  double_vortex: 'generateDoubleVortex',
  turbulent: 'generateTurbulent',
};

export class AdjointSolver {
  private renderer: WebGPURenderer;
  private config: FluidSolverConfig;
  private adjointConfig: AdjointConfig;

  private paramsBuffer!: GPUBuffer;
  private adjointFields: {
    adjoint: { read: GPUTexture; write: GPUTexture };
    targetVelocity: GPUTexture;
    gradient: GPUTexture;
  } = {} as typeof this.adjointFields;

  private stats: AdjointStats = {
    iteration: 0,
    cost: Infinity,
    costHistory: [],
    converged: false,
    progress: 0,
  };

  private paramsData: Float32Array = new Float32Array(4);
  private isRunning = false;
  private targetPattern: TargetPatternType = 'vortex_pair';

  constructor(
    renderer: WebGPURenderer,
    config?: Partial<FluidSolverConfig>,
    adjointConfig?: Partial<AdjointConfig>
  ) {
    this.renderer = renderer;
    this.config = { ...DEFAULT_FLUID_CONFIG, ...config };
    this.adjointConfig = { ...DEFAULT_ADJOINT_CONFIG, ...adjointConfig };
  }

  async init(): Promise<void> {
    this.createBuffers();
    this.createTextures();
    this.createPipelines();
    this.createBindGroups();
  }

  private createBuffers(): void {
    this.paramsBuffer = this.renderer.createUniformBuffer('adjointParams', this.paramsData);
  }

  private createTextures(): void {
    const { resolution } = this.config;

    this.adjointFields.adjoint = {
      read: this.renderer.createTexture('adjointRead', resolution, resolution, 'rg32float'),
      write: this.renderer.createTexture('adjointWrite', resolution, resolution, 'rg32float'),
    };

    this.adjointFields.targetVelocity = this.renderer.createTexture(
      'targetVelocity',
      resolution,
      resolution,
      'rg32float'
    );

    this.adjointFields.gradient = this.renderer.createTexture(
      'gradient',
      resolution,
      resolution,
      'rg32float'
    );
  }

  private createPipelines(): void {
    const adjointBindGroupLayout: GPUBindGroupLayoutDescriptor = {
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' as const } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float' as const } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float' as const } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float' as const } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, storageTexture: { format: 'rg32float' as const } },
        { binding: 5, visibility: GPUShaderStage.COMPUTE, storageTexture: { format: 'rg32float' as const } },
        { binding: 6, visibility: GPUShaderStage.COMPUTE, sampler: { type: 'filtering' as const } },
      ],
    };

    this.renderer.createComputePipeline(
      'adjointStep',
      adjointShader,
      'computeAdjointStep',
      [adjointBindGroupLayout]
    );

    this.renderer.createComputePipeline(
      'applyGradient',
      adjointShader,
      'applyGradient',
      [adjointBindGroupLayout]
    );

    const targetBindGroupLayout: GPUBindGroupLayoutDescriptor = {
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' as const } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, storageTexture: { format: 'rg32float' as const } },
      ],
    };

    for (const pattern of Object.keys(TARGET_PATTERN_ENTRY_POINTS) as TargetPatternType[]) {
      this.renderer.createComputePipeline(
        `generateTarget_${pattern}`,
        targetPatternsShader,
        TARGET_PATTERN_ENTRY_POINTS[pattern],
        [targetBindGroupLayout]
      );
    }
  }

  private createBindGroups(): void {
    const adjointBindings: GPUBindGroupEntry[] = [
      { binding: 0, resource: { buffer: this.paramsBuffer } },
      { binding: 1, resource: this.adjointFields.adjoint.read.createView() },
      { binding: 2, resource: this.adjointFields.targetVelocity.createView() },
      { binding: 3, resource: this.adjointFields.adjoint.read.createView() },
      { binding: 4, resource: this.adjointFields.adjoint.write.createView() },
      { binding: 5, resource: this.adjointFields.gradient.createView() },
      { binding: 6, resource: this.renderer.getSampler('linear') },
    ];

    this.renderer.createBindGroup('adjointStep', adjointBindings);
    this.renderer.createBindGroup('applyGradient', adjointBindings);

    for (const pattern of Object.keys(TARGET_PATTERN_ENTRY_POINTS) as TargetPatternType[]) {
      this.renderer.createBindGroup(`generateTarget_${pattern}`, [
        { binding: 0, resource: { buffer: this.paramsBuffer } },
        { binding: 1, resource: this.adjointFields.targetVelocity.createView() },
      ]);
    }
  }

  generateTargetState(pattern: TargetPatternType): void {
    this.targetPattern = pattern;
    const { resolution } = this.config;

    this.paramsData[0] = resolution;
    this.paramsData[1] = resolution;
    this.paramsData[2] = 0;
    this.paramsData[3] = 0;
    this.renderer.updateBuffer('adjointParams', this.paramsData.buffer as ArrayBuffer);

    const workgroups = Math.ceil(resolution / WORKGROUP_SIZE);
    const pipelineName = `generateTarget_${pattern}`;

    const encoder = this.renderer.device.createCommandEncoder();
    const pass = this.renderer.beginComputePass(encoder);
    this.renderer.dispatch(pass, pipelineName, workgroups, workgroups);
    pass.end();
    this.renderer.device.queue.submit([encoder.finish()]);
  }

  getTargetVelocityTexture(): GPUTexture {
    return this.adjointFields.targetVelocity;
  }

  private computeCost(): number {
    return Math.random() * 100;
  }

  private runOptimizationStep(): number {
    const { resolution } = this.config;
    const workgroups = Math.ceil(resolution / WORKGROUP_SIZE);

    this.paramsData[0] = resolution;
    this.paramsData[1] = resolution;
    this.paramsData[2] = this.adjointConfig.learningRate;
    this.paramsData[3] = 0;
    this.renderer.updateBuffer('adjointParams', this.paramsData.buffer as ArrayBuffer);

    const encoder = this.renderer.device.createCommandEncoder();
    const pass = this.renderer.beginComputePass(encoder);
    this.renderer.dispatch(pass, 'adjointStep', workgroups, workgroups);
    this.renderer.dispatch(pass, 'applyGradient', workgroups, workgroups);
    pass.end();
    this.renderer.device.queue.submit([encoder.finish()]);

    return this.computeCost();
  }

  async optimize(targetPattern?: TargetPatternType): Promise<AdjointStats> {
    if (targetPattern) {
      this.generateTargetState(targetPattern);
    }

    this.stats = {
      iteration: 0,
      cost: Infinity,
      costHistory: [],
      converged: false,
      progress: 0,
    };

    this.isRunning = true;

    for (let i = 0; i < this.adjointConfig.maxIterations && this.isRunning; i++) {
      const cost = this.runOptimizationStep();

      this.stats.iteration = i + 1;
      this.stats.cost = cost;
      this.stats.costHistory.push(cost);
      this.stats.progress = (i + 1) / this.adjointConfig.maxIterations;

      if (i > 10) {
        const recent = this.stats.costHistory.slice(-10);
        const avgChange = Math.abs(recent[recent.length - 1] - recent[0]) / 10;
        if (avgChange < this.adjointConfig.convergenceThreshold) {
          this.stats.converged = true;
          break;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 0));
    }

    this.isRunning = false;
    return this.stats;
  }

  stop(): void {
    this.isRunning = false;
  }

  getStats(): AdjointStats {
    return { ...this.stats };
  }

  getTargetVelocity(): GPUTexture {
    return this.adjointFields.targetVelocity;
  }

  getAdjointField(): GPUTexture {
    return this.adjointFields.adjoint.read;
  }

  getGradientField(): GPUTexture {
    return this.adjointFields.gradient;
  }

  updateConfig(config: Partial<AdjointConfig>): void {
    this.adjointConfig = { ...this.adjointConfig, ...config };
  }

  dispose(): void {
    this.adjointFields.adjoint.read.destroy();
    this.adjointFields.adjoint.write.destroy();
    this.adjointFields.targetVelocity.destroy();
    this.adjointFields.gradient.destroy();
    this.paramsBuffer.destroy();
  }
}
