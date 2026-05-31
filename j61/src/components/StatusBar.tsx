import { Activity, Server, Database, AlertCircle, AlertTriangle, Bug, Info } from 'lucide-react';
import { useLogStore, SERVICES, LOG_LEVELS } from '../store/useLogStore';
import type { LogLevel } from '../../shared/types';

const levelIcons: Record<LogLevel, typeof Bug> = {
  DEBUG: Bug,
  INFO: Info,
  WARN: AlertTriangle,
  ERROR: AlertCircle,
};

const levelColors: Record<LogLevel, string> = {
  DEBUG: 'text-purple-400',
  INFO: 'text-blue-400',
  WARN: 'text-amber-400',
  ERROR: 'text-red-400',
};

export function StatusBar() {
  const connected = useLogStore((state) => state.connected);
  const totalCount = useLogStore((state) => state.totalCount);
  const serviceCounts = useLogStore((state) => state.serviceCounts);
  const levelCounts = useLogStore((state) => state.levelCounts);

  return (
    <div className="bg-slate-800/80 backdrop-blur border-b border-slate-700 px-6 py-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`}
            />
            <span className="text-slate-300 text-sm font-medium">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="h-5 w-px bg-slate-600" />
          <div className="flex items-center gap-2 text-slate-400">
            <Activity size={16} />
            <span className="text-sm">Live</span>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-lg">
            <Database size={14} className="text-blue-400" />
            <div className="text-right">
              <div className="text-[10px] text-slate-500">Total</div>
              <div className="text-sm font-semibold text-white tabular-nums">
                {totalCount.toLocaleString()}
              </div>
            </div>
          </div>

          {LOG_LEVELS.map((level) => {
            const Icon = levelIcons[level];
            return (
              <div
                key={level}
                className="flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-lg"
              >
                <Icon size={14} className={levelColors[level]} />
                <div className="text-right">
                  <div className="text-[10px] text-slate-500">{level}</div>
                  <div className="text-sm font-semibold text-white tabular-nums">
                    {(levelCounts[level] || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="h-6 w-px bg-slate-600 mx-1" />

          {SERVICES.map((service) => (
            <div
              key={service}
              className="flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-lg"
            >
              <Server size={14} className="text-cyan-400" />
              <div className="text-right">
                <div className="text-[10px] text-slate-500">{service}</div>
                <div className="text-sm font-semibold text-white tabular-nums">
                  {(serviceCounts[service] || 0).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
