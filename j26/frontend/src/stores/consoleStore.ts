import { create } from 'zustand';
import type { ConsoleOutput } from '@/types/debugger';

interface ConsoleState {
  outputs: ConsoleOutput[];
  isVisible: boolean;
  isLoading: boolean;
  addOutput: (type: ConsoleOutput['type'], content: string) => void;
  clearOutputs: () => void;
  toggleVisible: () => void;
  setLoading: (loading: boolean) => void;
}

export const useConsoleStore = create<ConsoleState>((set) => ({
  outputs: [],
  isVisible: true,
  isLoading: false,

  addOutput: (type, content) => {
    set((state) => ({
      outputs: [
        ...state.outputs,
        {
          id: `output-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type,
          content,
          timestamp: Date.now(),
        },
      ],
    }));
  },

  clearOutputs: () => set({ outputs: [] }),

  toggleVisible: () => set((state) => ({ isVisible: !state.isVisible })),

  setLoading: (isLoading) => set({ isLoading }),
}));
