import { create } from 'zustand'

export interface PointCloudData {
  positions: Float32Array
  colors: Float32Array | null
  normals: Float32Array | null
  boundingBox: { min: [number, number, number]; max: [number, number, number] }
  pointCount: number
}

export type ColorMode = 'original' | 'height' | 'distance'

interface PointCloudState {
  isLoading: boolean
  fileName: string | null
  pointCloudData: PointCloudData | null
  selectionMode: boolean
  selectionBox: { min: [number, number, number]; max: [number, number, number] } | null
  selectedPointIndices: Uint8Array | null
  selectedPointCount: number
  pointSize: number
  colorMode: ColorMode
  cameraResetTrigger: number
  isDownloading: boolean

  setIsLoading: (v: boolean) => void
  setFileName: (v: string | null) => void
  setPointCloudData: (v: PointCloudData | null) => void
  setSelectionMode: (v: boolean) => void
  setSelectionBox: (v: PointCloudState['selectionBox']) => void
  setSelectedPointIndices: (v: Uint8Array | null) => void
  setSelectedPointCount: (v: number) => void
  setPointSize: (v: number) => void
  setColorMode: (v: ColorMode) => void
  triggerCameraReset: () => void
  setIsDownloading: (v: boolean) => void
  reset: () => void
}

const initialState = {
  isLoading: false,
  fileName: null,
  pointCloudData: null,
  selectionMode: false,
  selectionBox: null,
  selectedPointIndices: null,
  selectedPointCount: 0,
  pointSize: 2,
  colorMode: 'original' as ColorMode,
  cameraResetTrigger: 0,
  isDownloading: false,
}

export const usePointCloudStore = create<PointCloudState>((set) => ({
  ...initialState,

  setIsLoading: (v) => set({ isLoading: v }),
  setFileName: (v) => set({ fileName: v }),
  setPointCloudData: (v) => set({ pointCloudData: v }),
  setSelectionMode: (v) => set({ selectionMode: v, selectionBox: null, selectedPointIndices: null, selectedPointCount: 0 }),
  setSelectionBox: (v) => set({ selectionBox: v }),
  setSelectedPointIndices: (v) => set({ selectedPointIndices: v }),
  setSelectedPointCount: (v) => set({ selectedPointCount: v }),
  setPointSize: (v) => set({ pointSize: v }),
  setColorMode: (v) => set({ colorMode: v }),
  triggerCameraReset: () => set((s) => ({ cameraResetTrigger: s.cameraResetTrigger + 1 })),
  setIsDownloading: (v) => set({ isDownloading: v }),
  reset: () => set(initialState),
}))
