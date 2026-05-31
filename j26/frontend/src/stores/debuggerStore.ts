import { create } from 'zustand';
import type { DebugState, Variable, StackFrame, DebugEvent } from '@/types/debugger';

interface DebuggerState {
  state: DebugState;
  currentLine: number | null;
  locals: Variable[];
  globals: Variable[];
  callStack: StackFrame[];
  selectedFrameIndex: number;
  expandedVariables: Set<string>;
  setState: (state: DebugState) => void;
  setCurrentLine: (line: number | null) => void;
  setLocals: (variables: Variable[]) => void;
  setGlobals: (variables: Variable[]) => void;
  setCallStack: (stack: StackFrame[]) => void;
  setSelectedFrameIndex: (index: number) => void;
  toggleVariableExpand: (path: string) => void;
  handleDebugEvent: (event: DebugEvent) => void;
  reset: () => void;
}

const initialState: Omit<DebuggerState, keyof { [K in keyof DebuggerState as DebuggerState[K] extends Function ? K : never]: DebuggerState[K] }> = {
  state: 'uninitialized',
  currentLine: null,
  locals: [],
  globals: [],
  callStack: [],
  selectedFrameIndex: 0,
  expandedVariables: new Set(),
};

export const useDebuggerStore = create<DebuggerState>((set) => ({
  ...initialState,

  setState: (state) => set({ state }),

  setCurrentLine: (currentLine) => set({ currentLine }),

  setLocals: (locals) => set({ locals }),

  setGlobals: (globals) => set({ globals }),

  setCallStack: (callStack) => set({ callStack }),

  setSelectedFrameIndex: (selectedFrameIndex) => set({ selectedFrameIndex }),

  toggleVariableExpand: (path) => {
    set((state) => {
      const newExpanded = new Set(state.expandedVariables);
      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }
      return { expandedVariables: newExpanded };
    });
  },

  handleDebugEvent: (event) => {
    switch (event.type) {
      case 'started':
        set({ state: 'running' });
        break;
      case 'paused':
        set({
          state: 'paused',
          currentLine: event.data?.line ?? null,
          locals: event.data?.locals ?? [],
          globals: event.data?.globals ?? [],
          callStack: event.data?.callStack ?? [],
        });
        break;
      case 'resumed':
        set({ state: 'running' });
        break;
      case 'step':
        set({
          currentLine: event.data?.line ?? null,
          locals: event.data?.locals ?? [],
          globals: event.data?.globals ?? [],
          callStack: event.data?.callStack ?? [],
        });
        break;
      case 'exception':
        set({
          state: 'error',
          currentLine: event.data?.line ?? null,
        });
        break;
      case 'terminated':
        set({
          state: 'stopped',
          currentLine: null,
        });
        break;
    }
  },

  reset: () => set(initialState),
}));
