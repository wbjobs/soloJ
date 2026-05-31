import { spawn } from 'child_process';
import type { OutputEvent } from '../../shared/types';

const EXECUTION_TIMEOUT = 30000;

export interface ExecutionCallbacks {
  onStdout: (data: string) => void;
  onStderr: (data: string) => void;
  onExit: (code: number | null) => void;
  onError: (error: Error) => void;
}

export function executeCommand(
  command: string,
  room: string,
  callbacks: ExecutionCallbacks
): () => void {
  const isWindows = process.platform === 'win32';
  const shell = isWindows ? 'cmd.exe' : '/bin/bash';
  const shellFlag = isWindows ? '/c' : '-c';

  const child = spawn(shell, [shellFlag, command], {
    timeout: EXECUTION_TIMEOUT,
    env: {
      ...process.env,
      PATH: process.env.PATH,
    },
  });

  child.stdout.on('data', (data: Buffer) => {
    callbacks.onStdout(data.toString());
  });

  child.stderr.on('data', (data: Buffer) => {
    callbacks.onStderr(data.toString());
  });

  child.on('exit', (code) => {
    callbacks.onExit(code);
  });

  child.on('error', (error) => {
    callbacks.onError(error);
  });

  return () => {
    child.kill('SIGTERM');
  };
}

export function createOutputEvent(
  type: 'stdout' | 'stderr' | 'system',
  data: string,
  room: string
): OutputEvent {
  return {
    type,
    data,
    timestamp: Date.now(),
    room,
  };
}
