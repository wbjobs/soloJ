const layoutOptions = [
  { value: 'grid', label: 'Grid', icon: 'G' },
  { value: 'circular', label: 'Circular', icon: 'C' },
  { value: 'force', label: 'Force', icon: 'F' },
]

const statusColors = {
  online: 'bg-emerald-500',
  offline: 'bg-slate-500',
  degraded: 'bg-amber-500',
  error: 'bg-rose-500',
}

export default function ClusterToolbar({
  clusterName = 'FPGA Cluster',
  clusterStatus = 'online',
  onAddNode,
  onRemoveNode,
  onRefresh,
  layoutMode = 'grid',
  onLayoutChange,
  nodeCount = 0,
}) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">{clusterName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${statusColors[clusterStatus] || statusColors.offline}`} />
              <span className="text-sm text-slate-400 capitalize">{clusterStatus}</span>
              <span className="text-slate-600">•</span>
              <span className="text-sm text-slate-400">{nodeCount} nodes</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-700 rounded-lg p-1">
            <span className="text-xs text-slate-400 px-2">Layout:</span>
            {layoutOptions.map((layout) => (
              <button
                key={layout.value}
                onClick={() => onLayoutChange?.(layout.value)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  layoutMode === layout.value
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-300 hover:bg-slate-600'
                }`}
                title={layout.label}
              >
                {layout.label}
              </button>
            ))}
          </div>

          <button
            onClick={onRefresh}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-sm">Refresh</span>
          </button>

          <button
            onClick={onAddNode}
            className="px-3 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm">Add Node</span>
          </button>

          <button
            onClick={onRemoveNode}
            className="px-3 py-2 bg-slate-700 hover:bg-rose-600 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="text-sm">Remove</span>
          </button>
        </div>
      </div>
    </div>
  )
}
