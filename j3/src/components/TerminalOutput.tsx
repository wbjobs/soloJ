import { useEffect, useRef } from 'react';
import type { OutputEvent } from '../../shared/types';

interface TerminalOutputProps {
  outputs: OutputEvent[];
}

export function TerminalOutput({ outputs }: TerminalOutputProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [outputs]);

  const getOutputStyle = (type: OutputEvent['type']) => {
    switch (type) {
      case 'stdout':
        return 'text-green-400';
      case 'stderr':
        return 'text-red-400';
      case 'system':
        return 'text-cyan-400';
      default:
        return 'text-gray-300';
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto p-4 font-mono text-sm bg-gray-900 rounded-lg"
    >
      {outputs.length === 0 ? (
        <div className="text-gray-500 italic">等待输出...</div>
      ) : (
        <div className="space-y-1">
          {outputs.map((output, index) => (
            <div
              key={`${output.timestamp}-${index}`}
              className={`${getOutputStyle(output.type)} whitespace-pre-wrap break-all animate-fade-in`}
            >
              <span className="text-gray-500 mr-2">[{formatTime(output.timestamp)}]</span>
              {output.data}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
