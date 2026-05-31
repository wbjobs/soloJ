import { useEffect, useRef, useMemo } from 'react';
import { useLogStore } from '../store/useLogStore';
import { LogItem } from './LogItem';
import { Terminal, Zap } from 'lucide-react';

export function LogList() {
  const containerRef = useRef<HTMLDivElement>(null);
  const autoScroll = useLogStore((state) => state.autoScroll);
  const getFilteredLogs = useLogStore((state) => state.getFilteredLogs);
  const selectedService = useLogStore((state) => state.selectedService);
  const selectedLevels = useLogStore((state) => state.selectedLevels);

  const logs = useMemo(() => getFilteredLogs(), [getFilteredLogs, selectedService, selectedLevels]);
  const latestLogId = logs.length > 0 ? logs[logs.length - 1].id : null;

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [latestLogId, autoScroll]);

  if (logs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 bg-slate-900/50">
        <Terminal size={48} className="mb-4 opacity-50" />
        <p className="text-lg font-medium">No logs yet</p>
        <p className="text-sm mt-2">Waiting for log streams...</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
    >
      <div className="min-h-full">
        {logs.map((log, index) => (
          <LogItem
            key={log.id}
            log={log}
            isNew={index === logs.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
