import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Play,
  Pause,
  SkipBack,
  FastForward,
  Search,
  History,
  Clock,
  FileTerminal,
} from 'lucide-react';
import { TerminalOutput } from '../components/TerminalOutput';
import { getRecording, getAllRecordings } from '../services/api';
import type { RecordingSession, OutputEvent, RecordedEvent } from '../../shared/types';

const PLAYBACK_SPEEDS = [0.5, 1, 2];

export default function Playback() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSessionId = searchParams.get('session');

  const [sessionIdInput, setSessionIdInput] = useState(urlSessionId || '');
  const [session, setSession] = useState<RecordingSession | null>(null);
  const [outputs, setOutputs] = useState<OutputEvent[]>([]);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<RecordingSession[]>([]);
  const [showList, setShowList] = useState(false);

  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentTimeRef = useRef(0);

  useEffect(() => {
    if (urlSessionId) {
      handleLoadSession(urlSessionId);
    }
    loadRecordings();
  }, [urlSessionId]);

  useEffect(() => {
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, []);

  const loadRecordings = async () => {
    try {
      const data = await getAllRecordings();
      setRecordings(data);
    } catch (err) {
    }
  };

  const handleLoadSession = async (id?: string) => {
    const targetId = id || sessionIdInput;
    if (!targetId.trim()) return;

    setLoading(true);
    setError(null);
    setSession(null);
    setOutputs([]);
    setCurrentEventIndex(0);
    setIsPlaying(false);
    currentTimeRef.current = 0;

    try {
      const data = await getRecording(targetId.trim());
      setSession(data);
      setSearchParams({ session: targetId.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = useCallback(() => {
    if (!session || currentEventIndex >= session.events.length) return;

    setIsPlaying(true);

    const intervalMs = 50;
    playIntervalRef.current = setInterval(() => {
      currentTimeRef.current += intervalMs * playbackSpeed;

      let eventsToAdd: OutputEvent[] = [];
      while (
        currentEventIndex < session.events.length &&
        session.events[currentEventIndex].relativeTime <= currentTimeRef.current
      ) {
        const event = session.events[currentEventIndex];
        eventsToAdd.push({
          type: event.type === 'command' ? 'system' : event.type,
          data: event.type === 'command' ? `$ ${event.data}` : event.data,
          timestamp: event.timestamp,
          room: session.room,
        });
        setCurrentEventIndex((prev) => prev + 1);
      }

      if (eventsToAdd.length > 0) {
        setOutputs((prev) => [...prev, ...eventsToAdd]);
      }

      if (currentEventIndex >= session.events.length) {
        if (playIntervalRef.current) {
          clearInterval(playIntervalRef.current);
        }
        setIsPlaying(false);
      }
    }, intervalMs);
  }, [session, currentEventIndex, playbackSpeed]);

  const handlePause = () => {
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
    }
    setIsPlaying(false);
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      handlePause();
    } else {
      handlePlay();
    }
  };

  const handleRestart = () => {
    handlePause();
    setOutputs([]);
    setCurrentEventIndex(0);
    currentTimeRef.current = 0;
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (isPlaying) {
      handlePause();
      setTimeout(handlePlay, 50);
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = session ? (currentEventIndex / session.events.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FileTerminal className="w-6 h-6 text-cyan-400" />
              <h1 className="text-xl font-bold">终端回放</h1>
            </div>
            {session && (
              <div className="px-3 py-1 bg-slate-800 rounded-lg text-sm">
                Session: <span className="text-cyan-400 font-mono">{session.sessionId}</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowList(!showList)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            <History className="w-4 h-4" />
            历史录制
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {showList && (
          <div className="mb-6 p-4 bg-slate-800 rounded-lg">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">历史录制列表</h3>
            {recordings.length === 0 ? (
              <div className="text-slate-500 text-sm">暂无录制记录</div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {recordings.map((rec) => (
                  <button
                    key={rec.sessionId}
                    onClick={() => {
                      setSessionIdInput(rec.sessionId);
                      handleLoadSession(rec.sessionId);
                      setShowList(false);
                    }}
                    className="w-full flex items-center justify-between p-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-left"
                  >
                    <div>
                      <div className="font-mono text-cyan-400 text-sm">{rec.sessionId}</div>
                      <div className="text-xs text-slate-400">
                        房间: {rec.room} | 命令数: {rec.commandCount}
                      </div>
                    </div>
                    <div className="text-sm text-slate-400">
                      {formatTime(rec.duration)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!session && (
          <div className="max-w-md mx-auto mt-20">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-800 rounded-2xl mb-4">
                <Search className="w-8 h-8 text-slate-400" />
              </div>
              <h2 className="text-2xl font-bold mb-2">输入 Session ID</h2>
              <p className="text-slate-400">回放之前录制的终端会话</p>
            </div>
            <div className="space-y-4">
              <input
                type="text"
                value={sessionIdInput}
                onChange={(e) => setSessionIdInput(e.target.value)}
                placeholder="例如: sess_xxxxxxxx"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors font-mono"
                onKeyDown={(e) => e.key === 'Enter' && handleLoadSession()}
              />
              {error && (
                <div className="p-3 bg-red-900/30 border border-red-500 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
              <button
                onClick={() => handleLoadSession()}
                disabled={loading || !sessionIdInput.trim()}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-all"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Search className="w-5 h-5" />
                )}
                {loading ? '加载中...' : '加载会话'}
              </button>
            </div>
          </div>
        )}

        {session && (
          <div className="h-[calc(100vh-160px)] flex flex-col gap-4">
            <div className="flex items-center gap-4 p-4 bg-slate-800 rounded-lg">
              <button
                onClick={handleRestart}
                className="p-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                title="重新开始"
              >
                <SkipBack className="w-5 h-5" />
              </button>
              <button
                onClick={handleTogglePlay}
                className="p-4 bg-cyan-600 hover:bg-cyan-500 rounded-full transition-all hover:shadow-lg hover:shadow-cyan-500/25"
                title={isPlaying ? '暂停' : '播放'}
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6 ml-0.5" />
                )}
              </button>
              <button
                onClick={() => handleSpeedChange(playbackSpeed === 2 ? 0.5 : playbackSpeed + 0.5)}
                className="flex items-center gap-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                title="切换倍速"
              >
                <FastForward className="w-4 h-4" />
                <span className="font-semibold">{playbackSpeed}x</span>
              </button>
              <div className="flex gap-1">
                {PLAYBACK_SPEEDS.map((speed) => (
                  <button
                    key={speed}
                    onClick={() => handleSpeedChange(speed)}
                    className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${
                      playbackSpeed === speed
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
              <div className="flex-1" />
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Clock className="w-4 h-4" />
                <span>
                  {formatTime(currentTimeRef.current)} / {formatTime(session.duration)}
                </span>
              </div>
            </div>

            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="flex-1">
              <TerminalOutput outputs={outputs} />
            </div>

            <div className="flex justify-between text-sm text-slate-500">
              <span>命令数: {session.commandCount}</span>
              <span>事件数: {session.events.length}</span>
              <span>房间: {session.room}</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
