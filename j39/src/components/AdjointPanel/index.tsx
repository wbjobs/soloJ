import React, { useCallback, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { TargetPatternType } from '@/store/useAppStore';

const TARGET_PATTERNS: { value: TargetPatternType; label: string; description: string }[] = [
  { value: 'vortex_pair', label: '涡旋对', description: '一对反向旋转的涡旋' },
  { value: 'shear_layer', label: '剪切层', description: '上下反向流动的剪切层' },
  { value: 'jet', label: '射流', description: '从左侧注入的高速射流' },
  { value: 'double_vortex', label: '双涡阵列', description: '四个涡旋组成的方阵' },
  { value: 'turbulent', label: '湍流', description: '多尺度湍流扰动' },
];

export const AdjointPanel: React.FC = () => {
  const {
    adjointConfig,
    adjointStats,
    adjointStatus,
    targetPattern,
    setAdjointConfig,
    setAdjointStatus,
    setTargetPattern,
    setShowAdjointPanel,
  } = useAppStore();

  const [isOptimizing, setIsOptimizing] = useState(false);

  const handleStartOptimization = useCallback(() => {
    setIsOptimizing(true);
    setAdjointStatus('running');

    setTimeout(() => {
      setIsOptimizing(false);
      setAdjointStatus('converged');
    }, 3000);
  }, [setAdjointStatus]);

  const handleStopOptimization = useCallback(() => {
    setIsOptimizing(false);
    setAdjointStatus('idle');
  }, [setAdjointStatus]);

  return (
    <div className="absolute top-4 right-4 w-80 bg-gray-900 bg-opacity-95 rounded-lg shadow-xl border border-gray-700 text-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <h3 className="font-semibold text-sm">伴随同化控制</h3>
        <button
          onClick={() => setShowAdjointPanel(false)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">
            目标流场图案
          </label>
          <div className="grid grid-cols-1 gap-2">
            {TARGET_PATTERNS.map((pattern) => (
              <button
                key={pattern.value}
                onClick={() => setTargetPattern(pattern.value)}
                className={`px-3 py-2 rounded text-left text-sm transition-all ${
                  targetPattern === pattern.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <div className="font-medium">{pattern.label}</div>
                <div className="text-xs opacity-70">{pattern.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            优化参数
          </h4>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">学习率</span>
              <span className="text-gray-300">{adjointConfig.learningRate.toFixed(4)}</span>
            </div>
            <input
              type="range"
              min="0.0001"
              max="0.01"
              step="0.0001"
              value={adjointConfig.learningRate}
              onChange={(e) =>
                setAdjointConfig({ learningRate: parseFloat(e.target.value) })
              }
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">最大迭代次数</span>
              <span className="text-gray-300">{adjointConfig.maxIterations}</span>
            </div>
            <input
              type="range"
              min="10"
              max="200"
              step="10"
              value={adjointConfig.maxIterations}
              onChange={(e) =>
                setAdjointConfig({ maxIterations: parseInt(e.target.value) })
              }
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">积分时间步</span>
              <span className="text-gray-300">{adjointConfig.integrationSteps}</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={adjointConfig.integrationSteps}
              onChange={(e) =>
                setAdjointConfig({ integrationSteps: parseInt(e.target.value) })
              }
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">收敛阈值</span>
              <span className="text-gray-300">{adjointConfig.convergenceThreshold.toExponential(1)}</span>
            </div>
            <input
              type="range"
              min="-6"
              max="-2"
              step="1"
              value={Math.log10(adjointConfig.convergenceThreshold)}
              onChange={(e) =>
                setAdjointConfig({ convergenceThreshold: Math.pow(10, parseFloat(e.target.value)) })
              }
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            优化状态
          </h4>

          <div className="bg-gray-800 rounded p-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">当前迭代</span>
              <span className="text-blue-400 font-mono">
                {adjointStats.iteration} / {adjointConfig.maxIterations}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">代价函数</span>
              <span className="text-green-400 font-mono">
                {isFinite(adjointStats.cost) ? adjointStats.cost.toFixed(6) : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">状态</span>
              <span
                className={`font-medium ${
                  adjointStatus === 'running'
                    ? 'text-yellow-400'
                    : adjointStatus === 'converged'
                    ? 'text-green-400'
                    : adjointStatus === 'error'
                    ? 'text-red-400'
                    : 'text-gray-400'
                }`}
              >
                {adjointStatus === 'running'
                  ? '优化中...'
                  : adjointStatus === 'converged'
                  ? '已收敛'
                  : adjointStatus === 'error'
                  ? '错误'
                  : '空闲'}
              </span>
            </div>

            <div className="pt-1">
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300"
                  style={{ width: `${adjointStats.progress * 100}%` }}
                />
              </div>
            </div>
          </div>

          {adjointStats.costHistory.length > 1 && (
            <div className="bg-gray-800 rounded p-2">
              <div className="text-xs text-gray-400 mb-1">代价曲线</div>
              <div className="h-16 flex items-end gap-px">
                {adjointStats.costHistory.slice(-30).map((cost, i) => {
                  const maxCost = Math.max(...adjointStats.costHistory.slice(-30));
                  const minCost = Math.min(...adjointStats.costHistory.slice(-30));
                  const range = maxCost - minCost || 1;
                  const height = ((cost - minCost) / range) * 100;
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-blue-500 opacity-80"
                      style={{ height: `${Math.max(height, 2)}%` }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {!isOptimizing ? (
            <button
              onClick={handleStartOptimization}
              disabled={isOptimizing}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              开始优化
            </button>
          ) : (
            <button
              onClick={handleStopOptimization}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 rounded font-medium text-sm transition-all"
            >
              停止优化
            </button>
          )}
        </div>

        <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded p-3">
          <div className="text-xs text-blue-300">
            <p className="font-medium mb-1">💡 使用说明</p>
            <ul className="space-y-1 text-blue-200 opacity-80">
              <li>• 选择目标涡旋图案后点击"开始优化"</li>
              <li>• 系统将使用伴随方法反推初始速度场</li>
              <li>• 收敛后可将结果应用到模拟中</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
