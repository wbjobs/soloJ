import { useDevice } from '../../context/DeviceContext.jsx'

export default function DeviceConnection() {
  const {
    selectedDevice,
    connectionStatus,
    connectDevice,
    disconnectDevice,
    loading,
    error,
  } = useDevice()

  const statusConfig = {
    connected: { color: 'bg-emerald-500', text: 'Connected', bg: 'bg-emerald-500/10', border: 'border-emerald-500/50' },
    connecting: { color: 'bg-amber-500 pulse-dot', text: 'Connecting...', bg: 'bg-amber-500/10', border: 'border-amber-500/50' },
    disconnected: { color: 'bg-slate-500', text: 'Disconnected', bg: 'bg-slate-500/10', border: 'border-slate-600' },
    error: { color: 'bg-rose-500', text: 'Error', bg: 'bg-rose-500/10', border: 'border-rose-500/50' },
  }

  const config = statusConfig[connectionStatus] || statusConfig.disconnected

  if (!selectedDevice) {
    return (
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">Device Connection</h2>
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No Device Selected</h3>
          <p className="text-slate-400 text-sm">Select a device from the list to view connection details</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Device Connection</h2>
          <p className="text-sm text-slate-400 mt-1">Manage device connection and view details</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${config.bg} border ${config.border}`}>
          <span className={`w-2.5 h-2.5 rounded-full ${config.color}`} />
          <span className="text-sm font-medium text-white">{config.text}</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30">
          <p className="text-sm text-rose-400">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 rounded-lg bg-slate-700/50">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Product Name</p>
          <p className="text-sm font-medium text-white">{selectedDevice.productName || 'N/A'}</p>
        </div>
        <div className="p-4 rounded-lg bg-slate-700/50">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Manufacturer</p>
          <p className="text-sm font-medium text-white">{selectedDevice.manufacturerName || 'N/A'}</p>
        </div>
        <div className="p-4 rounded-lg bg-slate-700/50">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Vendor ID</p>
          <p className="text-sm font-mono text-white">0x{selectedDevice.vendorId?.toString(16).padStart(4, '0').toUpperCase()}</p>
        </div>
        <div className="p-4 rounded-lg bg-slate-700/50">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Product ID</p>
          <p className="text-sm font-mono text-white">0x{selectedDevice.productId?.toString(16).padStart(4, '0').toUpperCase()}</p>
        </div>
        <div className="p-4 rounded-lg bg-slate-700/50 col-span-2">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Serial Number</p>
          <p className="text-sm font-mono text-white">{selectedDevice.serialNumber || 'N/A'}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {connectionStatus === 'connected' ? (
          <button
            onClick={disconnectDevice}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
            {loading ? 'Disconnecting...' : 'Disconnect'}
          </button>
        ) : (
          <button
            onClick={() => connectDevice(selectedDevice)}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        )}
      </div>
    </div>
  )
}
