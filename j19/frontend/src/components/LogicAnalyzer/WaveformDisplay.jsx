import { useRef, useEffect, useState, useCallback } from 'react'
import WaveformRenderer from '../../utils/waveformRenderer.js'

export default function WaveformDisplay({
  signals,
  cursorPosition,
  markers,
  onCursorChange,
  onMarkerAdd,
  onSignalSelect,
  timeWindow,
  sampleRate,
  height = 400,
}) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const rendererRef = useRef(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartXRef = useRef(0)
  const [hoveredSignal, setHoveredSignal] = useState(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const container = containerRef.current
    const width = container ? container.clientWidth : 800

    const renderer = new WaveformRenderer(canvasRef.current, {
      width,
      height,
      signalCount: signals?.length || 4,
      sampleRate: sampleRate || 1000000,
      timeWindow: timeWindow || { start: 0, end: 0.01 },
    })

    rendererRef.current = renderer
    renderer.render(signals || [], cursorPosition, markers || [])

    return () => {
      rendererRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!rendererRef.current) return

    const container = containerRef.current
    const width = container ? container.clientWidth : 800

    rendererRef.current.setSize(width, height)
    rendererRef.current.signalCount = signals?.length || 4
    rendererRef.current.sampleRate = sampleRate || 1000000

    if (timeWindow) {
      rendererRef.current.timeWindow = timeWindow
    }

    rendererRef.current.render(signals || [], cursorPosition, markers || [])
  }, [signals, cursorPosition, markers, timeWindow, sampleRate, height])

  useEffect(() => {
    const handleResize = () => {
      if (!rendererRef.current || !containerRef.current) return
      const width = containerRef.current.clientWidth
      rendererRef.current.setSize(width, height)
      rendererRef.current.render(signals || [], cursorPosition, markers || [])
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [signals, cursorPosition, markers, height])

  const handleMouseDown = useCallback((e) => {
    if (e.button === 0) {
      setIsDragging(true)
      dragStartXRef.current = e.clientX
    }
  }, [])

  const handleMouseMove = useCallback((e) => {
    if (!rendererRef.current || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left

    if (isDragging) {
      const deltaX = e.clientX - dragStartXRef.current
      dragStartXRef.current = e.clientX
      rendererRef.current.pan(deltaX)
      setOffset(rendererRef.current.panOffset)
      rendererRef.current.render(signals || [], cursorPosition, markers || [])
    }
  }, [isDragging, signals, cursorPosition, markers])

  const handleMouseUp = useCallback((e) => {
    if (e.button === 0 && isDragging) {
      const deltaX = Math.abs(e.clientX - dragStartXRef.current)
      if (deltaX < 5 && rendererRef.current && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const time = rendererRef.current.getTimeAtPosition(x)
        if (onCursorChange) {
          onCursorChange(time)
        }
      }
    }
    setIsDragging(false)
  }, [isDragging, onCursorChange])

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false)
    setHoveredSignal(null)
  }, [])

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    if (!rendererRef.current || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const centerX = e.clientX - rect.left
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1

    rendererRef.current.zoom(zoomFactor, centerX)
    setZoom(rendererRef.current.zoomLevel)
    rendererRef.current.render(signals || [], cursorPosition, markers || [])
  }, [signals, cursorPosition, markers])

  const handleDoubleClick = useCallback(() => {
    if (!rendererRef.current || !signals) return
    rendererRef.current.autoScale(signals)
    setZoom(1)
    setOffset(0)
    rendererRef.current.render(signals, cursorPosition, markers || [])
  }, [signals, cursorPosition, markers])

  const handleContextMenu = useCallback((e) => {
    e.preventDefault()
    if (!rendererRef.current || !canvasRef.current || !onMarkerAdd) return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const time = rendererRef.current.getTimeAtPosition(x)

    onMarkerAdd({
      time,
      label: `M${(markers?.length || 0) + 1}`,
      color: '#a78bfa',
    })
  }, [markers, onMarkerAdd])

  const handleSignalToggle = useCallback((index) => {
    if (!signals || !signals[index]) return
    signals[index].hidden = !signals[index].hidden
    if (rendererRef.current) {
      rendererRef.current.render(signals, cursorPosition, markers || [])
    }
    if (onSignalSelect) {
      onSignalSelect(index, !signals[index].hidden)
    }
  }, [signals, cursorPosition, markers, onSignalSelect])

  const handleExportPNG = useCallback(() => {
    if (!rendererRef.current) return
    const dataUrl = rendererRef.current.exportPNG()
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = 'waveform.png'
    link.click()
  }, [])

  const handleZoomIn = useCallback(() => {
    if (!rendererRef.current || !canvasRef.current) return
    const centerX = (canvasRef.current.width) / 2
    rendererRef.current.zoom(1.2, centerX)
    setZoom(rendererRef.current.zoomLevel)
    rendererRef.current.render(signals || [], cursorPosition, markers || [])
  }, [signals, cursorPosition, markers])

  const handleZoomOut = useCallback(() => {
    if (!rendererRef.current || !canvasRef.current) return
    const centerX = (canvasRef.current.width) / 2
    rendererRef.current.zoom(0.8, centerX)
    setZoom(rendererRef.current.zoomLevel)
    rendererRef.current.render(signals || [], cursorPosition, markers || [])
  }, [signals, cursorPosition, markers])

  const handleResetView = useCallback(() => {
    if (!rendererRef.current || !timeWindow) return
    rendererRef.current.setTimeWindow(timeWindow.start, timeWindow.end)
    setZoom(1)
    setOffset(0)
    rendererRef.current.render(signals || [], cursorPosition, markers || [])
  }, [timeWindow, signals, cursorPosition, markers])

  const timeAtCursor = cursorPosition !== null && cursorPosition !== undefined
    ? rendererRef.current?._formatTime?.(cursorPosition) || cursorPosition.toFixed(6) + 's'
    : '--'

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400">Waveform Display</span>
          <span className="text-xs text-slate-500">
            Zoom: {zoom.toFixed(2)}x | Time: {timeAtCursor}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
            title="Zoom In"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m-3-3h6" />
            </svg>
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
            title="Zoom Out"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM7 10h6" />
            </svg>
          </button>
          <button
            onClick={handleResetView}
            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
            title="Reset View"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={handleExportPNG}
            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
            title="Export PNG"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex">
        <div className="w-36 bg-slate-900 border-r border-slate-700 flex-shrink-0">
          <div className="px-3 py-2 text-xs font-medium text-slate-400 border-b border-slate-700">
            Signals
          </div>
          <div className="py-1">
            {signals?.map((signal, index) => (
              <div
                key={index}
                className={`px-3 py-2 cursor-pointer transition-colors ${
                  hoveredSignal === index ? 'bg-slate-800' : 'hover:bg-slate-800/50'
                }`}
                onMouseEnter={() => setHoveredSignal(index)}
                onMouseLeave={() => setHoveredSignal(null)}
                onClick={() => handleSignalToggle(index)}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-sm flex-shrink-0 ${signal.hidden ? 'opacity-30' : ''}`}
                    style={{ backgroundColor: signal.color || '#3b82f6' }}
                  />
                  <span className={`text-xs truncate ${signal.hidden ? 'text-slate-600' : 'text-slate-300'}`}>
                    {signal.name || `CH${index}`}
                  </span>
                </div>
              </div>
            ))}
            {(!signals || signals.length === 0) && (
              <div className="px-3 py-4 text-xs text-slate-600 text-center">
                No signals
              </div>
            )}
          </div>
        </div>

        <div
          ref={containerRef}
          className="flex-1 relative"
          style={{ minHeight: height }}
        >
          <canvas
            ref={canvasRef}
            className="block cursor-crosshair"
            style={{ width: '100%', height: height }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onWheel={handleWheel}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
          />
        </div>
      </div>

      <div className="px-4 py-2 border-t border-slate-700 bg-slate-800/50 text-xs text-slate-500">
        Click to place cursor | Drag to pan | Scroll to zoom | Double-click to auto-scale | Right-click for marker
      </div>
    </div>
  )
}
