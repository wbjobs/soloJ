export interface FluidParamsRequest {
  gridSize?: number;
  viscosity?: number;
  density?: number;
}

export interface FluidParamsResponse {
  success: boolean;
  data: {
    gridSize: number;
    viscosity: number;
    baseDensity: number;
    damping: number;
    timeStep: number;
    densityGrid: number[];
    velocityField: {
      x: number[];
      y: number[];
      z: number[];
    };
    viscosityField: number[];
    boundaries: {
      min: [number, number, number];
      max: [number, number, number];
    };
  };
  timestamp: number;
}

export interface ParticleData {
  positions: Float32Array;
  velocities: Float32Array;
  colors: Float32Array;
  count: number;
}

export interface InteractionState {
  isMouseDown: boolean;
  mousePosition: [number, number, number];
  lastMousePosition: [number, number, number];
  forceStrength: number;
  forceRadius: number;
}

export interface SimulationConfig {
  viscosity: number;
  density: number;
  damping: number;
  timeStep: number;
  isRunning: boolean;
}

export interface ForceApplication {
  position: [number, number, number];
  direction: [number, number, number];
  strength: number;
  radius: number;
  type: 'impulse' | 'continuous';
  createdAt: number;
  frameNumber?: number;
}

export interface ForceDataBatch {
  sessionId: string;
  startTime: number;
  endTime: number;
  forceCount: number;
  forces: ForceApplication[];
  simulationConfig: SimulationConfig;
  gridSize: number;
}

export interface ForceDataResponse {
  success: boolean;
  message: string;
  storedCount: number;
  filename?: string;
}

export interface VideoUploadResponse {
  success: boolean;
  message: string;
  filename: string;
  size: number;
  duration: number;
}

export type RecordingState = 'idle' | 'recording' | 'uploading' | 'processing' | 'done' | 'error';
