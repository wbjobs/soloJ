import React, { useMemo, useState } from 'react';
import type { VADSegment, SubtitleSegment } from '../types';

interface TimelineProps {
  vadSegments: VADSegment[];
  subtitleSegments: SubtitleSegment[];
  duration: number;
  onSeek: (time: number) => void;
  currentTime: number;
}

const Timeline: React.FC<TimelineProps> = ({
  vadSegments,
  subtitleSegments,
  duration,
  onSeek,
  currentTime,
}) => {
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);
  const [hoveredSegment, setHoveredSegment] = useState<SubtitleSegment | null>(null);

  const pixelPerSecond = useMemo(() => {
    return Math.max(50, 800 / duration);
  }, [duration]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / rect.width) * duration;
    onSeek(time);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / rect.width) * duration;
    setHoveredTime(time);
  };

  const timeMarkers = useMemo(() => {
    const markers = [];
    const interval = duration > 60 ? 10 : 5;
    for (let i = 0; i <= duration; i += interval) {
      markers.push(i);
    }
    return markers;
  }, [duration]);

  return (
    <div className="w-full bg-gray-900 rounded-lg p-4 text-white">
      <div className="flex gap-4 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 bg-green-500 rounded" />
          <span>语音活动(VAD)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 bg-blue-500 rounded" />
          <span>字幕</span>
        </div>
      </div>

      <div
        className="relative cursor-pointer"
        onClick={handleTimelineClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          setHoveredTime(null);
          setHoveredSegment(null);
        }}
      >
        <div className="flex justify-between text-xs text-gray-400 mb-2 px-1">
          {timeMarkers.map((time) => (
            <span key={time}>{formatTime(time)}</span>
          ))}
        </div>

        <div className="relative h-12 bg-gray-800 rounded mb-2 overflow-hidden">
          {vadSegments.map((seg, idx) => (
            <div
              key={`vad-${idx}`}
              className="absolute top-2 h-8 bg-green-500/60 rounded"
              style={{
                left: `${(seg.start / duration) * 100}%`,
                width: `${((seg.end - seg.start) / duration) * 100}%`,
              }}
            />
          ))}
        </div>

        <div className="relative h-12 bg-gray-800 rounded overflow-hidden">
          {subtitleSegments.map((seg, idx) => (
            <div
              key={`sub-${idx}`}
              className="absolute top-2 h-8 bg-blue-500/60 rounded cursor-pointer hover:bg-blue-400/80 transition-colors"
              style={{
                left: `${(seg.start / duration) * 100}%`,
                width: `${Math.max(2, ((seg.end - seg.start) / duration) * 100)}%`,
              }}
              onMouseEnter={() => setHoveredSegment(seg)}
              onMouseLeave={() => setHoveredSegment(null)}
              onClick={(e) => {
                e.stopPropagation();
                onSeek(seg.start);
              }}
            />
          ))}
        </div>

        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-10"
          style={{ left: `${(currentTime / duration) * 100}%` }}
        >
          <div className="absolute -top-1 -left-1 w-3 h-3 bg-red-500 rounded-full" />
        </div>

        {hoveredTime !== null && (
          <div
            className="absolute -top-8 bg-gray-700 text-white text-xs px-2 py-1 rounded pointer-events-none z-20"
            style={{ left: `${(hoveredTime / duration) * 100}%`, transform: 'translateX(-50%)' }}
          >
            {formatTime(hoveredTime)}
          </div>
        )}
      </div>

      {hoveredSegment && (
        <div className="mt-4 p-3 bg-gray-800 rounded text-sm">
          <div className="text-gray-400 mb-1">
            #{hoveredSegment.index} {formatTime(hoveredSegment.start)} → {formatTime(hoveredSegment.end)}
          </div>
          <div className="text-white">{hoveredSegment.text}</div>
        </div>
      )}
    </div>
  );
};

export default Timeline;
