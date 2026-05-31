import React, { useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { VisualizationMode } from '@/store/useAppStore';

const VISUALIZATION_MODES: { value: VisualizationMode; label: string; icon: string }[] = [
  { value: 'particles', label: '粒子', icon: '●' },
  { value: 'streamlines', label: '流线', icon: '〰' },
  { value: 'vorticity', label: '涡度', icon: '🌀' },
  { value: 'ftle_forward', label: '前向FTLE', icon: '→' },
  { value: 'ftle_backward', label: '后向FTLE', icon: '←' },
  { value: 'lcs_ridges', label: 'LCS屏障', icon: '║' },
];

export const LCSPanel: React.FC = () => {
  const {
    visualizationMode,
    lcsConfig,
    lcsStats,
    lcsEnabled,
    setVisualizationMode,
    setLCSConfig,
    setLCSEnabled,
    setShowLCSPanel,
  } = useAppStore();

  const handleComputeLCS = useCallback(() => {
    setLCSEnabled(true);
  }, [setLCSEnabled]);

  return (
    <div className="absolute top-4 left-4 w-80 bg-gray-900 bg-opacity-95 rounded-lg shadow-xl border border-gray-700 text-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <h3 className="font-semibold text-sm">拉格朗日拟序结构 (LCS)</h3>
        <button
          onClick={() => setShowLCSPanel(false)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">
            可视化模式
          </label>
          <div className="grid grid-cols-3 gap-2">
            {VISUALIZATION_MODES.map((mode) => (
              <button
                key={mode.value}
                onClick={() => setVisualizationMode(mode.value)}
                className={`px-2 py-3 rounded text-center transition-all ${
                  visualizationMode === mode.value
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <div className="text-lg mb-1">{mode.icon}</div>
                <div className="text-xs">{mode.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            FTLE计算参数
          </h4>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">积分时间</span>
              <span className="text-gray-300">{lcsConfig.integrationTime.toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.5"
              value={lcsConfig.integrationTime}
              onChange={(e) =>
                setLCSConfig({ integrationTime: parseFloat(e.target.value) })
              }
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">积分步数</span>
              <span className="text-gray-300">{lcsConfig.integrationSteps}</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={lcsConfig.integrationSteps}
              onChange={(e) =>
                setLCSConfig({ integrationSteps: parseInt(e.target.value) })
              }
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">阈值</span>
              <span className="text-gray-300">{lcsConfig.ridgeThreshold.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={lcsConfig.ridgeThreshold}
              onChange={(e) =>
                setLCSConfig({ ridgeThreshold: parseFloat(e.target.value) })
              }
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">计算后向FTLE</span>
            <button
              onClick={() =>
                setLCSConfig({ computeBackwardFTLE: !lcsConfig.computeBackwardFTLE })
              }
              className={`w-12 h-6 rounded-full transition-colors ${
                lcsConfig.computeBackwardFTLE ? 'bg-purple-600' : 'bg-gray-600'
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  lcsConfig.computeBackwardFTLE ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            计算状态
          </h4>

          <div className="bg-gray-800 rounded p-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">前向FTLE最大值</span>
              <span className="text-purple-400 font-mono">
                {lcsStats.forwardFTLEMax.toFixed(3)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">后向FTLE最大值</span>
              <span className="text-orange-400 font-mono">
                {lcsStats.backwardFTLEMax.toFixed(3)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">计算耗时</span>
              <span className="text-green-400 font-mono">
                {lcsStats.computationTime.toFixed(1)}ms
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">状态</span>
              <span className={lcsEnabled ? 'text-green-400' : 'text-gray-400'}>
                {lcsEnabled ? '已启用' : '未启用'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleComputeLCS}
          className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded font-medium text-sm transition-all"
        >
          计算LCS结构
        </button>

        <div className="bg-purple-900 bg-opacity-30 border border-purple-700 rounded p-3">
          <div className="text-xs text-purple-300">
            <p className="font-medium mb-1">📊 LCS说明</p>
            <ul className="space-y-1 text-purple-200 opacity-80">
              <li>• <strong>FTLE</strong>: 有限时间李雅普诺夫指数</li>
              <li>• <strong>高FTLE</strong>: 粒子分离区域</li>
              <li>• <strong>LCS脊线</strong>: 物质输运屏障</li>
              <li>• <strong>前向/后向</strong>: 吸引/排斥屏障</li>
            </ul>
          </div>
        </div>

        <div className="bg-gray-800 rounded p-3">
          <div className="text-xs font-medium text-gray-400 mb-2">颜色映射</div>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">低FTLE</span>
                <span className="text-gray-500">高FTLE</span>
              </div>
              <div className="h-4 rounded bg-gradient-to-r from-blue-900 via-purple-600 to-yellow-400" />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              前向FTLE: 蓝色→黄色 &nbsp;|&nbsp; 后向FTLE: 青色→红色
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
