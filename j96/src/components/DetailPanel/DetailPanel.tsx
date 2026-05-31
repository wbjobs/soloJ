import { useState } from 'react';
import { X, Server, Bug } from 'lucide-react';
import type { ServiceNode } from '../../../shared/types';
import { getStatusColor } from '../../utils/format';
import TabSwitcher from '../common/TabSwitcher';
import SpanPanel from '../SpanPanel/SpanPanel';
import ErrorPanel from '../ErrorPanel/ErrorPanel';

interface DetailPanelProps {
  service: ServiceNode | null;
  onClose: () => void;
  loading: boolean;
  onTraceClick?: (traceId: string) => void;
}

export default function DetailPanel({ service, onClose, loading, onTraceClick }: DetailPanelProps) {
  const [activeTab, setActiveTab] = useState('spans');

  const tabs = [
    { id: 'spans', label: '调用详情', icon: Server },
    { id: 'errors', label: '错误日志', icon: Bug, count: service?.errorCount },
  ];

  const SkeletonLoader = () => (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg animate-pulse" style={{ background: 'rgba(255, 255, 255, 0.1)' }} />
          <div>
            <div className="h-6 w-32 rounded animate-pulse mb-1" style={{ background: 'rgba(255, 255, 255, 0.1)' }} />
            <div className="h-4 w-16 rounded animate-pulse" style={{ background: 'rgba(255, 255, 255, 0.1)' }} />
          </div>
        </div>
        <div className="w-8 h-8 rounded-lg animate-pulse" style={{ background: 'rgba(255, 255, 255, 0.1)' }} />
      </div>
      <div className="h-10 w-48 rounded-xl animate-pulse mb-4" style={{ background: 'rgba(255, 255, 255, 0.1)' }} />
      <div className="flex-1">
        <div className="h-full rounded-xl animate-pulse" style={{ background: 'rgba(255, 255, 255, 0.05)' }} />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div
        className="h-full w-full"
        style={{
          background: 'rgba(17, 24, 39, 0.95)',
          backdropFilter: 'blur(20px)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <SkeletonLoader />
      </div>
    );
  }

  return (
    <div
      className="h-full w-full flex flex-col animate-slide-in"
      style={{
        background: 'rgba(17, 24, 39, 0.95)',
        backdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      {service && (
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
              }}
            >
              <Server className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{service.name}</h2>
              <span className={`text-xs ${getStatusColor(service.status)} capitalize`}>
                {service.status}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      )}

      {service && (
        <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
          <TabSwitcher
            tabs={tabs.map((tab) => ({
              id: tab.id,
              label: tab.label,
              count: tab.count,
            }))}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {activeTab === 'spans' ? (
          <SpanPanel service={service} loading={loading} />
        ) : (
          <ErrorPanel service={service} loading={loading} onTraceClick={onTraceClick} />
        )}
      </div>

      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
