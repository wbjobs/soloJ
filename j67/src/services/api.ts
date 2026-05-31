import type { OHLCVData, StockResponse, BollingerRequest, BollingerResponse } from '@/types/stock';

const API_BASE = '/api';

export async function fetchStockData(
  symbol: string,
  startDate?: string,
  endDate?: string
): Promise<StockResponse> {
  const params = new URLSearchParams({ symbol });
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const response = await fetch(`${API_BASE}/stock?${params}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export async function calculateBollingerBands(
  data: OHLCVData[],
  period: number = 20,
  stdDev: number = 2.0
): Promise<BollingerResponse> {
  const body: BollingerRequest = { data, period, stdDev };

  const response = await fetch(`${API_BASE}/bollinger`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}
