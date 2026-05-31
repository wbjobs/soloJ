import React, { useState, useRef, useEffect, useCallback } from 'react';
import { formatTimestamp } from '../utils/diffUtils';

export interface HistoryVersion {
  version: number;
  timestamp: Date;
  title: string;
  language: string;
  changesCount: number;
}

interface TimelineSliderProps {
  versions: HistoryVersion[];
  currentVersion: number;
  previewVersion: number | null;
  onPreviewChange: (version: number | null) => void;
  onSeek: (version: number) => void;
  disabled?: boolean;
}

const TimelineSlider: React.FC<TimelineSliderProps> = ({
  versions,
  currentVersion,
  previewVersion,
  onPreviewChange,
  onSeek,
  disabled = false
}) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredVersion, setHoveredVersion] = useState<number | null>(null);

  const maxVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version)) : 0;

  const getVersionFromPosition = useCallback((clientX: number): number => {
    if (!sliderRef.current || maxVersion === 0) return 1;
    
    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const version = Math.round(1 + percentage * (maxVersion - 1));
    return Math.max(1, Math.min(maxVersion, version));
  }, [maxVersion]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled || versions.length === 0) return;
    setIsDragging(true);
    const version = getVersionFromPosition(e.clientX);
    onPreviewChange(version);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || disabled || versions.length === 0) return;
    const version = getVersionFromPosition(e.clientX);
    onPreviewChange(version);
  }, [isDragging, disabled, versions.length, getVersionFromPosition, onPreviewChange]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!isDragging || disabled || versions.length === 0) {
      setIsDragging(false);
      return;
    }
    setIsDragging(false);
    const version = getVersionFromPosition(e.clientX);
    onSeek(version);
    onPreviewChange(null);
  }, [isDragging, disabled, versions.length, getVersionFromPosition, onSeek, onPreviewChange]);

  const handleMouseMoveOverSlider = (e: React.MouseEvent) => {
    if (disabled || versions.length === 0 || isDragging) return;
    const version = getVersionFromPosition(e.clientX);
    setHoveredVersion(version);
  };

  const handleMouseLeave = () => {
    setHoveredVersion(null);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const getVersionPosition = (version: number): number => {
    if (maxVersion <= 1) return 0;
    return ((version - 1) / (maxVersion - 1)) * 100;
  };

  const displayVersion = previewVersion ?? hoveredVersion;
  const displayVersionData = displayVersion 
    ? versions.find(v => v.version === displayVersion)
    : null;

  const activeVersion = previewVersion ?? currentVersion;

  if (versions.length === 0) {
    return (
      <div style={styles.emptyContainer}>
        <span style={styles.emptyText}>暂无历史版本（编辑约 2 秒后生成第一个快照）</span>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.versionInfo}>
          <span style={styles.label}>版本历史</span>
          <span style={styles.versionCount}>
            {previewVersion 
              ? `预览 v${previewVersion} / 共 ${maxVersion} 个版本`
              : `当前 v${currentVersion} / 共 ${maxVersion} 个版本`
            }
          </span>
        </div>
        {displayVersionData && (
          <div style={styles.hoverInfo}>
            <span style={styles.hoverVersion}>v{displayVersion}</span>
            <span style={styles.hoverTime}>{formatTimestamp(displayVersionData.timestamp)}</span>
            <span style={styles.hoverChanges}>+{displayVersionData.changesCount} 次变更</span>
          </div>
        )}
      </div>

      <div
        ref={sliderRef}
        style={{
          ...styles.sliderContainer,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMoveOverSlider}
        onMouseLeave={handleMouseLeave}
      >
        <div style={styles.track}>
          <div 
            style={{
              ...styles.progress,
              width: `${getVersionPosition(activeVersion)}%`
            }}
          />
        </div>

        {versions.map((v) => (
          <div
            key={v.version}
            style={{
              ...styles.tick,
              left: `${getVersionPosition(v.version)}%`,
              backgroundColor: v.version <= activeVersion ? '#007acc' : '#3c3c3c',
              transform: v.version === activeVersion ? 'scale(1.5)' : 'scale(1)',
              boxShadow: v.version === activeVersion 
                ? '0 0 8px rgba(0, 122, 204, 0.6)' 
                : 'none',
              zIndex: v.version === activeVersion ? 10 : 1
            }}
            title={`v${v.version} - ${formatTimestamp(v.timestamp)}`}
          />
        ))}

        <div
          style={{
            ...styles.thumb,
            left: `calc(${getVersionPosition(activeVersion)}% - 8px)`,
            boxShadow: isDragging 
              ? '0 0 0 4px rgba(0, 122, 204, 0.3), 0 2px 8px rgba(0,0,0,0.4)'
              : '0 2px 4px rgba(0,0,0,0.3)'
          }}
        />
      </div>

      <div style={styles.legend}>
        <span style={styles.legendItem}>
          <span style={{ ...styles.legendDot, backgroundColor: '#3c3c3c' }} />
          v1
        </span>
        <span style={{ ...styles.legendItem, textAlign: 'center' as const }}>
          {previewVersion ? (
            <span style={styles.previewMode}>🕐 预览模式 - 点击任意处退出</span>
          ) : (
            <span style={styles.dragHint}>拖动滑块查看历史版本</span>
          )}
        </span>
        <span style={{ ...styles.legendItem, textAlign: 'right' as const }}>
          <span style={{ ...styles.legendDot, backgroundColor: '#007acc' }} />
          v{maxVersion}
        </span>
      </div>
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: '#252526',
    borderTop: '1px solid #3c3c3c',
    padding: '12px 24px',
    userSelect: 'none' as const,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  versionInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  label: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#d4d4d4',
  },
  versionCount: {
    fontSize: '12px',
    color: '#888',
  },
  hoverInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: '#1e1e1e',
    padding: '4px 12px',
    borderRadius: '4px',
    border: '1px solid #3c3c3c',
  },
  hoverVersion: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#007acc',
  },
  hoverTime: {
    fontSize: '11px',
    color: '#888',
  },
  hoverChanges: {
    fontSize: '11px',
    color: '#6a9955',
  },
  sliderContainer: {
    position: 'relative' as const,
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
  },
  track: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    height: '4px',
    backgroundColor: '#3c3c3c',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progress: {
    height: '100%',
    backgroundColor: '#007acc',
    transition: 'width 0.1s ease-out',
  },
  tick: {
    position: 'absolute' as const,
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    transform: 'translateX(-50%)',
    transition: 'all 0.15s ease',
    cursor: 'pointer',
  },
  thumb: {
    position: 'absolute' as const,
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    backgroundColor: '#007acc',
    border: '2px solid #1e1e1e',
    transition: 'box-shadow 0.15s ease',
    zIndex: 20,
  },
  legend: {
    display: 'grid',
    gridTemplateColumns: '1fr 2fr 1fr',
    marginTop: '8px',
    fontSize: '11px',
    color: '#888',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  legendDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
  },
  dragHint: {
    color: '#666',
    fontStyle: 'italic' as const,
  },
  previewMode: {
    color: '#ce9178',
    fontWeight: '600',
  },
  emptyContainer: {
    backgroundColor: '#252526',
    borderTop: '1px solid #3c3c3c',
    padding: '12px 24px',
    textAlign: 'center' as const,
  },
  emptyText: {
    fontSize: '12px',
    color: '#888',
    fontStyle: 'italic' as const,
  },
};

export default TimelineSlider;
