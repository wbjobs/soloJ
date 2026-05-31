import type { PyodideInterface } from 'pyodide';

export interface PyodideState {
  status: 'uninitialized' | 'loading' | 'ready' | 'error';
  progress: number;
  error?: string;
  pyodide?: PyodideInterface;
  loadedPackages: string[];
}

export interface LoadPackageOptions {
  packages: string[];
  version?: string;
}

export interface ExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
}
