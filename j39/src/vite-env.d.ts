/// <reference types="vite/client" />

declare module '*.wgsl?raw' {
  const content: string;
  export default content;
}

declare module '*.wgsl' {
  const shader: GPUShaderModuleDescriptor;
  export default shader;
}

