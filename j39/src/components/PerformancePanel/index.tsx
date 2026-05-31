import React, { useRef, useEffect } from 'react';
import { Activity, Cpu, HardDrive, Clock, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, unit, color = '#22d3ee' }) => (
  <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/30 border border-cyan-500/10">
    <div
      className="w-8 h-8 rounded-md flex items-center justify-center"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-slate-400 truncate">{label}</p>
      <p className="text-sm font-mono font-semibold truncate" style={{ color }}>
        {value}
        {unit && <span className="text-xs text-slate-500 ml-1">{unit}</span>}
      </p>
    </div>
  </div>
);

export const PerformancePanel: React.FC = () => {
  const {
    performanceStats,
    showPerformancePanel,
    setShowPerformancePanel,
  } = useAppStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !showPerformancePanel) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const { fpsHistory } = performanceStats;
    const width = rect.width;
    const height = rect.height;
    const padding = 10;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.5)';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(34, 211, 238, 0.1)';
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i++) {
      const y = padding + (i * (height - 2 * padding)) / 4;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();

      const fpsValue = Math.round(60 - i * 15);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
      ctx.font = '10px JetBrains Mono';
      ctx.textAlign = 'right';
      ctx.fillText(`${fpsValue}`, padding - 5, y + 3);
    }

    if (fpsHistory.length > 1) {
      const gradient = ctx.createLinearGradient(0, padding, 0, height - padding);
      gradient.addColorStop(0, 'rgba(34, 211, 238, 0.8)');
      gradient.addColorStop(0.5, 'rgba(34, 211, 238, 0.4)');
      gradient.addColorStop(1, 'rgba(34, 211, 238, 0.1)');

      ctx.beginPath();
      ctx.moveTo(padding, height - padding);

      const maxFps = 75;
      const minFps = 0;

      fpsHistory.forEach((fps, index) => {
        const x = padding + (index * (width - 2 * padding)) / (fpsHistory.length - 1 || 1);
        const normalizedY = (fps - minFps) / (maxFps - minFps);
        const y = height - padding - normalizedY * (height - 2 * padding);
        const clampedY = Math.max(padding, Math.min(height - padding, y));

        if (index === 0) {
          ctx.moveTo(x, clampedY);
        } else {
          ctx.lineTo(x, clampedY);
        }
      });

      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.lineTo(
        padding + ((fpsHistory.length - 1) * (width - 2 * padding)) / (fpsHistory.length - 1 || 1),
        height - padding
      );
      ctx.lineTo(padding, height - padding);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      if (fpsHistory.length > 0) {
        const lastFps = fpsHistory[fpsHistory.length - 1];
        const lastX =
          padding +
          ((fpsHistory.length - 1) * (width - 2 * padding)) / (fpsHistory.length - 1 || 1);
        const lastNormalizedY = (lastFps - minFps) / (maxFps - minFps);
        const lastY = height - padding - lastNormalizedY * (height - 2 * padding);
        const lastClampedY = Math.max(padding, Math.min(height - padding, lastY));

        ctx.beginPath();
        ctx.arc(lastX, lastClampedY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#22d3ee';
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }, [performanceStats.fpsHistory, showPerformancePanel]);

  if (!showPerformancePanel) return null;

  const getFpsColor = (fps: number) => {
    if (fps >= 55) return '#10b981';
    if (fps >= 30) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400" />
          <h3 className="text-base font-semibold font-display text-cyan-400 neon-text">
            性能统计
          </h3>
        </div>
        <button
          onClick={() => setShowPerformancePanel(false)}
          className="p-1 rounded hover:bg-slate-700/50 transition-colors"
        >
          <X className="w-4 h-4 text-slate-400 hover:text-white" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard
          icon={<Activity size={16} />}
          label="FPS"
          value={performanceStats.fps.toString()}
          color={getFpsColor(performanceStats.fps)}
        />
        <StatCard
          icon={<Cpu size={16} />}
          label="模拟时间"
          value={performanceStats.simulationTime.toFixed(1)}
          unit="ms"
          color="#818cf8"
        />
        <StatCard
          icon={<Clock size={16} />}
          label="渲染时间"
          value={performanceStats.renderTime.toFixed(1)}
          unit="ms"
          color="#f472b6"
        />
        <StatCard
          icon={<HardDrive size={16} />}
          label="内存使用"
          value={performanceStats.memory.toFixed(1)}
          unit="MB"
          color="#fbbf24"
        />
      </div>

      <div className="mb-2">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-slate-400">FPS 折线图</span>
          <span className="text-xs font-mono text-cyan-400">
            粒子数: {performanceStats.particleCount.toLocaleString()}
          </span>
        </div>
        <div className="relative rounded-lg overflow-hidden border border-cyan-500/20">
          <canvas
            ref={canvasRef}
            className="w-full h-32"
            style={{ display: 'block' }}
          />
        </div>
      </div>

      <div className="flex justify-between text-xs text-slate-500 mt-2">
        <span>
          平均:{' '}
          <span className="text-cyan-400 font-mono">
            {performanceStats.fpsHistory.length > 0
              ? Math.round(
                  performanceStats.fpsHistory.reduce((a, b) => a + b, 0) /
                    performanceStats.fpsHistory.length
                )
              : 0}
          </span>{' '}
          FPS
        </span>
        <span>
          最低:{' '}
          <span className="text-cyan-400 font-mono">
            {performanceStats.fpsHistory.length > 0
              ? Math.round(Math.min(...performanceStats.fpsHistory))
              : 0}
          </span>{' '}
          FPS
        </span>
      </div>
    </div>
  );
};

export default PerformancePanel;
