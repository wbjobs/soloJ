import { Play, Pause, StepForward, ArrowDown, ArrowUp, Square, RotateCcw, Bug, Code2, Activity } from 'lucide-react';
import { useDebuggerStore } from '@/stores/debuggerStore';

interface DebugControlsProps {
  onRun: () => void;
  onDebug: () => void;
  onProfile: () => void;
  onCommand: (command: string) => void;
  pyodideStatus: string;
}

export function DebugControls({ onRun, onDebug, onProfile, onCommand, pyodideStatus }: DebugControlsProps) {
  const { state: debugState } = useDebuggerStore();
  
  const isReady = pyodideStatus === 'ready';
  const isRunning = debugState === 'running';
  const isPaused = debugState === 'paused';
  const canControl = isRunning || isPaused;

  return (
    <div className="flex items-center gap-1 px-4 py-2 bg-editor-bg border-b border-gray-700">
      <div className="flex items-center gap-1">
        <button
          className="p-2 rounded hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onRun}
          disabled={!isReady || isRunning}
          title="运行 (F5)"
        >
          <Play className="w-4 h-4 text-green-400" />
        </button>

        <button
          className="p-2 rounded hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onDebug}
          disabled={!isReady || isRunning}
          title="调试 (F6)"
        >
          <Bug className="w-4 h-4 text-yellow-400" />
        </button>

        <button
          className="p-2 rounded hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onProfile}
          disabled={!isReady || isRunning}
          title="性能分析 (F7)"
        >
          <Activity className="w-4 h-4 text-purple-400" />
        </button>

        <button
          className="p-2 rounded hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => onCommand('stop')}
          disabled={!canControl}
          title="停止 (Shift+F5)"
        >
          <Square className="w-4 h-4 text-red-400" />
        </button>
      </div>

      <div className="w-px h-6 bg-gray-700 mx-2" />

      <div className="flex items-center gap-1">
        <button
          className="p-2 rounded hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => onCommand('continue')}
          disabled={!isPaused}
          title="继续 (F5)"
        >
          <Play className="w-4 h-4 text-blue-400" />
        </button>

        <button
          className="p-2 rounded hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => onCommand('pause')}
          disabled={!isRunning}
          title="暂停 (F6)"
        >
          <Pause className="w-4 h-4 text-yellow-400" />
        </button>

        <button
          className="p-2 rounded hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => onCommand('step_over')}
          disabled={!isPaused}
          title="单步跳过 (F10)"
        >
          <StepForward className="w-4 h-4 text-gray-300" />
        </button>

        <button
          className="p-2 rounded hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => onCommand('step_into')}
          disabled={!isPaused}
          title="单步进入 (F11)"
        >
          <ArrowDown className="w-4 h-4 text-gray-300" />
        </button>

        <button
          className="p-2 rounded hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => onCommand('step_out')}
          disabled={!isPaused}
          title="单步跳出 (Shift+F11)"
        >
          <ArrowUp className="w-4 h-4 text-gray-300" />
        </button>
      </div>

      <div className="w-px h-6 bg-gray-700 mx-2" />

      <button
        className="p-2 rounded hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={() => onCommand('restart')}
        disabled={!isReady}
        title="重新开始 (Ctrl+Shift+F5)"
      >
        <RotateCcw className="w-4 h-4 text-gray-300" />
      </button>

      <div className="ml-auto flex items-center gap-2">
        <Code2 className="w-4 h-4 text-gray-500" />
        <span className={`text-sm ${
          pyodideStatus === 'ready' ? 'text-green-400' :
          pyodideStatus === 'loading' ? 'text-yellow-400' :
          pyodideStatus === 'error' ? 'text-red-400' :
          'text-gray-500'
        }`}>
          {pyodideStatus === 'ready' ? 'Python 就绪' :
           pyodideStatus === 'loading' ? '加载中...' :
           pyodideStatus === 'error' ? '加载失败' :
           '未初始化'}
        </span>
      </div>
    </div>
  );
}
