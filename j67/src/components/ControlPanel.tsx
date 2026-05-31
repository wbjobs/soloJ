import { Settings, RefreshCw } from 'lucide-react';
import { useStockStore } from '@/store/useStockStore';

export default function ControlPanel() {
  const {
    period,
    stdDev,
    loading,
    setPeriod,
    setStdDev,
    recalculateBollingerBands,
  } = useStockStore();

  const handleApply = () => {
    recalculateBollingerBands();
  };

  const handlePeriodChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setPeriod(value);
  };

  const handleStdDevChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setStdDev(value);
  };

  return (
    <div className="w-72 bg-[#1a1f2e] border-l border-gray-700 p-5 flex flex-col gap-6">
      <div className="flex items-center gap-2 pb-4 border-b border-gray-700">
        <Settings className="w-5 h-5 text-blue-400" />
        <h3 className="text-white font-semibold">指标参数设置</h3>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm text-gray-400">布林带周期</label>
            <span className="text-sm font-mono text-blue-400">{period}</span>
          </div>
          <input
            type="range"
            min="5"
            max="50"
            step="1"
            value={period}
            onChange={handlePeriodChange}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-4
              [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:bg-blue-500
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:transition-transform
              [&::-webkit-slider-thumb]:hover:scale-110"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>5</span>
            <span>25</span>
            <span>50</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm text-gray-400">标准差倍数</label>
            <span className="text-sm font-mono text-purple-400">{stdDev.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="1"
            max="3"
            step="0.1"
            value={stdDev}
            onChange={handleStdDevChange}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-4
              [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:bg-purple-500
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:transition-transform
              [&::-webkit-slider-thumb]:hover:scale-110"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>1.0</span>
            <span>2.0</span>
            <span>3.0</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleApply}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 px-4 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-auto"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        重新计算布林带
      </button>

      <div className="space-y-3 pt-4 border-t border-gray-700">
        <h4 className="text-sm font-medium text-gray-300">布林带说明</h4>
        <div className="space-y-2 text-xs text-gray-500">
          <p>
            <span className="inline-block w-3 h-0.5 bg-blue-500 mr-2 border-dashed"></span>
            <span className="text-blue-400">上轨</span>: 中轨 + 标准差 × N
          </p>
          <p>
            <span className="inline-block w-3 h-0.5 bg-purple-500 mr-2"></span>
            <span className="text-purple-400">中轨</span>: N 日简单移动平均线
          </p>
          <p>
            <span className="inline-block w-3 h-0.5 bg-blue-500 mr-2 border-dashed"></span>
            <span className="text-blue-400">下轨</span>: 中轨 - 标准差 × N
          </p>
        </div>
        <div className="bg-[#0f1419] rounded-lg p-3 text-xs text-gray-400 leading-relaxed">
          <p className="mb-2">
            <span className="text-yellow-400">交易信号:</span>
          </p>
          <p>• 价格突破上轨 → 超买信号</p>
          <p>• 价格跌破下轨 → 超卖信号</p>
          <p>• 带宽收窄 → 变盘信号</p>
        </div>
      </div>
    </div>
  );
}
