import { create } from 'zustand'

export const useStore = create((set, get) => ({
  apiBase: 'http://localhost:8000/api',
  
  pointclouds: [],
  currentPointcloud: null,
  pointcloudData: null,
  offsets: { x: 0, y: 0, z: 0 },
  
  isSelectionMode: false,
  selectionStart: null,
  selectionEnd: null,
  selectionBox: null,
  
  stats: null,
  savedSelections: [],
  
  loading: false,
  error: null,
  
  pointSize: 2.0,
  colorMode: 'height',
  
  classificationRules: [],
  visibleClasses: new Set(),
  classificationStats: null,
  
  setApiBase: (apiBase) => set({ apiBase }),
  setPointSize: (pointSize) => set({ pointSize }),
  setColorMode: (colorMode) => set({ colorMode }),
  setClassificationRules: (classificationRules) => {
    const visibleClasses = new Set(classificationRules.map(r => r.class_id))
    set({ classificationRules, visibleClasses })
  },
  toggleClassVisibility: (classId) => set((state) => {
    const visibleClasses = new Set(state.visibleClasses)
    if (visibleClasses.has(classId)) {
      visibleClasses.delete(classId)
    } else {
      visibleClasses.add(classId)
    }
    return { visibleClasses }
  }),
  setClassificationStats: (classificationStats) => set({ classificationStats }),
  setVisibleClasses: (visibleClasses) => set({ visibleClasses }),
  setPointclouds: (pointclouds) => set({ pointclouds }),
  setCurrentPointcloud: (currentPointcloud) => set({ currentPointcloud }),
  setPointcloudData: (pointcloudData) => set({ pointcloudData }),
  setOffsets: (offsets) => set({ offsets }),
  
  setSelectionMode: (isSelectionMode) => set({ 
    isSelectionMode,
    selectionStart: null,
    selectionEnd: null,
    selectionBox: null,
    stats: null,
  }),
  setSelectionStart: (selectionStart) => set({ selectionStart }),
  setSelectionEnd: (selectionEnd) => set({ selectionEnd }),
  setSelectionBox: (selectionBox) => set({ selectionBox }),
  
  setStats: (stats) => set({ stats }),
  setSavedSelections: (savedSelections) => set({ savedSelections }),
  
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  
  clearSelection: () => set({
    selectionStart: null,
    selectionEnd: null,
    selectionBox: null,
    stats: null,
  }),
}))
