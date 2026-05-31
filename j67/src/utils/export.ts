import type { OHLCVData, BollingerBand } from '@/types/stock';

export interface ExportDataRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  upper: number | null;
  middle: number | null;
  lower: number | null;
}

export function generateCSVContent(
  ohlcvData: OHLCVData[],
  bollingerBands: BollingerBand[],
  startIndex: number = 0,
  endIndex?: number
): string {
  const sortedOhlcv = [...ohlcvData].sort((a, b) => a.date.localeCompare(b.date));
  const bandMap = new Map(bollingerBands.map(b => [b.date, b]));

  const actualEnd = endIndex ?? sortedOhlcv.length;
  const viewData = sortedOhlcv.slice(startIndex, actualEnd);

  const headers = ['Date', 'Open', 'High', 'Low', 'Close', 'Volume', 'Upper Band', 'Middle Band', 'Lower Band'];

  const rows = viewData.map(item => {
    const band = bandMap.get(item.date);
    return [
      item.date,
      item.open.toString(),
      item.high.toString(),
      item.low.toString(),
      item.close.toString(),
      item.volume.toString(),
      band?.upper?.toString() ?? '',
      band?.middle?.toString() ?? '',
      band?.lower?.toString() ?? '',
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function downloadCSV(
  filename: string,
  content: string
): void {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });

  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export function getCurrentViewRange(
  dataLength: number,
  startPercent: number,
  endPercent: number
): { startIndex: number; endIndex: number } {
  const startIndex = Math.floor(dataLength * (startPercent / 100));
  const endIndex = Math.ceil(dataLength * (endPercent / 100));
  return { startIndex, endIndex: Math.min(endIndex, dataLength) };
}
