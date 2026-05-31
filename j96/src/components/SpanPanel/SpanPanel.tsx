import { useState, useEffect, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { ChevronDown, ChevronRight, Clock, AlertCircle, CheckCircle2, Zap, Server, AlertOctagon } from 'lucide-react';
import type { ServiceNode, Span } from '../../../shared/types';
import { getServiceSpans } from '../../services/api';
import { formatDuration, formatTime, getStatusColor } from '../../utils/format';
import TabSwitcher from '../common/TabSwitcher';
import EmptyState from '../common/EmptyState';

interface SpanPanelProps {
  service: ServiceNode | null;
  loading: boolean;
}

export default function SpanPanel({ service, loading }: SpanPanelProps) {
  const [spans, setSpans] = useState<Span[]>([]);
  const [spansLoading, setSpansLoading] = useState(false);
  const [selectedSpan, setSelectedSpan] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('list');

  const fetchSpans = useCallback(async () => {
    if (!service) return;
    setSpansLoading(true);
    try {
      const res = await getServiceSpans(service.id);
      if (res.success && res.data) {
        setSpans(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch spans:', err);
    } finally {
      setSpansLoading(false);
    }
  }, [service]);

  useEffect(() => {
    fetchSpans();
  }, [fetchSpans]);

  const tabs = [
    { id: 'list', label: '调用列表', count: spans.length },
    { id: 'duration', label: '耗时分析' },
    { id: 'waterfall', label: '瀑布图' },
  ];

  const baseChart = {
    backgroundColor: 'transparent',
    tooltip: {
      backgroundColor: 'rgba(17, 24, 39, 0.95)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      textStyle: { color: '#f3f4f6' }
    },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
  };

  const getDurationChartOption = () => ({
    ...baseChart,
    tooltip: {
      ...baseChart.tooltip,
      trigger: 'axis',
      formatter: (p: any) => {
        const s = spans[p[0].dataIndex];
        return `${s.name}<br/>耗时: ${formatDuration(s.duration)}`;
      }
    },
    xAxis: {
      type: 'category',
      data: spans.map((s) => s.name.slice(0, 20) + (s.name.length > 20 ? '...' : '')),
      axisLabel: { color: '#9ca3af', rotate: 30 },
      axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
    },
    yAxis: {
      type: 'value',
      name: '耗时 (ms)',
      nameTextStyle: { color: '#9ca3af' },
      axisLabel: { color: '#9ca3af', formatter: (v: number) => `${(v / 1000000).toFixed(0)}` },
      splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } },
    },
    series: [{
      type: 'bar',
      data: spans.map((s) => s.duration),
      itemStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(59, 130, 246, 0.8)' },
            { offset: 1, color: 'rgba(139, 92, 246, 0.6)' },
          ]
        },
        borderRadius: [4, 4, 0, 0],
      }
    }],
  });

  const getWaterfallChartOption = () => {
    const sorted = [...spans].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    const minTime = sorted.length ? new Date(sorted[0].startTime).getTime() : 0;
    return {
      ...baseChart,
      tooltip: {
        ...baseChart.tooltip,
        trigger: 'axis',
        formatter: (p: any) => {
          const s = sorted[p[0].dataIndex];
          return `${s.name}<br/>开始: ${formatTime(s.startTime)}<br/>耗时: ${formatDuration(s.duration)}`;
        }
      },
      xAxis: {
        type: 'value',
        name: '时间 (ms)',
        nameTextStyle: { color: '#9ca3af' },
        axisLabel: { color: '#9ca3af' },
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } },
      },
      yAxis: {
        type: 'category',
        data: sorted.map((s) => s.name.slice(0, 25) + (s.name.length > 25 ? '...' : '')),
        axisLabel: { color: '#9ca3af' },
        axisLine: { lineStyle: { color: 'rgba(255, 255, 0.1)' } },
      },
      series: [{
        type: 'bar',
        data: sorted.map((s) => [
          (new Date(s.startTime).getTime() - minTime) / 1000,
          s.duration / 1000000,
        ]),
        itemStyle: {
          color: (p: any) => sorted[p.dataIndex].statusCode === 'ERROR'
            ? 'rgba(239, 68, 68, 0.8)'
            : 'rgba(34, 197, 94, 0.8)',
          borderRadius: [2, 2, 2, 2],
        }
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
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-3 rounded-lg" style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
              <div className="h-3 w-12 rounded animate-pulse mb-2" style={{ background: 'rgba(255, 255, 255, 0.1)' }} />
              <div className="h-4 w-20 rounded animate-pulse" style={{ background: 'rgba(255, 255, 255, 0.1)' }} />
            </div>
          ))}
        </div>
      </div>
      <div className="h-10 w-64 rounded-xl animate-pulse mb-4" style={{ background: 'rgba(255, 255, 255, 0.1)' }} />
      <div className="flex-1 space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-4 rounded-lg animate-pulse" style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded" style={{ background: 'rgba(255, 255, 255, 0.1)' }} />
              <div className="flex-1">
                <div className="h-4 w-3/4 rounded mb-1" style={{ background: 'rgba(255, 255, 255, 0.1)' }} />
                <div className="h-3 w-1/3 rounded" style={{ background: 'rgba(255, 255, 255, 0.1)' }} />
              </div>
              <div className="text-right">
                <div className="h-4 w-16 rounded mb-1" style={{ background: 'rgba(255, 255, 255, 0.1)' }} />
                <div className="h-3 w-24 rounded" style={{ background: 'rgba(255, 255, 255, 0.1)' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (loading || spansLoading) {
    return <SkeletonLoader />;
  }

  if (!service) {
    return <EmptyState icon="Server" title="选择一个服务" description="点击拓扑图中的服务节点查看详细信息" />;
  }

  const stats = [
    { label: '类型', value: service.type, color: 'text-white', fmt: 'capitalize' },
    { label: '调用次数', value: service.callCount.toLocaleString(), color: 'text-white' },
    { label: '错误数', value: service.errorCount, color: 'text-red-400' },
    { label: '平均延迟', value: formatDuration(service.avgLatency), color: 'text-emerald-400' },
  ];

  const statusIcon = (code: string) => {
    if (code === 'ERROR') return <AlertCircle className="w-4 h-4 text-red-500" />;
    if (code === 'OK') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    return <Clock className="w-4 h-4 text-gray-500" />;
  };

  const anomalyTypeLabels: Record<string, string> = {
    error: '错误异常',
    latency_spike: '耗时突增',
    error_spike: '错误率突增',
  };

  const severityColors: Record<string, string> = {
    low: 'text-yellow-400',
    medium: 'text-orange-400',
    high: 'text-red-400',
    critical: 'text-red-500',
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30">
            <Server className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{service.name}</h2>
            <span className={`text-sm ${getStatusColor(service.status)} capitalize`}>{service.status}</span>
          </div>
        </div>
        {service.anomaly && (
          <div
            className="mb-4 p-3 rounded-lg border"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              borderColor: 'rgba(239, 68, 68, 0.3)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertOctagon className="w-5 h-5 text-red-500 animate-pulse" />
              <span className="text-sm font-bold text-red-400">
                {anomalyTypeLabels[service.anomaly.type] || '异常'}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded ${severityColors[service.anomaly.severity]}`} style={{ background: 'rgba(255,255,255,0.1)' }}>
                {service.anomaly.severity.toUpperCase()}
              </span>
            </div>
            <div className="text-xs text-gray-400">{service.anomaly.message}</div>
            <div className="text-xs text-gray-500 mt-1">
              首次发生: {formatTime(service.anomaly.firstOccurredAt)}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((item, idx) => (
            <div key={idx} className="p-3 rounded-lg bg-white/5">
              <div className="text-xs text-gray-400 mb-1">{item.label}</div>
              <div className={`text-sm font-medium ${item.color} ${item.fmt || ''}`}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      <TabSwitcher tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="flex-1 mt-4 overflow-hidden">
        {spans.length === 0 ? (
          <EmptyState icon="Zap" title="暂无调用数据" description="该服务尚未产生任何调用记录" />
        ) : activeTab === 'list' ? (
          <div className="overflow-y-auto h-full space-y-2 pr-2">
            {spans.map((span) => (
              <div key={span.id} className="rounded-lg overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <button className="w-full p-3 flex items-center gap-3 hover:bg-white/5 transition-colors" onClick={() => setSelectedSpan(selectedSpan === span.id ? null : span.id)}>
                  {selectedSpan === span.id ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  {statusIcon(span.statusCode)}
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-white truncate">{span.name}</div>
                    <div className="text-xs text-gray-500 capitalize">{span.kind}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-blue-400">{formatDuration(span.duration)}</div>
                    <div className="text-xs text-gray-500">{formatTime(span.startTime)}</div>
                  </div>
                </button>
                {selectedSpan === span.id && (
                  <div className="p-3 border-t border-white/10 bg-black/20">
                    <div className="mb-3">
                      <div className="text-xs font-medium text-gray-400 mb-2"><Zap className="w-3 h-3 inline mr-1" />Attributes</div>
                      <div className="bg-black/30 rounded p-2 text-xs font-mono text-gray-300 overflow-x-auto max-h-32 overflow-y-auto">
                        {JSON.stringify(span.attributes, null, 2)}
                      </div>
                    </div>
                    {span.events && span.events.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-gray-400 mb-2"><Clock className="w-3 h-3 inline mr-1" />Events</div>
                        <div className="space-y-2">
                          {span.events.map((e, idx) => (
                            <div key={idx} className="bg-black/30 rounded p-2 text-xs">
                              <div className="text-blue-400 font-medium">{e.name}<span className="text-gray-500 ml-2">{formatTime(e.time)}</span></div>
                              <div className="mt-1 font-mono text-gray-300 overflow-x-auto">{JSON.stringify(e.attributes, null, 2)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : activeTab === 'duration' ? (
          <ReactECharts option={getDurationChartOption()} style={{ height: '100%', minHeight: '400px' }} theme="dark" />
        ) : (
          <ReactECharts option={getWaterfallChartOption()} style={{ height: '100%', minHeight: '400px' }} theme="dark" />
        )}
      </div>
    </div>
  );
}
