import { create } from 'zustand';
import type { OHLCVData, BollingerBand, StockState } from '@/types/stock';
import { fetchStockData, calculateBollingerBands } from '@/services/api';

interface StockStore extends StockState {
  setSymbol: (symbol: string) => void;
  setPeriod: (period: number) => void;
  setStdDev: (stdDev: number) => void;
  loadStockData: (symbol: string) => Promise<void>;
  recalculateBollingerBands: () => Promise<void>;
}

export const useStockStore = create<StockStore>((set, get) => ({
  symbol: 'AAPL',
  ohlcvData: [],
  bollingerBands: [],
  period: 20,
  stdDev: 2.0,
  loading: false,
  error: null,

  setSymbol: (symbol: string) => set({ symbol }),
  setPeriod: (period: number) => set({ period }),
  setStdDev: (stdDev: number) => set({ stdDev }),

  loadStockData: async (symbol: string) => {
    set({ loading: true, error: null });
    try {
      const response = await fetchStockData(symbol);
      set({ ohlcvData: response.data, symbol: response.symbol });

      const { period, stdDev } = get();
      const bollingerResponse = await calculateBollingerBands(response.data, period, stdDev);
      set({ bollingerBands: bollingerResponse.bands, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load data',
        loading: false,
      });
    }
  },

  recalculateBollingerBands: async () => {
    const { ohlcvData, period, stdDev } = get();
    if (ohlcvData.length === 0) return;

    set({ loading: true, error: null });
    try {
      const response = await calculateBollingerBands(ohlcvData, period, stdDev);
      set({ bollingerBands: response.bands, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to calculate bands',
        loading: false,
      });
    }
  },
}));
