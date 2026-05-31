import { spawn, type ChildProcess } from 'child_process';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface RunningProcess {
  process: ChildProcess;
  room: string;
  executionId: string;
  startTime: number;
  timeoutId: NodeJS.Timeout;
}

const MAX_EXECUTION_TIME = 5 * 60 * 1000;
const processes = new Map<string, RunningProcess>();

function killProcessTree(pid: number): Promise<void> {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    
    if (isWindows) {
      exec(`taskkill /T /F /PID ${pid}`, () => resolve());
    } else {
      try {
        process.kill(-pid, 'SIGTERM');
      } catch (e) {
        try {
          process.kill(pid, 'SIGTERM');
        } catch (e2) {
        }
      }
      resolve();
    }
  });
}

export function executeWithProcessManagement(
  command: string,
  room: string,
  executionId: string,
  callbacks: {
    onStdout: (data: string) => void;
    onStderr: (data: string) => void;
    onExit: (code: number | null) => void;
    onError: (error: Error) => void;
  }
): () => void {
  const isWindows = process.platform === 'win32';
  const shell = isWindows ? 'cmd.exe' : '/bin/bash';
  const shellFlag = isWindows ? '/c' : '-c';

  const child = spawn(shell, [shellFlag, command], {
    env: {
      ...process.env,
      PATH: process.env.PATH,
    },
    detached: !isWindows,
  });

  const timeoutId = setTimeout(() => {
    terminateProcess(executionId);
  }, MAX_EXECUTION_TIME);

  const runningProcess: RunningProcess = {
    process: child,
    room,
    executionId,
    startTime: Date.now(),
    timeoutId,
  };

  processes.set(executionId, runningProcess);

  let stdoutData = '';
  let stderrData = '';

  child.stdout?.on('data', (data: Buffer) => {
    const str = data.toString();
    stdoutData += str;
    callbacks.onStdout(str);
  });

  child.stderr?.on('data', (data: Buffer) => {
    const str = data.toString();
    stderrData += str;
    callbacks.onStderr(str);
  });

  child.on('exit', (code, signal) => {
    cleanupProcess(executionId);
    callbacks.onExit(code);
  });

  child.on('error', (error) => {
    cleanupProcess(executionId);
    callbacks.onError(error);
  });

  return () => terminateProcess(executionId);
}

export function terminateProcess(executionId: string): boolean {
  const running = processes.get(executionId);
  if (!running) return false;

  try {
    clearTimeout(running.timeoutId);
    
    if (running.process.pid) {
      killProcessTree(running.process.pid);
    }
  } catch (e) {
    console.error('Error terminating process:', e);
  }

  processes.delete(executionId);
  return true;
}

export function terminateProcessesByRoom(room: string): void {
  const roomProcesses = [...processes.entries()].filter(
    ([_, p]) => p.room === room
  );
  
  roomProcesses.forEach(([executionId]) => {
    terminateProcess(executionId);
  });
}

function cleanupProcess(executionId: string): void {
  const running = processes.get(executionId);
  if (running) {
    clearTimeout(running.timeoutId);
    processes.delete(executionId);
  }
}

export function isRoomExecuting(room: string): boolean {
  return [...processes.values()].some((p) => p.room === room);
}

export function getActiveProcessCount(): number {
  return processes.size;
}

process.on('exit', () => {
  console.log(`Cleaning up ${processes.size} running processes...`);
  processes.forEach((_, executionId) => terminateProcess(executionId));
});

export async function cleanupZombieProcesses(): Promise<void> {
  console.log('Running zombie process cleanup...');
  
  if (process.platform === 'win32') {
    try {
      const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq cmd.exe" /FO CSV');
      console.log('Current cmd processes:', stdout.split('\n').length - 2);
    } catch (e) {
    }
  }
  
  console.log('Active tracked processes:', getActiveProcessCount());
}
