import { useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import type {
  FluidParamsResponse,
  ParticleData,
  SimulationConfig,
  ForceApplication,
  ForceDataBatch,
} from '@/types/fluid';
import { uploadForceData } from '@/services/api';

const PARTICLE_COUNT = 8000;
const BOUNDARY_MIN = new THREE.Vector3(-8, -8, -8);
const BOUNDARY_MAX = new THREE.Vector3(8, 8, 8);

export function useFluidSimulation() {
  const [params, setParams] = useState<FluidParamsResponse | null>(null);
  const [config, setConfig] = useState<SimulationConfig>({
    viscosity: 0.0001,
    density: 1.0,
    damping: 0.995,
    timeStep: 0.016,
    isRunning: true,
  });

  const particlesRef = useRef<ParticleData>({
    positions: new Float32Array(PARTICLE_COUNT * 3),
    velocities: new Float32Array(PARTICLE_COUNT * 3),
    colors: new Float32Array(PARTICLE_COUNT * 3),
    count: PARTICLE_COUNT,
  });

  const pendingForcesRef = useRef<ForceApplication[]>([]);
  const forceHistoryRef = useRef<ForceApplication[]>([]);
  const frameCountRef = useRef<number>(0);
  const sessionStartTimeRef = useRef<number>(Date.now());
  const sessionIdRef = useRef<string>('');

  const initParticles = useCallback((fluidParams: FluidParamsResponse) => {
    const { positions, velocities, colors } = particlesRef.current;
    const { boundaries } = fluidParams.data;
    const rangeX = boundaries.max[0] - boundaries.min[0];
    const rangeY = boundaries.max[1] - boundaries.min[1];
    const rangeZ = boundaries.max[2] - boundaries.min[2];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = Math.cbrt(Math.random()) * 6;
      
      positions[i3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = r * Math.cos(phi);
      
      const speed = 0.5;
      velocities[i3] = (Math.random() - 0.5) * speed;
      velocities[i3 + 1] = (Math.random() - 0.5) * speed;
      velocities[i3 + 2] = (Math.random() - 0.5) * speed;
      
      const hue = (i / PARTICLE_COUNT) * 0.3 + 0.45;
      const [rCol, gCol, bCol] = hslToRgb(hue, 0.8, 0.6);
      colors[i3] = rCol;
      colors[i3 + 1] = gCol;
      colors[i3 + 2] = bCol;
    }

    setParams(fluidParams);
    setConfig({
      viscosity: fluidParams.data.viscosity,
      density: fluidParams.data.baseDensity,
      damping: fluidParams.data.damping,
      timeStep: fluidParams.data.timeStep,
      isRunning: true,
    });

    forceHistoryRef.current = [];
    frameCountRef.current = 0;
    sessionStartTimeRef.current = Date.now();
    sessionIdRef.current = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return [r, g, b];
  };

  const sampleVelocityField = useCallback((pos: THREE.Vector3): THREE.Vector3 => {
    if (!params) return new THREE.Vector3(0, 0, 0);
    
    const { gridSize, velocityField } = params.data;
    const { min, max } = params.data.boundaries;
    
    const rangeX = max[0] - min[0];
    const rangeY = max[1] - min[1];
    const rangeZ = max[2] - min[2];
    
    if (rangeX === 0 || rangeY === 0 || rangeZ === 0) {
      return new THREE.Vector3(0, 0, 0);
    }
    
    const u = ((pos.x - min[0]) / rangeX) * (gridSize - 1);
    const v = ((pos.y - min[1]) / rangeY) * (gridSize - 1);
    const w = ((pos.z - min[2]) / rangeZ) * (gridSize - 1);
    
    const i = Math.floor(u);
    const j = Math.floor(v);
    const k = Math.floor(w);
    
    if (i < 0 || i >= gridSize - 1 || j < 0 || j >= gridSize - 1 || k < 0 || k >= gridSize - 1) {
      return new THREE.Vector3(0, 0, 0);
    }
    
    const fx = u - i;
    const fy = v - j;
    const fz = w - k;
    
    const idx000 = k * gridSize * gridSize + j * gridSize + i;
    const idx100 = idx000 + 1;
    const idx010 = idx000 + gridSize;
    const idx110 = idx010 + 1;
    const idx001 = idx000 + gridSize * gridSize;
    const idx101 = idx001 + 1;
    const idx011 = idx001 + gridSize;
    const idx111 = idx011 + 1;
    
    const vx = trilinearInterpolation(
      velocityField.x[idx000], velocityField.x[idx100],
      velocityField.x[idx010], velocityField.x[idx110],
      velocityField.x[idx001], velocityField.x[idx101],
      velocityField.x[idx011], velocityField.x[idx111],
      fx, fy, fz
    );
    
    const vy = trilinearInterpolation(
      velocityField.y[idx000], velocityField.y[idx100],
      velocityField.y[idx010], velocityField.y[idx110],
      velocityField.y[idx001], velocityField.y[idx101],
      velocityField.y[idx011], velocityField.y[idx111],
      fx, fy, fz
    );
    
    const vz = trilinearInterpolation(
      velocityField.z[idx000], velocityField.z[idx100],
      velocityField.z[idx010], velocityField.z[idx110],
      velocityField.z[idx001], velocityField.z[idx101],
      velocityField.z[idx011], velocityField.z[idx111],
      fx, fy, fz
    );
    
    return new THREE.Vector3(vx, vy, vz);
  }, [params]);

  const trilinearInterpolation = (
    v000: number, v100: number, v010: number, v110: number,
    v001: number, v101: number, v011: number, v111: number,
    fx: number, fy: number, fz: number
  ): number => {
    const x00 = v000 * (1 - fx) + v100 * fx;
    const x10 = v010 * (1 - fx) + v110 * fx;
    const x01 = v001 * (1 - fx) + v101 * fx;
    const x11 = v011 * (1 - fx) + v111 * fx;
    
    const y0 = x00 * (1 - fy) + x10 * fy;
    const y1 = x01 * (1 - fy) + x11 * fy;
    
    return y0 * (1 - fz) + y1 * fz;
  };

  const applyForce = useCallback((force: ForceApplication) => {
    const forceWithFrame = { ...force, frameNumber: frameCountRef.current };
    pendingForcesRef.current.push(forceWithFrame);
    forceHistoryRef.current.push(forceWithFrame);
  }, []);

  const updateParticles = useCallback((deltaTime: number) => {
    if (!config.isRunning) return;
    
    const { positions, velocities, colors } = particlesRef.current;
    const { damping, timeStep, viscosity } = config;
    const dt = Math.min(deltaTime, 0.033) / timeStep * 0.016;
    
    const forces = pendingForcesRef.current;
    pendingForcesRef.current = [];
    
    const tempPos = new THREE.Vector3();
    const tempVel = new THREE.Vector3();
    const forceVec = new THREE.Vector3();
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      
      tempPos.set(positions[i3], positions[i3 + 1], positions[i3 + 2]);
      tempVel.set(velocities[i3], velocities[i3 + 1], velocities[i3 + 2]);
      
      const fieldVel = sampleVelocityField(tempPos);
      tempVel.add(fieldVel.multiplyScalar(dt * 0.1));
      
      for (const force of forces) {
        const dx = tempPos.x - force.position[0];
        const dy = tempPos.y - force.position[1];
        const dz = tempPos.z - force.position[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        if (dist < force.radius) {
          const falloff = 1.0 - dist / force.radius;
          const strength = force.strength * falloff * falloff;
          
          if (force.type === 'impulse') {
            forceVec.set(dx, dy, dz).normalize().multiplyScalar(strength);
          } else {
            forceVec.set(force.direction[0], force.direction[1], force.direction[2]).multiplyScalar(strength);
          }
          tempVel.add(forceVec.multiplyScalar(dt));
        }
      }
      
      tempVel.multiplyScalar(Math.pow(damping, dt * 60));
      
      const viscForce = tempVel.clone().multiplyScalar(-viscosity * 1000);
      tempVel.add(viscForce.multiplyScalar(dt));
      
      tempPos.add(tempVel.clone().multiplyScalar(dt));
      
      const bounds = params?.data.boundaries || { min: [-8, -8, -8], max: [8, 8, 8] };
      for (let dim = 0; dim < 3; dim++) {
        const min = bounds.min[dim];
        const max = bounds.max[dim];
        const velComp = tempVel.getComponent(dim);
        const posComp = tempPos.getComponent(dim);
        
        if (posComp < min) {
          tempPos.setComponent(dim, min);
          tempVel.setComponent(dim, Math.abs(velComp) * 0.5);
        } else if (posComp > max) {
          tempPos.setComponent(dim, max);
          tempVel.setComponent(dim, -Math.abs(velComp) * 0.5);
        }
      }
      
      positions[i3] = tempPos.x;
      positions[i3 + 1] = tempPos.y;
      positions[i3 + 2] = tempPos.z;
      
      velocities[i3] = tempVel.x;
      velocities[i3 + 1] = tempVel.y;
      velocities[i3 + 2] = tempVel.z;
      
      const speed = tempVel.length();
      const speedNorm = Math.min(speed / 3.0, 1.0);
      const hue = 0.45 + speedNorm * 0.35;
      const [r, g, b] = hslToRgb(hue, 0.8, 0.4 + speedNorm * 0.4);
      colors[i3] = r;
      colors[i3 + 1] = g;
      colors[i3 + 2] = b;
    }
    
    frameCountRef.current++;
  }, [config, params, sampleVelocityField]);

  const resetParticles = useCallback(() => {
    if (params) {
      initParticles(params);
    }
  }, [params, initParticles]);

  const updateConfig = useCallback((updates: Partial<SimulationConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const getForceData = useCallback((): ForceDataBatch => {
    return {
      sessionId: sessionIdRef.current,
      startTime: sessionStartTimeRef.current,
      endTime: Date.now(),
      forceCount: forceHistoryRef.current.length,
      forces: [...forceHistoryRef.current],
      simulationConfig: config,
      gridSize: params?.data.gridSize || 32,
    };
  }, [config, params]);

  const exportForceData = useCallback(async () => {
    const data = getForceData();
    try {
      const result = await uploadForceData(data);
      return result;
    } catch (error) {
      console.error('Failed to export force data:', error);
      throw error;
    }
  }, [getForceData]);

  const getForceCount = useCallback(() => forceHistoryRef.current.length, []);

  return {
    particles: particlesRef,
    params,
    config,
    initParticles,
    updateParticles,
    applyForce,
    resetParticles,
    updateConfig,
    exportForceData,
    getForceData,
    getForceCount,
    particleCount: PARTICLE_COUNT,
    boundaryMin: BOUNDARY_MIN,
    boundaryMax: BOUNDARY_MAX,
    sessionId: sessionIdRef.current,
  };
}
