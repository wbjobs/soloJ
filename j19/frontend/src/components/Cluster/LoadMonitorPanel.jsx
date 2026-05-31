import { useState } from 'react'

const statusColors = {
  offline: 'bg-slate-500',
  idle: 'bg-emerald-500',
  busy: 'bg-amber-500',
  error: 'bg-rose-500',
}

const statusLabels = {
  offline: 'Offline',
  idle: 'Idle',
  busy: 'Busy',
  error: 'Error',
}

function getTemperatureColor(temp) {
  if (temp < 40) return 'text-emerald-400'
  if (temp < 60) return 'text-amber-400'
  return 'text-rose-400'
}

function getLoadColor(load) {
  if (load < 40) return 'bg-emerald-500'
  if (load < 70) return 'bg-amber-500'
  return 'bg-rose-500'
}

function NodeCard({ node, isSelected, onClick }) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      className={`bg-slate-800 rounded-xl p-4 border transition-all duration-200 cursor-pointer ${
        isSelected
          ? 'border-primary-500 ring-2 ring-primary-500/30'
          : isHovered
          ? 'border-slate-600'
          : 'border-slate-700'
      }`}
      onClick={() => onClick(node)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${statusColors[node.status] || statusColors.offline}`} />
          <h3 className="font-semibold text-white">{node.name}</h3>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${statusColors[node.status] || statusColors.offline} bg-opacity-20 text-white`}>
          {statusLabels[node.status] || 'Offline'}
        </span>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Load</span>
            <span>{node.load || 0}%</span>
          </div>
          <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${getLoadColor(node.load || 0)} transition-all duration-300`}
              style={{ width: `${node.load || 0}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-700/50 rounded-lg p-2">
            <div className="text-xs text-slate-400 mb-1">Temperature</div>
            <div className={`text-lg font-bold ${getTemperatureColor(node.temperature || 0)}`}>
              {node.temperature || 0}°C
            </div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-2">
            <div className="text-xs text-slate-400 mb-1">Voltage</div>
            <div className="text-lg font-bold text-white">
              {node.voltage?.toFixed(2) || '0.00'}V
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-700/50 rounded-lg p-2">
            <div className="text-xs text-slate-400 mb-1">Current</div>
            <div className="text-lg font-bold text-white">
              {node.current?.toFixed(1) || '0.0'}mA
            </div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-2">
            <div className="text-xs text-slate-400 mb-1">Tasks Done</div>
            <div className="text-lg font-bold text-white">
              {node.tasksCompleted || 0}
            </div>
          </div>
        </div>

        {node.status === 'busy' && node.currentTask && (
          <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="text-xs text-amber-400 mb-1">Running Task</div>
            <div className="text-sm text-white truncate">{node.currentTask}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LoadMonitorPanel({ nodes = [], selectedNode, onNodeSelect }) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Node Load Monitor</h2>
        <span className="text-sm text-slate-400">{nodes.length} nodes</span>
      </div>

      <div className="flex-1 overflow-y-auto pr-2">
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
            <p>No nodes in cluster</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
            {nodes.map((node) => (
              <NodeCard
                key={node.id}
                node={node}
                isSelected={selectedNode?.id === node.id}
                onClick={onNodeSelect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
