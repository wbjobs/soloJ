import { useEffect, useState } from 'react';
import { RefreshCw, Network, Menu, X, Activity, Database, AlertCircle } from 'lucide-react';
import TopologyGraph from '../components/TopologyGraph/TopologyGraph';
import ControlPanel from '../components/ControlPanel/ControlPanel';
import StatsOverview from '../components/StatsOverview/StatsOverview';
import SpanPanel from '../components/SpanPanel/SpanPanel';
import ErrorPanel from '../components/ErrorPanel/ErrorPanel';
import TabSwitcher from '../components/common/TabSwitcher';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import { useTopology } from '../hooks/useTopology';
import type { ServiceNode } from '../../shared/types';

export default function Home() {
  const {
    topologyData,
    selectedService,
    selectedTab,
    loading,
    error,
    serviceFilter,
    statusFilter,
    filteredNodes,
    filteredEdges,
    maxDepth,
    isTimeout,
    selectService,
    setSelectedTab,
    toggleServiceFilter,
    toggleStatusFilter,
    generateMockData,
    clearData,
    setMaxDepth,
    refresh,
    fetchTopology,
  } = useTopology();

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  useEffect(() => {
    generateMockData();
  }, [generateMockData]);

  const handleNodeClick = (node: ServiceNode) => {
    selectService(selectedService?.id === node.id ? null : node);
  };

  const tabs = [
    { id: 'spans', label: 'Span 详情', count: topologyData?.statistics?.totalCalls },
    { id: 'errors', label: '错误日志', count: topologyData?.statistics?.totalErrors },
  ];

  const filteredData = topologyData
    ? { ...topologyData, nodes: filteredNodes, edges: filteredEdges }
    : null;

  const statusColor = loading
    ? 'var(--color-accent)'
    : error
      ? 'var(--color-error)'
      : !topologyData
        ? 'var(--color-text-secondary)'
        : 'var(--color-healthy)';

  const statusText = loading
    ? '加载中...'
    : isTimeout
      ? '查询超时'
      : error
        ? '加载失败'
        : !topologyData
          ? '暂无数据'
          : '已连接';

  const renderCenterContent = () => {
    if (loading && !topologyData) {
      return (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl glass">
          <div className="flex flex-col items-center gap-4">
            <LoadingSpinner size="lg" />
            <p style={{ color: 'var(--color-text-secondary)' }}>正在加载拓扑数据...</p>
          </div>
        </div>
      );
    }
    if (error) {
      return (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl glass">
          <EmptyState
            title="加载失败"
            description={error}
            icon={<AlertCircle className="w-8 h-8" style={{ color: 'var(--color-error)' }} />}
          />
        </div>
      );
    }
    if (!topologyData) {
      return (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl glass">
          <EmptyState
            title="暂无拓扑数据"
            description="点击生成 Mock 数据开始体验"
            icon={<Database className="w-8 h-8" style={{ color: 'var(--color-text-secondary)' }} />}
          />
        </div>
      );
    }
    return (
      <TopologyGraph
        data={filteredData}
        selectedService={selectedService}
        onNodeClick={handleNodeClick}
        loading={loading}
      />
    );
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--color-bg-primary)' }}>
      <header className="h-14 flex items-center justify-between px-4 shrink-0 glass border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(139, 92, 246, 0.3) 100%)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              boxShadow: '0 0 20px rgba(59, 130, 246, 0.2)',
            }}
          >
            <Network className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider" style={{ color: 'var(--color-text-primary)', fontFamily: "'Orbitron', sans-serif" }}>
              微服务链路追踪
            </h1>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>
              Microservice Tracing System
            </p>
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 disabled:opacity-50 glass-hover"
          style={{ background: 'rgba(59, 130, 246, 0.2)', color: 'var(--color-accent)', border: '1px solid rgba(59, 130, 246, 0.3)' }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </header>

      <main className="flex-1 flex overflow-hidden p-4 gap-4">
        <aside className={`transition-all duration-300 ease-in-out overflow-hidden ${leftCollapsed ? 'w-0' : 'w-72 lg:w-80'}`}>
          <div className="w-72 lg:w-80 h-full">
            <div className="lg:hidden mb-3">
              <button onClick={() => setLeftCollapsed(true)} className="p-2 rounded-lg glass-hover" style={{ color: 'var(--color-text-secondary)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <ControlPanel
              services={topologyData?.nodes || []}
              selectedFilters={serviceFilter}
              statusFilters={statusFilter}
              onToggleFilter={toggleServiceFilter}
              onToggleStatus={toggleStatusFilter}
              onRefresh={refresh}
              onGenerateMock={generateMockData}
              onGenerateDeepChain={() => generateMockData(15)}
              onClear={clearData}
              loading={loading}
              maxDepth={maxDepth}
              onMaxDepthChange={(d) => { setMaxDepth(d); fetchTopology(); }}
            />
          </div>
        </aside>

        {leftCollapsed && (
          <button onClick={() => setLeftCollapsed(false)} className="lg:hidden absolute left-4 top-20 z-10 p-2 rounded-lg glass" style={{ color: 'var(--color-text-secondary)' }}>
            <Menu className="w-5 h-5" />
          </button>
        )}

        <section className="flex-1 flex flex-col min-w-0 gap-4">
          <StatsOverview statistics={topologyData?.statistics || null} />
          <div className="flex-1 relative min-h-0">
            {renderCenterContent()}
          </div>
        </section>

        <aside className={`transition-all duration-300 ease-in-out overflow-hidden ${rightCollapsed ? 'w-0' : selectedService ? 'w-80 lg:w-96' : 'w-0'}`}>
          {selectedService && (
            <div className="w-80 lg:w-96 h-full flex flex-col">
              <div className="lg:hidden mb-3 flex justify-end">
                <button onClick={() => setRightCollapsed(true)} className="p-2 rounded-lg glass-hover" style={{ color: 'var(--color-text-secondary)' }}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mb-4">
                <TabSwitcher tabs={tabs} activeTab={selectedTab} onChange={(id) => setSelectedTab(id as 'spans' | 'errors')} />
              </div>
              <div className="flex-1 overflow-y-auto animate-fade-in">
                {selectedTab === 'spans' ? <SpanPanel service={selectedService} loading={loading} /> : <ErrorPanel service={selectedService} loading={loading} />}
              </div>
            </div>
          )}
        </aside>
      </main>

      <footer className="h-10 flex items-center justify-between px-4 shrink-0 glass border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: statusColor, animation: loading ? 'pulse-glow 2s ease-in-out infinite' : 'none' }}
            />
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>
              {statusText}
            </span>
          </div>
          {topologyData && (
            <>
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" style={{ color: 'var(--color-accent)' }} />
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {filteredNodes.length} 节点
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Network className="w-3.5 h-3.5" style={{ color: 'var(--color-accent)' }} />
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {filteredEdges.length} 边
                </span>
              </div>
            </>
          )}
        </div>
        <div className="text-xs" style={{ color: 'var(--color-text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>
          v1.0.0
        </div>
      </footer>
    </div>
  );
}
