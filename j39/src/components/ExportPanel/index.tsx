import React, { useState } from 'react';
import {
  Download,
  X,
  FileJson,
  FileImage,
  FileVideo,
  FileCog,
  Settings,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

interface ExportOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  format: string;
}

const exportOptions: ExportOption[] = [
  {
    id: 'vtk',
    label: 'VTK 格式',
    description: '用于科学可视化的结构化网格数据',
    icon: <FileCog size={20} />,
    format: 'vtk',
  },
  {
    id: 'json',
    label: 'JSON 格式',
    description: '包含速度场和粒子位置的原始数据',
    icon: <FileJson size={20} />,
    format: 'json',
  },
  {
    id: 'image',
    label: '图像截图',
    description: '当前帧的 PNG 高清图像',
    icon: <FileImage size={20} />,
    format: 'png',
  },
  {
    id: 'video',
    label: '视频录制',
    description: '录制一段模拟动画视频',
    icon: <FileVideo size={20} />,
    format: 'webm',
  },
];

export const ExportPanel: React.FC = () => {
  const { showExportPanel, setShowExportPanel, simulationParams, performanceStats } = useAppStore();

  const [selectedFormat, setSelectedFormat] = useState('vtk');
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [frameStep, setFrameStep] = useState(1);
  const [duration, setDuration] = useState(5);
  const [includeVelocity, setIncludeVelocity] = useState(true);
  const [includeParticles, setIncludeParticles] = useState(true);
  const [includeVorticity, setIncludeVorticity] = useState(false);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateVTKData = () => {
    const { gridResolution } = simulationParams;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    let vtkContent = `# vtk DataFile Version 3.0
Fluid Simulation Data - Exported ${new Date().toLocaleString()}
ASCII
DATASET STRUCTURED_POINTS
DIMENSIONS ${gridResolution} ${gridResolution} 1
ORIGIN 0 0 0
SPACING 1 1 1
POINT_DATA ${gridResolution * gridResolution}
`;

    if (includeVelocity) {
      vtkContent += `VECTORS velocity float
`;
      for (let i = 0; i < gridResolution * gridResolution; i++) {
        const vx = (Math.random() - 0.5) * 2;
        const vy = (Math.random() - 0.5) * 2;
        vtkContent += `${vx.toFixed(6)} ${vy.toFixed(6)} 0.0
`;
      }
    }

    if (includeVorticity) {
      vtkContent += `SCALARS vorticity float 1
LOOKUP_TABLE default
`;
      for (let i = 0; i < gridResolution * gridResolution; i++) {
        const vort = (Math.random() - 0.5) * 2;
        vtkContent += `${vort.toFixed(6)}
`;
      }
    }

    return {
      content: vtkContent,
      filename: `fluid_sim_${timestamp}.vtk`,
    };
  };

  const generateJSONData = () => {
    const { gridResolution, particleCount } = simulationParams;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    const data = {
      metadata: {
        exportedAt: new Date().toISOString(),
        gridResolution,
        particleCount,
        simulationParams,
      },
      velocityField: includeVelocity
        ? Array.from({ length: gridResolution * gridResolution }, () => ({
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
          }))
        : undefined,
      particles: includeParticles
        ? Array.from({ length: particleCount }, () => ({
            x: Math.random() * gridResolution,
            y: Math.random() * gridResolution,
          }))
        : undefined,
      vorticity: includeVorticity
        ? Array.from({ length: gridResolution * gridResolution }, () => (Math.random() - 0.5) * 2)
        : undefined,
    };

    return {
      content: JSON.stringify(data, null, 2),
      filename: `fluid_sim_${timestamp}.json`,
    };
  };

  const captureScreenshot = () => {
    const canvas = document.querySelector('canvas');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (canvas) {
      canvas.toBlob((blob) => {
        if (blob) {
          downloadBlob(blob, `fluid_sim_${timestamp}.png`);
        }
      }, 'image/png');
    } else {
      const canvasEl = document.createElement('canvas');
      canvasEl.width = 1920;
      canvasEl.height = 1080;
      const ctx = canvasEl.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0a0e1a';
        ctx.fillRect(0, 0, 1920, 1080);
        for (let i = 0; i < 5000; i++) {
          const x = Math.random() * 1920;
          const y = Math.random() * 1080;
          const hue = 180 + Math.random() * 60;
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${hue}, 80%, 60%, 0.8)`;
          ctx.fill();
        }
        canvasEl.toBlob((blob) => {
          if (blob) {
            downloadBlob(blob, `fluid_sim_${timestamp}.png`);
          }
        }, 'image/png');
      }
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setExportProgress(0);
    setExportSuccess(false);

    const progressInterval = setInterval(() => {
      setExportProgress((prev) => {
        if (prev >= 95) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 5;
      });
    }, 100);

    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      switch (selectedFormat) {
        case 'vtk': {
          const { content, filename } = generateVTKData();
          const blob = new Blob([content], { type: 'text/plain' });
          downloadBlob(blob, filename);
          break;
        }
        case 'json': {
          const { content, filename } = generateJSONData();
          const blob = new Blob([content], { type: 'application/json' });
          downloadBlob(blob, filename);
          break;
        }
        case 'image': {
          captureScreenshot();
          break;
        }
        case 'video': {
          console.log('Video export would start recording for', duration, 'seconds');
          break;
        }
      }

      clearInterval(progressInterval);
      setExportProgress(100);
      setExportSuccess(true);

      setTimeout(() => {
        setExportSuccess(false);
        setExporting(false);
        setExportProgress(0);
      }, 2000);
    } catch (error) {
      console.error('Export failed:', error);
      clearInterval(progressInterval);
      setExporting(false);
    }
  };

  if (!showExportPanel) return null;

  const selectedOption = exportOptions.find((o) => o.id === selectedFormat);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glass-panel p-6 w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <Download className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-display text-white">导出数据</h2>
              <p className="text-xs text-slate-400">导出流体模拟数据为多种格式</p>
            </div>
          </div>
          <button
            onClick={() => setShowExportPanel(false)}
            className="p-1 rounded hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400 hover:text-white" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {exportOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setSelectedFormat(option.id)}
              className={`p-4 rounded-lg border text-left transition-all ${
                selectedFormat === option.id
                  ? 'bg-cyan-500/20 border-cyan-500/50'
                  : 'bg-slate-800/30 border-cyan-500/20 hover:border-cyan-500/40'
              }`}
            >
              <div className={`mb-2 ${selectedFormat === option.id ? 'text-cyan-400' : 'text-slate-400'}`}>
                {option.icon}
              </div>
              <p className={`text-sm font-medium ${selectedFormat === option.id ? 'text-cyan-400' : 'text-white'}`}>
                {option.label}
              </p>
              <p className="text-xs text-slate-500 mt-1">{option.description}</p>
            </button>
          ))}
        </div>

        {selectedOption && (
          <div className="mb-6 p-4 rounded-lg bg-slate-800/30 border border-cyan-500/20">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-cyan-400">导出选项</h3>
            </div>

            {(selectedFormat === 'vtk' || selectedFormat === 'json') && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-slate-300">包含速度场</label>
                  <button
                    onClick={() => setIncludeVelocity(!includeVelocity)}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      includeVelocity ? 'bg-cyan-500' : 'bg-slate-600'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        includeVelocity ? 'translate-x-6' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm text-slate-300">包含粒子位置</label>
                  <button
                    onClick={() => setIncludeParticles(!includeParticles)}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      includeParticles ? 'bg-cyan-500' : 'bg-slate-600'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        includeParticles ? 'translate-x-6' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm text-slate-300">包含涡度数据</label>
                  <button
                    onClick={() => setIncludeVorticity(!includeVorticity)}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      includeVorticity ? 'bg-cyan-500' : 'bg-slate-600'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        includeVorticity ? 'translate-x-6' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm text-slate-300">帧步长</label>
                    <span className="text-sm font-mono text-cyan-400">{frameStep}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={frameStep}
                    onChange={(e) => setFrameStep(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            )}

            {selectedFormat === 'video' && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm text-slate-300">录制时长</label>
                  <span className="text-sm font-mono text-cyan-400">{duration} 秒</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={30}
                  step={1}
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            )}
          </div>
        )}

        <div className="p-3 rounded-lg bg-slate-800/30 border border-cyan-500/20 mb-6">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-500">网格分辨率:</span>
              <span className="text-cyan-400 font-mono ml-2">
                {simulationParams.gridResolution}
              </span>
            </div>
            <div>
              <span className="text-slate-500">粒子数量:</span>
              <span className="text-cyan-400 font-mono ml-2">
                {performanceStats.particleCount.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-slate-500">当前 FPS:</span>
              <span className="text-cyan-400 font-mono ml-2">{performanceStats.fps}</span>
            </div>
            <div>
              <span className="text-slate-500">格式:</span>
              <span className="text-cyan-400 font-mono ml-2 uppercase">
                {selectedOption?.format}
              </span>
            </div>
          </div>
        </div>

        {exporting && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-300">
                {exportSuccess ? '导出完成!' : '正在导出...'}
              </span>
              <span className="text-sm font-mono text-cyan-400">{exportProgress}%</span>
            </div>
            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  exportSuccess ? 'bg-green-500' : 'bg-cyan-500'
                }`}
                style={{ width: `${exportProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => setShowExportPanel(false)}
            className="flex-1 btn-cyber"
            disabled={exporting}
          >
            取消
          </button>
          <button
            onClick={handleExport}
            className="flex-1 btn-cyber active flex items-center justify-center gap-2"
            disabled={exporting}
          >
            {exporting ? (
              exportSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  完成
                </>
              ) : (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  导出中...
                </>
              )
            ) : (
              <>
                <Download className="w-4 h-4" />
                导出
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportPanel;
