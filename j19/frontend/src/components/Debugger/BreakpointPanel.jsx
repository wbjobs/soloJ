import { useState, useRef, useEffect } from 'react'
import { useDevice } from '../../context/DeviceContext.jsx'

const CONDITION_TYPES = [
  { value: 'eq', label: '==' },
  { value: 'neq', label: '!=' },
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
  { value: 'gte', label: '>=' },
  { value: 'lte', label: '<=' },
  { value: 'rising_edge', label: 'Rising Edge' },
  { value: 'falling_edge', label: 'Falling Edge' },
]

const ACTIONS = [
  { value: 'pause', label: 'Pause' },
  { value: 'capture', label: 'Capture' },
  { value: 'custom', label: 'Custom Command' },
]

const DEFAULT_SIGNALS = [
  { id: 'clk', name: 'CLK' },
  { id: 'reset', name: 'RESET' },
  { id: 'data_in', name: 'DATA_IN' },
  { id: 'data_out', name: 'DATA_OUT' },
  { id: 'addr', name: 'ADDR' },
  { id: 'wr_en', name: 'WR_EN' },
  { id: 'rd_en', name: 'RD_EN' },
  { id: 'valid', name: 'VALID' },
]

export default function BreakpointPanel({
  breakpoints,
  onAddBreakpoint,
  onRemoveBreakpoint,
  onEnableToggle,
  onHit,
}) {
  const { connectionStatus } = useDevice()

  const [localBreakpoints, setLocalBreakpoints] = useState(breakpoints || [])
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedSignal, setSelectedSignal] = useState('')
  const [conditionType, setConditionType] = useState('eq')
  const [thresholdValue, setThresholdValue] = useState('0')
  const [action, setAction] = useState('pause')
  const [customCommand, setCustomCommand] = useState('')
  const [isEnabled, setIsEnabled] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [importError, setImportError] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (breakpoints) {
      setLocalBreakpoints(breakpoints)
    }
  }, [breakpoints])

  const handleAddBreakpoint = () => {
    if (!selectedSignal) return

    const newBp = {
      id: editingId || `bp_${Date.now()}`,
      signal: selectedSignal,
      signalName: DEFAULT_SIGNALS.find((s) => s.id === selectedSignal)?.name || selectedSignal,
      condition: conditionType,
      threshold: thresholdValue,
      action,
      customCommand: action === 'custom' ? customCommand : '',
      enabled: isEnabled,
      hitCount: 0,
    }

    setLocalBreakpoints((prev) => {
      if (editingId) {
        return prev.map((bp) => (bp.id === editingId ? newBp : bp))
      }
      return [...prev, newBp]
    })

    if (onAddBreakpoint) {
      onAddBreakpoint(newBp)
    }

    resetForm()
  }

  const resetForm = () => {
    setSelectedSignal('')
    setConditionType('eq')
    setThresholdValue('0')
    setAction('pause')
    setCustomCommand('')
    setIsEnabled(true)
    setEditingId(null)
    setShowAddForm(false)
  }

  const handleRemoveBreakpoint = (id) => {
    setLocalBreakpoints((prev) => prev.filter((bp) => bp.id !== id))
    if (onRemoveBreakpoint) {
      onRemoveBreakpoint(id)
    }
  }

  const handleEnableToggle = (id) => {
    setLocalBreakpoints((prev) =>
      prev.map((bp) => (bp.id === id ? { ...bp, enabled: !bp.enabled } : bp))
    )
    if (onEnableToggle) {
      onEnableToggle(id)
    }
  }

  const handleEditBreakpoint = (bp) => {
    setEditingId(bp.id)
    setSelectedSignal(bp.signal)
    setConditionType(bp.condition)
    setThresholdValue(bp.threshold)
    setAction(bp.action)
    setCustomCommand(bp.customCommand || '')
    setIsEnabled(bp.enabled)
    setShowAddForm(true)
  }

  const handleResetHitCount = (id) => {
    setLocalBreakpoints((prev) =>
      prev.map((bp) => (bp.id === id ? { ...bp, hitCount: 0 } : bp))
    )
  }

  const handleResetAllCounts = () => {
    setLocalBreakpoints((prev) =>
      prev.map((bp) => ({ ...bp, hitCount: 0 }))
    )
  }

  const handleSimulateHit = (id) => {
    setLocalBreakpoints((prev) =>
      prev.map((bp) => (bp.id === id ? { ...bp, hitCount: bp.hitCount + 1 } : bp))
    )
    if (onHit) {
      onHit(id)
    }
  }

  const handleExport = () => {
    const data = JSON.stringify(localBreakpoints, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'breakpoints.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result)
        if (Array.isArray(data)) {
          setLocalBreakpoints(data)
          if (onAddBreakpoint) {
            data.forEach((bp) => onAddBreakpoint(bp))
          }
        }
        setImportError(null)
      } catch {
        setImportError('Invalid breakpoint file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleClearAll = () => {
    setLocalBreakpoints([])
    if (onRemoveBreakpoint) {
      localBreakpoints.forEach((bp) => onRemoveBreakpoint(bp.id))
    }
  }

  const needsValue = !['rising_edge', 'falling_edge'].includes(conditionType)

  const enabledCount = localBreakpoints.filter((bp) => bp.enabled).length
  const totalHits = localBreakpoints.reduce((sum, bp) => sum + bp.hitCount, 0)

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden h-full flex flex-col">
      <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Breakpoints</h3>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>{localBreakpoints.length} total</span>
            <span>{enabledCount} enabled</span>
            <span>{totalHits} hits</span>
            <span className={`flex items-center gap-1 ${
              connectionStatus === 'connected' ? 'text-emerald-400' : 'text-slate-500'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                connectionStatus === 'connected' ? 'bg-emerald-500' : 'bg-slate-500'
              }`} />
              {connectionStatus === 'connected' ? 'HW Connected' : 'Simulation'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              resetForm()
              setShowAddForm(true)
            }}
            className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            + Add Breakpoint
          </button>
          <button
            onClick={handleResetAllCounts}
            disabled={localBreakpoints.length === 0}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition-colors disabled:opacity-50"
          >
            Reset All Counts
          </button>
          <button
            onClick={handleExport}
            disabled={localBreakpoints.length === 0}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition-colors disabled:opacity-50"
          >
            Export
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition-colors"
          >
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={handleClearAll}
            disabled={localBreakpoints.length === 0}
            className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 text-xs rounded-lg transition-colors disabled:opacity-50"
          >
            Clear All
          </button>
        </div>

        {importError && (
          <div className="mt-2 text-xs text-rose-400">{importError}</div>
        )}
      </div>

      {showAddForm && (
        <div className="px-4 py-3 border-b border-slate-700 bg-slate-900/50">
          <h4 className="text-xs font-medium text-slate-400 mb-3">
            {editingId ? 'Edit Breakpoint' : 'Add New Breakpoint'}
          </h4>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Signal</label>
              <select
                value={selectedSignal}
                onChange={(e) => setSelectedSignal(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
              >
                <option value="">Select...</option>
                {DEFAULT_SIGNALS.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">Condition</label>
              <select
                value={conditionType}
                onChange={(e) => setConditionType(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
              >
                {CONDITION_TYPES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {needsValue && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">Threshold</label>
                <input
                  type="text"
                  value={thresholdValue}
                  onChange={(e) => setThresholdValue(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500"
                  placeholder="Value"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-500 mb-1">Action</label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
              >
                {ACTIONS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>

            {action === 'custom' && (
              <div className="col-span-2 lg:col-span-4">
                <label className="block text-xs text-slate-500 mb-1">Custom Command</label>
                <input
                  type="text"
                  value={customCommand}
                  onChange={(e) => setCustomCommand(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500 font-mono"
                  placeholder="e.g., jtag reset, mem dump 0x100"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-primary-500 focus:ring-primary-500 focus:ring-offset-0"
              />
              <span className="text-xs text-slate-400">Enabled</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                onClick={resetForm}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddBreakpoint}
                disabled={!selectedSignal}
                className="px-4 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-medium rounded-lg transition-colors"
              >
                {editingId ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-900/50 sticky top-0">
            <tr className="text-slate-400">
              <th className="px-4 py-2 text-left font-medium">ID</th>
              <th className="px-4 py-2 text-left font-medium">Signal</th>
              <th className="px-4 py-2 text-left font-medium">Condition</th>
              <th className="px-4 py-2 text-left font-medium">Enabled</th>
              <th className="px-4 py-2 text-left font-medium">Hits</th>
              <th className="px-4 py-2 text-left font-medium">Action</th>
              <th className="px-4 py-2 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {localBreakpoints.map((bp) => (
              <tr
                key={bp.id}
                className={`border-t border-slate-700/50 transition-colors ${
                  bp.hitCount > 0 ? 'bg-amber-500/5' : 'hover:bg-slate-700/30'
                }`}
              >
                <td className="px-4 py-2 text-slate-500 font-mono">{bp.id}</td>
                <td className="px-4 py-2 text-white">{bp.signalName}</td>
                <td className="px-4 py-2">
                  <span className="text-slate-300">
                    {CONDITION_TYPES.find((c) => c.value === bp.condition)?.label || bp.condition}
                    {bp.threshold && !['rising_edge', 'falling_edge'].includes(bp.condition)
                      ? ` ${bp.threshold}`
                      : ''}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => handleEnableToggle(bp.id)}
                    className={`w-9 h-5 rounded-full transition-colors ${
                      bp.enabled ? 'bg-emerald-500' : 'bg-slate-600'
                    }`}
                  >
                    <span className={`block w-3.5 h-3.5 bg-white rounded-full transition-transform ${
                      bp.enabled ? 'translate-x-4' : 'translate-x-1'
                    }`} />
                  </button>
                </td>
                <td className="px-4 py-2">
                  <span className={`font-mono ${bp.hitCount > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                    {bp.hitCount}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-300">
                  {bp.action === 'custom' && bp.customCommand
                    ? bp.customCommand
                    : ACTIONS.find((a) => a.value === bp.action)?.label || bp.action}
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleSimulateHit(bp.id)}
                      className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-colors"
                      title="Simulate Hit"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleResetHitCount(bp.id)}
                      className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                      title="Reset Count"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleEditBreakpoint(bp)}
                      className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-primary-400 transition-colors"
                      title="Edit"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleRemoveBreakpoint(bp.id)}
                      className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-colors"
                      title="Delete"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {localBreakpoints.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No breakpoints configured
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
