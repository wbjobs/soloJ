import { GpuContext } from './GpuContext';

export class ComputePipelineManager {
  private _device: GPUDevice;
  private _pipelines: Map<string, GPUComputePipeline> = new Map();
  private _bindGroupLayouts: Map<string, GPUBindGroupLayout> = new Map();
  private _shaderModules: Map<string, GPUShaderModule> = new Map();

  constructor(context: GpuContext) {
    this._device = context.device;
  }

  get device(): GPUDevice {
    return this._device;
  }

  createShaderModule(code: string, label?: string): GPUShaderModule {
    const module = this._device.createShaderModule({
      code,
      label
    });
    if (label) {
      this._shaderModules.set(label, module);
    }
    return module;
  }

  createBindGroupLayout(entries: GPUBindGroupLayoutEntry[], label?: string): GPUBindGroupLayout {
    const layout = this._device.createBindGroupLayout({ entries, label });
    if (label) {
      this._bindGroupLayouts.set(label, layout);
    }
    return layout;
  }

  createPipeline(
    layout: GPUPipelineLayout | 'auto',
    module: GPUShaderModule,
    entryPoint: string,
    label?: string
  ): GPUComputePipeline {
    const pipeline = this._device.createComputePipeline({
      layout,
      compute: { module, entryPoint },
      label
    });
    if (label) {
      this._pipelines.set(label, pipeline);
    }
    return pipeline;
  }

  getPipeline(label: string): GPUComputePipeline | undefined {
    return this._pipelines.get(label);
  }

  getBindGroupLayout(label: string): GPUBindGroupLayout | undefined {
    return this._bindGroupLayouts.get(label);
  }

  createBindGroup(
    layout: GPUBindGroupLayout,
    entries: GPUBindGroupEntry[],
    label?: string
  ): GPUBindGroup {
    return this._device.createBindGroup({ layout, entries, label });
  }

  createPipelineLayout(
    bindGroupLayouts: GPUBindGroupLayout[],
    label?: string
  ): GPUPipelineLayout {
    return this._device.createPipelineLayout({ bindGroupLayouts, label });
  }

  dispatch(
    encoder: GPUCommandEncoder,
    pipeline: GPUComputePipeline,
    bindGroup: GPUBindGroup,
    workgroupCountX: number,
    workgroupCountY: number = 1,
    workgroupCountZ: number = 1
  ): void {
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(workgroupCountX, workgroupCountY, workgroupCountZ);
    pass.end();
  }
}