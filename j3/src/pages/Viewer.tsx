import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wifi, WifiOff, Users, Eye, Activity } from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';
import { TerminalOutput } from '../components/TerminalOutput';
import type { OutputEvent } from '../../shared/types';

export default function Viewer() {
  const [searchParams] = useSearchParams();
  const room = searchParams.get('room') || 'default';
  const [outputs, setOutputs] = useState<OutputEvent[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [hasHost, setHasHost] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const handleOutput = useCallback((event: OutputEvent) => {
    setOutputs((prev) => [...prev, event]);
  }, []);

  const handleHistory = useCallback((history: OutputEvent[]) => {
    setOutputs(history);
  }, []);

  const handleRoomInfo = useCallback((info: { viewers: number; hasHost: boolean }) => {
    setViewerCount(info.viewers);
    setHasHost(info.hasHost);
  }, []);

  const handleExecutionStart = useCallback(() => {
    setIsExecuting(true);
  }, []);

  const handleExecutionEnd = useCallback(() => {
    setIsExecuting(false);
  }, []);

  const { isConnected } = useWebSocket({
    room,
    role: 'viewer',
    onOutput: handleOutput,
    onHistory: handleHistory,
    onRoomInfo: handleRoomInfo,
    onExecutionStart: handleExecutionStart,
    onExecutionEnd: handleExecutionEnd,
  });

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Eye className="w-6 h-6 text-cyan-400" />
              <h1 className="text-xl font-bold">观众模式</h1>
            </div>
            <div className="px-3 py-1 bg-slate-800 rounded-lg text-sm">
              房间: <span className="text-cyan-400 font-mono">{room}</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-slate-400">在线观众:</span>
              <span className="text-green-400 font-semibold">{viewerCount + (hasHost ? 1 : 0)}</span>
            </div>
            <div className="flex items-center gap-2">
              {isExecuting && (
                <div className="flex items-center gap-2 px-3 py-1 bg-amber-900/50 rounded-full">
                  <Activity className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span className="text-sm text-amber-400">执行中</span>
                </div>
              )}
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
        <div className="h-[calc(100vh-120px)] flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-slate-300">实时输出</h2>
            {!hasHost && (
              <div className="px-3 py-1 bg-yellow-900/30 border border-yellow-600 rounded text-sm text-yellow-400">
                等待主持人加入...
              </div>
            )}
          </div>
          <div className="flex-1">
            <TerminalOutput outputs={outputs} />
          </div>
          <div className="text-center text-sm text-slate-500">
            这是只读模式，命令输出将实时显示在这里
          </div>
        </div>
      </main>
    </div>
  );
}
