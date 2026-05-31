import { GpuContext } from '../gpu/GpuContext';
import { ComputePipelineManager } from '../gpu/ComputePipelineManager';
import type { CameraUniforms } from '../types/index';
import { FluidSimulation } from '../simulation/FluidSimulation';

import particleShader from './shaders/particle_render.wgsl?raw';
import surfaceShader from './shaders/surface_reconstruction.wgsl?raw';
import rayTraceShader from './shaders/ray_trace.wgsl?raw';

export type RenderMode = 'particles' | 'surface' | 'rayTrace';

interface RenderParams {
  particleRadius: number;
  maxParticles: number;
  screenWidth: number;
  screenHeight: number;
  smoothingRadius: number;
  isoValue: number;
}

interface LightParams {
  direction: [number, number, number];
  padding1: number;
  color: [number, number, number];
  padding2: number;
  ambient: number;
  maxBounces: number;
  sampleCount: number;
  padding3: number;
}

export class Renderer {
  private _context: GpuContext;
  private _pipelineManager: ComputePipelineManager;

  private _particlePipeline!: GPURenderPipeline;
  private _surfacePipeline!: GPURenderPipeline;
  private _rayTracePipeline!: GPURenderPipeline;

  private _cameraBuffer: GPUBuffer;
  private _renderParamsBuffer: GPUBuffer;
  private _lightParamsBuffer: GPUBuffer;

  private _surfaceParamsBuffer: GPUBuffer;

  private _particleBindGroup!: GPUBindGroup;
  private _surfaceBindGroup0!: GPUBindGroup;
  private _surfaceBindGroup1!: GPUBindGroup;
  private _rayTraceBindGroup0!: GPUBindGroup;
  private _rayTraceBindGroup1!: GPUBindGroup;

  private _renderMode: RenderMode = 'particles';
  private _canvas: HTMLCanvasElement;

  private _taaEnabled: boolean = true;
  private _accumulationTexture!: GPUTexture;
  private _accumulationTextureView!: GPUTextureView;
  private _accumulationCount: number = 0;

  private _accumulationPipeline!: GPURenderPipeline;
  private _accumulationBindGroup!: GPUBindGroup;

  private _displayPipeline!: GPURenderPipeline;
  private _displayBindGroup!: GPUBindGroup;

  private _outputTexture!: GPUTexture;
  private _outputTextureView!: GPUTextureView;

  constructor(
    context: GpuContext,
    pipelineManager: ComputePipelineManager,
    canvas: HTMLCanvasElement
  ) {
    this._context = context;
    this._pipelineManager = pipelineManager;
    this._canvas = canvas;

    const device = context.device;

    this._cameraBuffer = device.createBuffer({
      size: 256,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this._renderParamsBuffer = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this._lightParamsBuffer = device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this._surfaceParamsBuffer = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this._initRenderPipelines();
    this._initPostProcessing();
  }

  private _initRenderPipelines(): void {
    const device = this._context.device;

    const particleModule = this._pipelineManager.createShaderModule(particleShader, 'particle_render');
    const surfaceModule = this._pipelineManager.createShaderModule(surfaceShader, 'surface_reconstruction');
    const rayTraceModule = this._pipelineManager.createShaderModule(rayTraceShader, 'ray_trace');

    this._particlePipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: particleModule,
        entryPoint: 'vs_main'
      },
      fragment: {
        module: particleModule,
        entryPoint: 'fs_main',
        targets: [{
          format: 'bgra8unorm',
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add'
            },
            alpha: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add'
            }
          }
        }]
      },
      primitive: {
        topology: 'triangle-list'
      },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: true,
        depthCompare: 'less'
      }
    });

    this._surfacePipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: surfaceModule,
        entryPoint: 'vs_main'
      },
      fragment: {
        module: surfaceModule,
        entryPoint: 'fs_main',
        targets: [{
          format: 'bgra8unorm'
        }]
      },
      primitive: {
        topology: 'triangle-list'
      },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: true,
        depthCompare: 'less'
      }
    });

    this._rayTracePipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: rayTraceModule,
        entryPoint: 'vs_main'
      },
      fragment: {
        module: rayTraceModule,
        entryPoint: 'fs_main',
        targets: [{
          format: 'bgra8unorm'
        }]
      },
      primitive: {
        topology: 'triangle-list'
      }
    });
  }

  private _initPostProcessing(): void {
    const device = this._context.device;

    const size = { width: this._canvas.width, height: this._canvas.height };

    this._accumulationTexture = device.createTexture({
      size,
      format: 'rgba16float',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });
    this._accumulationTextureView = this._accumulationTexture.createView();

    this._outputTexture = device.createTexture({
      size,
      format: 'bgra8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });
    this._outputTextureView = this._outputTexture.createView();

    const fullscreenShader = `
struct CameraUniforms {
  viewProj: mat4x4<f32>,
  view: mat4x4<f32>,
  proj: mat4x4<f32>,
  cameraPos: vec3<f32>,
  padding: f32,
};

@group(0) @binding(0) var currentTex: texture_2d<f32>;
@group(0) @binding(1) var historyTex: texture_2d<f32>;
@group(0) @binding(2) var outputTex: texture_storage_2d<bgra8unorm, write>;
@group(0) @binding(3) var<uniform> camera: CameraUniforms;

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

@group(1) @binding(0) var texSampler: sampler;
@group(1) @binding(1) var renderTex: texture_2d<f32>;

@fragment
fn accum_fs_main(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = pos.xy / vec2<f32>(textureDimensions(currentTex));
  let current = textureSampleLevel(currentTex, texSampler, uv, 0.0);
  let history = textureSampleLevel(historyTex, texSampler, uv, 0.0);
  
  let historyColor = history.rgb;
  let currentColor = current.rgb;
  
  let minColor = min(historyColor, currentColor);
  let maxColor = max(historyColor, currentColor);
  let clamped = clamp(historyColor, minColor, maxColor);
  
  let alpha = 1.0 / (f32(history.a + 1.0));
  let blended = mix(clamped, currentColor, alpha);
  
  return vec4<f32>(blended, history.a + 1.0);
}

@fragment
fn display_fs_main(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = pos.xy / vec2<f32>(textureDimensions(renderTex));
  let color = textureSampleLevel(renderTex, texSampler, uv, 0.0).rgb;
  return vec4<f32>(color, 1.0);
}
`;

    const module = device.createShaderModule({ code: fullscreenShader });

    const sampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear'
    });

    this._accumulationPipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module,
        entryPoint: 'vs_main'
      },
      fragment: {
        module,
        entryPoint: 'accum_fs_main',
        targets: [{
          format: 'rgba16float'
        }]
      },
      primitive: {
        topology: 'triangle-list'
      }
    });

    const accumBindGroupLayout = this._accumulationPipeline.getBindGroupLayout(0);
    this._accumulationBindGroup = device.createBindGroup({
      layout: accumBindGroupLayout,
      entries: [
        { binding: 0, resource: this._outputTextureView },
        { binding: 1, resource: this._accumulationTextureView },
        { binding: 2, resource: this._outputTextureView },
        { binding: 3, resource: { buffer: this._cameraBuffer } }
      ]
    });

    this._displayPipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module,
        entryPoint: 'vs_main'
      },
      fragment: {
        module,
        entryPoint: 'display_fs_main',
        targets: [{
          format: 'bgra8unorm'
        }]
      },
      primitive: {
        topology: 'triangle-list'
      }
    });

    const displayBindGroupLayout = this._displayPipeline.getBindGroupLayout(1);
    this._displayBindGroup = device.createBindGroup({
      layout: displayBindGroupLayout,
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: this._accumulationTextureView }
      ]
    });
  }

  initBindGroups(simulation: FluidSimulation): void {
    const device = this._context.device;

    this._particleBindGroup = device.createBindGroup({
      layout: this._particlePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: simulation.particleBuffer } },
        { binding: 1, resource: { buffer: this._cameraBuffer } },
        { binding: 2, resource: { buffer: this._renderParamsBuffer } }
      ]
    });

    this._surfaceBindGroup0 = device.createBindGroup({
      layout: this._surfacePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: simulation.particleBuffer } },
        { binding: 1, resource: { buffer: this._cameraBuffer } },
        { binding: 2, resource: { buffer: this._surfaceParamsBuffer } },
        { binding: 3, resource: { buffer: simulation.fluidPropsBuffer } }
      ]
    });

    this._surfaceBindGroup1 = device.createBindGroup({
      layout: this._surfacePipeline.getBindGroupLayout(1),
      entries: [
        { binding: 0, resource: { buffer: simulation.cellStartBuffer } },
        { binding: 1, resource: { buffer: simulation.cellCountBuffer } },
        { binding: 2, resource: { buffer: simulation.sortedIndicesBuffer } }
      ]
    });

    this._rayTraceBindGroup0 = device.createBindGroup({
      layout: this._rayTracePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: simulation.particleBuffer } },
        { binding: 1, resource: { buffer: this._cameraBuffer } },
        { binding: 2, resource: { buffer: this._lightParamsBuffer } },
        { binding: 3, resource: { buffer: simulation.fluidPropsBuffer } }
      ]
    });

    this._rayTraceBindGroup1 = device.createBindGroup({
      layout: this._rayTracePipeline.getBindGroupLayout(1),
      entries: [
        { binding: 0, resource: { buffer: simulation.cellStartBuffer } },
        { binding: 1, resource: { buffer: simulation.cellCountBuffer } },
        { binding: 2, resource: { buffer: simulation.sortedIndicesBuffer } }
      ]
    });
  }

  updateCamera(camera: CameraUniforms): void {
    const data = new Float32Array([
      ...camera.viewProj,
      ...camera.view,
      ...camera.proj,
      camera.cameraPos[0], camera.cameraPos[1], camera.cameraPos[2], 0
    ]);
    this._context.device.queue.writeBuffer(this._cameraBuffer, 0, new Float32Array(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength));
  }

  updateRenderParams(params: Partial<RenderParams>): void {
    const data = new Float32Array([
      params.particleRadius ?? 0.3,
      params.maxParticles ?? 8192,
      params.screenWidth ?? this._canvas.width,
      params.screenHeight ?? this._canvas.height,
      params.smoothingRadius ?? 2.0,
      params.isoValue ?? 0.5,
      0, 0
    ]);
    this._context.device.queue.writeBuffer(this._renderParamsBuffer, 0, new Float32Array(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength));

    const surfaceData = new Float32Array([
      params.particleRadius ?? 0.3,
      params.smoothingRadius ?? 2.0,
      params.isoValue ?? 0.5,
      params.maxParticles ?? 8192,
      params.screenWidth ?? this._canvas.width,
      params.screenHeight ?? this._canvas.height,
      0, 0
    ]);
    this._context.device.queue.writeBuffer(this._surfaceParamsBuffer, 0, new Float32Array(surfaceData.buffer as ArrayBuffer, surfaceData.byteOffset, surfaceData.byteLength));
  }

  updateLightParams(params: Partial<LightParams>): void {
    const data = new Float32Array([
      ...(params.direction ?? [0.5, 1.0, 0.8]),
      0,
      ...(params.color ?? [1.0, 1.0, 1.0]),
      0,
      params.ambient ?? 0.2,
      params.maxBounces ?? 3,
      params.sampleCount ?? 4,
      0
    ]);
    this._context.device.queue.writeBuffer(this._lightParamsBuffer, 0, new Float32Array(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength));
  }

  setRenderMode(mode: RenderMode): void {
    this._renderMode = mode;
    this._accumulationCount = 0;
  }

  setTAAEnabled(enabled: boolean): void {
    this._taaEnabled = enabled;
    this._accumulationCount = 0;
  }

  resetAccumulation(): void {
    this._accumulationCount = 0;
  }

  render(
    simulation: FluidSimulation,
    view: GPUTextureView,
    depthView: GPUTextureView
  ): void {
    const device = this._context.device;
    const encoder = device.createCommandEncoder();

    if (this._renderMode === 'particles') {
      const particlePass = encoder.beginRenderPass({
        colorAttachments: [{
          view,
          clearValue: { r: 0.05, g: 0.08, b: 0.15, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store'
        }],
        depthStencilAttachment: {
          view: depthView,
          depthClearValue: 1.0,
          depthLoadOp: 'clear',
          depthStoreOp: 'store'
        }
      });

      particlePass.setPipeline(this._particlePipeline);
      particlePass.setBindGroup(0, this._particleBindGroup);
      particlePass.draw(6 * simulation.particleCount);
      particlePass.end();
    } else if (this._renderMode === 'surface') {
      const surfacePass = encoder.beginRenderPass({
        colorAttachments: [{
          view: this._outputTextureView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store'
        }],
        depthStencilAttachment: {
          view: depthView,
          depthClearValue: 1.0,
          depthLoadOp: 'clear',
          depthStoreOp: 'store'
        }
      });

      surfacePass.setPipeline(this._surfacePipeline);
      surfacePass.setBindGroup(0, this._surfaceBindGroup0);
      surfacePass.setBindGroup(1, this._surfaceBindGroup1);
      surfacePass.draw(6);
      surfacePass.end();

      if (this._taaEnabled) {
        const accumPass = encoder.beginRenderPass({
          colorAttachments: [{
            view: this._accumulationTextureView,
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: this._accumulationCount === 0 ? 'clear' : 'load',
            storeOp: 'store'
          }]
        });

        accumPass.setPipeline(this._accumulationPipeline);
        accumPass.setBindGroup(0, this._accumulationBindGroup);
        accumPass.draw(6);
        accumPass.end();

        const displayPass = encoder.beginRenderPass({
          colorAttachments: [{
            view,
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: 'clear',
            storeOp: 'store'
          }]
        });

        displayPass.setPipeline(this._displayPipeline);
        displayPass.setBindGroup(1, this._displayBindGroup);
        displayPass.draw(6);
        displayPass.end();

        this._accumulationCount++;
      } else {
        const copyPass = encoder.beginRenderPass({
          colorAttachments: [{
            view,
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: 'clear',
            storeOp: 'store'
          }]
        });

        copyPass.setPipeline(this._displayPipeline);
        copyPass.setBindGroup(1, device.createBindGroup({
          layout: this._displayPipeline.getBindGroupLayout(1),
          entries: [
            { binding: 0, resource: device.createSampler({ magFilter: 'linear', minFilter: 'linear' }) },
            { binding: 1, resource: this._outputTextureView }
          ]
        }));
        copyPass.draw(6);
        copyPass.end();
      }
    } else if (this._renderMode === 'rayTrace') {
      const rayPass = encoder.beginRenderPass({
        colorAttachments: [{
          view: this._outputTextureView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store'
        }]
      });

      rayPass.setPipeline(this._rayTracePipeline);
      rayPass.setBindGroup(0, this._rayTraceBindGroup0);
      rayPass.setBindGroup(1, this._rayTraceBindGroup1);
      rayPass.draw(6);
      rayPass.end();

      if (this._taaEnabled) {
        const accumPass = encoder.beginRenderPass({
          colorAttachments: [{
            view: this._accumulationTextureView,
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: this._accumulationCount === 0 ? 'clear' : 'load',
            storeOp: 'store'
          }]
        });

        accumPass.setPipeline(this._accumulationPipeline);
        accumPass.setBindGroup(0, this._accumulationBindGroup);
        accumPass.draw(6);
        accumPass.end();

        const displayPass = encoder.beginRenderPass({
          colorAttachments: [{
            view,
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: 'clear',
            storeOp: 'store'
          }]
        });

        displayPass.setPipeline(this._displayPipeline);
        displayPass.setBindGroup(1, this._displayBindGroup);
        displayPass.draw(6);
        displayPass.end();

        this._accumulationCount++;
      } else {
        const copyPass = encoder.beginRenderPass({
          colorAttachments: [{
            view,
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: 'clear',
            storeOp: 'store'
          }]
        });

        copyPass.setPipeline(this._displayPipeline);
        copyPass.setBindGroup(1, device.createBindGroup({
          layout: this._displayPipeline.getBindGroupLayout(1),
          entries: [
            { binding: 0, resource: device.createSampler({ magFilter: 'linear', minFilter: 'linear' }) },
            { binding: 1, resource: this._outputTextureView }
          ]
        }));
        copyPass.draw(6);
        copyPass.end();
      }
    }

    device.queue.submit([encoder.finish()]);
  }

  resize(width: number, height: number): void {
    if (this._accumulationTexture) {
      this._accumulationTexture.destroy();
    }
    if (this._outputTexture) {
      this._outputTexture.destroy();
    }

    const device = this._context.device;
    const size = { width, height };

    this._accumulationTexture = device.createTexture({
      size,
      format: 'rgba16float',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });
    this._accumulationTextureView = this._accumulationTexture.createView();

    this._outputTexture = device.createTexture({
      size,
      format: 'bgra8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });
    this._outputTextureView = this._outputTexture.createView();

    this._accumulationCount = 0;
    this._initPostProcessingBindGroups();
  }

  private _initPostProcessingBindGroups(): void {
    const device = this._context.device;

    if (this._accumulationPipeline) {
      const accumBindGroupLayout = this._accumulationPipeline.getBindGroupLayout(0);
      this._accumulationBindGroup = device.createBindGroup({
        layout: accumBindGroupLayout,
        entries: [
          { binding: 0, resource: this._outputTextureView },
          { binding: 1, resource: this._accumulationTextureView },
          { binding: 2, resource: this._outputTextureView },
          { binding: 3, resource: { buffer: this._cameraBuffer } }
        ]
      });
    }

    if (this._displayPipeline) {
      const sampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear'
      });
      const displayBindGroupLayout = this._displayPipeline.getBindGroupLayout(1);
      this._displayBindGroup = device.createBindGroup({
        layout: displayBindGroupLayout,
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: this._accumulationTextureView }
        ]
      });
    }
  }

  get renderMode(): RenderMode {
    return this._renderMode;
  }

  get taaEnabled(): boolean {
    return this._taaEnabled;
  }

  destroy(): void {
    this._cameraBuffer.destroy();
    this._renderParamsBuffer.destroy();
    this._lightParamsBuffer.destroy();
    this._surfaceParamsBuffer.destroy();
    if (this._accumulationTexture) {
      this._accumulationTexture.destroy();
    }
    if (this._outputTexture) {
      this._outputTexture.destroy();
    }
  }
}