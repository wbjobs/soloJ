import { useState, useEffect, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  AlertCircle,
  Copy,
  Check,
  Calendar,
  TrendingUp,
  Bug,
  ExternalLink,
} from 'lucide-react';
import type { ServiceNode, ErrorLog } from '../../../shared/types';
import { getServiceErrors } from '../../services/api';
import { formatTime, getStatusColor } from '../../utils/format';
import EmptyState from '../common/EmptyState';
import LoadingSpinner from '../common/LoadingSpinner';

interface ErrorPanelProps {
  service: ServiceNode | null;
  loading: boolean;
  onTraceClick?: (traceId: string) => void;
}

type TimeFilter = 'all' | 'today' | 'week';

export default function ErrorPanel({ service, loading, onTraceClick }: ErrorPanelProps) {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [errorsLoading, setErrorsLoading] = useState(false);
  const [selectedError, setSelectedError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchErrors = useCallback(async () => {
    if (!service) return;
    setErrorsLoading(true);
    try {
      const res = await getServiceErrors(service.id);
      if (res.success && res.data) setErrors(res.data);
    } catch (err) {
      console.error('Failed to fetch errors:', err);
    } finally {
      setErrorsLoading(false);
    }
  }, [service]);

  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const filterErrors = (errs: ErrorLog[]) => {
    const now = new Date();
    if (timeFilter === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return errs.filter((e) => new Date(e.timestamp).getTime() >= startOfDay);
    }
    if (timeFilter === 'week') {
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime();
      return errs.filter((e) => new Date(e.timestamp).getTime() >= startOfWeek);
    }
    return errs;
  };

  const filteredErrors = filterErrors(errors);
  const totalErrors = filteredErrors.length;
  const errorRate = service && service.callCount > 0
    ? ((service.errorCount / service.callCount) * 100).toFixed(2)
    : '0';

  const getPieChartOption = () => {
    const typeCounts = filteredErrors.reduce((acc, err) => {
      acc[err.errorType] = (acc[err.errorType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const colors = [
      'rgba(239, 68, 68, 0.8)',
      'rgba(245, 158, 11, 0.8)',
      'rgba(139, 92, 246, 0.8)',
      'rgba(59, 130, 246, 0.8)',
      'rgba(236, 72, 153, 0.8)',
    ];

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        textStyle: { color: '#f3f4f6' },
        formatter: '{b}: {c} ({d}%)',
      },
      legend: {
        orient: 'vertical',
        right: '5%',
        top: 'center',
        textStyle: { color: '#9ca3af' },
      },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 4, borderColor: 'rgba(0, 0, 0, 0.3)', borderWidth: 2 },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 14, fontWeight: 'bold', color: '#fff' },
        },
        data: Object.entries(typeCounts).map(([name, value], idx) => ({
          value,
          name,
          itemStyle: { color: colors[idx % colors.length] },
        })),
      }],
    };
  };

  const getTrendChartOption = () => {
    const hours = [];
    const counts = [];
    const now = new Date();

    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
      hours.push(`${hour.getHours().toString().padStart(2, '0')}:00`);
      const hourStart = hour.getTime();
      const hourEnd = hourStart + 60 * 60 * 1000;
      const count = errors.filter((e) => {
        const t = new Date(e.timestamp).getTime();
        return t >= hourStart && t < hourEnd;
      }).length;
      counts.push(count);
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        textStyle: { color: '#f3f4f6' },
        formatter: '{b0}<br/>错误数: {c0}',
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: hours,
        axisLabel: { color: '#9ca3af', rotate: 30 },
        axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
      },
      yAxis: {
        type: 'value',
        name: '错误数',
        nameTextStyle: { color: '#9ca3af' },
        axisLabel: { color: '#9ca3af' },
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } },
      },
      series: [{
        type: 'line',
        data: counts,
        smooth: true,
        itemStyle: { color: 'rgba(239, 68, 68, 0.8)' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(239, 68, 68, 0.3)' },
              { offset: 1, color: 'rgba(239, 68, 68, 0.05)' },
            ],
          },
        },
      }],
    };
  };

  const SkeletonLoader = () => (
    <div className="h-full flex flex-col">
      <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg animate-pulse" style={{ background: 'rgba(255, 255, 255, 0.1)' }} />
          <div className="flex-1">
            <div className="h-5 w-32 rounded animate-pulse mb-2" style={{ background: 'rgba(255, 255, 255, 0.1)' }} />
            <div className="h-4 w-16 rounded animate-pulse" style={{ background: 'rgba(255, 255, 255, 0.1)' }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-3 rounded-lg" style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
              <div className="h-3 w-16 rounded animate-pulse mb-2" style={{ background: 'rgba(255, 255, 255, 0.1)' }} />
              <div className="h-5 w-12 rounded animate-pulse" style={{ background: 'rgba(255, 255, 255, 0.1)' }} />
            </div>
          ))}
        </div>
      </div>
      <div className="h-40 rounded-xl animate-pulse mb-4" style={{ background: 'rgba(255, 255, 255, 0.05)' }} />
      <div className="flex-1 space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-4 rounded-lg animate-pulse" style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded" style={{ background: 'rgba(255, 255, 255, 0.1)' }} />
              <div className="flex-1">
                <div className="h-4 w-3/4 rounded mb-1" style={{ background: 'rgba(255, 255, 255, 0.1)' }} />
                <div className="h-3 w-1/2 rounded" style={{ background: 'rgba(255, 255, 255, 0.1)' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (loading || errorsLoading) {
    return <SkeletonLoader />;
  }

  if (!service) {
    return <EmptyState icon="AlertTriangle" title="选择一个服务" description="点击拓扑图中的服务节点查看错误信息" />;
  }

  const timeFilters = [
    { id: 'all', label: '全部' },
    { id: 'today', label: '今日' },
    { id: 'week', label: '本周' },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30">
              <Bug className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{service.name}</h2>
              <span className={`text-sm ${getStatusColor(service.status)} capitalize`}>{service.status}</span>
            </div>
          </div>
          <div className="flex gap-1 p-1 rounded-lg bg-white/5">
            {timeFilters.map((f) => (
              <button
                key={f.id}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  timeFilter === f.id ? 'bg-blue-500/30 text-white' : 'text-gray-400 hover:text-white'
                }`}
                onClick={() => setTimeFilter(f.id as TimeFilter)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-white/5">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <AlertCircle className="w-3 h-3" />
              总错误数
            </div>
            <div className="text-xl font-bold text-red-400">{totalErrors}</div>
          </div>
          <div className="p-3 rounded-lg bg-white/5">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <TrendingUp className="w-3 h-3" />
              错误率
            </div>
            <div className="text-xl font-bold text-amber-400">{errorRate}%</div>
          </div>
          <div className="p-3 rounded-lg bg-white/5">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <Calendar className="w-3 h-3" />
              最近错误
            </div>
            <div className="text-sm font-medium text-white">
              {filteredErrors.length > 0 ? formatTime(filteredErrors[0].timestamp) : '-'}
            </div>
          </div>
        </div>
      </div>

      {filteredErrors.length > 0 && (
        <div className="space-y-4 mb-4">
          <div className="h-48">
            <ReactECharts option={getTrendChartOption()} style={{ height: '100%' }} theme="dark" />
          </div>
          <div className="h-48">
            <ReactECharts option={getPieChartOption()} style={{ height: '100%' }} theme="dark" />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {filteredErrors.length === 0 ? (
          <EmptyState icon="Check" title="暂无错误" description="该服务在当前时间范围内没有错误记录" />
        ) : (
          <div className="overflow-y-auto h-full space-y-2 pr-2">
            {filteredErrors.map((error) => (
              <div key={error.id} className="rounded-lg overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <button
                  className="w-full p-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
                  onClick={() => setSelectedError(selectedError === error.id ? null : error.id)}
                >
                  {selectedError === error.id ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-red-400 truncate">{error.errorType}</div>
                    <div className="text-xs text-gray-400 truncate">{error.message}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs text-gray-500">{formatTime(error.timestamp)}</div>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs text-gray-500 font-mono truncate max-w-20">{error.traceId.slice(0, 8)}...</span>
                      <button
                        className="p-0.5 rounded hover:bg-white/10 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(error.traceId, error.id);
                        }}
                      >
                        {copiedId === error.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-gray-400" />}
                      </button>
                      <button
                        className="p-0.5 rounded hover:bg-white/10 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTraceClick?.(error.traceId);
                        }}
                      >
                        <ExternalLink className="w-3 h-3 text-blue-400" />
                      </button>
                    </div>
                  </div>
                </button>
                {selectedError === error.id && error.stackTrace && (
                  <div className="p-3 border-t border-white/10 bg-black/20">
                    <div className="text-xs font-medium text-gray-400 mb-2">堆栈信息</div>
                    <pre className="bg-black/30 rounded p-2 text-xs font-mono text-gray-300 overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap">
                      {error.stackTrace}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
