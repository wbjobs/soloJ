export class GpuContext {
  private _device: GPUDevice | null = null;
  private _canvas: HTMLCanvasElement;
  private _context: GPUCanvasContext | null = null;
  private _format: GPUTextureFormat;

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas;
    this._format = navigator.gpu.getPreferredCanvasFormat();
  }

  get device(): GPUDevice {
    if (!this._device) throw new Error('GPU device not initialized');
    return this._device;
  }

  get context(): GPUCanvasContext {
    if (!this._context) throw new Error('GPU context not initialized');
    return this._context;
  }

  get format(): GPUTextureFormat {
    return this._format;
  }

  get canvas(): HTMLCanvasElement {
    return this._canvas;
  }

  async init(): Promise<void> {
    if (!navigator.gpu) {
      throw new Error('WebGPU is not supported in this browser');
    }

    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance'
    });

    if (!adapter) {
      throw new Error('Failed to get GPU adapter');
    }

    this._device = await adapter.requestDevice({
      requiredFeatures: [],
      requiredLimits: {
        maxStorageBufferBindingSize: 256 * 1024 * 1024,
        maxComputeWorkgroupStorageSize: 32768,
        maxComputeInvocationsPerWorkgroup: 256,
        maxComputeWorkgroupSizeX: 256,
        maxComputeWorkgroupSizeY: 256,
        maxComputeWorkgroupSizeZ: 64,
        maxComputeWorkgroupsPerDimension: 65535
      }
    });

    this._context = this._canvas.getContext('webgpu') as GPUCanvasContext;
    if (!this._context) {
      throw new Error('Failed to get WebGPU context');
    }

    this._context.configure({
      device: this._device,
      format: this._format,
      alphaMode: 'premultiplied'
    });

    this._device.lost.then((info) => {
      console.error('GPU device lost:', info.message);
    });
  }

  createBuffer(size: number, usage: GPUBufferUsageFlags): GPUBuffer {
    return this._device!.createBuffer({
      size: Math.max(size, 4),
      usage,
      mappedAtCreation: false
    });
  }

  createBufferInit(data: ArrayBufferView, usage: GPUBufferUsageFlags): GPUBuffer {
    const buffer = this._device!.createBuffer({
      size: Math.max(data.byteLength, 4),
      usage,
      mappedAtCreation: true
    });
    new Uint8Array(buffer.getMappedRange()).set(
      new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    );
    buffer.unmap();
    return buffer;
  }

  writeBuffer(buffer: GPUBuffer, offset: number, data: ArrayBufferView): void {
    this._device!.queue.writeBuffer(buffer, offset, new Uint8Array(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength));
  }

  getCurrentTexture(): GPUTexture {
    return this._context!.getCurrentTexture();
  }

  resize(width: number, height: number): void {
    this._canvas.width = width;
    this._canvas.height = height;
  }
}