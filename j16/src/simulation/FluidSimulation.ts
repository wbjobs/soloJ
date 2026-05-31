import { GpuContext } from '../gpu/GpuContext';
import { ComputePipelineManager } from '../gpu/ComputePipelineManager';
import { GpuSpatialHashGrid } from './SpatialHashGrid';
import type { Vec3, SimulationParams } from '../types/index';
import { FluidType, FLUID_PROPERTIES } from '../types/index';
import { FLUID_PROPS_ARRAY } from './SPHTypes';

import sphComputeShader from './shaders/sph_compute.wgsl?raw';
import spatialHashShader from './shaders/spatial_hash.wgsl?raw';

const PARTICLE_SIZE = 20 * 4;
const FLUID_PROP_SIZE = 8 * 4;
const NUM_FLUID_TYPES = 3;

export class FluidSimulation {
  private _context: GpuContext;
  private _pipelineManager: ComputePipelineManager;
  private _hashGrid: GpuSpatialHashGrid;

  private _maxParticles: number;
  private _particleCount: number = 0;

  private _particleBuffer: GPUBuffer;
  private _paramsBuffer: GPUBuffer;
  private _fluidPropsBuffer: GPUBuffer;
  private _paramsData: Float32Array;

  private _hashPipeline!: GPUComputePipeline;
  private _countPipeline!: GPUComputePipeline;
  private _prefixSumPipeline!: GPUComputePipeline;
  private _fillPipeline!: GPUComputePipeline;
  private _densityPressurePipeline!: GPUComputePipeline;
  private _forcePipeline!: GPUComputePipeline;
  private _integratePipeline!: GPUComputePipeline;

  private _hashBindGroup!: GPUBindGroup;
  private _sphBindGroup!: GPUBindGroup;

  private _params: SimulationParams;
  private _hostBuffer: ArrayBuffer;
  private _defaultFluidType: FluidType = FluidType.WATER;

  constructor(
    context: GpuContext,
    pipelineManager: ComputePipelineManager,
    maxParticles: number,
    params: SimulationParams
  ) {
    this._context = context;
    this._pipelineManager = pipelineManager;
    this._maxParticles = maxParticles;
    this._params = { ...params };

    const device = context.device;

    this._particleBuffer = device.createBuffer({
      size: maxParticles * PARTICLE_SIZE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });

    this._hostBuffer = new ArrayBuffer(maxParticles * PARTICLE_SIZE);

    this._hashGrid = new GpuSpatialHashGrid(device, params.smoothingRadius, maxParticles);

    this._fluidPropsBuffer = device.createBuffer({
      size: NUM_FLUID_TYPES * FLUID_PROP_SIZE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    const fluidPropsData = new Float32Array(FLUID_PROPS_ARRAY);
    device.queue.writeBuffer(this._fluidPropsBuffer, 0, fluidPropsData);

    this._paramsData = new Float32Array([
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

    this._paramsBuffer = device.createBuffer({
      size: this._paramsData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(this._paramsBuffer, 0, new Float32Array(this._paramsData.buffer as ArrayBuffer, this._paramsData.byteOffset, this._paramsData.byteLength));

    this._initShaders();
    this._initBindGroups();
  }

  private _initShaders(): void {
    const device = this._context.device;

    const sphModule = this._pipelineManager.createShaderModule(sphComputeShader, 'sph');
    const hashModule = this._pipelineManager.createShaderModule(spatialHashShader, 'hash');

    this._hashPipeline = this._pipelineManager.createPipeline('auto', hashModule, 'clearCells', 'clearCells');
    this._countPipeline = this._pipelineManager.createPipeline('auto', hashModule, 'countParticles', 'countParticles');
    this._prefixSumPipeline = this._pipelineManager.createPipeline('auto', hashModule, 'computePrefixSum', 'computePrefixSum');
    this._fillPipeline = this._pipelineManager.createPipeline('auto', hashModule, 'fillSortedIndices', 'fillSortedIndices');
    this._densityPressurePipeline = this._pipelineManager.createPipeline('auto', sphModule, 'computeDensityPressure', 'densityPressure');
    this._forcePipeline = this._pipelineManager.createPipeline('auto', sphModule, 'computeForces', 'computeForces');
    this._integratePipeline = this._pipelineManager.createPipeline('auto', sphModule, 'integrate', 'integrate');
  }

  private _initBindGroups(): void {
    const device = this._context.device;

    this._hashBindGroup = device.createBindGroup({
      layout: this._hashPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this._particleBuffer } },
        { binding: 1, resource: { buffer: this._hashGrid.cellCountBuffer } },
        { binding: 2, resource: { buffer: this._hashGrid.cellStartBuffer } },
        { binding: 3, resource: { buffer: this._hashGrid.sortedIndicesBuffer } },
        { binding: 4, resource: { buffer: this._paramsBuffer } },
      ]
    });

    this._sphBindGroup = device.createBindGroup({
      layout: this._densityPressurePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this._particleBuffer } },
        { binding: 1, resource: { buffer: this._hashGrid.cellStartBuffer } },
        { binding: 2, resource: { buffer: this._hashGrid.cellCountBuffer } },
        { binding: 3, resource: { buffer: this._hashGrid.sortedIndicesBuffer } },
        { binding: 4, resource: { buffer: this._paramsBuffer } },
        { binding: 5, resource: { buffer: this._fluidPropsBuffer } },
      ]
    });
  }

  step(dt?: number): void {
    if (this._particleCount === 0) return;

    const device = this._context.device;
    const encoder = device.createCommandEncoder();

    const gridSize = this._hashGrid.tableSize;
    const workgroupCount = Math.ceil(gridSize / 256);

    const hashPass = encoder.beginComputePass();
    hashPass.setPipeline(this._hashPipeline);
    hashPass.setBindGroup(0, this._hashBindGroup);
    hashPass.dispatchWorkgroups(workgroupCount);
    hashPass.end();

    const particleWgCount = Math.ceil(this._particleCount / 64);

    const countPass = encoder.beginComputePass();
    countPass.setPipeline(this._countPipeline);
    countPass.setBindGroup(0, this._hashBindGroup);
    countPass.dispatchWorkgroups(particleWgCount);
    countPass.end();

    const prefixPass = encoder.beginComputePass();
    prefixPass.setPipeline(this._prefixSumPipeline);
    prefixPass.setBindGroup(0, this._hashBindGroup);
    prefixPass.dispatchWorkgroups(1);
    prefixPass.end();

    const fillPass = encoder.beginComputePass();
    fillPass.setPipeline(this._fillPipeline);
    fillPass.setBindGroup(0, this._hashBindGroup);
    fillPass.dispatchWorkgroups(particleWgCount);
    fillPass.end();

    const substeps = this._params.substeps;
    const currentDt = dt ?? this._params.dt;
    this._paramsData[5] = currentDt;
    device.queue.writeBuffer(this._paramsBuffer, 0, new Float32Array(this._paramsData.buffer as ArrayBuffer, this._paramsData.byteOffset, this._paramsData.byteLength));

    for (let s = 0; s < substeps; s++) {
      const dpPass = encoder.beginComputePass();
      dpPass.setPipeline(this._densityPressurePipeline);
      dpPass.setBindGroup(0, this._sphBindGroup);
      dpPass.dispatchWorkgroups(particleWgCount);
      dpPass.end();

      const forcePass = encoder.beginComputePass();
      forcePass.setPipeline(this._forcePipeline);
      forcePass.setBindGroup(0, this._sphBindGroup);
      forcePass.dispatchWorkgroups(particleWgCount);
      forcePass.end();

      const intPass = encoder.beginComputePass();
      intPass.setPipeline(this._integratePipeline);
      intPass.setBindGroup(0, this._sphBindGroup);
      intPass.dispatchWorkgroups(particleWgCount);
      intPass.end();
    }

    device.queue.submit([encoder.finish()]);
  }

  addParticle(position: Vec3, velocity?: Vec3, type?: FluidType): void {
    if (this._particleCount >= this._maxParticles) return;

    const idx = this._particleCount;
    const offset = idx * PARTICLE_SIZE;
    const view = new DataView(this._hostBuffer);
    const fluidType = type ?? this._defaultFluidType;
    const prop = FLUID_PROPERTIES[fluidType];

    view.setFloat32(offset, position.x, true);
    view.setFloat32(offset + 4, position.y, true);
    view.setFloat32(offset + 8, position.z, true);
    view.setFloat32(offset + 12, 0, true);

    if (velocity) {
      view.setFloat32(offset + 16, velocity.x, true);
      view.setFloat32(offset + 20, velocity.y, true);
      view.setFloat32(offset + 24, velocity.z, true);
    } else {
      view.setFloat32(offset + 16, 0, true);
      view.setFloat32(offset + 20, 0, true);
      view.setFloat32(offset + 24, 0, true);
    }
    view.setFloat32(offset + 28, 0, true);

    view.setFloat32(offset + 32, prop.restDensity, true);
    view.setFloat32(offset + 36, 0, true);
    view.setInt32(offset + 40, fluidType, true);
    view.setFloat32(offset + 44, 0, true);

    view.setFloat32(offset + 48, 0, true);
    view.setFloat32(offset + 52, 0, true);
    view.setFloat32(offset + 56, 0, true);
    view.setFloat32(offset + 60, 0, true);

    view.setFloat32(offset + 64, prop.color.x, true);
    view.setFloat32(offset + 68, prop.color.y, true);
    view.setFloat32(offset + 72, prop.color.z, true);
    view.setFloat32(offset + 76, 0, true);

    this._particleCount++;
  }

  addParticlesInVolume(
    center: Vec3,
    size: Vec3,
    count: number,
    initialVelocity?: Vec3,
    type?: FluidType
  ): void {
    const positions: Vec3[] = [];
    for (let i = 0; i < count; i++) {
      positions.push({
        x: center.x + (Math.random() - 0.5) * size.x,
        y: center.y + (Math.random() - 0.5) * size.y,
        z: center.z + (Math.random() - 0.5) * size.z
      });
    }
    this.addParticles(positions, initialVelocity, type);
  }

  addParticles(positions: Vec3[], velocity?: Vec3, type?: FluidType): void {
    for (const pos of positions) {
      this.addParticle(pos, velocity, type);
    }
    this._flushParticles();
  }

  private _flushParticles(): void {
    if (this._particleCount === 0) return;
    const view = new Float32Array(this._hostBuffer, 0, this._particleCount * (PARTICLE_SIZE / 4));
    const data = new Float32Array(view);
    this._context.device.queue.writeBuffer(this._particleBuffer, 0, data);
  }

  clear(): void {
    this._particleCount = 0;
    const empty = new Float32Array(PARTICLE_SIZE / 4);
    this._context.device.queue.writeBuffer(this._particleBuffer, 0, empty);
  }

  setDefaultFluidType(type: FluidType): void {
    this._defaultFluidType = type;
  }

  setParams(params: Partial<SimulationParams>): void {
    Object.assign(this._params, params);
    this._paramsData = new Float32Array([
      this._params.particleRadius,
      0,
      this._params.gravityX,
      this._params.gravityY,
      this._params.gravityZ,
      this._params.dt,
      this._params.substeps,
      this._params.smoothingRadius,
      this._params.boundsMin ? this._params.boundsMin.x : 0,
      this._params.boundsMin ? this._params.boundsMin.y : 0,
      this._params.boundsMin ? this._params.boundsMin.z : 0,
      this._params.boundsMax ? this._params.boundsMax.x : 0,
      this._params.boundsMax ? this._params.boundsMax.y : 0,
      this._params.boundsMax ? this._params.boundsMax.z : 0,
      this._params.surfaceTension,
      this._params.adhesionStrength,
      this._params.repulsionStrength,
      0.98,
      0, 0, 0
    ]);
    this._context.device.queue.writeBuffer(this._paramsBuffer, 0, new Float32Array(this._paramsData.buffer as ArrayBuffer, this._paramsData.byteOffset, this._paramsData.byteLength));
  }

  get particleBuffer(): GPUBuffer {
    return this._particleBuffer;
  }

  get fluidPropsBuffer(): GPUBuffer {
    return this._fluidPropsBuffer;
  }

  get particleCount(): number {
    return this._particleCount;
  }

  get maxParticles(): number {
    return this._maxParticles;
  }

  get params(): SimulationParams {
    return this._params;
  }

  get defaultFluidType(): FluidType {
    return this._defaultFluidType;
  }

  get cellStartBuffer(): GPUBuffer {
    return this._hashGrid.cellStartBuffer;
  }

  get cellCountBuffer(): GPUBuffer {
    return this._hashGrid.cellCountBuffer;
  }

  get sortedIndicesBuffer(): GPUBuffer {
    return this._hashGrid.sortedIndicesBuffer;
  }

  destroy(): void {
    this._particleBuffer.destroy();
    this._paramsBuffer.destroy();
    this._fluidPropsBuffer.destroy();
    this._hashGrid.destroy();
  }
}