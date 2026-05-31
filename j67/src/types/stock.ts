export interface OHLCVData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BollingerBand {
  date: string;
  upper: number | null;
  middle: number | null;
  lower: number | null;
}

export interface StockResponse {
  symbol: string;
  startDate: string;
  endDate: string;
  data: OHLCVData[];
}

export interface BollingerRequest {
  data: OHLCVData[];
  period: number;
  stdDev: number;
}

export interface BollingerResponse {
  bands: BollingerBand[];
  period: number;
  stdDev: number;
}

export interface StockState {
  symbol: string;
  ohlcvData: OHLCVData[];
  bollingerBands: BollingerBand[];
  period: number;
  stdDev: number;
  loading: boolean;
  error: string | null;
}
