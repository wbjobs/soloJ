import React, { useState, useRef, useEffect, useCallback } from 'react';

const AnnotationCanvas = ({ annotations, currentTime, onAddAnnotation, disabled, videoElement, videoDimensions, hiddenAnnotations }) => {
  const containerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState(null);
  const [currentRect, setCurrentRect] = useState(null);
  const [displayArea, setDisplayArea] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const calculateDisplayArea = useCallback(() => {
    if (!containerRef.current || !videoDimensions) {
      setDisplayArea({ x: 0, y: 0, width: 0, height: 0 });
      return;
    }

    const container = containerRef.current.getBoundingClientRect();
    const containerWidth = container.width;
    const containerHeight = container.height;

    const videoAspectRatio = videoDimensions.videoWidth / videoDimensions.videoHeight;
    const containerAspectRatio = containerWidth / containerHeight;

    let displayWidth, displayHeight, offsetX, offsetY;

    if (containerAspectRatio > videoAspectRatio) {
      displayHeight = containerHeight;
      displayWidth = displayHeight * videoAspectRatio;
      offsetX = (containerWidth - displayWidth) / 2;
      offsetY = 0;
    } else {
      displayWidth = containerWidth;
      displayHeight = displayWidth / videoAspectRatio;
      offsetX = 0;
      offsetY = (containerHeight - displayHeight) / 2;
    }

    setDisplayArea({
      x: offsetX,
      y: offsetY,
      width: displayWidth,
      height: displayHeight,
    });
  }, [videoDimensions]);

  useEffect(() => {
    calculateDisplayArea();
    window.addEventListener('resize', calculateDisplayArea);
    return () => window.removeEventListener('resize', calculateDisplayArea);
  }, [calculateDisplayArea]);

  const getRelativeCoords = (e) => {
    if (!containerRef.current || displayArea.width === 0) return { x: 0, y: 0 };

    const containerRect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - containerRect.left - displayArea.x;
    const clickY = e.clientY - containerRect.top - displayArea.y;

    const clampedX = Math.max(0, Math.min(clickX, displayArea.width));
    const clampedY = Math.max(0, Math.min(clickY, displayArea.height));

    return {
      x: (clampedX / displayArea.width) * 100,
      y: (clampedY / displayArea.height) * 100,
    };
  };

  const handleMouseDown = (e) => {
    if (disabled) return;
    const pos = getRelativeCoords(e);
    setIsDrawing(true);
    setStartPos(pos);
    setCurrentRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !startPos) return;
    const pos = getRelativeCoords(e);
    setCurrentRect({
      x: Math.min(startPos.x, pos.x),
      y: Math.min(startPos.y, pos.y),
      width: Math.abs(pos.x - startPos.x),
      height: Math.abs(pos.y - startPos.y),
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentRect) {
      setIsDrawing(false);
      setStartPos(null);
      setCurrentRect(null);
      return;
    }

    if (currentRect.width > 2 && currentRect.height > 2) {
      onAddAnnotation?.({
        x: currentRect.x,
        y: currentRect.y,
        width: currentRect.width,
        height: currentRect.height,
      });
    }

    setIsDrawing(false);
    setStartPos(null);
    setCurrentRect(null);
  };

  const visibleAnnotations = annotations.filter(
    (a) => Math.abs(a.timestamp - currentTime) < 0.5 && !hiddenAnnotations?.has(a.id)
  );

  const getAnnotationStyle = (annotation) => {
    return {
      left: `calc(${displayArea.x}px + ${annotation.x}% * ${displayArea.width}px / 100)`,
      top: `calc(${displayArea.y}px + ${annotation.y}% * ${displayArea.height}px / 100)`,
      width: `calc(${annotation.width}% * ${displayArea.width}px / 100)`,
      height: `calc(${annotation.height}% * ${displayArea.height}px / 100)`,
    };
  };

  const getDrawingStyle = () => {
    if (!currentRect) return {};
    return {
      left: `calc(${displayArea.x}px + ${currentRect.x}% * ${displayArea.width}px / 100)`,
      top: `calc(${displayArea.y}px + ${currentRect.y}% * ${displayArea.height}px / 100)`,
      width: `calc(${currentRect.width}% * ${displayArea.width}px / 100)`,
      height: `calc(${currentRect.height}% * ${displayArea.height}px / 100)`,
    };
  };

  return (
    <div ref={containerRef} className="video-wrapper">
      <div
        className={`annotation-canvas ${!disabled ? 'active' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 10,
        }}
      >
        {visibleAnnotations.map((annotation) => (
          <div
            key={annotation.id}
            className="annotation-rect"
            style={getAnnotationStyle(annotation)}
          >
            <div className="tooltip">
              <strong>{annotation.userName}</strong>: {annotation.text}
            </div>
          </div>
        ))}

        {currentRect && (
          <div
            style={{
              ...getDrawingStyle(),
              position: 'absolute',
              border: '2px dashed #667eea',
              background: 'rgba(102, 126, 234, 0.2)',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
    </div>
  );
};

export default AnnotationCanvas;
