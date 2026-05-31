import { create } from 'zustand';
import type { LineProfile, FunctionProfile, FlameGraphNode, PerformanceReport } from '@/types/debugger';

interface ProfilerState {
  isProfiling: boolean;
  lineProfiles: LineProfile[];
  functionProfiles: FunctionProfile[];
  flameGraph: FlameGraphNode | null;
  totalExecutionTime: number;
  selectedLine: number | null;
  showFlameGraph: boolean;
  
  startProfiling: () => void;
  stopProfiling: () => void;
  setProfiles: (lineProfiles: LineProfile[], functionProfiles: FunctionProfile[], flameGraph: FlameGraphNode, totalTime: number) => void;
  setSelectedLine: (line: number | null) => void;
  setShowFlameGraph: (show: boolean) => void;
  exportReport: (fileName: string, code: string) => PerformanceReport;
  clear: () => void;
}

export const useProfilerStore = create<ProfilerState>((set, get) => ({
  isProfiling: false,
  lineProfiles: [],
  functionProfiles: [],
  flameGraph: null,
  totalExecutionTime: 0,
  selectedLine: null,
  showFlameGraph: false,

  startProfiling: () => set({ isProfiling: true }),
  
  stopProfiling: () => set({ isProfiling: false }),
  
  setProfiles: (lineProfiles, functionProfiles, flameGraph, totalTime) => set({
    lineProfiles,
    functionProfiles,
    flameGraph,
    totalExecutionTime: totalTime,
    isProfiling: false,
  }),
  
  setSelectedLine: (line) => set({ selectedLine: line }),
  
  setShowFlameGraph: (show) => set({ showFlameGraph: show }),
  
  exportReport: (fileName, code) => {
    const { lineProfiles, functionProfiles, flameGraph, totalExecutionTime } = get();
    
    const report: PerformanceReport = {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      totalExecutionTime,
      lineProfiles,
      functionProfiles,
      flameGraph: flameGraph || { name: 'root', value: 0, children: [] },
      metadata: {
        codeLength: code.length,
        fileName,
        pyodideVersion: '0.25.0',
      },
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    return report;
  },
  
  clear: () => set({
    lineProfiles: [],
    functionProfiles: [],
    flameGraph: null,
    totalExecutionTime: 0,
    selectedLine: null,
    isProfiling: false,
  }),
}));
