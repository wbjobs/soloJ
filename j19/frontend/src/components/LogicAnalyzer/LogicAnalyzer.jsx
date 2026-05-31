import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import WaveformDisplay from './WaveformDisplay.jsx'
import SignalSelector from './SignalSelector.jsx'
import { useDevice } from '../../context/DeviceContext.jsx'

const SAMPLE_RATES = [
  { value: 1000, label: '1 kHz' },
  { value: 10000, label: '10 kHz' },
  { value: 100000, label: '100 kHz' },
  { value: 1000000, label: '1 MHz' },
  { value: 10000000, label: '10 MHz' },
  { value: 50000000, label: '50 MHz' },
  { value: 100000000, label: '100 MHz' },
]

const TRIGGER_MODES = [
  { value: 'auto', label: 'Auto' },
  { value: 'normal', label: 'Normal' },
  { value: 'single', label: 'Single' },
]

const TRIGGER_TYPES = [
  { value: 'rising', label: 'Rising Edge' },
  { value: 'falling', label: 'Falling Edge' },
  { value: 'high', label: 'Level High' },
  { value: 'low', label: 'Level Low' },
  { value: 'pattern', label: 'Pattern Match' },
]

const TIME_BASES = [
  { value: 0.000001, label: '1 us' },
  { value: 0.00001, label: '10 us' },
  { value: 0.0001, label: '100 us' },
  { value: 0.001, label: '1 ms' },
  { value: 0.01, label: '10 ms' },
  { value: 0.1, label: '100 ms' },
  { value: 1, label: '1 s' },
]

function generateSimulatedSignals(sampleRate, duration, signalCount) {
  const signals = []
  const sampleCount = Math.floor(sampleRate * duration)

  for (let i = 0; i < signalCount; i++) {
    const isAnalog = i >= signalCount - 2
    const data = []

    if (isAnalog) {
      const frequency = (i + 1) * 1000
      for (let j = 0; j < sampleCount; j += Math.max(1, Math.floor(sampleCount / 500))) {
        const t = j / sampleRate
        const value = Math.sin(2 * Math.PI * frequency * t + i) * (0.5 + i * 0.1)
        data.push({ time: t, value })
      }
    } else {
      let currentValue = Math.random() > 0.5 ? 1 : 0
      const transitionRate = 0.0001 * (i + 1)
      let lastTransition = 0

      for (let j = 0; j < sampleCount; j += Math.max(1, Math.floor(sampleCount / 1000))) {
        const t = j / sampleRate

        if (Math.random() < transitionRate && t - lastTransition > 0.0001) {
          currentValue = currentValue ? 0 : 1
          lastTransition = t
        }

        if (j === 0 || data.length === 0 || data[data.length - 1].value !== currentValue) {
          data.push({ time: t, value: currentValue })
        }
      }
      data.push({ time: duration, value: currentValue })
    }

    signals.push({
      id: `sig_${i}`,
      name: isAnalog ? `ANALOG_${i}` : `DIG_${i}`,
      group: isAnalog ? 'Analog Signals' : `Digital Bus ${Math.floor(i / 4) + 1}`,
      color: [
        '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
        '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
      ][i % 8],
      data,
      isAnalog,
      width: 1,
      hidden: false,
    })
  }

  return signals
}

export default function LogicAnalyzer() {
  const { selectedDevice, connectionStatus } = useDevice()

  const [signals, setSignals] = useState([])
  const [selectedSignals, setSelectedSignals] = useState([])
  const [cursorPosition, setCursorPosition] = useState(null)
  const [markers, setMarkers] = useState([])
  const [sampleRate, setSampleRate] = useState(1000000)
  const [timeBase, setTimeBase] = useState(0.01)
  const [triggerMode, setTriggerMode] = useState('auto')
  const [triggerSource, setTriggerSource] = useState(null)
  const [triggerType, setTriggerType] = useState('rising')
  const [preTrigger, setPreTrigger] = useState(50)
  const [isCapturing, setIsCapturing] = useState(false)
  const [captureState, setCaptureState] = useState('idle')
  const [sampleCount, setSampleCount] = useState(0)
  const [showTriggerPanel, setShowTriggerPanel] = useState(true)
  const [streamingInterval, setStreamingInterval] = useState(null)

  const timeWindow = useMemo(() => ({
    start: 0,
    end: timeBase * 10,
  }), [timeBase])

  useEffect(() => {
    const initialSignals = generateSimulatedSignals(sampleRate, timeBase * 10, 8)
    setSignals(initialSignals)
    setSelectedSignals(initialSignals.slice(0, 6))
    setTriggerSource(initialSignals[0]?.id || null)
  }, [])

  const handleSignalToggle = useCallback((signal) => {
    setSelectedSignals((prev) => {
      const exists = prev.some((s) => s.id === signal.id)
      if (exists) {
        return prev.filter((s) => s.id !== signal.id)
      }
      return [...prev, signal]
    })
  }, [])

  const handleGroupSelect = useCallback((signalIds) => {
    setSelectedSignals(
      signals.filter((s) => signalIds.includes(s.id))
    )
  }, [signals])

  const handleCursorChange = useCallback((time) => {
    setCursorPosition(time)
  }, [])

  const handleMarkerAdd = useCallback((marker) => {
    setMarkers((prev) => [...prev, marker])
  }, [])

  const handleStartCapture = useCallback(() => {
    if (isCapturing) return

    setIsCapturing(true)
    setCaptureState('capturing')

    if (connectionStatus !== 'connected') {
      let intervalMs = 200
      if (sampleRate > 1000000) intervalMs = 100
      if (sampleRate > 10000000) intervalMs = 50

      const interval = setInterval(() => {
        const newSignals = generateSimulatedSignals(sampleRate, timeBase * 10, signals.length || 8)
        setSignals(newSignals)
        setSelectedSignals((prev) =>
          newSignals.filter((s) => prev.some((p) => p.id === s.id))
        )
        setSampleCount((prev) => prev + Math.floor(sampleRate * (intervalMs / 1000)))
      }, intervalMs)

      setStreamingInterval(interval)
    }
  }, [isCapturing, connectionStatus, sampleRate, timeBase, signals.length])

  const handleStopCapture = useCallback(() => {
    setIsCapturing(false)
    setCaptureState('stopped')

    if (streamingInterval) {
      clearInterval(streamingInterval)
      setStreamingInterval(null)
    }
  }, [streamingInterval])

  const handleExport = useCallback((format) => {
    if (selectedSignals.length === 0) return

    let content = ''
    let mimeType = 'text/plain'
    let filename = `logic_capture.${format}`

    switch (format) {
      case 'csv':
        content = 'time,' + selectedSignals.map((s) => s.name).join(',') + '\n'
        const allTimes = new Set()
        selectedSignals.forEach((s) => {
          s.data.forEach((d) => allTimes.add(d.time))
        })
        const sortedTimes = Array.from(allTimes).sort((a, b) => a - b)
        sortedTimes.forEach((t) => {
          const row = [t.toFixed(9)]
          selectedSignals.forEach((s) => {
            const point = s.data.find((d) => Math.abs(d.time - t) < 0.000001)
            row.push(point ? point.value : '')
          })
          content += row.join(',') + '\n'
        })
        mimeType = 'text/csv'
        break

      case 'vcd':
        content = '$date\n  today\n$end\n'
        content += '$version\n  LogicAnalyzer v1.0\n$end\n'
        content += '$timescale\n  1ns\n$end\n'
        content += '$scope module logic $end\n'
        selectedSignals.forEach((s, i) => {
          content += `$var wire ${s.width || 1} ${String.fromCharCode(33 + i)} ${s.name} $end\n`
        })
        content += '$upscope $end\n$enddefinitions $end\n'
        content += '#0\n'
        const vcdTimes = new Set()
        selectedSignals.forEach((s) => {
          s.data.forEach((d) => vcdTimes.add(Math.floor(d.time * 1e9)))
        })
        Array.from(vcdTimes).sort((a, b) => a - b).forEach((t) => {
          content += `#${t}\n`
          selectedSignals.forEach((s, i) => {
            const point = s.data.find((d) => Math.floor(d.time * 1e9) === t)
            if (point) {
              content += `${point.value}${String.fromCharCode(33 + i)}\n`
            }
          })
        })
        break

      case 'json':
        const jsonData = {
          sampleRate,
          timeBase,
          signals: selectedSignals.map((s) => ({
            id: s.id,
            name: s.name,
            isAnalog: s.isAnalog,
            width: s.width,
            data: s.data,
          })),
        }
        content = JSON.stringify(jsonData, null, 2)
        mimeType = 'application/json'
        break

      default:
        return
    }

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }, [selectedSignals, sampleRate, timeBase])

  const handleSignalSelect = useCallback((index, visible) => {
    if (signals[index]) {
      signals[index].hidden = !visible
      setSignals([...signals])
    }
  }, [signals])

  const visibleSignals = useMemo(() => {
    return selectedSignals.filter((s) => !s.hidden)
  }, [selectedSignals])

  const timeRange = useMemo(() => {
    const end = timeBase * 10
    return `0 - ${end.toFixed(6)}s`
  }, [timeBase])

  useEffect(() => {
    return () => {
      if (streamingInterval) {
        clearInterval(streamingInterval)
      }
    }
  }, [streamingInterval])

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Logic Analyzer</h1>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
            connectionStatus === 'connected'
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-slate-700 text-slate-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-emerald-500' : 'bg-slate-500'
            } ${isCapturing ? 'animate-pulse' : ''}`} />
            <span className="text-xs font-medium">
              {connectionStatus === 'connected'
                ? `Connected: ${selectedDevice?.productName || 'Device'}`
                : isCapturing
                ? 'Simulated Capture'
                : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={isCapturing ? handleStopCapture : handleStartCapture}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                isCapturing
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {isCapturing ? 'Stop' : 'Start'}
            </button>
          </div>

          <div className="h-6 w-px bg-slate-700" />

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Sample Rate</label>
            <select
              value={sampleRate}
              onChange={(e) => setSampleRate(Number(e.target.value))}
              className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
            >
              {SAMPLE_RATES.map((sr) => (
                <option key={sr.value} value={sr.value}>{sr.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Time Base</label>
            <select
              value={timeBase}
              onChange={(e) => setTimeBase(Number(e.target.value))}
              className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
            >
              {TIME_BASES.map((tb) => (
                <option key={tb.value} value={tb.value}>{tb.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Trigger</label>
            <select
              value={triggerMode}
              onChange={(e) => setTriggerMode(e.target.value)}
              className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
            >
              {TRIGGER_MODES.map((tm) => (
                <option key={tm.value} value={tm.value}>{tm.label}</option>
              ))}
            </select>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Export:</span>
            <button
              onClick={() => handleExport('csv')}
              disabled={selectedSignals.length === 0}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition-colors disabled:opacity-50"
            >
              CSV
            </button>
            <button
              onClick={() => handleExport('vcd')}
              disabled={selectedSignals.length === 0}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition-colors disabled:opacity-50"
            >
              VCD
            </button>
            <button
              onClick={() => handleExport('json')}
              disabled={selectedSignals.length === 0}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition-colors disabled:opacity-50"
            >
              JSON
            </button>
          </div>
        </div>
      </div>

      {showTriggerPanel && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Trigger Configuration</h3>
            <button
              onClick={() => setShowTriggerPanel(false)}
              className="text-slate-400 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">Source</label>
              <select
                value={triggerSource || ''}
                onChange={(e) => setTriggerSource(e.target.value)}
                className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
              >
                <option value="">Select signal...</option>
                {signals.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">Type</label>
              <select
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value)}
                className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
              >
                {TRIGGER_TYPES.map((tt) => (
                  <option key={tt.value} value={tt.value}>{tt.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <label className="text-xs text-slate-400 whitespace-nowrap">Pre-trigger</label>
              <input
                type="range"
                min="0"
                max="100"
                value={preTrigger}
                onChange={(e) => setPreTrigger(Number(e.target.value))}
                className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
              />
              <span className="text-xs text-slate-400 w-10 text-right">{preTrigger}%</span>
            </div>
          </div>
        </div>
      )}

      {!showTriggerPanel && (
        <button
          onClick={() => setShowTriggerPanel(true)}
          className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-xs text-slate-400 hover:text-white hover:border-slate-600 transition-colors text-left"
        >
          Show Trigger Configuration
        </button>
      )}

      <div className="flex-1 flex gap-4 min-h-0">
        <div className="w-64 flex-shrink-0">
          <SignalSelector
            availableSignals={signals}
            selectedSignals={selectedSignals}
            onSignalToggle={handleSignalToggle}
            onGroupSelect={handleGroupSelect}
          />
        </div>

        <div className="flex-1 min-w-0">
          <WaveformDisplay
            signals={visibleSignals}
            cursorPosition={cursorPosition}
            markers={markers}
            onCursorChange={handleCursorChange}
            onMarkerAdd={handleMarkerAdd}
            onSignalSelect={handleSignalSelect}
            timeWindow={timeWindow}
            sampleRate={sampleRate}
            height={500}
          />
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-6">
            <span>Samples: <span className="text-white font-mono">{sampleCount.toLocaleString()}</span></span>
            <span>Time Range: <span className="text-white font-mono">{timeRange}</span></span>
            <span>State: <span className={
              isCapturing ? 'text-emerald-400' : captureState === 'error' ? 'text-rose-400' : 'text-slate-400'
            }>{captureState}</span></span>
          </div>
          <div className="flex items-center gap-6">
            <span>Buffer: <span className="text-white font-mono">{Math.min(100, Math.floor(sampleCount / 1000000 * 10))}%</span></span>
            <span>Markers: <span className="text-white font-mono">{markers.length}</span></span>
            <span>Signals: <span className="text-white font-mono">{selectedSignals.length}/{signals.length}</span></span>
          </div>
        </div>
      </div>
    </div>
  )
}
