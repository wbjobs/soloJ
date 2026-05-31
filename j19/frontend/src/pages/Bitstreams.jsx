import { useState } from 'react'
import BitstreamUploader from '../components/Bitstream/BitstreamUploader.jsx'
import BitstreamLibrary from '../components/Bitstream/BitstreamLibrary.jsx'
import BurnProgress from '../components/Bitstream/BurnProgress.jsx'
import { bitstreamApi } from '../services/api.js'
import { useDevice } from '../context/DeviceContext.jsx'

export default function Bitstreams() {
  const [activeTab, setActiveTab] = useState('library')
  const [burnId, setBurnId] = useState(null)
  const [burningBitstream, setBurningBitstream] = useState(null)
  const { selectedDevice, connectionStatus } = useDevice()

  const handleBurn = async (bitstream) => {
    if (!selectedDevice) {
      alert('Please connect a device first')
      return
    }
    try {
      const { data } = await bitstreamApi.burn(bitstream.id, selectedDevice.id || selectedDevice.serialNumber)
      setBurnId(data.burnId || data.id || 'burn-' + Date.now())
      setBurningBitstream(bitstream)
      setActiveTab('burning')
    } catch (err) {
      alert('Failed to start burn: ' + (err.response?.data?.message || err.message))
    }
  }

  const handleUploadComplete = () => {
    setActiveTab('library')
  }

  const handleBurnComplete = () => {
    setTimeout(() => {
      setBurnId(null)
      setBurningBitstream(null)
      setActiveTab('library')
    }, 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Bitstreams</h1>
          <p className="text-slate-400 mt-1">Manage and deploy FPGA bitstream files</p>
        </div>
        <div className="flex items-center gap-2 p-1 bg-slate-800 rounded-lg border border-slate-700">
          <button
            onClick={() => setActiveTab('library')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'library' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Library
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'upload' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Upload
          </button>
          {burnId && (
            <button
              onClick={() => setActiveTab('burning')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'burning' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Burning
            </button>
          )}
        </div>
      </div>

      {!selectedDevice && activeTab !== 'upload' && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm text-amber-300">
            No device connected. <a href="/devices" className="text-amber-400 underline hover:text-amber-300">Connect a device</a> to burn bitstreams.
          </p>
        </div>
      )}

      {activeTab === 'library' && (
        <BitstreamLibrary onBurn={handleBurn} />
      )}

      {activeTab === 'upload' && (
        <BitstreamUploader onUploadComplete={handleUploadComplete} />
      )}

      {activeTab === 'burning' && burnId && (
        <BurnProgress
          burnId={burnId}
          bitstreamName={burningBitstream?.name}
          onComplete={handleBurnComplete}
          onCancel={() => { setBurnId(null); setBurningBitstream(null); setActiveTab('library') }}
        />
      )}
    </div>
  )
}
