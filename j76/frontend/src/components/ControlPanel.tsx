import { useState } from 'react';
import { Play, Pause, RotateCcw, Settings, ChevronDown, ChevronUp, Video, VideoOff, Download, Upload, Check, AlertCircle } from 'lucide-react';
import type { SimulationConfig, RecordingState } from '@/types/fluid';

interface ControlPanelProps {
  config: SimulationConfig;
  onConfigChange: (updates: Partial<SimulationConfig>) => void;
  onReset: () => void;
  mousePosition: [number, number, number];
  isConnected: boolean;
  recordingState: RecordingState;
  recordingDuration: number;
  uploadProgress: number;
  onToggleRecording: () => void;
  onDownloadForceData: () => void;
  forceCount: number;
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export function ControlPanel({
  config,
  onConfigChange,
  onReset,
  mousePosition,
  isConnected,
  recordingState,
  recordingDuration,
  uploadProgress,
  onToggleRecording,
  onDownloadForceData,
  forceCount,
}: ControlPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const getRecordingButtonConfig = () => {
    switch (recordingState) {
      case 'recording':
        return {
          icon: <VideoOff className="w-4 h-4" />,
          label: '停止录制',
          className: 'bg-red-500/20 hover:bg-red-500/30 border-red-500/50 text-red-300 animate-pulse',
        };
      case 'processing':
        return {
          icon: <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />,
          label: '处理中...',
          className: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300',
        };
      case 'uploading':
        return {
          icon: <Upload className="w-4 h-4" />,
          label: `上传中 ${Math.round(uploadProgress)}%`,
          className: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
        };
      case 'done':
        return {
          icon: <Check className="w-4 h-4" />,
          label: '完成',
          className: 'bg-green-500/20 border-green-500/50 text-green-300',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          label: '重试',
          className: 'bg-red-500/20 border-red-500/50 text-red-300',
        };
      default:
        return {
          icon: <Video className="w-4 h-4" />,
          label: '录制视频',
          className: 'bg-purple-500/20 hover:bg-purple-500/30 border-purple-500/50 text-purple-300',
        };
    }
  };

  const recordBtn = getRecordingButtonConfig();
  const isRecordingDisabled = recordingState === 'processing' || recordingState === 'uploading' || recordingState === 'done';

  return (
    <div className="fixed top-4 left-4 z-10 w-80">
      <div className="bg-slate-900/80 backdrop-blur-lg rounded-xl border border-cyan-500/20 shadow-lg shadow-cyan-500/10 overflow-hidden">
        <div 
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-800/50 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <h2 className="text-cyan-300 font-semibold text-sm tracking-wide">
              FLUID SIMULATION
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full ${
              isConnected 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {isConnected ? '后端已连接' : '使用模拟数据'}
            </span>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="px-4 pb-4 space-y-4">
            <div className="flex gap-2">
              <button
                onClick={() => onConfigChange({ isRunning: !config.isRunning })}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-sm font-medium transition-all hover:shadow-lg hover:shadow-cyan-500/20"
              >
                {config.isRunning ? (
                  <>
                    <Pause className="w-4 h-4" />
                    暂停
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    继续
                  </>
                )}
              </button>
              <button
                onClick={onReset}
                className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 border border-slate-500/30 text-slate-300 text-sm font-medium transition-all hover:shadow-lg hover:shadow-slate-500/20"
              >
                <RotateCcw className="w-4 h-4" />
                重置
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={onToggleRecording}
                  disabled={isRecordingDisabled}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg border text-sm font-medium transition-all ${recordBtn.className} ${isRecordingDisabled ? 'cursor-not-allowed opacity-70' : 'hover:shadow-lg'}`}
                >
                  {recordBtn.icon}
                  {recordBtn.label}
                </button>
                <button
                  onClick={onDownloadForceData}
                  disabled={forceCount === 0}
                  className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 border border-slate-500/30 text-slate-300 text-sm font-medium transition-all hover:shadow-lg hover:shadow-slate-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="下载力场数据JSON"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>

              {(recordingState === 'recording' || recordingState === 'uploading') && (
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-slate-400">录制时长</span>
                    <span className="text-cyan-300 font-mono">{formatDuration(recordingDuration)}</span>
                  </div>
                  {recordingState === 'uploading' && (
                    <div className="w-full bg-slate-700 rounded-full h-1.5 mt-2">
                      <div 
                        className="bg-gradient-to-r from-cyan-500 to-purple-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                  {forceCount > 0 && (
                    <div className="flex justify-between items-center text-xs mt-2 pt-2 border-t border-slate-700/50">
                      <span className="text-slate-400">记录力场次数</span>
                      <span className="text-purple-300 font-mono">{forceCount}</span>
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <Settings className="w-3 h-3" />
                <span>模拟参数</span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">粘度</span>
                  <span className="text-cyan-300 font-mono">{config.viscosity.toExponential(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.00001"
                  max="0.001"
                  step="0.00001"
                  value={config.viscosity}
                  onChange={(e) => onConfigChange({ viscosity: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">密度</span>
                  <span className="text-cyan-300 font-mono">{config.density.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="5.0"
                  step="0.1"
                  value={config.density}
                  onChange={(e) => onConfigChange({ density: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">阻尼</span>
                  <span className="text-cyan-300 font-mono">{config.damping.toFixed(3)}</span>
                </div>
                <input
                  type="range"
                  min="0.95"
                  max="0.999"
                  step="0.001"
                  value={config.damping}
                  onChange={(e) => onConfigChange({ damping: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-700/50">
              <div className="text-xs text-slate-400 mb-2">交互状态</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-800/50 rounded-lg p-2">
                  <div className="text-slate-500 mb-1">鼠标位置</div>
                  <div className="text-cyan-300 font-mono">
                    {mousePosition[0].toFixed(2)}, {mousePosition[1].toFixed(2)}, {mousePosition[2].toFixed(2)}
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-2">
                  <div className="text-slate-500 mb-1">状态</div>
                  <div className={`font-mono ${config.isRunning ? 'text-green-400' : 'text-yellow-400'}`}>
                    {config.isRunning ? '运行中' : '已暂停'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
