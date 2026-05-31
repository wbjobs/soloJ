import { useState, useMemo } from 'react'

const DEFAULT_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
]

export default function SignalSelector({
  availableSignals = [],
  selectedSignals = [],
  onSignalToggle,
  onGroupSelect,
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedGroups, setExpandedGroups] = useState({})
  const [colorPickerOpen, setColorPickerOpen] = useState(null)

  const { groups, flatSignals } = useMemo(() => {
    const groupMap = new Map()
    const flat = []

    availableSignals.forEach((signal) => {
      const groupName = signal.group || 'Uncategorized'
      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, [])
      }
      groupMap.get(groupName).push(signal)
      flat.push(signal)
    })

    return {
      groups: Array.from(groupMap.entries()).map(([name, signals]) => ({
        name,
        signals,
      })),
      flatSignals: flat,
    }
  }, [availableSignals])

  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) return groups

    const term = searchTerm.toLowerCase()
    return groups
      .map((group) => ({
        ...group,
        signals: group.signals.filter(
          (s) =>
            s.name?.toLowerCase().includes(term) ||
            s.group?.toLowerCase().includes(term)
        ),
      }))
      .filter((group) => group.signals.length > 0)
  }, [groups, searchTerm])

  const toggleGroup = (groupName) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }))
  }

  const handleQuickSelect = (type) => {
    if (!onGroupSelect) return

    switch (type) {
      case 'all':
        onGroupSelect(availableSignals.map((s) => s.id))
        break
      case 'none':
        onGroupSelect([])
        break
      case 'digital':
        onGroupSelect(
          availableSignals.filter((s) => !s.isAnalog).map((s) => s.id)
        )
        break
      case 'analog':
        onGroupSelect(
          availableSignals.filter((s) => s.isAnalog).map((s) => s.id)
        )
        break
      default:
        break
    }
  }

  const isSelected = (signalId) => {
    return selectedSignals.some((s) => s.id === signalId)
  }

  const handleSignalToggle = (signal) => {
    if (onSignalToggle) {
      onSignalToggle(signal)
    }
  }

  const handleColorChange = (signalId, color) => {
    const signal = availableSignals.find((s) => s.id === signalId)
    if (signal && onSignalToggle) {
      signal.color = color
      onSignalToggle(signal)
    }
    setColorPickerOpen(null)
  }

  const digitalCount = flatSignals.filter((s) => !s.isAnalog).length
  const analogCount = flatSignals.filter((s) => s.isAnalog).length
  const selectedCount = selectedSignals.length

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden h-full flex flex-col">
      <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Signal Selector</h3>
          <span className="text-xs text-slate-400">
            {selectedCount}/{flatSignals.length} selected
          </span>
        </div>

        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search signals..."
            className="w-full pl-10 pr-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div className="flex gap-2 mt-3">
          <button
            onClick={() => handleQuickSelect('all')}
            className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
          >
            All
          </button>
          <button
            onClick={() => handleQuickSelect('none')}
            className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
          >
            None
          </button>
          <button
            onClick={() => handleQuickSelect('digital')}
            className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
          >
            Digital
          </button>
          <button
            onClick={() => handleQuickSelect('analog')}
            className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
          >
            Analog
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredGroups.map((group) => (
          <div key={group.name} className="border-b border-slate-700/50">
            <button
              onClick={() => toggleGroup(group.name)}
              className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-slate-700/50 transition-colors"
            >
              <span className="text-xs font-medium text-slate-400">
                {group.name}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  {group.signals.filter((s) => isSelected(s.id)).length}/{group.signals.length}
                </span>
                <svg
                  className={`w-4 h-4 text-slate-500 transition-transform ${
                    expandedGroups[group.name] ? 'rotate-90' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            {(expandedGroups[group.name] || !searchTerm) && (
              <div className="pb-1">
                {group.signals.map((signal) => (
                  <div
                    key={signal.id}
                    className={`px-4 py-2 flex items-center gap-3 transition-colors ${
                      isSelected(signal.id) ? 'bg-slate-700/30' : ''
                    } hover:bg-slate-700/40`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected(signal.id)}
                      onChange={() => handleSignalToggle(signal)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-primary-500 focus:ring-primary-500 focus:ring-offset-0"
                    />

                    <div className="relative">
                      <button
                        onClick={() =>
                          setColorPickerOpen(
                            colorPickerOpen === signal.id ? null : signal.id
                          )
                        }
                        className="w-5 h-5 rounded border border-slate-600 cursor-pointer hover:ring-2 hover:ring-slate-500"
                        style={{ backgroundColor: signal.color || DEFAULT_COLORS[0] }}
                        title="Change color"
                      />
                      {colorPickerOpen === signal.id && (
                        <div className="absolute left-0 top-full mt-1 p-2 bg-slate-700 rounded-lg border border-slate-600 shadow-xl z-10 flex flex-wrap gap-1 w-28">
                          {DEFAULT_COLORS.map((color) => (
                            <button
                              key={color}
                              onClick={() => handleColorChange(signal.id, color)}
                              className="w-6 h-6 rounded border border-slate-600 hover:ring-2 hover:ring-white/30"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white truncate">
                        {signal.name || signal.id}
                      </div>
                      <div className="text-xs text-slate-500">
                        {signal.isAnalog ? 'Analog' : 'Digital'}
                        {signal.width ? ` | ${signal.width}-bit` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {filteredGroups.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            {searchTerm ? 'No signals match your search' : 'No signals available'}
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-slate-700 bg-slate-800/50 text-xs text-slate-500">
        Digital: {digitalCount} | Analog: {analogCount}
      </div>
    </div>
  )
}
