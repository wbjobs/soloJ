import { useEffect } from 'react';
import Header from '@/components/Header';
import StockChart from '@/components/StockChart';
import ControlPanel from '@/components/ControlPanel';
import { useStockStore } from '@/store/useStockStore';

export default function Home() {
  const { symbol, loadStockData, error } = useStockStore();

  useEffect(() => {
    loadStockData(symbol);
  }, []);

  return (
    <div className="h-full flex flex-col bg-[#0f1419]">
      <Header />

      {error && (
        <div className="bg-red-900/50 border-b border-red-800 px-6 py-3">
          <p className="text-red-300 text-sm">错误: {error}</p>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        <StockChart />
        <ControlPanel />
      </div>
    </div>
  );
}