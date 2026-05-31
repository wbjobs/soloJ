export interface Breakpoint {
  id: string;
  lineNumber: number;
  enabled: boolean;
  condition?: string;
  fileName: string;
  isConditional: boolean;
}

export interface LineProfile {
  lineNumber: number;
  hitCount: number;
  totalTime: number;
  selfTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  functionName: string;
  code: string;
}

export interface FunctionProfile {
  name: string;
  callCount: number;
  totalTime: number;
  selfTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  lineRanges: [number, number];
}

export interface FlameGraphNode {
  name: string;
  value: number;
  children: FlameGraphNode[];
  lineNumber?: number;
  selfTime?: number;
}

export interface PerformanceReport {
  version: string;
  generatedAt: string;
  totalExecutionTime: number;
  lineProfiles: LineProfile[];
  functionProfiles: FunctionProfile[];
  flameGraph: FlameGraphNode;
  metadata: {
    codeLength: number;
    fileName: string;
    pyodideVersion: string;
  };
}

export interface StackFrame {
  id: string;
  functionName: string;
  lineNumber: number;
  fileName: string;
  locals: Variable[];
}

export interface Variable {
  name: string;
  type: string;
  value: string;
  expanded: boolean;
  hasChildren: boolean;
  children?: Variable[];
}

export type DebugState = 
  | 'uninitialized'
  | 'initializing'
  | 'ready'
  | 'running'
  | 'paused'
  | 'stopped'
  | 'error';

export type DebugCommand = 
  | 'continue'
  | 'step_over'
  | 'step_into'
  | 'step_out'
  | 'pause'
  | 'stop'
  | 'restart';

export type DebugEventType = 
  | 'started'
  | 'paused'
  | 'resumed'
  | 'step'
  | 'exception'
  | 'terminated'
  | 'output';

export interface DebugEvent {
  type: DebugEventType;
  data?: {
    line?: number;
    fileName?: string;
    locals?: Variable[];
    globals?: Variable[];
    callStack?: StackFrame[];
    message?: string;
    error?: string;
  };
}

export interface ConsoleOutput {
  id: string;
  type: 'stdout' | 'stderr' | 'debug';
  content: string;
  timestamp: number;
}
