import { useState, useRef } from 'react'
import { bitstreamApi } from '../../services/api.js'

const VALID_EXTENSIONS = ['.bit', '.bin', '.svf', '.jed', '.pof']

export default function BitstreamUploader({ onUploadComplete }) {
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [metadata, setMetadata] = useState({
    name: '',
    description: '',
    targetDevice: '',
  })
  const fileInputRef = useRef(null)

  const validateFile = (f) => {
    const ext = '.' + f.name.split('.').pop().toLowerCase()
    if (!VALID_EXTENSIONS.includes(ext)) {
      return `Invalid file type. Allowed: ${VALID_EXTENSIONS.join(', ')}`
    }
    if (f.size > 500 * 1024 * 1024) {
      return 'File size exceeds 500MB limit'
    }
    return null
  }

  const handleFileSelect = (f) => {
    const validationError = validateFile(f)
    if (validationError) {
      setError(validationError)
      return
    }
    setFile(f)
    setError(null)
    if (!metadata.name) {
      setMetadata((prev) => ({ ...prev, name: f.name.replace(/\.[^/.]+$/, '') }))
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleInputChange = (e) => {
    const files = e.target.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setProgress(0)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('name', metadata.name)
    formData.append('description', metadata.description)
    formData.append('targetDevice', metadata.targetDevice)

    try {
      const { data } = await bitstreamApi.upload(formData, (p) => setProgress(p))
      if (onUploadComplete) onUploadComplete(data)
      setFile(null)
      setProgress(0)
      setMetadata({ name: '', description: '', targetDevice: '' })
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h2 className="text-lg font-semibold text-white mb-6">Upload Bitstream</h2>

      {!file ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-primary-500 bg-primary-500/10'
              : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/30'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".bit,.bin,.svf,.jed,.pof"
            onChange={handleInputChange}
            className="hidden"
          />
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-white font-medium mb-1">Drag & drop your bitstream file here</p>
          <p className="text-sm text-slate-400">or click to browse</p>
          <p className="text-xs text-slate-500 mt-2">Supported: .bit, .bin, .svf, .jed, .pof (max 500MB)</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-700/50">
            <div className="w-12 h-12 rounded-lg bg-primary-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{file.name}</p>
              <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
            </div>
            <button
              onClick={() => { setFile(null); setProgress(0); setError(null) }}
              disabled={uploading}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {uploading && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300">Uploading...</span>
                <span className="text-sm font-medium text-primary-400">{progress}%</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
              <input
                type="text"
                value={metadata.name}
                onChange={(e) => setMetadata({ ...metadata, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                placeholder="My Bitstream"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
              <textarea
                value={metadata.description}
                onChange={(e) => setMetadata({ ...metadata, description: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 resize-none"
                rows={2}
                placeholder="Bitstream description..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Target Device</label>
              <input
                type="text"
                value={metadata.targetDevice}
                onChange={(e) => setMetadata({ ...metadata, targetDevice: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                placeholder="e.g., Xilinx Artix-7"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30">
              <p className="text-sm text-rose-400">{error}</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={() => { setFile(null); setProgress(0); setError(null) }}
              disabled={uploading}
              className="flex-1 px-4 py-2.5 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || !metadata.name}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
