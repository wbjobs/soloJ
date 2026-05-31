import { useState } from 'react'
import BreakpointPanel from '../components/Debugger/BreakpointPanel.jsx'
import DebugConsole from '../components/Debugger/DebugConsole.jsx'
import { useDevice } from '../context/DeviceContext.jsx'

export default function DebuggerPage() {
  const { selectedDevice, connectionStatus } = useDevice()
  const [breakpoints, setBreakpoints] = useState([])
  const [sessionActive, setSessionActive] = useState(false)

  const handleAddBreakpoint = (bp) => {
    setBreakpoints([...breakpoints, { ...bp, id: Date.now(), hitCount: 0, enabled: true }])
  }

  const handleRemoveBreakpoint = (id) => {
    setBreakpoints(breakpoints.filter((b) => b.id !== id))
  }

  const handleEnableToggle = (id, enabled) => {
    setBreakpoints(
      breakpoints.map((b) => (b.id === id ? { ...b, enabled } : b))
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Debugger</h1>
          <p className="text-slate-400 mt-1">JTAG 在线调试与断点管理</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSessionActive(!sessionActive)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              sessionActive
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {sessionActive ? '停止调试' : '开始调试'}
          </button>
          {connectionStatus === 'connected' ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-500 pulse-dot" />
              <span className="text-sm text-emerald-400">
                {selectedDevice?.productName || 'FPGA Device'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-sm text-amber-400">未连接 - 模拟模式</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 flex flex-col min-h-0">
          <div className="bg-slate-800 rounded-xl border border-slate-700 flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 flex-shrink-0">
              <h2 className="text-sm font-semibold text-white">断点管理</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {breakpoints.length} 个断点 · {breakpoints.filter((b) => b.enabled).length} 个已启用
              </p>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <BreakpointPanel
                breakpoints={breakpoints}
                onAddBreakpoint={handleAddBreakpoint}
                onRemoveBreakpoint={handleRemoveBreakpoint}
                onEnableToggle={handleEnableToggle}
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 flex flex-col min-h-0">
          <div className="bg-slate-800 rounded-xl border border-slate-700 flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 flex-shrink-0">
              <h2 className="text-sm font-semibold text-white">调试控制台</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {sessionActive ? '会话运行中' : '会话未启动'}
              </p>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <DebugConsole
                sessionActive={sessionActive}
                onSessionToggle={() => setSessionActive(!sessionActive)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}