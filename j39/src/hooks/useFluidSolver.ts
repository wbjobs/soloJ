import { useEffect, useRef, useCallback } from 'react';
import { useAppStore, ForcePoint, SimulationParams } from '@/store/useAppStore';

interface FluidSolverState {
  initialized: boolean;
  running: boolean;
  particles: Float32Array;
  velocityX: Float32Array;
  velocityY: Float32Array;
  density: Float32Array;
  vorticity: Float32Array;
  tempVelX: Float32Array;
  tempVelY: Float32Array;
  prevVelX: Float32Array;
  prevVelY: Float32Array;
}

export const useFluidSolver = (canvasRef: React.RefObject<HTMLCanvasElement>) => {
  const solverRef = useRef<FluidSolverState | null>(null);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsTimeRef = useRef<number>(0);

  const {
    simulationParams,
    isSimulating,
    isPaused,
    activeForces,
    setIsSimulating,
    updatePerformanceStats,
    addFpsSample,
  } = useAppStore();

  const initSolver = useCallback((width: number, height: number, params: SimulationParams) => {
    const gridSize = params.gridResolution;
    const particleCount = params.particleCount;
    const fieldSize = gridSize * gridSize;

    const solver: FluidSolverState = {
      initialized: true,
      running: false,
      particles: new Float32Array(particleCount * 2),
      velocityX: new Float32Array(fieldSize),
      velocityY: new Float32Array(fieldSize),
      density: new Float32Array(fieldSize),
      vorticity: new Float32Array(fieldSize),
      tempVelX: new Float32Array(fieldSize),
      tempVelY: new Float32Array(fieldSize),
      prevVelX: new Float32Array(fieldSize),
      prevVelY: new Float32Array(fieldSize),
    };

    for (let i = 0; i < particleCount; i++) {
      solver.particles[i * 2] = Math.random() * width;
      solver.particles[i * 2 + 1] = Math.random() * height;
    }

    solverRef.current = solver;
    return solver;
  }, []);

  const applyForces = useCallback((
    solver: FluidSolverState,
    forces: ForcePoint[],
    width: number,
    height: number,
    params: SimulationParams
  ) => {
    const gridSize = params.gridResolution;
    const cellWidth = width / gridSize;
    const cellHeight = height / gridSize;

    forces.forEach((force) => {
      const worldX = force.x * width;
      const worldY = force.y * height;
      const gridX = Math.floor(worldX / cellWidth);
      const gridY = Math.floor(worldY / cellHeight);
      const normalizedRadius = force.radius / Math.max(width, height);
      const radius = Math.max(1, Math.ceil(normalizedRadius * gridSize));

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const gx = Math.max(0, Math.min(gridSize - 1, gridX + dx));
          const gy = Math.max(0, Math.min(gridSize - 1, gridY + dy));
          const idx = gy * gridSize + gx;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= radius) {
            const falloff = 1 - dist / radius;
            const strength = force.strength * falloff * 0.01;
            const cellCenterX = gx * cellWidth + cellWidth / 2;
            const cellCenterY = gy * cellHeight + cellHeight / 2;

            let vx = 0;
            let vy = 0;

            switch (force.type) {
              case 'attract': {
                const dirX = worldX - cellCenterX;
                const dirY = worldY - cellCenterY;
                const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
                vx = (dirX / len) * strength;
                vy = (dirY / len) * strength;
                break;
              }
              case 'repel': {
                const dirX = cellCenterX - worldX;
                const dirY = cellCenterY - worldY;
                const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
                vx = (dirX / len) * strength;
                vy = (dirY / len) * strength;
                break;
              }
              case 'vortex': {
                const dirX = cellCenterX - worldX;
                const dirY = cellCenterY - worldY;
                const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
                vx = (-dirY / len) * strength;
                vy = (dirX / len) * strength;
                break;
              }
            }

            solver.velocityX[idx] += vx;
            solver.velocityY[idx] += vy;
          }
        }
      }
    });
  }, []);

  const diffuse = useCallback((
    field: Float32Array,
    prevField: Float32Array,
    diffusion: number,
    dt: number,
    gridSize: number
  ) => {
    const a = dt * diffusion * gridSize * gridSize;
    const iterations = 20;

    for (let iter = 0; iter < iterations; iter++) {
      for (let y = 1; y < gridSize - 1; y++) {
        for (let x = 1; x < gridSize - 1; x++) {
          const idx = y * gridSize + x;
          const up = (y - 1) * gridSize + x;
          const down = (y + 1) * gridSize + x;
          const left = y * gridSize + (x - 1);
          const right = y * gridSize + (x + 1);

          field[idx] = (prevField[idx] + a * (field[up] + field[down] + field[left] + field[right])) / (1 + 4 * a);
        }
      }
    }
  }, []);

  const advect = useCallback((
    field: Float32Array,
    prevField: Float32Array,
    velX: Float32Array,
    velY: Float32Array,
    dt: number,
    gridSize: number
  ) => {
    const dt0 = dt * gridSize;

    for (let y = 1; y < gridSize - 1; y++) {
      for (let x = 1; x < gridSize - 1; x++) {
        const idx = y * gridSize + x;
        let x0 = x - dt0 * velX[idx];
        let y0 = y - dt0 * velY[idx];

        x0 = Math.max(0.5, Math.min(gridSize - 1.5, x0));
        y0 = Math.max(0.5, Math.min(gridSize - 1.5, y0));

        const i0 = Math.floor(x0);
        const j0 = Math.floor(y0);
        const i1 = i0 + 1;
        const j1 = j0 + 1;
        const s1 = x0 - i0;
        const s0 = 1 - s1;
        const t1 = y0 - j0;
        const t0 = 1 - t1;

        field[idx] =
          s0 * (t0 * prevField[j0 * gridSize + i0] + t1 * prevField[j1 * gridSize + i0]) +
          s1 * (t0 * prevField[j0 * gridSize + i1] + t1 * prevField[j1 * gridSize + i1]);
      }
    }
  }, []);

  const computeVorticity = useCallback((
    solver: FluidSolverState,
    gridSize: number
  ) => {
    for (let y = 1; y < gridSize - 1; y++) {
      for (let x = 1; x < gridSize - 1; x++) {
        const idx = y * gridSize + x;
        const up = (y - 1) * gridSize + x;
        const down = (y + 1) * gridSize + x;
        const left = y * gridSize + (x - 1);
        const right = y * gridSize + (x + 1);

        const dudy = (solver.velocityY[down] - solver.velocityY[up]) * 0.5;
        const dvdx = (solver.velocityX[right] - solver.velocityX[left]) * 0.5;

        solver.vorticity[idx] = dudy - dvdx;
      }
    }
  }, []);

  const updateParticles = useCallback((
    solver: FluidSolverState,
    width: number,
    height: number,
    params: SimulationParams
  ) => {
    const gridSize = params.gridResolution;
    const cellWidth = width / gridSize;
    const cellHeight = height / gridSize;
    const particleCount = params.particleCount;

    for (let i = 0; i < particleCount; i++) {
      const px = solver.particles[i * 2];
      const py = solver.particles[i * 2 + 1];

      const gx = Math.max(0, Math.min(gridSize - 1, Math.floor(px / cellWidth)));
      const gy = Math.max(0, Math.min(gridSize - 1, Math.floor(py / cellHeight)));
      const idx = gy * gridSize + gx;

      const vx = solver.velocityX[idx] * params.velocity;
      const vy = solver.velocityY[idx] * params.velocity;

      let newX = px + vx * params.timeStep * 60;
      let newY = py + vy * params.timeStep * 60;

      if (newX < 0) newX = width + newX;
      if (newX > width) newX = newX - width;
      if (newY < 0) newY = height + newY;
      if (newY > height) newY = newY - height;

      solver.particles[i * 2] = newX;
      solver.particles[i * 2 + 1] = newY;
    }
  }, []);

  const step = useCallback((
    solver: FluidSolverState,
    width: number,
    height: number,
    params: SimulationParams,
    forces: ForcePoint[]
  ) => {
    const simStart = performance.now();
    const gridSize = params.gridResolution;

    solver.prevVelX.set(solver.velocityX);
    solver.prevVelY.set(solver.velocityY);

    applyForces(solver, forces, width, height, params);

    diffuse(solver.velocityX, solver.prevVelX, params.viscosity, params.timeStep, gridSize);
    diffuse(solver.velocityY, solver.prevVelY, params.viscosity, params.timeStep, gridSize);

    solver.tempVelX.set(solver.velocityX);
    solver.tempVelY.set(solver.velocityY);

    advect(solver.velocityX, solver.tempVelX, solver.tempVelX, solver.tempVelY, params.timeStep, gridSize);
    advect(solver.velocityY, solver.tempVelY, solver.tempVelX, solver.tempVelY, params.timeStep, gridSize);

    for (let i = 0; i < solver.velocityX.length; i++) {
      solver.velocityX[i] *= params.dissipation;
      solver.velocityY[i] *= params.dissipation;
    }

    computeVorticity(solver, gridSize);
    updateParticles(solver, width, height, params);

    const simTime = performance.now() - simStart;
    return simTime;
  }, [applyForces, diffuse, advect, computeVorticity, updateParticles]);

  const render = useCallback((
    ctx: CanvasRenderingContext2D,
    solver: FluidSolverState,
    width: number,
    height: number,
    params: SimulationParams,
    visualizationMode: string
  ) => {
    const renderStart = performance.now();

    ctx.fillStyle = 'rgba(10, 14, 26, 0.15)';
    ctx.fillRect(0, 0, width, height);

    switch (visualizationMode) {
      case 'particles': {
        const particleCount = params.particleCount;
        for (let i = 0; i < particleCount; i++) {
          const x = solver.particles[i * 2];
          const y = solver.particles[i * 2 + 1];

          const gridSize = params.gridResolution;
          const cellWidth = width / gridSize;
          const cellHeight = height / gridSize;
          const gx = Math.max(0, Math.min(gridSize - 1, Math.floor(x / cellWidth)));
          const gy = Math.max(0, Math.min(gridSize - 1, Math.floor(y / cellHeight)));
          const idx = gy * gridSize + gx;

          const speed = Math.sqrt(
            solver.velocityX[idx] ** 2 + solver.velocityY[idx] ** 2
          );
          const hue = 180 + Math.min(speed * 20, 60);
          const alpha = Math.min(0.8, 0.3 + speed * 0.5);

          ctx.beginPath();
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${hue}, 80%, 60%, ${alpha})`;
          ctx.fill();
        }
        break;
      }
      case 'streamlines': {
        const gridSize = params.gridResolution;
        const cellWidth = width / gridSize;
        const cellHeight = height / gridSize;

        ctx.lineWidth = 1;
        const step = 4;

        for (let y = 0; y < gridSize; y += step) {
          for (let x = 0; x < gridSize; x += step) {
            const idx = y * gridSize + x;
            const vx = solver.velocityX[idx];
            const vy = solver.velocityY[idx];
            const speed = Math.sqrt(vx * vx + vy * vy);

            if (speed > 0.1) {
              const startX = x * cellWidth + cellWidth / 2;
              const startY = y * cellHeight + cellHeight / 2;
              const len = Math.min(speed * 10, 30);
              const endX = startX + (vx / speed) * len;
              const endY = startY + (vy / speed) * len;

              const hue = 180 + Math.min(speed * 20, 60);
              ctx.beginPath();
              ctx.moveTo(startX, startY);
              ctx.lineTo(endX, endY);
              ctx.strokeStyle = `hsla(${hue}, 80%, 60%, 0.6)`;
              ctx.stroke();
            }
          }
        }
        break;
      }
      case 'vorticity': {
        const gridSize = params.gridResolution;
        const cellWidth = width / gridSize;
        const cellHeight = height / gridSize;

        for (let y = 0; y < gridSize; y++) {
          for (let x = 0; x < gridSize; x++) {
            const idx = y * gridSize + x;
            const vort = solver.vorticity[idx];

            let hue: number;
            let alpha: number;

            if (vort > 0) {
              hue = 0;
              alpha = Math.min(0.6, Math.abs(vort) * 5);
            } else if (vort < 0) {
              hue = 240;
              alpha = Math.min(0.6, Math.abs(vort) * 5);
            } else {
              continue;
            }

            ctx.fillStyle = `hsla(${hue}, 80%, 50%, ${alpha})`;
            ctx.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
          }
        }
        break;
      }
    }

    return performance.now() - renderStart;
  }, []);

  const animate = useCallback((timestamp: number) => {
    if (!solverRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = useAppStore.getState();
    const { isSimulating, isPaused, visualizationMode, activeForces, simulationParams } = state;

    if (isSimulating && !isPaused) {
      const simTime = step(solverRef.current, canvas.width, canvas.height, simulationParams, activeForces);
      const renderTime = render(ctx, solverRef.current, canvas.width, canvas.height, simulationParams, visualizationMode);

      updatePerformanceStats({
        simulationTime: simTime,
        renderTime,
        particleCount: simulationParams.particleCount,
      });

      frameCountRef.current++;
      if (timestamp - fpsTimeRef.current >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / (timestamp - fpsTimeRef.current));
        addFpsSample(fps);
        frameCountRef.current = 0;
        fpsTimeRef.current = timestamp;

        if ((performance as any).memory) {
          updatePerformanceStats({
            memory: (performance as any).memory.usedJSHeapSize / 1048576,
          });
        }
      }
    }

    lastTimeRef.current = timestamp;
    animationRef.current = requestAnimationFrame(animate);
  }, [canvasRef, step, render, updatePerformanceStats, addFpsSample]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const params = useAppStore.getState().simulationParams;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      initSolver(canvas.width, canvas.height, params);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [canvasRef, initSolver]);

  useEffect(() => {
    if (isSimulating) {
      fpsTimeRef.current = performance.now();
      frameCountRef.current = 0;
      animationRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(animationRef.current);
    }

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [isSimulating, animate]);

  const start = useCallback(() => {
    setIsSimulating(true);
  }, [setIsSimulating]);

  const stop = useCallback(() => {
    setIsSimulating(false);
  }, [setIsSimulating]);

  const reset = useCallback(() => {
    if (!canvasRef.current) return;
    const params = useAppStore.getState().simulationParams;
    initSolver(canvasRef.current.width, canvasRef.current.height, params);
  }, [canvasRef, initSolver]);

  return {
    solver: solverRef.current,
    start,
    stop,
    reset,
  };
};
