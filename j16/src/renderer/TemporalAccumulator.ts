import { GpuContext } from '../gpu/GpuContext';

const TAA_SHADER = /* wgsl */`
struct Uniforms {
  blendFactor: f32,
  padding: vec3<f32>,
};

@group(0) @binding(0) var currentTex: texture_2d<f32>;
@group(0) @binding(1) var historyTex: texture_2d<f32>;
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4<f32> {
  var pos = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, 1.0)
  );
  return vec4<f32>(pos[vi], 0.0, 1.0);
}

@fragment
fn fs_main(@builtin(position) coord: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = coord.xy / vec2<f32>(textureDimensions(currentTex));
  let currentColor = textureLoad(currentTex, vec2<i32>(coord.xy), 0);
  let historyColor = textureLoad(historyTex, vec2<i32>(coord.xy), 0);

  var aabbMin = vec3<f32>(1.0);
  var aabbMax = vec3<f32>(0.0);

  for (var y: i32 = -1; y <= 1; y++) {
    for (var x: i32 = -1; x <= 1; x++) {
      let sampleCoord = vec2<i32>(coord.xy) + vec2<i32>(x, y);
      let sampleColor = textureLoad(currentTex, sampleCoord, 0);
      aabbMin = min(aabbMin, sampleColor.rgb);
      aabbMax = max(aabbMax, sampleColor.rgb);
    }
  }

  var clampedHistory = clamp(historyColor.rgb, aabbMin, aabbMax);
  var result = mix(currentColor.rgb, clampedHistory, uniforms.blendFactor);

  return vec4<f32>(result, 1.0);
}
`;

export class TemporalAccumulator {
  private _context: GpuContext;
  private _device: GPUDevice;
  private _pipeline!: GPURenderPipeline;
  private _uniformBuffer: GPUBuffer;
  private _historyTexture: GPUTexture;
  private _outputTexture: GPUTexture;
  private _bindGroup!: GPUBindGroup;
  private _blendFactor: number = 0.7;
  private _width: number;
  private _height: number;

  constructor(context: GpuContext, width: number, height: number) {
    this._context = context;
    this._device = context.device;
    this._width = width;
    this._height = height;

    this._uniformBuffer = this._device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this._updateUniforms();

    this._historyTexture = this._device.createTexture({
      size: [width, height],
      format: 'rgba16float',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST
    });

    this._outputTexture = this._device.createTexture({
      size: [width, height],
      format: 'rgba16float',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
    });

    this._initPipeline();
  }

  private _initPipeline(): void {
    const module = this._device.createShaderModule({ code: TAA_SHADER });

    const bindGroupLayout = this._device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ]
    });

    const sampler = this._device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear'
    });

    const pipelineLayout = this._device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout]
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

  private _updateUniforms(): void {
    const data = new Float32Array([this._blendFactor, 0, 0, 0]);
    this._device.queue.writeBuffer(this._uniformBuffer, 0, data);
  }

  setBlendFactor(factor: number): void {
    this._blendFactor = factor;
    this._updateUniforms();
  }

  resize(width: number, height: number): void {
    this._width = width;
    this._height = height;

    this._historyTexture.destroy();
    this._outputTexture.destroy();

    this._historyTexture = this._device.createTexture({
      size: [width, height],
      format: 'rgba16float',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST
    });

    this._outputTexture = this._device.createTexture({
      size: [width, height],
      format: 'rgba16float',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
    });
  }

  reset(): void {
    const encoder = this._device.createCommandEncoder();
    encoder.clearBuffer?.(this._uniformBuffer);
    this._device.queue.submit([encoder.finish()]);
  }

  accumulate(
    encoder: GPUCommandEncoder,
    currentFrameView: GPUTextureView,
    targetView: GPUTextureView
  ): void {
    this._bindGroup = this._device.createBindGroup({
      layout: this._pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: currentFrameView },
        { binding: 1, resource: this._historyTexture.createView() },
        { binding: 2, resource: { buffer: this._uniformBuffer } },
      ]
    });

    const outputView = this._outputTexture.createView();

    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: outputView,
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });

    pass.setPipeline(this._pipeline);
    pass.setBindGroup(0, this._bindGroup);
    pass.draw(6);
    pass.end();

    const copyEncoder = this._device.createCommandEncoder();
    copyEncoder.copyTextureToTexture(
      { texture: this._outputTexture },
      { texture: this._historyTexture },
      [this._width, this._height, 1]
    );
    this._device.queue.submit([copyEncoder.finish()]);

    const finalPass = encoder.beginRenderPass({
      colorAttachments: [{
        view: targetView,
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });

    finalPass.setPipeline(this._pipeline);
    finalPass.setBindGroup(0, this._bindGroup);
    finalPass.draw(6);
    finalPass.end();
  }

  get historyTexture(): GPUTexture {
    return this._historyTexture;
  }

  get outputTexture(): GPUTexture {
    return this._outputTexture;
  }
}