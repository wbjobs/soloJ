import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { bitstreamApi } from '../../services/api.js'
import { useDevice } from '../../context/DeviceContext.jsx'

export default function BitstreamLibrary({ onBurn }) {
  const [bitstreams, setBitstreams] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)
  const { selectedDevice } = useDevice()

  const fetchBitstreams = async () => {
    try {
      const { data } = await bitstreamApi.list()
      setBitstreams(data.bitstreams || data || [])
    } catch (err) {
      console.error('Failed to fetch bitstreams:', err)
      setBitstreams([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBitstreams()
  }, [])

  const handleDelete = async (id) => {
    try {
      setDeleting(id)
      await bitstreamApi.delete(id)
      setBitstreams((prev) => prev.filter((b) => b.id !== id))
    } catch (err) {
      console.error('Failed to delete bitstream:', err)
    } finally {
      setDeleting(null)
    }
  }

  const handleBurn = async (bitstream) => {
    if (onBurn) onBurn(bitstream)
  }

  const filtered = bitstreams.filter((b) => {
    const matchesSearch =
      b.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filter === 'all' || b.deviceType?.toLowerCase().includes(filter.toLowerCase())
    return matchesSearch && matchesFilter
  })

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A'
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Bitstream Library</h2>
            <p className="text-sm text-slate-400 mt-1">Manage and deploy your bitstream files</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="pl-10 pr-4 py-2 w-64 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
            >
              <option value="all">All Types</option>
              <option value="bit">BIT</option>
              <option value="bin">BIN</option>
              <option value="svf">SVF</option>
              <option value="jed">JED</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 mt-4">Loading bitstreams...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No Bitstreams Found</h3>
          <p className="text-slate-400 text-sm">Upload a bitstream file to get started</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Size</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Target</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Uploaded</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filtered.map((bitstream) => (
                <tr key={bitstream.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{bitstream.name}</p>
                        {bitstream.description && (
                          <p className="text-xs text-slate-400 truncate max-w-xs">{bitstream.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-slate-600 text-slate-300 uppercase">
                      {bitstream.fileType || bitstream.name?.split('.').pop() || 'unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-300">{formatFileSize(bitstream.fileSize)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-300">{bitstream.targetDevice || 'N/A'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-300">
                      {bitstream.createdAt ? format(new Date(bitstream.createdAt), 'MMM d, yyyy HH:mm') : 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleBurn(bitstream)}
                        disabled={!selectedDevice}
                        title={!selectedDevice ? 'Connect a device first' : 'Burn to device'}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white transition-colors"
                      >
                        Burn
                      </button>
                      <button
                        onClick={() => handleDelete(bitstream.id)}
                        disabled={deleting === bitstream.id}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-rose-500/50 text-rose-400 hover:bg-rose-500/10 disabled:opacity-50 transition-colors"
                      >
                        {deleting === bitstream.id ? '...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
