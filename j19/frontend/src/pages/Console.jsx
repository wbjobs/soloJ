import { useState, useRef, useEffect } from 'react'
import { useDevice } from '../context/DeviceContext.jsx'

const baudRates = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600]

export default function Console() {
  const { selectedDevice, connectionStatus } = useDevice()
  const [logs, setLogs] = useState([])
  const [input, setInput] = useState('')
  const [baudRate, setBaudRate] = useState(115200)
  const [connected, setConnected] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const [timestamp, setTimestamp] = useState(true)
  const logsRef = useRef(null)

  useEffect(() => {
    if (autoScroll && logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const handleSend = () => {
    if (!input.trim()) return
    const newLog = {
      type: 'tx',
      message: input,
      time: new Date(),
    }
    setLogs((prev) => [...prev, newLog])
    setInput('')

    setTimeout(() => {
      const responses = [
        'OK',
        'READY',
        '> OK',
        'FPGA initialized',
        'Bitstream loaded',
        'CRC check passed',
        'Device responding normally',
      ]
      const response = responses[Math.floor(Math.random() * responses.length)]
      setLogs((prev) => [...prev, {
        type: 'rx',
        message: response,
        time: new Date(),
      }])
    }, 300 + Math.random() * 500)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const clearConsole = () => {
    setLogs([])
  }

  const exportLogs = () => {
    const content = logs.map((l) =>
      `${timestamp ? `[${l.time.toLocaleTimeString()}] ` : ''}${l.type === 'tx' ? 'TX: ' : 'RX: '}${l.message}`
    ).join('\n')

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `console_log_${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Serial Console</h1>
          <p className="text-slate-400 mt-1">Interact with your FPGA device via serial connection</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
            connected ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-slate-700/50'
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-500 pulse-dot' : 'bg-slate-500'}`} />
            <span className="text-sm text-white">{connected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">Baud Rate:</label>
            <select
              value={baudRate}
              onChange={(e) => setBaudRate(Number(e.target.value))}
              disabled={connected}
              className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500 disabled:opacity-50"
            >
              {baudRates.map((rate) => (
                <option key={rate} value={rate}>{rate}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">Data Bits:</label>
            <select className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500">
              <option>8</option>
              <option>7</option>
              <option>6</option>
              <option>5</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">Stop Bits:</label>
            <select className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500">
              <option>1</option>
              <option>1.5</option>
              <option>2</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">Parity:</label>
            <select className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500">
              <option value="none">None</option>
              <option value="even">Even</option>
              <option value="odd">Odd</option>
            </select>
          </div>

          <div className="flex-1" />

          <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={timestamp}
              onChange={(e) => setTimestamp(e.target.checked)}
              className="rounded border-slate-600 bg-slate-700 text-primary-500 focus:ring-primary-500"
            />
            Timestamps
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded border-slate-600 bg-slate-700 text-primary-500 focus:ring-primary-500"
            />
            Auto-scroll
          </label>

          <button
            onClick={exportLogs}
            disabled={logs.length === 0}
            className="px-3 py-1.5 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export
          </button>

          <button
            onClick={clearConsole}
            disabled={logs.length === 0}
            className="px-3 py-1.5 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear
          </button>

          <button
            onClick={() => setConnected(!connected)}
            disabled={connectionStatus !== 'connected'}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              connected
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            {connected ? 'Disconnect' : 'Connect'}
          </button>
        </div>

        <div
          ref={logsRef}
          className="h-96 overflow-y-auto p-4 font-mono text-sm bg-slate-900"
        >
          {logs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500">
              {connectionStatus === 'connected'
                ? 'Click "Connect" to start the serial session'
                : 'Connect a device first to use the console'}
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((log, index) => (
                <div key={index} className="flex gap-3">
                  {timestamp && (
                    <span className="text-slate-600 text-xs min-w-fit shrink-0">
                      {log.time.toLocaleTimeString()}
                    </span>
                  )}
                  <span className={`text-xs shrink-0 ${log.type === 'tx' ? 'text-primary-400' : 'text-emerald-400'}`}>
                    {log.type === 'tx' ? 'TX' : 'RX'}
                  </span>
                  <span className={`${log.type === 'tx' ? 'text-primary-300' : 'text-emerald-300'}`}>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-700">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!connected}
                placeholder={connected ? 'Type a command and press Enter...' : 'Connect to start typing...'}
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 font-mono text-sm disabled:opacity-50"
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!connected || !input.trim()}
              className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Send
            </button>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-medium text-white mb-3">Quick Commands</h3>
        <div className="flex flex-wrap gap-2">
          {['help', 'status', 'reset', 'version', 'info', 'read idcode'].map((cmd) => (
            <button
              key={cmd}
              onClick={() => {
                setInput(cmd)
                if (connected) setTimeout(() => { setInput(cmd); handleSend() }, 0)
              }}
              disabled={!connected}
              className="px-3 py-1.5 text-xs font-mono bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cmd}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
