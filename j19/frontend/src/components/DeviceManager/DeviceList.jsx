import { useState, useEffect } from 'react'
import { useDevice } from '../../context/DeviceContext.jsx'

export default function DeviceList() {
  const {
    usbDevices,
    selectedDevice,
    selectDevice,
    requestUsbDevice,
    listUsbDevices,
    loading,
  } = useDevice()

  const [webUsbSupported, setWebUsbSupported] = useState(false)

  useEffect(() => {
    setWebUsbSupported(typeof navigator !== 'undefined' && 'usb' in navigator)
  }, [])

  const handleRequestDevice = async () => {
    try {
      await requestUsbDevice()
      await listUsbDevices()
    } catch (err) {
      console.error('Failed to request device:', err)
    }
  }

  if (!webUsbSupported) {
    return (
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">WebUSB Not Supported</h3>
          <p className="text-slate-400 text-sm">
            Your browser does not support WebUSB. Please use Chrome, Edge, or Opera.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Available USB Devices</h2>
          <p className="text-sm text-slate-400 mt-1">Select a device to connect and program</p>
        </div>
        <button
          onClick={handleRequestDevice}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add USB Device
        </button>
      </div>

      {usbDevices.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No Devices Found</h3>
          <p className="text-slate-400 text-sm mb-4">Click "Add USB Device" to scan for connected FPGA boards</p>
        </div>
      ) : (
        <div className="space-y-3">
          {usbDevices.map((device, index) => {
            const isSelected = selectedDevice &&
              selectedDevice.vendorId === device.vendorId &&
              selectedDevice.productId === device.productId

            return (
              <div
                key={`${device.vendorId}-${device.productId}-${index}`}
                onClick={() => selectDevice(device)}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-slate-700 hover:border-slate-600 hover:bg-slate-700/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      device.opened ? 'bg-emerald-500/20' : 'bg-slate-700'
                    }`}>
                      <svg className={`w-5 h-5 ${device.opened ? 'text-emerald-500' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium text-white">{device.productName}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{device.manufacturerName}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        <span>VID: 0x{device.vendorId?.toString(16).padStart(4, '0').toUpperCase()}</span>
                        <span>PID: 0x{device.productId?.toString(16).padStart(4, '0').toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      device.opened ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                    }`}>
                      {device.opened ? 'Connected' : 'Available'}
                    </span>
                  </div>
                </div>
                {device.serialNumber && device.serialNumber !== 'N/A' && (
                  <div className="mt-2 pt-2 border-t border-slate-700/50">
                    <p className="text-xs text-slate-500">
                      Serial: <span className="font-mono text-slate-400">{device.serialNumber}</span>
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
