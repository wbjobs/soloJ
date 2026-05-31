import { TrendingUp, RefreshCw } from 'lucide-react';
import { useStockStore } from '@/store/useStockStore';

const STOCK_SYMBOLS = [
  { value: 'AAPL', label: 'AAPL - Apple Inc.' },
  { value: 'GOOGL', label: 'GOOGL - Alphabet Inc.' },
  { value: 'MSFT', label: 'MSFT - Microsoft Corp.' },
  { value: 'TSLA', label: 'TSLA - Tesla Inc.' },
  { value: 'AMZN', label: 'AMZN - Amazon.com Inc.' },
  { value: 'NVDA', label: 'NVDA - NVIDIA Corp.' },
];

export default function Header() {
  const { symbol, loading, setSymbol, loadStockData } = useStockStore();

  const handleSymbolChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSymbol = e.target.value;
    setSymbol(newSymbol);
    loadStockData(newSymbol);
  };

  const handleRefresh = () => {
    loadStockData(symbol);
  };

  return (
    <header className="bg-[#1a1f2e] border-b border-gray-700 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Stock Analysis
            </h1>
            <p className="text-xs text-gray-400">
              股票技术分析工具
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">股票代码:</label>
            <select
              value={symbol}
              onChange={handleSymbolChange}
              disabled={loading}
              className="bg-[#0f1419] border border-gray-600 text-white px-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50"
            >
              {STOCK_SYMBOLS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新数据
          </button>
        </div>
      </div>
    </header>
  );
}
