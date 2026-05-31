import { RefreshCw, Database, Trash2, Check, Filter, Layers } from 'lucide-react';
import type { ServiceNode, ServiceStatus } from '../../../shared/types';

interface ControlPanelProps {
  services: ServiceNode[];
  selectedFilters: string[];
  statusFilters: ServiceStatus[];
  onToggleFilter: (id: string) => void;
  onToggleStatus: (status: ServiceStatus) => void;
  onRefresh: () => void;
  onGenerateMock: () => void;
  onGenerateDeepChain: () => void;
  onClear: () => void;
  loading: boolean;
  maxDepth: number;
  onMaxDepthChange: (depth: number) => void;
}

const statusConfig: Record<ServiceStatus | 'all', { label: string; color: string }> = {
  all: { label: '全部', color: 'rgba(255, 255, 255, 0.6)' },
  healthy: { label: '正常', color: 'var(--color-healthy)' },
  warning: { label: '警告', color: 'var(--color-warning)' },
  error: { label: '错误', color: 'var(--color-error)' },
};

export default function ControlPanel({
  services,
  selectedFilters,
  statusFilters,
  onToggleFilter,
  onToggleStatus,
  onRefresh,
  onGenerateMock,
  onGenerateDeepChain,
  onClear,
  loading,
  maxDepth,
  onMaxDepthChange,
}: ControlPanelProps) {
  const allStatuses: (ServiceStatus | 'all')[] = ['all', 'healthy', 'warning', 'error'];

  const handleStatusToggle = (status: ServiceStatus | 'all') => {
    if (status === 'all') {
      if (statusFilters.length === 3) {
        onToggleStatus('healthy');
      } else {
        (['healthy', 'warning', 'error'] as ServiceStatus[]).forEach((s) => {
          if (!statusFilters.includes(s)) onToggleStatus(s);
        });
      }
    } else {
      onToggleStatus(status);
    }
  };

  return (
    <div
      className="h-full flex flex-col rounded-xl overflow-hidden"
      style={{
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <div className="p-4 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          控制面板
        </h3>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 disabled:opacity-50"
            style={{
              background: 'rgba(59, 130, 246, 0.2)',
              color: 'var(--color-accent)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
            }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button
            onClick={onGenerateMock}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105"
            style={{
              background: 'rgba(34, 197, 94, 0.2)',
              color: 'var(--color-healthy)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
            }}
          >
            <Database className="w-4 h-4" />
            生成 Mock
          </button>
          <button
            onClick={onClear}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105"
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              color: 'var(--color-error)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            <Trash2 className="w-4 h-4" />
            清空
          </button>
        </div>

        <div className="mb-4">
          <button
            onClick={onGenerateDeepChain}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 disabled:opacity-50 w-full"
            style={{
              background: 'rgba(139, 92, 246, 0.2)',
              color: 'var(--color-purple)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
            }}
          >
            <Layers className="w-4 h-4" />
            生成深层调用链 (15层)
          </button>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                深度限制
              </span>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ color: 'var(--color-accent)', background: 'rgba(59, 130, 246, 0.1)' }}>
              {maxDepth}
            </span>
          </div>
          <input
            type="range"
            min={3}
            max={50}
            value={maxDepth}
            onChange={(e) => onMaxDepthChange(parseInt(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${((maxDepth - 3) / 47) * 100}%, rgba(255,255,255,0.1) ${((maxDepth - 3) / 47) * 100}%, rgba(255,255,255,0.1) 100%)`,
            }}
          />
          <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            <span>3</span>
            <span>50</span>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Filter className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              状态筛选
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {allStatuses.map((status) => {
              const isActive = status === 'all' ? statusFilters.length === 3 : statusFilters.includes(status);
              return (
                <button
                  key={status}
                  onClick={() => handleStatusToggle(status)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
                  style={{
                    background: isActive ? statusConfig[status].color : 'rgba(255, 255, 255, 0.05)',
                    color: isActive ? '#fff' : 'var(--color-text-secondary)',
                    border: `1px solid ${isActive ? statusConfig[status].color : 'rgba(255, 255, 255, 0.1)'}`,
                    opacity: isActive ? 1 : 0.7,
                  }}
                >
                  {isActive && <Check className="w-3 h-3" />}
                  {statusConfig[status].label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>
          服务列表 ({services.length})
        </div>
        <div className="space-y-2">
          {services.map((service) => {
            const isSelected = selectedFilters.includes(service.id);
            return (
              <div
                key={service.id}
                onClick={() => onToggleFilter(service.id)}
                className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 hover:bg-white/5"
                style={{
                  background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                  border: `1px solid ${isSelected ? 'rgba(59, 130, 246, 0.3)' : 'transparent'}`,
                }}
              >
                <div
                  className="w-4 h-4 rounded flex items-center justify-center transition-all duration-200"
                  style={{
                    background: isSelected ? 'var(--color-accent)' : 'rgba(255, 255, 255, 0.1)',
                    border: `1px solid ${isSelected ? 'var(--color-accent)' : 'rgba(255, 255, 255, 0.2)'}`,
                  }}
                >
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {service.name}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {service.type} · {service.callCount.toLocaleString()} 次调用
                  </div>
                </div>
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: statusConfig[service.status].color }}
                />
              </div>
            );
          })}
          {services.length === 0 && (
            <div className="text-center py-8 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              暂无服务数据
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
        <div className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          图例说明
        </div>
        <div className="flex flex-wrap gap-3">
          {(['healthy', 'warning', 'error'] as const).map((status) => (
            <div key={status} className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: statusConfig[status].color }}
              />
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {statusConfig[status].label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
