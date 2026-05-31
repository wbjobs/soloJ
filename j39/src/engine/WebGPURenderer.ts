import type {
  TextureFormat,
  TextureInfo,
  ComputePipelineInfo,
  RenderPipelineInfo,
  WebGPUBufferInfo,
} from '../types';

export class WebGPURenderer {
  private canvas: HTMLCanvasElement;
  private context!: GPUCanvasContext;
  device!: GPUDevice;
  private adapter!: GPUAdapter;
  private format!: GPUTextureFormat;
  private presentationSize: { width: number; height: number };
  private samplers: Map<string, GPUSampler> = new Map();
  private buffers: Map<string, WebGPUBufferInfo> = new Map();
  private textures: Map<string, TextureInfo> = new Map();
  private computePipelines: Map<string, ComputePipelineInfo> = new Map();
  private renderPipelines: Map<string, RenderPipelineInfo> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.presentationSize = {
      width: canvas.width,
      height: canvas.height,
    };
  }

  async init(): Promise<void> {
    if (!navigator.gpu) {
      throw new Error('WebGPU is not supported in this browser');
    }

    this.adapter = (await navigator.gpu.requestAdapter())!;
    if (!this.adapter) {
      throw new Error('No GPU adapter found');
    }

    this.device = await this.adapter.requestDevice();

    this.context = this.canvas.getContext('webgpu')!;
    if (!this.context) {
      throw new Error('WebGPU context not available');
    }

    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied',
    });

    this.createDefaultSamplers();
  }

  private createDefaultSamplers(): void {
    const linearSampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });

    const nearestSampler = this.device.createSampler({
      magFilter: 'nearest',
      minFilter: 'nearest',
      mipmapFilter: 'nearest',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });

    this.samplers.set('linear', linearSampler);
    this.samplers.set('nearest', nearestSampler);
  }

  createBuffer(
    name: string,
    size: number,
    usage: GPUBufferUsageFlags,
    mappedAtCreation = false
  ): GPUBuffer {
    const existing = this.buffers.get(name);
    if (existing) {
      existing.buffer.destroy();
    }

    const buffer = this.device.createBuffer({
      size,
      usage,
      mappedAtCreation,
    });

    this.buffers.set(name, { buffer, size, usage });
    return buffer;
  }

  createUniformBuffer(name: string, data: Float32Array): GPUBuffer {
    const existing = this.buffers.get(name);
    if (existing) {
      existing.buffer.destroy();
    }

    const buffer = this.device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.device.queue.writeBuffer(buffer, 0, data);
    this.buffers.set(name, {
      buffer,
      size: data.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    return buffer;
  }

  createStorageBuffer(name: string, size: number): GPUBuffer {
    const existing = this.buffers.get(name);
    if (existing) {
      existing.buffer.destroy();
    }

    const buffer = this.device.createBuffer({
      size,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.buffers.set(name, {
      buffer,
      size,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    return buffer;
  }

  updateBuffer(name: string, data: ArrayBuffer, offset = 0): void {
    const bufferInfo = this.buffers.get(name);
    if (!bufferInfo) {
      throw new Error(`Buffer ${name} not found`);
    }
    this.device.queue.writeBuffer(bufferInfo.buffer, offset, data);
  }

  createTexture(
    name: string,
    width: number,
    height: number,
    format: TextureFormat,
    usage: GPUTextureUsageFlags = GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.COPY_SRC
  ): GPUTexture {
    const existing = this.textures.get(name);
    if (existing) {
      existing.texture.destroy();
    }

    const texture = this.device.createTexture({
      size: { width, height },
      format: format as GPUTextureFormat,
      usage,
    });

    this.textures.set(name, { texture, format, width, height });
    return texture;
  }

  createTextureView(
    name: string,
    descriptor?: GPUTextureViewDescriptor
  ): GPUTextureView {
    const textureInfo = this.textures.get(name);
    if (!textureInfo) {
      throw new Error(`Texture ${name} not found`);
    }
    return textureInfo.texture.createView(descriptor);
  }

  getTexture(name: string): GPUTexture {
    const textureInfo = this.textures.get(name);
    if (!textureInfo) {
      throw new Error(`Texture ${name} not found`);
    }
    return textureInfo.texture;
  }

  getSampler(name: string): GPUSampler {
    const sampler = this.samplers.get(name);
    if (!sampler) {
      throw new Error(`Sampler ${name} not found`);
    }
    return sampler;
  }

  getBuffer(name: string): GPUBuffer {
    const bufferInfo = this.buffers.get(name);
    if (!bufferInfo) {
      throw new Error(`Buffer ${name} not found`);
    }
    return bufferInfo.buffer;
  }

  createComputePipeline(
    name: string,
    shaderCode: string,
    entryPoint: string,
    bindGroupLayoutDescriptors: GPUBindGroupLayoutDescriptor[]
  ): ComputePipelineInfo {
    const bindGroupLayouts = bindGroupLayoutDescriptors.map((desc) =>
      this.device.createBindGroupLayout(desc)
    );

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts,
    });

    const shaderModule = this.device.createShaderModule({
      code: shaderCode,
    });

    const pipeline = this.device.createComputePipeline({
      layout: pipelineLayout,
      compute: {
        module: shaderModule,
        entryPoint,
      },
    });

    const pipelineInfo: ComputePipelineInfo = {
      pipeline,
      bindGroupLayout: bindGroupLayouts[0],
      bindGroups: [],
    };

    this.computePipelines.set(name, pipelineInfo);
    return pipelineInfo;
  }

  createBindGroup(
    pipelineName: string,
    entries: GPUBindGroupEntry[],
    groupIndex = 0
  ): GPUBindGroup {
    const pipelineInfo = this.computePipelines.get(pipelineName);
    if (!pipelineInfo) {
      throw new Error(`Compute pipeline ${pipelineName} not found`);
    }

    const bindGroup = this.device.createBindGroup({
      layout: pipelineInfo.bindGroupLayout,
      entries,
    });

    pipelineInfo.bindGroups[groupIndex] = bindGroup;
    return bindGroup;
  }

  createRenderPipeline(
    name: string,
    shaderCode: string,
    bindGroupLayoutDescriptors: GPUBindGroupLayoutDescriptor[],
    targets: GPUColorTargetState[] = [{ format: this.format, blend: {
      color: {
        srcFactor: 'src-alpha',
        dstFactor: 'one-minus-src-alpha',
        operation: 'add',
      },
      alpha: {
        srcFactor: 'one',
        dstFactor: 'one-minus-src-alpha',
        operation: 'add',
      },
    } }]
  ): RenderPipelineInfo {
    const bindGroupLayouts = bindGroupLayoutDescriptors.map((desc) =>
      this.device.createBindGroupLayout(desc)
    );

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts,
    });

    const shaderModule = this.device.createShaderModule({
      code: shaderCode,
    });

    const pipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets,
      },
      primitive: {
        topology: 'triangle-list',
      },
    });

    const pipelineInfo: RenderPipelineInfo = {
      pipeline,
      bindGroupLayout: bindGroupLayouts[0],
      bindGroups: [],
    };

    this.renderPipelines.set(name, pipelineInfo);
    return pipelineInfo;
  }

  createRenderBindGroup(
    pipelineName: string,
    entries: GPUBindGroupEntry[],
    groupIndex = 0
  ): GPUBindGroup {
    const pipelineInfo = this.renderPipelines.get(pipelineName);
    if (!pipelineInfo) {
      throw new Error(`Render pipeline ${pipelineName} not found`);
    }

    const bindGroup = this.device.createBindGroup({
      layout: pipelineInfo.bindGroupLayout,
      entries,
    });

    pipelineInfo.bindGroups[groupIndex] = bindGroup;
    return bindGroup;
  }

  beginComputePass(encoder: GPUCommandEncoder): GPUComputePassEncoder {
    return encoder.beginComputePass();
  }

  dispatch(
    pass: GPUComputePassEncoder,
    pipelineName: string,
    workgroupCountX: number,
    workgroupCountY: number,
    workgroupCountZ = 1,
    bindGroupIndex = 0
  ): void {
    const pipelineInfo = this.computePipelines.get(pipelineName);
    if (!pipelineInfo) {
      throw new Error(`Compute pipeline ${pipelineName} not found`);
    }

    pass.setPipeline(pipelineInfo.pipeline);
    pass.setBindGroup(bindGroupIndex, pipelineInfo.bindGroups[bindGroupIndex]);
    pass.dispatchWorkgroups(workgroupCountX, workgroupCountY, workgroupCountZ);
  }

  beginRenderPass(
    encoder: GPUCommandEncoder,
    clearColor: { r: number; g: number; b: number; a: number } = { r: 0, g: 0, b: 0, a: 1 }
  ): GPURenderPassEncoder {
    const view = this.context.getCurrentTexture().createView();

    return encoder.beginRenderPass({
      colorAttachments: [
        {
          view,
          clearValue: clearColor,
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
  }

  draw(
    pass: GPURenderPassEncoder,
    pipelineName: string,
    vertexCount: number,
    instanceCount = 1,
    bindGroupIndex = 0
  ): void {
    const pipelineInfo = this.renderPipelines.get(pipelineName);
    if (!pipelineInfo) {
      throw new Error(`Render pipeline ${pipelineName} not found`);
    }

    pass.setPipeline(pipelineInfo.pipeline);
    pass.setBindGroup(bindGroupIndex, pipelineInfo.bindGroups[bindGroupIndex]);
    pass.draw(vertexCount, instanceCount);
  }

  createCommandEncoder(): GPUCommandEncoder {
    return this.device.createCommandEncoder();
  }

  submit(encoder: GPUCommandEncoder): void {
    this.device.queue.submit([encoder.finish()]);
  }

  getDevice(): GPUDevice {
    return this.device;
  }

  getFormat(): GPUTextureFormat {
    return this.format;
  }

  getPresentationSize(): { width: number; height: number } {
    return this.presentationSize;
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.presentationSize = { width, height };
  }

  clearTexture(name: string, value: number = 0): void {
    const textureInfo = this.textures.get(name);
    if (!textureInfo) {
      throw new Error(`Texture ${name} not found`);
    }

    const encoder = this.device.createCommandEncoder();

    const clearValue = { r: value, g: value, b: value, a: value === 0 ? 0 : 1 };

    const tempTexture = this.device.createTexture({
      size: { width: textureInfo.width, height: textureInfo.height },
      format: textureInfo.format as GPUTextureFormat,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const tempEncoder = this.device.createCommandEncoder();
    const tempPass = tempEncoder.beginRenderPass({
      colorAttachments: [{
        view: tempTexture.createView(),
        clearValue,
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    tempPass.end();
    this.device.queue.submit([tempEncoder.finish()]);

    encoder.copyTextureToTexture(
      { texture: tempTexture },
      { texture: textureInfo.texture },
      { width: textureInfo.width, height: textureInfo.height }
    );

    this.device.queue.submit([encoder.finish()]);
    tempTexture.destroy();
  }

  dispose(): void {
    this.buffers.forEach((info) => {
      info.buffer.destroy();
    });
    this.textures.forEach((info) => {
      info.texture.destroy();
    });
    this.buffers.clear();
    this.textures.clear();
    this.samplers.clear();
    this.computePipelines.clear();
    this.renderPipelines.clear();

    if (this.device) {
      this.device.destroy();
    }
  }
}
