import { GpuContext } from '../gpu/GpuContext';
import type { Vec3, CameraParams } from '../types/index';
import { mat4 } from '../math/mat4';

import rayTraceShader from './shaders/ray_trace.wgsl?raw';

export class RayTracingRenderer {
  private _context: GpuContext;
  private _device: GPUDevice;
  private _pipeline!: GPURenderPipeline;
  private _uniformBuffer: GPUBuffer;
  private _paramsBuffer: GPUBuffer;
  private _bindGroup!: GPUBindGroup;
  private _hashBindGroup!: GPUBindGroup;
  private _uniformData: Float32Array;
  private _paramsData: Float32Array;
  private _frameCount: number = 0;

  constructor(context: GpuContext) {
    this._context = context;
    this._device = context.device;

    this._uniformData = new Float32Array(16 * 3 + 4);
    this._uniformBuffer = this._device.createBuffer({
      size: this._uniformData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this._paramsData = new Float32Array([0.025, 1.33, 3, 800, 600, 0]);
    this._paramsBuffer = this._device.createBuffer({
      size: this._paramsData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this._initPipeline();
  }

  private _initPipeline(): void {
    const module = this._device.createShaderModule({ code: rayTraceShader });

    const bindGroupLayout0 = this._device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ]
    });

    const bindGroupLayout1 = this._device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
      ]
    });

    const pipelineLayout = this._device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout0, bindGroupLayout1]
    });

    this._pipeline = this._device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: { module, entryPoint: 'vs_main' },
      fragment: {
        module,
        entryPoint: 'fs_main',
        targets: [{ format: 'rgba16float' }]
      },
      primitive: { topology: 'triangle-list' }
    });
  }

  updateCamera(camera: CameraParams): void {
    const view = mat4.lookAt(camera.position, camera.target, camera.up);
    const proj = mat4.perspective(camera.fov, camera.aspect, camera.near, camera.far);
    const viewProj = mat4.multiply(proj, view);

    this._uniformData.set(viewProj.m, 0);
    this._uniformData.set(view.m, 16);
    this._uniformData.set(proj.m, 32);
    this._uniformData.set([camera.position.x, camera.position.y, camera.position.z, 0], 48);

    this._device.queue.writeBuffer(this._uniformBuffer, 0, new Float32Array(this._uniformData.buffer as ArrayBuffer, this._uniformData.byteOffset, this._uniformData.byteLength));
  }

  updateParams(particleRadius: number, refractiveIndex: number, maxBounces: number): void {
    this._paramsData[0] = particleRadius;
    this._paramsData[1] = refractiveIndex;
    this._paramsData[2] = maxBounces;
    this._device.queue.writeBuffer(this._paramsBuffer, 0, new Float32Array(this._paramsData.buffer as ArrayBuffer, this._paramsData.byteOffset, this._paramsData.byteLength));
  }

  resize(width: number, height: number): void {
    this._paramsData[3] = width;
    this._paramsData[4] = height;
    this._device.queue.writeBuffer(this._paramsBuffer, 0, new Float32Array(this._paramsData.buffer as ArrayBuffer, this._paramsData.byteOffset, this._paramsData.byteLength));
  }

  resetAccumulation(): void {
    this._frameCount = 0;
  }

  render(
    encoder: GPUCommandEncoder,
    targetView: GPUTextureView,
    particleBuffer: GPUBuffer,
    hashBuffers: { cellStart: GPUBuffer; cellCount: GPUBuffer; sortedIndices: GPUBuffer }
  ): void {
    this._paramsData[5] = this._frameCount;
    this._device.queue.writeBuffer(this._paramsBuffer, 0, new Float32Array(this._paramsData.buffer as ArrayBuffer, this._paramsData.byteOffset, this._paramsData.byteLength));

    this._bindGroup = this._device.createBindGroup({
      layout: this._pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: particleBuffer } },
        { binding: 1, resource: { buffer: this._uniformBuffer } },
        { binding: 2, resource: { buffer: this._paramsBuffer } },
      ]
    });

    this._hashBindGroup = this._device.createBindGroup({
      layout: this._pipeline.getBindGroupLayout(1),
      entries: [
        { binding: 0, resource: { buffer: hashBuffers.cellStart } },
        { binding: 1, resource: { buffer: hashBuffers.cellCount } },
        { binding: 2, resource: { buffer: hashBuffers.sortedIndices } },
      ]
    });

    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: targetView,
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });

    pass.setPipeline(this._pipeline);
    pass.setBindGroup(0, this._bindGroup);
    pass.setBindGroup(1, this._hashBindGroup);
    pass.draw(6);
    pass.end();

    this._frameCount++;
  }
}