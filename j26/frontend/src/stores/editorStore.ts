import { create } from 'zustand';
import type { Breakpoint } from '@/types/debugger';

interface EditorState {
  code: string;
  fileName: string;
  breakpoints: Breakpoint[];
  currentLine: number | null;
  theme: 'vs-dark' | 'light';
  setCode: (code: string) => void;
  setFileName: (name: string) => void;
  addBreakpoint: (lineNumber: number, condition?: string) => void;
  removeBreakpoint: (lineNumber: number) => void;
  toggleBreakpoint: (lineNumber: number) => void;
  updateBreakpointCondition: (lineNumber: number, condition: string | undefined) => void;
  setCurrentLine: (line: number | null) => void;
  setTheme: (theme: 'vs-dark' | 'light') => void;
  clearBreakpoints: () => void;
}

const DEFAULT_CODE = `# Python WASM Debugger
# Welcome to the browser-based Python debugger!

import math
import json

def calculate_factorial(n):
    """Calculate factorial of a number"""
    result = 1
    for i in range(1, n + 1):
        result *= i
    return result

def process_data(data):
    """Process and analyze data"""
    total = sum(data)
    average = total / len(data)
    squared_sum = sum(x ** 2 for x in data)
    variance = squared_sum / len(data) - average ** 2
    std_dev = math.sqrt(variance)
    
    return {
        'total': total,
        'average': average,
        'std_dev': std_dev,
        'count': len(data)
    }

# Main execution
numbers = [2, 4, 6, 8, 10, 12]
print("Processing numbers:", numbers)

stats = process_data(numbers)
print("\nStatistics:")
for key, value in stats.items():
    print(f"  {key}: {value}")

# Test factorial
print("\nFactorial calculations:")
for n in range(1, 6):
    fact = calculate_factorial(n)
    print(f"  {n}! = {fact}")

# JSON serialization
data_json = json.dumps(stats, indent=2)
print("\nJSON output:")
print(data_json)
`;

export const useEditorStore = create<EditorState>((set, get) => ({
  code: DEFAULT_CODE,
  fileName: 'main.py',
  breakpoints: [],
  currentLine: null,
  theme: 'vs-dark',

  setCode: (code) => set({ code }),

  setFileName: (fileName) => set({ fileName }),

  addBreakpoint: (lineNumber, condition) => {
    const { breakpoints, fileName } = get();
    const exists = breakpoints.find(bp => bp.lineNumber === lineNumber);
    if (!exists) {
      set({
        breakpoints: [
          ...breakpoints,
          {
            id: `bp-${lineNumber}-${Date.now()}`,
            lineNumber,
            enabled: true,
            fileName,
            isConditional: !!condition,
            condition,
          },
        ],
      });
    }
  },

  removeBreakpoint: (lineNumber) => {
    set((state) => ({
      breakpoints: state.breakpoints.filter(bp => bp.lineNumber !== lineNumber),
    }));
  },

  toggleBreakpoint: (lineNumber) => {
    const { breakpoints } = get();
    const exists = breakpoints.find(bp => bp.lineNumber === lineNumber);
    if (exists) {
      set((state) => ({
        breakpoints: state.breakpoints.filter(bp => bp.lineNumber !== lineNumber),
      }));
    } else {
      set((state) => ({
        breakpoints: [
          ...state.breakpoints,
          {
            id: `bp-${lineNumber}-${Date.now()}`,
            lineNumber,
            enabled: true,
            fileName: state.fileName,
            isConditional: false,
          },
        ],
      }));
    }
  },

  updateBreakpointCondition: (lineNumber, condition) => {
    set((state) => ({
      breakpoints: state.breakpoints.map(bp => 
        bp.lineNumber === lineNumber
          ? { ...bp, condition, isConditional: !!condition }
          : bp
      ),
    }));
  },

  setCurrentLine: (line) => set({ currentLine: line }),

  setTheme: (theme) => set({ theme }),

  clearBreakpoints: () => set({ breakpoints: [] }),
}));
