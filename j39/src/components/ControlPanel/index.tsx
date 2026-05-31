import React from 'react';
import {
  Settings,
  Play,
  Pause,
  RotateCcw,
  Droplets,
  Wind,
  CircleDot,
  Magnet,
  Zap,
  Eye,
  Hand,
  Maximize2,
} from 'lucide-react';
import { useAppStore, VisualizationMode, ForceFieldType } from '@/store/useAppStore';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}

const Slider: React.FC<SliderProps> = ({ label, value, min, max, step, unit, onChange }) => {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm text-slate-300 font-display">{label}</label>
        <span className="text-sm font-mono text-cyan-400">
          {value.toFixed(step < 1 ? 3 : 0)}{unit || ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
    </div>
  );
};

interface SelectProps {
  label: string;
  value: string;
  options: { value: string; label: string; icon?: React.ReactNode }[];
  onChange: (value: string) => void;
}

const Select: React.FC<SelectProps> = ({ label, value, options, onChange }) => {
  return (
    <div className="mb-4">
      <label className="block text-sm text-slate-300 font-display mb-2">{label}</label>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`btn-cyber flex flex-col items-center gap-1 py-2 px-1 text-xs ${
              value === option.value ? 'active' : ''
            }`}
          >
            {option.icon}
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string }> = ({ icon, title }) => (
  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-cyan-500/20">
    <div className="text-cyan-400">{icon}</div>
    <h3 className="text-base font-semibold font-display text-cyan-400 neon-text">{title}</h3>
  </div>
);

export const ControlPanel: React.FC = () => {
  const {
    simulationParams,
    visualizationMode,
    forceFieldType,
    forceStrength,
    forceRadius,
    isSimulating,
    isPaused,
    handTracking,
    setSimulationParams,
    setVisualizationMode,
    setForceFieldType,
    setForceStrength,
    setForceRadius,
    toggleSimulation,
    togglePause,
    resetSimulation,
    setHandTrackingEnabled,
  } = useAppStore();

  const visualizationOptions: { value: VisualizationMode; label: string; icon: React.ReactNode }[] = [
    { value: 'particles', label: '粒子', icon: <CircleDot size={16} /> },
    { value: 'streamlines', label: '流线', icon: <Wind size={16} /> },
    { value: 'vorticity', label: '涡度', icon: <Droplets size={16} /> },
  ];

  const forceOptions: { value: ForceFieldType; label: string; icon: React.ReactNode }[] = [
    { value: 'attract', label: '吸引', icon: <Magnet size={16} /> },
    { value: 'repel', label: '排斥', icon: <Zap size={16} /> },
    { value: 'vortex', label: '旋涡', icon: <RotateCcw size={16} /> },
  ];

  return (
    <div className="glass-panel h-full flex flex-col overflow-hidden">
      <div className="p-4 overflow-y-auto flex-1">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <Settings className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-display text-white">控制面板</h2>
            <p className="text-xs text-slate-400">流体模拟参数调节</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={toggleSimulation}
            className={`flex-1 btn-cyber flex items-center justify-center gap-2 ${
              isSimulating ? 'active' : ''
            }`}
          >
            {isSimulating ? <Pause size={16} /> : <Play size={16} />}
            {isSimulating ? '暂停' : '开始'}
          </button>
          <button
            onClick={togglePause}
            disabled={!isSimulating}
            className="btn-cyber flex items-center justify-center gap-2 disabled:opacity-50"
            title={isPaused ? '继续' : '暂停'}
          >
            {isPaused ? <Play size={16} /> : <Pause size={16} />}
          </button>
          <button
            onClick={resetSimulation}
            className="btn-cyber flex items-center justify-center gap-2"
            title="重置"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        <SectionHeader icon={<Eye size={18} />} title="可视化模式" />
        <Select
          label=""
          value={visualizationMode}
          options={visualizationOptions}
          onChange={(v) => setVisualizationMode(v as VisualizationMode)}
        />

        <SectionHeader icon={<Maximize2 size={18} />} title="力场类型" />
        <Select
          label=""
          value={forceFieldType}
          options={forceOptions}
          onChange={(v) => setForceFieldType(v as ForceFieldType)}
        />

        <Slider
          label="力场强度"
          value={forceStrength}
          min={10}
          max={200}
          step={5}
          onChange={setForceStrength}
        />

        <Slider
          label="力场半径"
          value={forceRadius}
          min={20}
          max={300}
          step={10}
          unit="px"
          onChange={setForceRadius}
        />

        <SectionHeader icon={<Droplets size={18} />} title="流体参数" />

        <Slider
          label="粘度"
          value={simulationParams.viscosity}
          min={0.0001}
          max={0.01}
          step={0.0001}
          onChange={(v) => setSimulationParams({ viscosity: v })}
        />

        <Slider
          label="速度系数"
          value={simulationParams.velocity}
          min={0.1}
          max={3}
          step={0.1}
          onChange={(v) => setSimulationParams({ velocity: v })}
        />

        <Slider
          label="涡度系数"
          value={simulationParams.vorticity}
          min={0}
          max={2}
          step={0.1}
          onChange={(v) => setSimulationParams({ vorticity: v })}
        />

        <Slider
          label="耗散率"
          value={simulationParams.dissipation}
          min={0.9}
          max={0.999}
          step={0.001}
          onChange={(v) => setSimulationParams({ dissipation: v })}
        />

        <Slider
          label="粒子数量"
          value={simulationParams.particleCount}
          min={1000}
          max={20000}
          step={500}
          onChange={(v) => setSimulationParams({ particleCount: v })}
        />

        <Slider
          label="网格分辨率"
          value={simulationParams.gridResolution}
          min={64}
          max={256}
          step={16}
          onChange={(v) => setSimulationParams({ gridResolution: v })}
        />

        <SectionHeader icon={<Hand size={18} />} title="手势控制" />

        <button
          onClick={() => setHandTrackingEnabled(!handTracking.enabled)}
          className={`w-full btn-cyber flex items-center justify-center gap-2 mb-4 ${
            handTracking.enabled ? 'active' : ''
          }`}
        >
          <Hand size={16} />
          {handTracking.enabled ? '关闭手势' : '开启手势'}
        </button>

        {handTracking.enabled && (
          <div className="p-3 rounded-lg bg-slate-800/50 border border-cyan-500/20">
            <div className="text-xs text-slate-400 space-y-1">
              <p>✊ 握拳 = 排斥力场</p>
              <p>🖐️ 张开 = 吸引力场</p>
              <p>🔄 旋转 = 旋涡力场</p>
            </div>
            {handTracking.cameraActive && (
              <div className="mt-2 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-green-400">摄像头已启用</span>
              </div>
            )}
            {handTracking.gesture !== 'none' && (
              <div className="mt-2 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-xs text-cyan-400">
                  检测到: {handTracking.gesture === 'fist' ? '握拳' :
                           handTracking.gesture === 'open' ? '张开' : '旋转'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ControlPanel;
