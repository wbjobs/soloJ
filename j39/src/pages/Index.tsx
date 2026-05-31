import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Download, Activity, Maximize2, Minimize2, Menu, X, Brain, GitBranch } from 'lucide-react';
import { ControlPanel } from '@/components/ControlPanel';
import { PerformancePanel } from '@/components/PerformancePanel';
import { CollaborationPanel } from '@/components/CollaborationPanel';
import { ExportPanel } from '@/components/ExportPanel';
import { AdjointPanel } from '@/components/AdjointPanel';
import { LCSPanel } from '@/components/LCSPanel';
import { useFluidSolver } from '@/hooks/useFluidSolver';
import { useHandTracking } from '@/hooks/useHandTracking';
import { useSocket } from '@/hooks/useSocket';
import { useAppStore, ForceFieldType } from '@/store/useAppStore';

const Index: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const handCanvasRef = useRef<HTMLCanvasElement>(null);

  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMouseDown, setIsMouseDown] = useState(false);

  const {
    forceFieldType,
    forceStrength,
    forceRadius,
    showPerformancePanel,
    showAdjointPanel,
    showLCSPanel,
    setShowPerformancePanel,
    setShowExportPanel,
    setShowAdjointPanel,
    setShowLCSPanel,
    addForcePoint,
    removeForcePoint,
    handTracking,
  } = useAppStore();

  const { start, stop, reset } = useFluidSolver(canvasRef);
  const { sendForce } = useSocket();

  const handleForce = useCallback(
    (x: number, y: number, type: ForceFieldType) => {
      if (!canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const normalizedX = rect.width > 0 ? x / rect.width : 0;
      const normalizedY = rect.height > 0 ? y / rect.height : 0;

      const now = Date.now();
      const forcePoint = {
        x: normalizedX,
        y: normalizedY,
        type,
        strength: forceStrength,
        radius: forceRadius,
        timestamp: now,
      };

      addForcePoint(forcePoint);
      sendForce(forcePoint);

      setTimeout(() => {
        removeForcePoint(now);
      }, 100);
    },
    [forceStrength, forceRadius, addForcePoint, sendForce, removeForcePoint, canvasRef]
  );

  useHandTracking({
    videoRef,
    canvasRef: handCanvasRef,
    onForce: handleForce,
  });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!canvasRef.current || !isMouseDown) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      handleForce(x, y, forceFieldType);
    },
    [isMouseDown, forceFieldType, handleForce, canvasRef]
  );

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsMouseDown(true);
    handleMouseMove(e);
  }, [handleMouseMove]);

  const handleMouseUp = useCallback(() => {
    setIsMouseDown(false);
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (!canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const touch = e.touches[0];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      handleForce(x, y, forceFieldType);
    },
    [forceFieldType, handleForce, canvasRef]
  );

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const getForceColor = (type: ForceFieldType) => {
    switch (type) {
      case 'attract':
        return '#10b981';
      case 'repel':
        return '#ef4444';
      case 'vortex':
        return '#818cf8';
      default:
        return '#22d3ee';
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-cyber-bg grid-bg overflow-hidden">
      <header className="h-14 flex items-center justify-between px-4 border-b border-cyan-500/20 bg-slate-900/50 backdrop-blur-sm z-10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowLeftPanel(!showLeftPanel)}
            className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors lg:hidden"
          >
            {showLeftPanel ? <X size={18} className="text-cyan-400" /> : <Menu size={18} className="text-cyan-400" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-indigo-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">FL</span>
            </div>
            <div>
              <h1 className="text-base font-bold font-display text-white">流体协作实验室</h1>
              <p className="text-[10px] text-slate-400 hidden sm:block">
                Fluid Dynamics Collaborative Lab
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-cyan-500/20">
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: getForceColor(forceFieldType) }}
            />
            <span className="text-xs text-slate-300">
              力场:{' '}
              <span className="text-cyan-400 font-medium">
                {forceFieldType === 'attract' ? '吸引' : forceFieldType === 'repel' ? '排斥' : '旋涡'}
              </span>
            </span>
          </div>

          <button
            onClick={() => setShowPerformancePanel(!showPerformancePanel)}
            className={`p-2 rounded-lg border transition-colors ${
              showPerformancePanel
                ? 'bg-cyan-500/20 border-cyan-500/50'
                : 'bg-cyan-500/10 border-cyan-500/30 hover:bg-cyan-500/20'
            }`}
            title="性能统计"
          >
            <Activity size={18} className="text-cyan-400" />
          </button>

          <button
            onClick={() => setShowExportPanel(true)}
            className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors"
            title="导出数据"
          >
            <Download size={18} className="text-cyan-400" />
          </button>

          <button
            onClick={() => setShowAdjointPanel(!showAdjointPanel)}
            className={`p-2 rounded-lg border transition-colors ${
              showAdjointPanel
                ? 'bg-blue-500/20 border-blue-500/50'
                : 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20'
            }`}
            title="伴随同化"
          >
            <Brain size={18} className="text-blue-400" />
          </button>

          <button
            onClick={() => setShowLCSPanel(!showLCSPanel)}
            className={`p-2 rounded-lg border transition-colors ${
              showLCSPanel
                ? 'bg-purple-500/20 border-purple-500/50'
                : 'bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20'
            }`}
            title="LCS拟序结构"
          >
            <GitBranch size={18} className="text-purple-400" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors"
            title="全屏"
          >
            {isFullscreen ? (
              <Minimize2 size={18} className="text-cyan-400" />
            ) : (
              <Maximize2 size={18} className="text-cyan-400" />
            )}
          </button>

          <button
            onClick={() => setShowRightPanel(!showRightPanel)}
            className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors lg:hidden"
          >
            {showRightPanel ? <X size={18} className="text-cyan-400" /> : <Menu size={18} className="text-cyan-400" />}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <aside
          className={`w-72 h-full border-r border-cyan-500/20 flex-shrink-0 transition-all duration-300 ${
            showLeftPanel ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-0 lg:opacity-0 lg:border-0'
          } absolute lg:relative z-20`}
        >
          <ControlPanel />
        </aside>

        <main className="flex-1 relative flex flex-col overflow-hidden">
          <div className="flex-1 relative">
            <canvas
              ref={canvasRef}
              className="w-full h-full block cursor-crosshair"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchMove={handleTouchMove}
              onTouchStart={handleTouchMove}
            />

            {handTracking.enabled && (
              <>
                <video
                  ref={videoRef}
                  className="hidden"
                  playsInline
                  muted
                />
                <canvas
                  ref={handCanvasRef}
                  className="absolute bottom-4 right-4 w-48 h-36 rounded-lg border border-cyan-500/30 bg-slate-900/50 backdrop-blur-sm"
                  width={320}
                  height={240}
                />
              </>
            )}

            <div className="absolute bottom-4 left-4 flex gap-2">
              <button
                onClick={start}
                className="btn-cyber text-xs flex items-center gap-1.5"
              >
                开始模拟
              </button>
              <button
                onClick={stop}
                className="btn-cyber text-xs flex items-center gap-1.5"
              >
                停止
              </button>
              <button
                onClick={reset}
                className="btn-cyber text-xs flex items-center gap-1.5"
              >
                重置
              </button>
            </div>

            {showPerformancePanel && (
              <div className="absolute top-4 right-4 w-72">
                <PerformancePanel />
              </div>
            )}

            {showAdjointPanel && (
              <div className="absolute top-4 left-4 w-80 z-30">
                <AdjointPanel />
              </div>
            )}

            {showLCSPanel && (
              <div className="absolute top-4 left-4 w-80 z-30">
                <LCSPanel />
              </div>
            )}
          </div>
        </main>

        <aside
          className={`w-72 h-full border-l border-cyan-500/20 flex-shrink-0 transition-all duration-300 ${
            showRightPanel ? 'translate-x-0' : 'translate-x-full lg:translate-x-0 lg:w-0 lg:opacity-0 lg:border-0'
          } absolute right-0 lg:relative z-20`}
        >
          <CollaborationPanel />
        </aside>

        {(showLeftPanel || showRightPanel) && (
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px] z-10 lg:hidden"
            onClick={() => {
              setShowLeftPanel(false);
              setShowRightPanel(false);
            }}
          />
        )}
      </div>

      <footer className="h-8 flex items-center justify-between px-4 border-t border-cyan-500/20 bg-slate-900/50 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-[11px] text-slate-500 font-mono">
            鼠标拖拽 = 添加力场
          </span>
          <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
            |
          </span>
          <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
            手势控制: ✊排斥 🖐️吸引 🔄旋涡
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              useAppStore.getState().isSimulating
                ? 'bg-green-500 animate-pulse'
                : 'bg-slate-600'
            }`}
          />
          <span className="text-[11px] text-slate-500 font-mono">
            {useAppStore.getState().isSimulating ? '模拟运行中' : '模拟已停止'}
          </span>
        </div>
      </footer>

      <ExportPanel />
    </div>
  );
};

export default Index;
