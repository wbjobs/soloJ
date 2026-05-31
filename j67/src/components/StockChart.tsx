import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption, ECharts } from 'echarts';
import { Download, X } from 'lucide-react';
import { useStockStore } from '@/store/useStockStore';
import { generateCSVContent, downloadCSV, getCurrentViewRange } from '@/utils/export';

const COLORS = {
  up: '#16c784',
  down: '#ea3943',
  bollingerUpper: '#3b82f6',
  bollingerMiddle: '#a855f7',
  bollingerLower: '#3b82f6',
  volume: '#6366f1',
};

interface HoverData {
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

export default function StockChart() {
  const chartRef = useRef<ReactECharts>(null);
  const { ohlcvData, bollingerBands, symbol, loading } = useStockStore();

  const [hoverData, setHoverData] = useState<HoverData | null>(null);
  const [viewRange, setViewRange] = useState({ start: 60, end: 100 });
  const [showExportMenu, setShowExportMenu] = useState(false);

  const chartData = useMemo(() => {
    if (ohlcvData.length === 0) {
      return {
        dates: [] as string[],
        klineData: [] as (number | null)[][],
        volumeData: [] as (number | null)[],
        upperData: [] as (number | null)[],
        middleData: [] as (number | null)[],
        lowerData: [] as (number | null)[],
        volumeColors: [] as number[],
        dataMap: new Map<string, Omit<HoverData, 'date'>>(),
      };
    }

    const sortedData = [...ohlcvData].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    const dates = sortedData.map((d) => d.date);
    const klineData = sortedData.map((d) => [d.open, d.close, d.low, d.high]);
    const volumeData = sortedData.map((d) => d.volume);
    const volumeColors = sortedData.map((d) => (d.close >= d.open ? 1 : 0));

    const bandMap = new Map(
      bollingerBands.map((b) => [b.date, b])
    );

    const upperData: (number | null)[] = [];
    const middleData: (number | null)[] = [];
    const lowerData: (number | null)[] = [];
    const dataMap = new Map<string, Omit<HoverData, 'date'>>();

    sortedData.forEach((item) => {
      const band = bandMap.get(item.date);
      const upper = band?.upper ?? null;
      const middle = band?.middle ?? null;
      const lower = band?.lower ?? null;

      upperData.push(upper);
      middleData.push(middle);
      lowerData.push(lower);
      dataMap.set(item.date, {
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
        upper,
        middle,
        lower,
      });
    });

    return { dates, klineData, volumeData, upperData, middleData, lowerData, volumeColors, dataMap };
  }, [ohlcvData, bollingerBands]);

  const dataSize = chartData.dates.length;
  const isLargeDataset = dataSize > 2000;

  const handleChartMouseOver = useCallback((params: any) => {
    if (params && params.dataIndex != null) {
      const date = chartData.dates[params.dataIndex];
      const data = chartData.dataMap.get(date);
      if (data) {
        setHoverData({ date, ...data });
      }
    }
  }, [chartData]);

  const handleChartMouseOut = useCallback(() => {
    setHoverData(null);
  }, []);

  const handleDataZoom = useCallback((params: any) => {
    if (params.batch) {
      const batch = params.batch[0];
      if (batch.start != null && batch.end != null) {
        setViewRange({ start: batch.start, end: batch.end });
      }
    }
  }, []);

  const onEvents = useMemo(() => ({
    mouseover: handleChartMouseOver,
    mouseout: handleChartMouseOut,
    dataZoom: handleDataZoom,
  }), [handleChartMouseOver, handleChartMouseOut, handleDataZoom]);

  const handleExportCurrentView = useCallback(() => {
    const { startIndex, endIndex } = getCurrentViewRange(
      chartData.dates.length,
      viewRange.start,
      viewRange.end
    );
    const content = generateCSVContent(ohlcvData, bollingerBands, startIndex, endIndex);
    const filename = `${symbol}_chart_view_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(filename, content);
    setShowExportMenu(false);
  }, [chartData.dates.length, viewRange, ohlcvData, bollingerBands, symbol]);

  const handleExportAllData = useCallback(() => {
    const content = generateCSVContent(ohlcvData, bollingerBands);
    const filename = `${symbol}_complete_data_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(filename, content);
    setShowExportMenu(false);
  }, [ohlcvData, bollingerBands, symbol]);

  const option: EChartsOption = useMemo(() => {
    const { dates, klineData, volumeData, upperData, middleData, lowerData, volumeColors } = chartData;

    return {
      backgroundColor: '#0f1419',
      animation: !isLargeDataset,
      animationDuration: isLargeDataset ? 0 : 300,
      animationEasingUpdate: 'quinticInOut',
      textStyle: {
        color: '#9ca3af',
        fontFamily: "'JetBrains Mono', 'Inter', monospace",
      },
      useUTC: true,
      tooltip: {
        show: false,
      },
      legend: {
        data: ['K线', '上轨', '中轨', '下轨', '成交量'],
        top: 10,
        right: 20,
        textStyle: {
          color: '#9ca3af',
          fontSize: 12,
        },
        icon: 'roundRect',
        itemWidth: 12,
        itemHeight: 8,
        selectedMode: true,
      },
      axisPointer: {
        link: [
          { xAxisIndex: [0, 1] }
        ],
      },
      grid: [
        {
          left: 70,
          right: 50,
          top: 70,
          height: '52%',
          containLabel: false,
        },
        {
          left: 70,
          right: 50,
          top: '65%',
          height: '15%',
          containLabel: false,
        },
      ],
      xAxis: [
        {
          type: 'category',
          data: dates,
          boundaryGap: true,
          axisLine: { lineStyle: { color: '#374151', width: 1 } },
          axisLabel: {
            color: '#6b7280',
            fontSize: 10,
            hideOverlap: true,
            align: 'center',
          },
          splitLine: { show: false },
          axisTick: { show: false },
          gridIndex: 0,
          min: 'dataMin',
          max: 'dataMax',
          axisPointer: {
            show: true,
            type: 'line',
            lineStyle: {
              color: '#6366f1',
              width: 1,
              type: 'dashed',
            },
            snap: true,
            label: {
              show: true,
              backgroundColor: '#6366f1',
              color: '#fff',
              fontSize: 10,
              padding: [2, 6],
              borderRadius: 3,
            },
          },
        },
        {
          type: 'category',
          data: dates,
          boundaryGap: true,
          axisLine: { lineStyle: { color: '#374151', width: 1 } },
          axisLabel: { show: false },
          splitLine: { show: false },
          axisTick: { show: false },
          gridIndex: 1,
          min: 'dataMin',
          max: 'dataMax',
          axisPointer: {
            show: true,
            type: 'line',
            lineStyle: {
              color: '#6366f1',
              width: 1,
              type: 'dashed',
            },
            snap: true,
          },
        },
      ],
      yAxis: [
        {
          type: 'value',
          scale: true,
          position: 'left',
          axisLine: { show: false },
          axisLabel: {
            color: '#6b7280',
            fontSize: 10,
            formatter: (value: number) => value.toFixed(0),
          },
          splitLine: { lineStyle: { color: '#1f2937', type: 'dashed', width: 1 } },
          splitNumber: 4,
          gridIndex: 0,
          axisPointer: {
            show: true,
            type: 'line',
            lineStyle: {
              color: '#6366f1',
              width: 1,
              type: 'dashed',
            },
            label: {
              show: true,
              backgroundColor: '#6366f1',
              color: '#fff',
              fontSize: 10,
              padding: [2, 6],
              borderRadius: 3,
              formatter: (params: any) => params.value.toFixed(2),
            },
          },
        },
        {
          type: 'value',
          scale: true,
          position: 'left',
          axisLine: { show: false },
          axisLabel: {
            color: '#6b7280',
            fontSize: 10,
            formatter: (value: number) => (value / 1000000).toFixed(0) + 'M',
          },
          splitLine: { show: false },
          splitNumber: 2,
          gridIndex: 1,
        },
      ],
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: [0, 1],
          yAxisIndex: [],
          start: Math.max(0, 100 - (5000 / dataSize) * 100),
          end: 100,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          moveOnMouseWheel: false,
          preventDefaultMouseMove: true,
          throttle: 50,
          filterMode: 'weakFilter',
        },
        {
          type: 'slider',
          xAxisIndex: [0, 1],
          start: Math.max(0, 100 - (5000 / dataSize) * 100),
          end: 100,
          bottom: 10,
          height: 24,
          borderColor: '#374151',
          fillerColor: 'rgba(59, 130, 246, 0.15)',
          handleStyle: {
            color: '#3b82f6',
            borderColor: '#3b82f6',
            borderWidth: 1,
          },
          textStyle: {
            color: '#6b7280',
            fontSize: 10,
          },
          brushSelect: true,
          showDetail: true,
          showDataShadow: false,
          handleSize: '100%',
          throttle: 50,
        },
      ],
      visualMap: {
        show: false,
        seriesIndex: 4,
        dimension: 1,
        pieces: [
          { value: 1, color: COLORS.up },
          { value: 0, color: COLORS.down },
        ],
      },
      series: [
        {
          name: 'K线',
          type: 'candlestick',
          data: klineData,
          xAxisIndex: 0,
          yAxisIndex: 0,
          itemStyle: {
            color: COLORS.up,
            color0: COLORS.down,
            borderColor: COLORS.up,
            borderColor0: COLORS.down,
            borderWidth: 1,
          },
          barMaxWidth: 15,
          barMinWidth: 2,
        },
        {
          name: '上轨',
          type: 'line',
          data: upperData,
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: false,
          symbol: 'none',
          lineStyle: {
            color: COLORS.bollingerUpper,
            width: 1,
            type: 'dashed',
          },
          sampling: 'lttb',
          large: isLargeDataset,
          largeThreshold: 2000,
          silent: true,
        },
        {
          name: '中轨',
          type: 'line',
          data: middleData,
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: false,
          symbol: 'none',
          lineStyle: {
            color: COLORS.bollingerMiddle,
            width: 2,
          },
          sampling: 'lttb',
          large: isLargeDataset,
          largeThreshold: 2000,
          silent: true,
        },
        {
          name: '下轨',
          type: 'line',
          data: lowerData,
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: false,
          symbol: 'none',
          lineStyle: {
            color: COLORS.bollingerLower,
            width: 1,
            type: 'dashed',
          },
          sampling: 'lttb',
          large: isLargeDataset,
          largeThreshold: 2000,
          silent: true,
        },
        {
          name: '成交量',
          type: 'bar',
          data: volumeData.map((v, i) => [v, volumeColors[i]]),
          xAxisIndex: 1,
          yAxisIndex: 1,
          large: isLargeDataset,
          largeThreshold: 2000,
          silent: true,
          barMaxWidth: 15,
          barMinWidth: 2,
        },
      ],
    };
  }, [chartData, isLargeDataset, dataSize]);

  useEffect(() => {
    const handleResize = () => {
      if (chartRef.current) {
        chartRef.current.getEchartsInstance().resize();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { startIndex, endIndex } = getCurrentViewRange(
    chartData.dates.length,
    viewRange.start,
    viewRange.end
  );
  const viewDataCount = endIndex - startIndex;

  if (loading && ohlcvData.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0f1419]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">加载数据中...</p>
        </div>
      </div>
    );
  }

  if (ohlcvData.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0f1419]">
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-2">暂无数据</p>
          <p className="text-gray-500 text-sm">请选择股票代码或刷新数据</p>
        </div>
      </div>
    );
  }

  const currentData = ohlcvData[ohlcvData.length - 1];
  const prevData = ohlcvData[ohlcvData.length - 2];
  const priceChange = prevData ? currentData.close - prevData.close : 0;
  const priceChangePercent = prevData ? (priceChange / prevData.close) * 100 : 0;
  const isUp = priceChange >= 0;

  return (
    <div className="flex-1 flex flex-col bg-[#0f1419] p-4 min-h-0 relative">
      {hoverData && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 bg-[#1a1f2e]/95 backdrop-blur-sm border border-gray-700 rounded-xl px-6 py-3 shadow-2xl">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">日期</p>
              <p className="text-sm font-semibold text-white">{hoverData.date}</p>
            </div>
            <div className="w-px h-10 bg-gray-700"></div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">开盘</p>
              <p className="text-sm font-semibold text-white">${hoverData.open.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">收盘</p>
              <p className={`text-sm font-semibold ${hoverData.close >= hoverData.open ? 'text-green-400' : 'text-red-400'}`}>
                ${hoverData.close.toFixed(2)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">最高</p>
              <p className="text-sm font-semibold text-green-400">${hoverData.high.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">最低</p>
              <p className="text-sm font-semibold text-red-400">${hoverData.low.toFixed(2)}</p>
            </div>
            <div className="w-px h-10 bg-gray-700"></div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">上轨</p>
              <p className="text-sm font-semibold text-blue-400">
                {hoverData.upper != null ? `$${hoverData.upper.toFixed(2)}` : '-'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">中轨</p>
              <p className="text-sm font-semibold text-purple-400">
                {hoverData.middle != null ? `$${hoverData.middle.toFixed(2)}` : '-'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">下轨</p>
              <p className="text-sm font-semibold text-blue-400">
                {hoverData.lower != null ? `$${hoverData.lower.toFixed(2)}` : '-'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 flex items-end justify-between flex-shrink-0">
        <div>
          <div className="flex items-baseline gap-3">
            <h2 className="text-2xl font-bold text-white">{symbol}</h2>
            <span
              className={`text-3xl font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}
            >
              ${currentData.close.toFixed(2)}
            </span>
            <span
              className={`text-lg font-medium ${isUp ? 'text-green-400' : 'text-red-400'}`}
            >
              {isUp ? '+' : ''}
              {priceChange.toFixed(2)} ({isUp ? '+' : ''}
              {priceChangePercent.toFixed(2)}%)
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {ohlcvData.length.toLocaleString()} 个交易日数据 | 视图显示 {viewDataCount} 条 | 最后更新: {currentData.date}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-2 bg-[#1a1f2e] hover:bg-[#252b3b] border border-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
            >
              <Download className="w-4 h-4" />
              导出数据
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-2 bg-[#1a1f2e] border border-gray-700 rounded-lg shadow-xl py-2 min-w-[180px] z-30">
                <button
                  onClick={handleExportCurrentView}
                  className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-[#252b3b] hover:text-white transition-colors"
                >
                  导出当前视图 ({viewDataCount} 条)
                </button>
                <button
                  onClick={handleExportAllData}
                  className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-[#252b3b] hover:text-white transition-colors"
                >
                  导出全部数据 ({ohlcvData.length.toLocaleString()} 条)
                </button>
              </div>
            )}
          </div>
          {showExportMenu && (
            <button
              onClick={() => setShowExportMenu(false)}
              className="p-2 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        <ReactECharts
          ref={chartRef}
          option={option}
          style={{ height: '100%', width: '100%' }}
          notMerge={true}
          lazyUpdate={true}
          opts={{ renderer: 'canvas' }}
          onEvents={onEvents}
        />
      </div>

      <div className="mt-3 flex items-center justify-center gap-6 text-xs text-gray-500 flex-shrink-0">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-blue-500 border-dashed"></span>
          鼠标滚轮缩放
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-purple-500"></span>
          拖拽平移
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-indigo-500 rounded-sm"></span>
          底部滑块选择区域
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 border border-indigo-400 rounded-full"></span>
          十字光标联动
        </span>
        {isLargeDataset && (
          <span className="flex items-center gap-1 text-yellow-500">
            <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
            大数据量模式已启用
          </span>
        )}
      </div>
    </div>
  );
}
