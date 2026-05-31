import { useState, useEffect, useRef } from 'react'
import { bitstreamApi } from '../../services/api.js'

export default function BurnProgress({ burnId, bitstreamName, onComplete, onCancel }) {
  const [status, setStatus] = useState('initializing')
  const [progress, setProgress] = useState(0)
  const [currentBlock, setCurrentBlock] = useState(0)
  const [totalBlocks, setTotalBlocks] = useState(0)
  const [estimatedTime, setEstimatedTime] = useState(null)
  const [logs, setLogs] = useState([])
  const [error, setError] = useState(null)
  const logsRef = useRef(null)
  const pollInterval = useRef(null)

  useEffect(() => {
    if (!burnId) return

    setStatus('burning')
    setLogs([{ time: new Date(), message: 'Starting burn process...', type: 'info' }])

    const startTime = Date.now()
    pollInterval.current = setInterval(async () => {
      try {
        const { data } = await bitstreamApi.burnStatus(burnId)
        setProgress(data.progress || 0)
        setCurrentBlock(data.currentBlock || 0)
        setTotalBlocks(data.totalBlocks || 0)
        setStatus(data.status || 'burning')

        if (data.logs && data.logs.length > 0) {
          setLogs((prev) => {
            const newLogs = data.logs.slice(prev.length).map((log) => ({
              time: new Date(),
              message: log,
              type: 'info',
            }))
            return [...prev, ...newLogs]
          })
        }

        const elapsed = (Date.now() - startTime) / 1000
        if (data.progress > 0 && data.progress < 100) {
          const remaining = Math.round((elapsed / data.progress) * (100 - data.progress))
          setEstimatedTime(remaining)
        }

        if (data.status === 'completed' || data.progress >= 100) {
          setStatus('completed')
          setProgress(100)
          clearInterval(pollInterval.current)
          if (onComplete) onComplete()
        } else if (data.status === 'failed' || data.status === 'error') {
          setStatus('error')
          setError(data.error || 'Burn process failed')
          clearInterval(pollInterval.current)
        }
      } catch (err) {
        console.error('Poll error:', err)
      }
    }, 1000)

    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current)
    }
  }, [burnId])

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight
    }
  }, [logs])

  const formatTime = (seconds) => {
    if (!seconds || seconds < 0) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const statusConfig = {
    initializing: { color: 'bg-amber-500', text: 'Initializing' },
    burning: { color: 'bg-primary-500', text: 'Burning' },
    completed: { color: 'bg-emerald-500', text: 'Completed' },
    error: { color: 'bg-rose-500', text: 'Error' },
    cancelled: { color: 'bg-slate-500', text: 'Cancelled' },
  }

  const config = statusConfig[status] || statusConfig.initializing

  const handleCancel = () => {
    if (pollInterval.current) clearInterval(pollInterval.current)
    setStatus('cancelled')
    if (onCancel) onCancel()
  }

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Burn Progress</h2>
          <p className="text-sm text-slate-400 mt-1">{bitstreamName || 'Burning bitstream...'}</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
          status === 'completed' ? 'bg-emerald-500/10' :
          status === 'error' ? 'bg-rose-500/10' :
          status === 'cancelled' ? 'bg-slate-600/50' :
          'bg-primary-500/10'
        }`}>
          <span className={`w-2.5 h-2.5 rounded-full ${config.color} ${status === 'burning' ? 'pulse-dot' : ''}`} />
          <span className="text-sm font-medium text-white">{config.text}</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30">
          <p className="text-sm text-rose-400">{error}</p>
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-300">Overall Progress</span>
          <span className="text-sm font-medium text-white">{progress}%</span>
        </div>
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              status === 'completed' ? 'bg-emerald-500' :
              status === 'error' ? 'bg-rose-500' :
              status === 'cancelled' ? 'bg-slate-500' :
              'bg-gradient-to-r from-primary-500 to-primary-400'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-lg bg-slate-700/50">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Current Block</p>
          <p className="text-lg font-mono font-semibold text-white">{currentBlock || '-'}</p>
        </div>
        <div className="p-4 rounded-lg bg-slate-700/50">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Blocks</p>
          <p className="text-lg font-mono font-semibold text-white">{totalBlocks || '-'}</p>
        </div>
        <div className="p-4 rounded-lg bg-slate-700/50">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Time Remaining</p>
          <p className="text-lg font-mono font-semibold text-white">{formatTime(estimatedTime)}</p>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Process Log</p>
        <div
          ref={logsRef}
          className="code-block max-h-48 overflow-y-auto text-sm"
        >
          {logs.map((log, index) => (
            <div key={index} className="flex gap-3">
              <span className="text-slate-500 text-xs min-w-fit">
                {log.time.toLocaleTimeString()}
              </span>
              <span className="text-slate-300">{log.message}</span>
            </div>
          ))}
          {logs.length === 0 && (
            <span className="text-slate-500">Waiting for logs...</span>
          )}
        </div>
      </div>

      {status === 'burning' && (
        <button
          onClick={handleCancel}
          className="w-full px-4 py-2.5 border border-rose-500/50 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors"
        >
          Cancel Burn
        </button>
      )}

      {status === 'completed' && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-center">
          <svg className="w-10 h-10 mx-auto mb-2 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-emerald-400 font-medium">Burn completed successfully!</p>
        </div>
      )}
    </div>
  )
}
