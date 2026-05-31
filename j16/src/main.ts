import { GpuContext } from './gpu/GpuContext';
import { ComputePipelineManager } from './gpu/ComputePipelineManager';
import { FluidSimulation } from './simulation/FluidSimulation';
import { Renderer } from './renderer/Renderer';
import { ControlPanel } from './ui/ControlPanel';
import { FluidType, RenderMode } from './types/index';
import type { Vec3, SimulationParams, CameraUniforms } from './types/index';

function mat4Perspective(fov: number, aspect: number, near: number, far: number): number[] {
  const f = 1.0 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0
  ];
}

function mat4LookAt(eye: Vec3, center: Vec3, up: Vec3): number[] {
  const zx = eye.x - center.x, zy = eye.y - center.y, zz = eye.z - center.z;
  let len = Math.sqrt(zx * zx + zy * zy + zz * zz);
  const fz = { x: zx / len, y: zy / len, z: zz / len };
  const xx = up.y * fz.z - up.z * fz.y;
  const xy = up.z * fz.x - up.x * fz.z;
  const xz = up.x * fz.y - up.y * fz.x;
  len = Math.sqrt(xx * xx + xy * xy + xz * xz);
  const sx = { x: xx / len, y: xy / len, z: xz / len };
  const ux = fz.y * sx.z - fz.z * sx.y;
  const uy = fz.z * sx.x - fz.x * sx.z;
  const uz = fz.x * sx.y - fz.y * sx.x;
  return [
    sx.x, ux, fz.x, 0,
    sx.y, uy, fz.y, 0,
    sx.z, uz, fz.z, 0,
    -(sx.x * eye.x + sx.y * eye.y + sx.z * eye.z),
    -(ux * eye.x + uy * eye.y + uz * eye.z),
    -(fz.x * eye.x + fz.y * eye.y + fz.z * eye.z),
    1
  ];
}

function mat4Multiply(a: number[], b: number[]): number[] {
  const r = new Array(16).fill(0);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      for (let k = 0; k < 4; k++) {
        r[i * 4 + j] += a[i * 4 + k] * b[k * 4 + j];
      }
    }
  }
  return r;
}

async function main(): Promise<void> {
  const canvas = document.getElementById('gpu-canvas') as HTMLCanvasElement;

  const resizeCanvas = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  const gpuContext = new GpuContext(canvas);
  try {
    await gpuContext.init();
  } catch (e) {
    console.error('Failed to initialize WebGPU:', e);
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#ff6666;font-size:18px;text-align:center;';
    errorDiv.innerHTML = 'WebGPU 初始化失败<br><br>请使用支持 WebGPU 的浏览器（如 Chrome/Edge 113+）';
    document.body.appendChild(errorDiv);
    return;
  }

  const device = gpuContext.device;
  const pipelineManager = new ComputePipelineManager(gpuContext);

  const bounds: { min: Vec3; max: Vec3 } = {
    min: { x: -0.8, y: -0.5, z: -0.4 },
    max: { x: 0.8, y: 0.5, z: 0.4 }
  };

  const simParams: SimulationParams = {
    particleRadius: 0.025,
    restDensity: 1000,
    viscosity: 250,
    pressureCoeff: 2000,
    gravityX: 0,
    gravityY: -9.8,
    gravityZ: 0,
    dt: 0.001,
    substeps: 3,
    smoothingRadius: 0.08,
    particleMass: 1.0,
    boundsMin: bounds.min,
    boundsMax: bounds.max,
    gravityStrength: 9.8,
    surfaceTension: 1.0,
    adhesionStrength: 0.5,
    repulsionStrength: 2.0
  };

  const simulation = new FluidSimulation(gpuContext, pipelineManager, 8192, simParams);

  const renderer = new Renderer(gpuContext, pipelineManager, canvas);
  renderer.initBindGroups(simulation);

  let cameraPos: Vec3 = { x: 0, y: 0.2, z: 2.0 };
  let cameraTarget: Vec3 = { x: 0, y: 0, z: 0 };
  let cameraUp: Vec3 = { x: 0, y: 1, z: 0 };
  let cameraFov = Math.PI / 4;

  const updateCameraUniforms = () => {
    const aspect = canvas.width / canvas.height;
    const view = mat4LookAt(cameraPos, cameraTarget, cameraUp);
    const proj = mat4Perspective(cameraFov, aspect, 0.1, 100);
    const viewProj = mat4Multiply(proj, view);

    const cameraUniforms: CameraUniforms = {
      viewProj,
      view,
      proj,
      cameraPos: [cameraPos.x, cameraPos.y, cameraPos.z]
    };
    renderer.updateCamera(cameraUniforms);
  };

  updateCameraUniforms();

  renderer.updateRenderParams({
    particleRadius: simParams.particleRadius,
    smoothingRadius: simParams.smoothingRadius,
    maxParticles: 8192,
    screenWidth: canvas.width,
    screenHeight: canvas.height,
    isoValue: 0.5
  });

  renderer.updateLightParams({
    direction: [0.5, 1.0, 0.8],
    color: [1.0, 1.0, 1.0],
    ambient: 0.2,
    maxBounces: 3,
    sampleCount: 4
  });

  simulation.addParticlesInVolume(
    { x: -0.3, y: 0, z: 0 },
    { x: 0.4, y: 0.35, z: 0.25 },
    400,
    undefined,
    FluidType.WATER
  );

  simulation.addParticlesInVolume(
    { x: 0.3, y: 0, z: 0 },
    { x: 0.35, y: 0.3, z: 0.2 },
    250,
    undefined,
    FluidType.OIL
  );

  simulation.addParticlesInVolume(
    { x: 0, y: 0.2, z: 0 },
    { x: 0.2, y: 0.15, z: 0.1 },
    60,
    undefined,
    FluidType.BUBBLE
  );

  let isDragging = false;
  let mousePos: Vec3 = { x: 0, y: 0, z: 0 };
  let lastMousePos: Vec3 = { x: 0, y: 0, z: 0 };

  const screenToWorld = (clientX: number, clientY: number): Vec3 => {
    const rect = canvas.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;

    const depth = 0.1;
    const aspect = canvas.width / canvas.height;
    const fov = cameraFov;

    const worldX = ndcX * Math.tan(fov / 2) * aspect * depth;
    const worldY = ndcY * Math.tan(fov / 2) * depth;

    return {
      x: cameraPos.x + worldX,
      y: cameraPos.y + worldY,
      z: cameraPos.z - depth
    };
  };

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    mousePos = screenToWorld(e.clientX, e.clientY);
    lastMousePos = { ...mousePos };
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    mousePos = screenToWorld(e.clientX, e.clientY);

    const velocity: Vec3 = {
      x: (mousePos.x - lastMousePos.x) * 50,
      y: (mousePos.y - lastMousePos.y) * 50,
      z: 0
    };

    simulation.addParticlesInVolume(mousePos, { x: 0.05, y: 0.05, z: 0.05 }, 8, velocity);

    lastMousePos = { ...mousePos };
  });

  canvas.addEventListener('mouseup', () => {
    isDragging = false;
  });

  canvas.addEventListener('mouseleave', () => {
    isDragging = false;
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomSpeed = 0.002;
    const direction = e.deltaY > 0 ? 1 : -1;
    const newZ = cameraPos.z + direction * zoomSpeed * cameraPos.z;
    cameraPos.z = Math.max(0.5, Math.min(10, newZ));
    updateCameraUniforms();
    renderer.resetAccumulation();
  });

  let cameraAngle = 0;
  let autoRotate = false;

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  canvas.addEventListener('mousemove', (e) => {
    if (e.buttons === 2) {
      cameraAngle += e.movementX * 0.005;
      cameraPos.x = Math.sin(cameraAngle) * 2.0;
      cameraPos.z = Math.cos(cameraAngle) * 2.0;
      updateCameraUniforms();
      renderer.resetAccumulation();
    }
  });

  const controlPanel = new ControlPanel({
    onRenderModeChange: (mode: RenderMode) => {
      renderer.setRenderMode(mode);
    },
    onAddParticles: () => {
      simulation.addParticlesInVolume(
        { x: 0, y: 0, z: 0 },
        { x: 0.4, y: 0.3, z: 0.2 },
        128
      );
    },
    onAddWater: () => {
      simulation.addParticlesInVolume(
        { x: -0.3, y: 0, z: 0 },
        { x: 0.3, y: 0.25, z: 0.2 },
        128,
        undefined,
        FluidType.WATER
      );
    },
    onAddOil: () => {
      simulation.addParticlesInVolume(
        { x: 0.3, y: 0, z: 0 },
        { x: 0.3, y: 0.25, z: 0.2 },
        100,
        undefined,
        FluidType.OIL
      );
    },
    onAddBubbles: () => {
      simulation.addParticlesInVolume(
        { x: 0, y: 0.2, z: 0 },
        { x: 0.2, y: 0.1, z: 0.1 },
        50,
        undefined,
        FluidType.BUBBLE
      );
    },
    onClearParticles: () => {
      simulation.clear();
    },
    onGravityChange: (x: number, y: number) => {
      simulation.setParams({
        gravityX: x * simParams.gravityStrength,
        gravityY: y * simParams.gravityStrength
      });
    },
    onFluidTypeChange: (type: FluidType) => {
      simulation.setDefaultFluidType(type);
    },
    onParamChange: (params: Partial<SimulationParams>) => {
      if (params.gravityStrength !== undefined) {
        simParams.gravityStrength = params.gravityStrength;
        const currentGravX = Math.sign(simParams.gravityX || 0);
        const currentGravY = Math.sign(simParams.gravityY || -1);
        simulation.setParams({
          gravityX: currentGravX * params.gravityStrength,
          gravityY: currentGravY * params.gravityStrength
        });
      } else {
        simulation.setParams(params);
      }
      if (params.particleRadius !== undefined) {
        renderer.updateRenderParams({
          particleRadius: params.particleRadius,
          smoothingRadius: simParams.smoothingRadius,
          maxParticles: 8192
        });
      }
      if (params.smoothingRadius !== undefined) {
        renderer.updateRenderParams({
          smoothingRadius: params.smoothingRadius
        });
      }
    },
    onTaaToggle: (enabled: boolean) => {
      renderer.setTAAEnabled(enabled);
    },
    onAutoRotateToggle: (enabled: boolean) => {
      autoRotate = enabled;
    }
  });

  let lastTime = performance.now();
  let fps = 60;
  let frameCount = 0;
  let fpsAccumulator = 0;

  function frame(): void {
    const currentTime = performance.now();
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    frameCount++;
    fpsAccumulator += deltaTime;
    if (fpsAccumulator >= 0.5) {
      fps = frameCount / fpsAccumulator;
      controlPanel.updateFPS(fps);
      controlPanel.updateParticleCount(simulation.particleCount);
      frameCount = 0;
      fpsAccumulator = 0;
    }

    if (autoRotate) {
      cameraAngle += deltaTime * 0.3;
      cameraPos.x = Math.sin(cameraAngle) * 2.0;
      cameraPos.z = Math.cos(cameraAngle) * 2.0;
      updateCameraUniforms();
    }

    const simulationDt = Math.min(deltaTime, 0.016);
    simulation.step(simulationDt);

    const currentTexture = gpuContext.getCurrentTexture();
    const currentView = currentTexture.createView();

    const depthTexture = device.createTexture({
      size: [canvas.width, canvas.height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
    const depthView = depthTexture.createView();

    renderer.render(simulation, currentView, depthView);

    device.queue.submit([device.createCommandEncoder().finish()]);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

main();