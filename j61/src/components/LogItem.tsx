import type { LogEntry, LogLevel } from '../../shared/types';
import { useMemo } from 'react';
import { useLogStore } from '../store/useLogStore';

const levelStyles: Record<LogLevel, { bg: string; text: string; dot: string }> = {
  DEBUG: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    dot: 'bg-purple-500',
  },
  INFO: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    dot: 'bg-blue-500',
  },
  WARN: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    dot: 'bg-amber-500',
  },
  ERROR: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    dot: 'bg-red-500',
  },
};

const serviceColors: Record<string, string> = {
  'user-service': 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  'order-service': 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  'payment-service': 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

interface LogItemProps {
  log: LogEntry;
  isNew?: boolean;
}

function highlightKeyword(text: string, keyword: string): (string | JSX.Element)[] {
  if (!keyword.trim()) {
    return [text];
  }

  const lowerKeyword = keyword.toLowerCase();
  const lowerText = text.toLowerCase();
  const indices: number[] = [];
  let pos = lowerText.indexOf(lowerKeyword);

  while (pos !== -1) {
    indices.push(pos);
    pos = lowerText.indexOf(lowerKeyword, pos + 1);
  }

  if (indices.length === 0) {
    return [text];
  }

  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  const keywordLen = keyword.length;

  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }
    parts.push(
      <mark
        key={i}
        className="bg-red-500/40 text-red-200 px-0.5 rounded"
      >
        {text.slice(start, start + keywordLen)}
      </mark>
    );
    lastIndex = start + keywordLen;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export function LogItem({ log, isNew }: LogItemProps) {
  const searchKeyword = useLogStore((state) => state.searchKeyword);
  const styles = levelStyles[log.level];
  const time = new Date(log.timestamp);
  const timeStr = time.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  } as Intl.DateTimeFormatOptions);

  const highlightedMessage = useMemo(
    () => highlightKeyword(log.message, searchKeyword),
    [log.message, searchKeyword]
  );

  return (
    <div
      className={`group px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800/30 transition-all duration-300 ${
        isNew ? 'animate-in slide-in-from-top duration-300' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1 pt-1">
          <div className={`w-2 h-2 rounded-full ${styles.dot} flex-shrink-0`} />
          <div className="w-px h-full bg-slate-800" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs text-slate-500 font-mono">{timeStr}</span>

            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${
                serviceColors[log.serviceName] ||
                'bg-slate-700/50 text-slate-300 border-slate-600'
              }`}
            >
              {log.serviceName}
            </span>

            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${styles.bg} ${styles.text}`}
            >
              {log.level}
            </span>
          </div>

          <div className="font-mono text-sm text-slate-200 leading-relaxed break-all">
            {highlightedMessage}
          </div>
        </div>
      </div>
    </div>
  );
}
