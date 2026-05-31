import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Play,
  Trash2,
  Wifi,
  WifiOff,
  Users,
  Crown,
  Loader2,
  Square,
  Video,
  VideoOff,
  CheckCircle2,
  Copy,
} from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';
import { TerminalOutput } from '../components/TerminalOutput';
import {
  executeCommand,
  stopCommand,
  startRecording,
  stopRecording,
} from '../services/api';
import type { OutputEvent } from '../../shared/types';

export default function Host() {
  const [searchParams] = useSearchParams();
  const room = searchParams.get('room') || 'default';
  const [command, setCommand] = useState('');
  const [outputs, setOutputs] = useState<OutputEvent[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedSessionId, setRecordedSessionId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleOutput = useCallback((event: OutputEvent) => {
    setOutputs((prev) => [...prev, event]);
  }, []);

  const handleHistory = useCallback((history: OutputEvent[]) => {
    setOutputs(history);
  }, []);

  const handleRoomInfo = useCallback((info: { viewers: number; hasHost: boolean }) => {
    setViewerCount(info.viewers);
  }, []);

  const handleExecutionStart = useCallback(() => {
    setIsExecuting(true);
  }, []);

  const handleExecutionEnd = useCallback(() => {
    setIsExecuting(false);
  }, []);

  const { isConnected } = useWebSocket({
    room,
    role: 'host',
    onOutput: handleOutput,
    onHistory: handleHistory,
    onRoomInfo: handleRoomInfo,
    onExecutionStart: handleExecutionStart,
    onExecutionEnd: handleExecutionEnd,
  });

  const handleExecute = async () => {
    if (!command.trim() || isExecuting) return;

    setError(null);
    try {
      await executeCommand(command, room);
    } catch (err) {
      setError(err instanceof Error ? err.message : '执行失败');
    }
  };

  const handleStop = async () => {
    try {
      await stopCommand(room);
    } catch (err) {
      setError(err instanceof Error ? err.message : '停止失败');
    }
  };

  const handleClear = () => {
    setOutputs([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleExecute();
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration((prev) => prev + 1000);
      }, 1000);
    } else {
      setRecordingDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const handleStartRecording = async () => {
    try {
      setError(null);
      setRecordedSessionId(null);
      await startRecording(room);
      setIsRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '开始录制失败');
    }
  };

  const handleStopRecording = async () => {
    try {
      setError(null);
      const result = await stopRecording(room);
      if (result.sessionId) {
        setRecordedSessionId(result.sessionId);
      }
      setIsRecording(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '停止录制失败');
    }
  };

  const handleCopySessionId = () => {
    if (recordedSessionId) {
      navigator.clipboard.writeText(recordedSessionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Crown className="w-6 h-6 text-yellow-400" />
              <h1 className="text-xl font-bold">主持人控制台</h1>
            </div>
            <div className="px-3 py-1 bg-slate-800 rounded-lg text-sm">
              房间: <span className="text-cyan-400 font-mono">{room}</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            {isRecording && (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-900/50 rounded-lg">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                <span className="text-sm text-red-400 font-mono">
                  录制中 {formatDuration(recordingDuration)}
                </span>
              </div>
            )}
            {recordedSessionId && !isRecording && (
              <div className="flex items-center gap-2 px-3 py-1 bg-green-900/50 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span className="text-sm text-green-400 font-mono">
                  {recordedSessionId}
                </span>
                <button
                  onClick={handleCopySessionId}
                  className="p-1 hover:bg-slate-700 rounded transition-colors"
                >
                  {copied ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-slate-400">观众:</span>
              <span className="text-green-400 font-semibold">{viewerCount}</span>
            </div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <Wifi className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-green-400">已连接</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-400">断开连接</span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-140px)]">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-300">命令输入</h2>
              <span className="text-xs text-slate-500">Ctrl + Enter 执行</span>
            </div>
            <div className="flex-1 flex flex-col gap-3">
              <textarea
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入 Shell 命令，例如: ls -la, echo hello"
                className="flex-1 w-full p-4 bg-slate-800 border border-slate-600 rounded-lg font-mono text-sm resize-none focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                disabled={isExecuting}
              />
              {error && (
                <div className="p-3 bg-red-900/30 border border-red-500 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={handleExecute}
                  disabled={isExecuting || !command.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-all hover:shadow-lg hover:shadow-cyan-500/25 disabled:hover:shadow-none"
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      执行中...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      执行命令
                    </>
                  )}
                </button>
                <button
                  onClick={handleStop}
                  disabled={!isExecuting}
                  className="px-6 py-3 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors flex items-center gap-2"
                >
                  <Square className="w-5 h-5" />
                  停止
                </button>
                <button
                  onClick={handleClear}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-5 h-5" />
                  清空
                </button>
              </div>
            </div>
            <div className="p-4 bg-slate-800/50 rounded-lg">
              <h3 className="text-sm font-semibold text-slate-400 mb-3">录制控制</h3>
              <div className="flex gap-3">
                {!isRecording ? (
                  <button
                    onClick={handleStartRecording}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-semibold transition-all hover:shadow-lg hover:shadow-red-500/25"
                  >
                    <Video className="w-5 h-5" />
                    开始录制
                  </button>
                ) : (
                  <button
                    onClick={handleStopRecording}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-800 hover:bg-red-700 rounded-lg font-semibold transition-all"
                  >
                    <VideoOff className="w-5 h-5" />
                    停止录制
                  </button>
                )}
              </div>
            </div>
            <div className="p-4 bg-slate-800/50 rounded-lg">
              <h3 className="text-sm font-semibold text-slate-400 mb-2">快捷命令示例</h3>
              <div className="flex flex-wrap gap-2">
                {['echo "Hello World"', 'ls -la', 'pwd', 'whoami', 'date'].map((cmd) => (
                  <button
                    key={cmd}
                    onClick={() => setCommand(cmd)}
                    className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm font-mono transition-colors"
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-slate-300">输出终端</h2>
            <div className="flex-1">
              <TerminalOutput outputs={outputs} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
