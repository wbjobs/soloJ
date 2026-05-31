import { create } from 'zustand';
import type { AdjointConfig, AdjointStats, TargetPatternType } from '../engine/AdjointSolver';
import type { LCSConfig, LCSStats } from '../engine/LCSSolver';

export type VisualizationMode = 'particles' | 'streamlines' | 'vorticity' | 'ftle_forward' | 'ftle_backward' | 'lcs_ridges';
export type ForceFieldType = 'attract' | 'repel' | 'vortex';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type HandGesture = 'fist' | 'open' | 'rotate' | 'none';
export type AdjointStatus = 'idle' | 'running' | 'converged' | 'error';

export interface SimulationParams {
  viscosity: number;
  velocity: number;
  vorticity: number;
  dissipation: number;
  particleCount: number;
  gridResolution: number;
  timeStep: number;
}

export interface User {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
}

export interface Room {
  id: string;
  name: string;
  userCount: number;
  maxUsers: number;
  hasPassword: boolean;
}

export interface PerformanceStats {
  fps: number;
  fpsHistory: number[];
  simulationTime: number;
  renderTime: number;
  memory: number;
  particleCount: number;
}

export interface ForcePoint {
  x: number;
  y: number;
  type: ForceFieldType;
  strength: number;
  radius: number;
  userId?: string;
  timestamp: number;
}

export interface HandTrackingState {
  enabled: boolean;
  initialized: boolean;
  cameraActive: boolean;
  gesture: HandGesture;
  fingerPosition: { x: number; y: number } | null;
  handLandmarks: any | null;
}

interface AppState {
  simulationParams: SimulationParams;
  visualizationMode: VisualizationMode;
  forceFieldType: ForceFieldType;
  forceStrength: number;
  forceRadius: number;
  isSimulating: boolean;
  isPaused: boolean;
  connectionStatus: ConnectionStatus;
  currentRoom: Room | null;
  currentUser: User | null;
  users: User[];
  rooms: Room[];
  performanceStats: PerformanceStats;
  handTracking: HandTrackingState;
  activeForces: ForcePoint[];
  showExportPanel: boolean;
  showPerformancePanel: boolean;

  adjointConfig: AdjointConfig;
  adjointStats: AdjointStats;
  adjointStatus: AdjointStatus;
  targetPattern: TargetPatternType;
  showAdjointPanel: boolean;

  lcsConfig: LCSConfig;
  lcsStats: LCSStats;
  lcsEnabled: boolean;
  showLCSPanel: boolean;

  setSimulationParams: (params: Partial<SimulationParams>) => void;
  setVisualizationMode: (mode: VisualizationMode) => void;
  setForceFieldType: (type: ForceFieldType) => void;
  setForceStrength: (strength: number) => void;
  setForceRadius: (radius: number) => void;
  setIsSimulating: (simulating: boolean) => void;
  setIsPaused: (paused: boolean) => void;
  toggleSimulation: () => void;
  togglePause: () => void;

  setConnectionStatus: (status: ConnectionStatus) => void;
  setCurrentRoom: (room: Room | null) => void;
  setCurrentUser: (user: User | null) => void;
  setUsers: (users: User[]) => void;
  setRooms: (rooms: Room[]) => void;
  addUser: (user: User) => void;
  removeUser: (userId: string) => void;

  updatePerformanceStats: (stats: Partial<PerformanceStats>) => void;
  addFpsSample: (fps: number) => void;

  setHandTrackingEnabled: (enabled: boolean) => void;
  setHandTrackingInitialized: (initialized: boolean) => void;
  setCameraActive: (active: boolean) => void;
  setGesture: (gesture: HandGesture) => void;
  setFingerPosition: (pos: { x: number; y: number } | null) => void;
  setHandLandmarks: (landmarks: any | null) => void;

  addForcePoint: (force: ForcePoint) => void;
  removeForcePoint: (timestamp: number) => void;
  clearForcePoints: () => void;

  setShowExportPanel: (show: boolean) => void;
  setShowPerformancePanel: (show: boolean) => void;
  resetSimulation: () => void;

  setAdjointConfig: (config: Partial<AdjointConfig>) => void;
  setAdjointStats: (stats: Partial<AdjointStats>) => void;
  setAdjointStatus: (status: AdjointStatus) => void;
  setTargetPattern: (pattern: TargetPatternType) => void;
  setShowAdjointPanel: (show: boolean) => void;

  setLCSConfig: (config: Partial<LCSConfig>) => void;
  setLCSStats: (stats: Partial<LCSStats>) => void;
  setLCSEnabled: (enabled: boolean) => void;
  setShowLCSPanel: (show: boolean) => void;
}

const DEFAULT_PARAMS: SimulationParams = {
  viscosity: 0.001,
  velocity: 1.0,
  vorticity: 0.5,
  dissipation: 0.98,
  particleCount: 5000,
  gridResolution: 128,
  timeStep: 0.016,
};

const DEFAULT_PERFORMANCE: PerformanceStats = {
  fps: 60,
  fpsHistory: [],
  simulationTime: 0,
  renderTime: 0,
  memory: 0,
  particleCount: 5000,
};

const DEFAULT_HAND_TRACKING: HandTrackingState = {
  enabled: false,
  initialized: false,
  cameraActive: false,
  gesture: 'none',
  fingerPosition: null,
  handLandmarks: null,
};

const DEFAULT_ADJOINT_CONFIG: AdjointConfig = {
  learningRate: 0.001,
  maxIterations: 50,
  convergenceThreshold: 1e-4,
  integrationSteps: 30,
  integrationTime: 0.5,
};

const DEFAULT_ADJOINT_STATS: AdjointStats = {
  iteration: 0,
  cost: Infinity,
  costHistory: [],
  converged: false,
  progress: 0,
};

const DEFAULT_LCS_CONFIG: LCSConfig = {
  integrationTime: 2.0,
  integrationSteps: 40,
  ftleThreshold: 0.1,
  ridgeThreshold: 5.0,
  computeBackwardFTLE: true,
};

const DEFAULT_LCS_STATS: LCSStats = {
  forwardFTLEMax: 0,
  backwardFTLEMax: 0,
  computationTime: 0,
};

export const useAppStore = create<AppState>((set, get) => ({
  simulationParams: DEFAULT_PARAMS,
  visualizationMode: 'particles',
  forceFieldType: 'attract',
  forceStrength: 50,
  forceRadius: 100,
  isSimulating: false,
  isPaused: false,
  connectionStatus: 'disconnected',
  currentRoom: null,
  currentUser: null,
  users: [],
  rooms: [],
  performanceStats: DEFAULT_PERFORMANCE,
  handTracking: DEFAULT_HAND_TRACKING,
  activeForces: [],
  showExportPanel: false,
  showPerformancePanel: true,

  adjointConfig: DEFAULT_ADJOINT_CONFIG,
  adjointStats: DEFAULT_ADJOINT_STATS,
  adjointStatus: 'idle',
  targetPattern: 'vortex_pair',
  showAdjointPanel: false,

  lcsConfig: DEFAULT_LCS_CONFIG,
  lcsStats: DEFAULT_LCS_STATS,
  lcsEnabled: false,
  showLCSPanel: false,

  setSimulationParams: (params) =>
    set((state) => ({
      simulationParams: { ...state.simulationParams, ...params },
    })),

  setVisualizationMode: (mode) => set({ visualizationMode: mode }),
  setForceFieldType: (type) => set({ forceFieldType: type }),
  setForceStrength: (strength) => set({ forceStrength: strength }),
  setForceRadius: (radius) => set({ forceRadius: radius }),
  setIsSimulating: (simulating) => set({ isSimulating: simulating }),
  setIsPaused: (paused) => set({ isPaused: paused }),
  toggleSimulation: () =>
    set((state) => ({ isSimulating: !state.isSimulating })),
  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),

  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setCurrentRoom: (room) => set({ currentRoom: room }),
  setCurrentUser: (user) => set({ currentUser: user }),
  setUsers: (users) => set({ users }),
  setRooms: (rooms) => set({ rooms }),
  addUser: (user) =>
    set((state) => ({ users: [...state.users.filter((u) => u.id !== user.id), user] })),
  removeUser: (userId) =>
    set((state) => ({ users: state.users.filter((u) => u.id !== userId) })),

  updatePerformanceStats: (stats) =>
    set((state) => ({
      performanceStats: { ...state.performanceStats, ...stats },
    })),

  addFpsSample: (fps) =>
    set((state) => {
      const history = [...state.performanceStats.fpsHistory, fps].slice(-60);
      return {
        performanceStats: {
          ...state.performanceStats,
          fps,
          fpsHistory: history,
        },
      };
    }),

  setHandTrackingEnabled: (enabled) =>
    set((state) => ({ handTracking: { ...state.handTracking, enabled } })),
  setHandTrackingInitialized: (initialized) =>
    set((state) => ({ handTracking: { ...state.handTracking, initialized } })),
  setCameraActive: (active) =>
    set((state) => ({ handTracking: { ...state.handTracking, cameraActive: active } })),
  setGesture: (gesture) =>
    set((state) => ({ handTracking: { ...state.handTracking, gesture } })),
  setFingerPosition: (pos) =>
    set((state) => ({ handTracking: { ...state.handTracking, fingerPosition: pos } })),
  setHandLandmarks: (landmarks) =>
    set((state) => ({ handTracking: { ...state.handTracking, handLandmarks: landmarks } })),

  addForcePoint: (force) =>
    set((state) => ({ activeForces: [...state.activeForces, force] })),
  removeForcePoint: (timestamp) =>
    set((state) => ({
      activeForces: state.activeForces.filter((f) => f.timestamp !== timestamp),
    })),
  clearForcePoints: () => set({ activeForces: [] }),

  setShowExportPanel: (show) => set({ showExportPanel: show }),
  setShowPerformancePanel: (show) => set({ showPerformancePanel: show }),

  resetSimulation: () =>
    set({
      simulationParams: DEFAULT_PARAMS,
      isPaused: false,
      activeForces: [],
      performanceStats: DEFAULT_PERFORMANCE,
      adjointStats: DEFAULT_ADJOINT_STATS,
      adjointStatus: 'idle',
      lcsStats: DEFAULT_LCS_STATS,
    }),

  setAdjointConfig: (config) =>
    set((state) => ({
      adjointConfig: { ...state.adjointConfig, ...config },
    })),

  setAdjointStats: (stats) =>
    set((state) => ({
      adjointStats: { ...state.adjointStats, ...stats },
    })),

  setAdjointStatus: (status) => set({ adjointStatus: status }),
  setTargetPattern: (pattern) => set({ targetPattern: pattern }),
  setShowAdjointPanel: (show) => set({ showAdjointPanel: show }),

  setLCSConfig: (config) =>
    set((state) => ({
      lcsConfig: { ...state.lcsConfig, ...config },
    })),

  setLCSStats: (stats) =>
    set((state) => ({
      lcsStats: { ...state.lcsStats, ...stats },
    })),

  setLCSEnabled: (enabled) => set({ lcsEnabled: enabled }),
  setShowLCSPanel: (show) => set({ showLCSPanel: show }),
}));

export type { AdjointConfig, AdjointStats, TargetPatternType };
export type { LCSConfig, LCSStats };
