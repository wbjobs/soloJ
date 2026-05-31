import { Server, Activity, AlertTriangle, Clock, AlertOctagon } from 'lucide-react';
import type { TopologyData } from '../../../shared/types';

interface StatsOverviewProps {
  statistics: TopologyData['statistics'] | null;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  unit?: string;
  warning?: boolean;
}

function StatCard({ icon, label, value, unit, warning }: StatCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-xl p-5 transition-all duration-300 hover:scale-[1.02]"
      style={{
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <div className="absolute inset-0 opacity-20" style={{
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
      }} />
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="p-2 rounded-lg"
            style={{
              background: warning ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)',
              color: warning ? 'var(--color-error)' : 'var(--color-accent)',
            }}
          >
            {icon}
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            {label}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className="text-3xl font-bold tracking-tight"
            style={{ color: warning ? 'var(--color-error)' : 'var(--color-text-primary)' }}
          >
            {value}
          </span>
          {unit && (
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              {unit}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StatsOverview({ statistics }: StatsOverviewProps) {
  if (!statistics) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl animate-pulse"
            style={{ background: 'rgba(255, 255, 255, 0.05)' }}
          />
        ))}
      </div>
    );
  }

  const { totalServices, totalCalls, errorRate, avgLatency, anomalyCount } = statistics;
  const hasErrorWarning = errorRate > 5;
  const hasAnomalies = anomalyCount > 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <StatCard
        icon={<Server className="w-5 h-5" />}
        label="服务总数"
        value={totalServices}
        unit="个"
      />
      <StatCard
        icon={<Activity className="w-5 h-5" />}
        label="调用总量"
        value={totalCalls.toLocaleString()}
        unit="次"
      />
      <StatCard
        icon={<AlertOctagon className="w-5 h-5" />}
        label="异常节点"
        value={anomalyCount}
        unit="个"
        warning={hasAnomalies}
      />
      <StatCard
        icon={<AlertTriangle className="w-5 h-5" />}
        label="错误率"
        value={`${errorRate.toFixed(2)}`}
        unit="%"
        warning={hasErrorWarning}
      />
      <StatCard
        icon={<Clock className="w-5 h-5" />}
        label="平均响应时间"
        value={`${avgLatency.toFixed(0)}`}
        unit="ms"
      />
    </div>
  );
}
