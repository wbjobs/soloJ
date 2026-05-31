import React, { useEffect, useState, useCallback } from 'react';
import { getAuditStats } from '../services/api';
import type { HourlyStats } from '../types';

const StatsChart: React.FC = () => {
  const [stats, setStats] = useState<HourlyStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hours, setHours] = useState(24);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAuditStats(hours);
      setStats(data);
    } catch (err) {
      setError('获取统计数据失败');
    } finally {
      setLoading(false);
    }
  }, [hours]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const chartWidth = 800;
  const chartHeight = 300;
  const padding = { top: 30, right: 30, bottom: 50, left: 50 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  const maxCount = stats
    ? Math.max(...stats.counts, 1)
    : 1;

  const points: string[] = [];
  const dots: Array<{ cx: number; cy: number; value: number; label: string }> = [];

  if (stats && stats.counts.length > 0) {
    const step = plotWidth / Math.max(stats.counts.length - 1, 1);
    stats.counts.forEach((count, i) => {
      const x = padding.left + i * step;
      const y = padding.top + plotHeight - (count / maxCount) * plotHeight;
      points.push(`${x},${y}`);
      dots.push({ cx: x, cy: y, value: count, label: stats.hours[i] || '' });
    });
  }

  const areaPath = points.length > 0
    ? `M ${padding.left},${padding.top + plotHeight} L ${points.join(' L ')} L ${padding.left + plotWidth},${padding.top + plotHeight} Z`
    : '';

  const linePath = points.length > 0 ? `M ${points.join(' L ')}` : '';

  const yAxisTicks = 5;
  const yAxisLabels = Array.from({ length: yAxisTicks + 1 }, (_, i) =>
    Math.round((maxCount / yAxisTicks) * i)
  );

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">脱敏文件处理统计</h3>
        <div className="flex items-center gap-2">
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={12}>近 12 小时</option>
            <option value={24}>近 24 小时</option>
            <option value={48}>近 48 小时</option>
            <option value={72}>近 72 小时</option>
            <option value={168}>近 7 天</option>
          </select>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="text-sm px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
          >
            {loading ? '加载中...' : '刷新'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {!stats && loading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {stats && stats.counts.length === 0 && !loading && (
        <div className="flex items-center justify-center h-64 text-gray-500">
          暂无数据
        </div>
      )}

      {stats && stats.counts.length > 0 && (
        <>
          <div className="flex justify-center overflow-x-auto">
            <svg
              width={chartWidth}
              height={chartHeight}
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full max-w-4xl"
            >
              <defs>
                <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {yAxisLabels.map((val, i) => {
                const y = padding.top + plotHeight - (val / maxCount) * plotHeight;
                return (
                  <g key={`y-${i}`}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={padding.left + plotWidth}
                      y2={y}
                      stroke="#E5E7EB"
                      strokeDasharray="4,4"
                    />
                    <text
                      x={padding.left - 8}
                      y={y}
                      textAnchor="end"
                      dominantBaseline="middle"
                      className="text-xs fill-gray-500"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              <line
                x1={padding.left}
                y1={padding.top + plotHeight}
                x2={padding.left + plotWidth}
                y2={padding.top + plotHeight}
                stroke="#D1D5DB"
              />
              <line
                x1={padding.left}
                y1={padding.top}
                x2={padding.left}
                y2={padding.top + plotHeight}
                stroke="#D1D5DB"
              />

              {areaPath && <path d={areaPath} fill="url(#areaGradient)" />}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}

              {dots.map((dot, i) => {
                const showLabel = stats.counts.length <= 24 || i % 2 === 0;
                return (
                  <g key={`dot-${i}`}>
                    <circle
                      cx={dot.cx}
                      cy={dot.cy}
                      r="4"
                      fill="#3B82F6"
                      stroke="white"
                      strokeWidth="2"
                      className="cursor-pointer"
                    >
                      <title>{`${dot.label}: ${dot.value} 条`}</title>
                    </circle>
                    {showLabel && (
                      <text
                        x={dot.cx}
                        y={padding.top + plotHeight + 16}
                        textAnchor="middle"
                        className="text-[10px] fill-gray-500"
                        transform={`rotate(-45, ${dot.cx}, ${padding.top + plotHeight + 16})`}
                      >
                        {dot.label.length > 16
                          ? dot.label.substring(11, 16)
                          : dot.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-gray-500">
              共 <span className="font-semibold text-gray-700">{stats.total}</span> 条审计记录
            </span>
            <span className="text-gray-400">
              {stats.hours.length > 0
                ? `${stats.hours[0]} ~ ${stats.hours[stats.hours.length - 1]}`
                : ''}
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default StatsChart;
