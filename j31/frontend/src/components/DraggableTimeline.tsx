import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import type { VADSegment, SubtitleSegment, SubtitleCorrection } from '../types';

interface DraggableTimelineProps {
  vadSegments: VADSegment[];
  subtitleSegments: SubtitleSegment[];
  duration: number;
  onSeek: (time: number) => void;
  currentTime: number;
  onSegmentDragEnd?: (index: number, newStart: number, newEnd: number) => void;
  corrections?: SubtitleCorrection[];
  editable?: boolean;
}

type DragType = 'start' | 'end' | 'move' | null;

interface DragState {
  isDragging: boolean;
  type: DragType;
  segmentIndex: number | null;
  startX: number;
  originalStart: number;
  originalEnd: number;
  currentStart: number;
  currentEnd: number;
}

const DraggableTimeline: React.FC<DraggableTimelineProps> = ({
  vadSegments,
  subtitleSegments,
  duration,
  onSeek,
  currentTime,
  onSegmentDragEnd,
  corrections = [],
  editable = true,
}) => {
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);
  const [hoveredSegment, setHoveredSegment] = useState<SubtitleSegment | null>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    type: null,
    segmentIndex: null,
    startX: 0,
    originalStart: 0,
    originalEnd: 0,
    currentStart: 0,
    currentEnd: 0,
  });
  const [hoveredHandle, setHoveredHandle] = useState<{ index: number; type: DragType } | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState>(dragState);

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  const pixelPerSecond = useMemo(() => {
    return Math.max(50, 800 / duration);
  }, [duration]);

  const correctedIndices = useMemo(() => {
    return new Set(corrections.map((c) => c.subtitleIndex));
  }, [corrections]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const formatTimeDiff = (diff: number): string => {
    const sign = diff >= 0 ? '+' : '';
    return `${sign}${diff.toFixed(2)}s`;
  };

  const getTimeFromX = useCallback(
    (clientX: number): number => {
      if (!timelineRef.current) return 0;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const time = (x / rect.width) * duration;
      return Math.max(0, Math.min(duration, time));
    },
    [duration]
  );

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragState.isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / rect.width) * duration;
    onSeek(time);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragState.isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / rect.width) * duration;
    setHoveredTime(time);
  };

  const handleGlobalMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragStateRef.current.isDragging) return;
      const currentDrag = dragStateRef.current;
      const newTime = getTimeFromX(e.clientX);
      const deltaTime = newTime - currentDrag.originalStart;
      const delta = currentDrag.originalEnd - currentDrag.originalStart;

      let newStart = currentDrag.originalStart;
      let newEnd = currentDrag.originalEnd;

      if (currentDrag.type === 'start') {
        newStart = Math.min(newTime, currentDrag.originalEnd - 0.1);
        newEnd = currentDrag.originalEnd;
      } else if (currentDrag.type === 'end') {
        newStart = currentDrag.originalStart;
        newEnd = Math.max(newTime, currentDrag.originalStart + 0.1);
      } else if (currentDrag.type === 'move') {
        newStart = Math.max(0, Math.min(duration - delta, newTime - deltaTime));
        newEnd = newStart + delta;
      }

      setDragState((prev) => ({
        ...prev,
        currentStart: newStart,
        currentEnd: newEnd,
      }));
    },
    [getTimeFromX, duration]
  );

  const handleGlobalMouseUp = useCallback(() => {
    const currentDrag = dragStateRef.current;
    if (currentDrag.isDragging && currentDrag.segmentIndex !== null && onSegmentDragEnd) {
      onSegmentDragEnd(
        currentDrag.segmentIndex,
        currentDrag.currentStart,
        currentDrag.currentEnd
      );
    }
    setDragState({
      isDragging: false,
      type: null,
      segmentIndex: null,
      startX: 0,
      originalStart: 0,
      originalEnd: 0,
      currentStart: 0,
      currentEnd: 0,
    });
    setHoveredHandle(null);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, [onSegmentDragEnd]);

  useEffect(() => {
    if (dragState.isDragging) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      document.body.style.userSelect = 'none';
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [dragState.isDragging, handleGlobalMouseMove, handleGlobalMouseUp]);

  const startDrag = (
    e: React.MouseEvent,
    index: number,
    type: DragType
  ) => {
    if (!editable) return;
    e.stopPropagation();
    e.preventDefault();
    const segment = subtitleSegments[index];
    if (!segment) return;
    setDragState({
      isDragging: true,
      type,
      segmentIndex: index,
      startX: e.clientX,
      originalStart: segment.start,
      originalEnd: segment.end,
      currentStart: segment.start,
      currentEnd: segment.end,
    });
    if (type === 'start' || type === 'end') {
      document.body.style.cursor = 'ew-resize';
    } else if (type === 'move') {
      document.body.style.cursor = 'grabbing';
    }
  };

  const timeMarkers = useMemo(() => {
    const markers = [];
    const interval = duration > 60 ? 10 : 5;
    for (let i = 0; i <= duration; i += interval) {
      markers.push(i);
    }
    return markers;
  }, [duration]);

  const renderSubtitleSegment = (seg: SubtitleSegment, idx: number) => {
    const isCorrected = correctedIndices.has(seg.index);
    const isDraggingThis = dragState.isDragging && dragState.segmentIndex === idx;

    let displayStart = isDraggingThis ? dragState.currentStart : seg.start;
    let displayEnd = isDraggingThis ? dragState.currentEnd : seg.end;

    return (
      <div
        key={`sub-${idx}`}
        className={`absolute top-2 h-8 rounded cursor-pointer transition-colors ${
          isCorrected ? 'bg-orange-500/60 border-2 border-orange-400' : 'bg-blue-500/60 hover:bg-blue-400/80'
        } ${isDraggingThis ? 'opacity-50' : ''}`}
        style={{
          left: `${(displayStart / duration) * 100}%`,
          width: `${Math.max(2, ((displayEnd - displayStart) / duration) * 100)}%`,
        }}
        onMouseEnter={() => setHoveredSegment(seg)}
        onMouseLeave={() => setHoveredSegment(null)}
        onMouseDown={(e) => startDrag(e, idx, 'move')}
        onClick={(e) => {
          e.stopPropagation();
          if (dragState.isDragging) return;
          onSeek(seg.start);
        }}
      >
        {editable && !isDraggingThis && (
          <>
            <div
              className="absolute top-0 bottom-0 cursor-ew-resize z-10 hover:bg-white/30 rounded-l transition-colors"
              style={{ left: '-3px', width: '6px' }}
              onMouseDown={(e) => {
                e.stopPropagation();
                startDrag(e, idx, 'start');
              }}
              onMouseEnter={(e) => {
                e.stopPropagation();
                setHoveredHandle({ index: idx, type: 'start' });
              }}
              onMouseLeave={(e) => {
                e.stopPropagation();
                if (dragState.isDragging) return;
                setHoveredHandle(null);
              }}
            />
            <div
              className="absolute top-0 bottom-0 cursor-ew-resize z-10 hover:bg-white/30 rounded-r transition-colors"
              style={{ right: '-3px', width: '6px' }}
              onMouseDown={(e) => {
                e.stopPropagation();
                startDrag(e, idx, 'end');
              }}
              onMouseEnter={(e) => {
                e.stopPropagation();
                setHoveredHandle({ index: idx, type: 'end' });
              }}
              onMouseLeave={(e) => {
                e.stopPropagation();
                if (dragState.isDragging) return;
                setHoveredHandle(null);
              }}
            />
          </>
        )}

        {isDraggingThis && (
          <>
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-20 pointer-events-none">
              {formatTime(displayStart)} → {formatTime(displayEnd)}
            </div>
            {(dragState.currentStart !== dragState.originalStart || dragState.currentEnd !== dragState.originalEnd) && (
              <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-700 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-20 pointer-events-none">
                <span className="text-green-400">
                  {formatTimeDiff(dragState.currentStart - dragState.originalStart)}
                </span>
                {' / '}
                <span className="text-blue-400">
                  {formatTimeDiff(dragState.currentEnd - dragState.originalEnd)}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

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
        {corrections.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 bg-orange-500 rounded" />
            <span>已修正</span>
          </div>
        )}
      </div>

      <div
        ref={timelineRef}
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
          {subtitleSegments.map((seg, idx) => renderSubtitleSegment(seg, idx))}
        </div>

        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-10"
          style={{ left: `${(currentTime / duration) * 100}%` }}
        >
          <div className="absolute -top-1 -left-1 w-3 h-3 bg-red-500 rounded-full" />
        </div>

        {hoveredTime !== null && !dragState.isDragging && (
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

export default DraggableTimeline;
