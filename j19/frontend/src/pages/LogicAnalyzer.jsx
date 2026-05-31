import { useState } from 'react'
import LogicAnalyzerComponent from '../components/LogicAnalyzer/LogicAnalyzer.jsx'
import { useDevice } from '../context/DeviceContext.jsx'

export default function LogicAnalyzerPage() {
  const { selectedDevice, connectionStatus } = useDevice()

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Logic Analyzer</h1>
          <p className="text-slate-400 mt-1">实时采集 FPGA 内部信号并显示波形</p>
        </div>
        <div className="flex items-center gap-3">
          {connectionStatus === 'connected' ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-500 pulse-dot" />
              <span className="text-sm text-emerald-400">{selectedDevice?.productName || 'FPGA Device'}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-sm text-amber-400">未连接设备 - 演示模式</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <LogicAnalyzerComponent />
      </div>
    </div>
  )
}