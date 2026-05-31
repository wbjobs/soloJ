import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { deviceApi } from '../services/api.js'
import { WebUSBService, vendorIds } from '../services/webusbService.js'

const DeviceContext = createContext(null)

export function DeviceProvider({ children }) {
  const [devices, setDevices] = useState([])
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [usbDevices, setUsbDevices] = useState([])

  const webusbServiceRef = useRef(null)
  const claimedInterfaceRef = useRef(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 3

  if (webusbServiceRef.current === null) {
    webusbServiceRef.current = new WebUSBService()
  }

  const fetchDevices = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await deviceApi.list()
      setDevices(data.devices || data)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch devices')
    } finally {
      setLoading(false)
    }
  }, [])

  const listUsbDevices = useCallback(async () => {
    try {
      if (navigator.usb) {
        const devices = await navigator.usb.getDevices()
        setUsbDevices(devices.map((d) => ({
          vendorId: d.vendorId,
          productId: d.productId,
          productName: d.productName || 'Unknown Device',
          manufacturerName: d.manufacturerName || 'Unknown',
          serialNumber: d.serialNumber || 'N/A',
          deviceClass: d.deviceClass,
          opened: d.opened || false,
          raw: d,
        })))
      }
    } catch (err) {
      setError('WebUSB not supported or access denied')
    }
  }, [])

  const requestUsbDevice = useCallback(async (filters = []) => {
    try {
      if (!navigator.usb) throw new Error('WebUSB not supported in this browser')
      const finalFilters = filters.length > 0 ? filters : vendorIds.map((vid) => ({ vendorId: vid }))
      const device = await navigator.usb.requestDevice({
        filters: finalFilters,
      })
      const deviceInfo = {
        vendorId: device.vendorId,
        productId: device.productId,
        productName: device.productName || 'Unknown Device',
        manufacturerName: device.manufacturerName || 'Unknown',
        serialNumber: device.serialNumber || 'N/A',
        deviceClass: device.deviceClass,
        opened: device.opened || false,
        raw: device,
      }
      setUsbDevices((prev) => {
        const exists = prev.find((d) => d.vendorId === device.vendorId && d.productId === device.productId)
        if (exists) return prev.map((d) => (d === exists ? { ...d, ...deviceInfo } : d))
        return [...prev, deviceInfo]
      })
      return deviceInfo
    } catch (err) {
      setError(err.message || 'Failed to request USB device')
      throw err
    }
  }, [])

  const safeReleaseInterface = useCallback(async (device, interfaceNumber) => {
    if (!device || interfaceNumber === null || interfaceNumber === undefined) return
    try {
      if (device.opened) {
        await device.releaseInterface(interfaceNumber)
      }
    } catch (err) {
      console.warn('Interface release failed (may already be released):', err.message)
    }
  }, [])

  const safeCloseDevice = useCallback(async (device, interfaceNumber) => {
    if (!device) return
    try {
      if (interfaceNumber !== null && interfaceNumber !== undefined) {
        await safeReleaseInterface(device, interfaceNumber)
      }
    } catch (_) { /* ignore */ }
    try {
      if (device.opened) {
        await device.close()
      }
    } catch (err) {
      console.warn('Device close failed:', err.message)
    }
  }, [safeReleaseInterface])

  const connectDevice = useCallback(async (device) => {
    setLoading(true)
    setError(null)
    reconnectAttemptsRef.current = 0

    try {
      if (device.raw) {
        const service = webusbServiceRef.current
        const result = await service.connect(device.raw)
        claimedInterfaceRef.current = result.interfaceNumber
        setConnectionStatus('connected')
        setSelectedDevice({
          ...device,
          opened: true,
          interfaceNumber: result.interfaceNumber,
          endpointIn: result.endpointIn,
          endpointOut: result.endpointOut,
        })
      } else {
        const { data } = await deviceApi.connect(device.id || device.serialNumber)
        setConnectionStatus('connected')
        setSelectedDevice(data.device || device)
      }
    } catch (err) {
      setConnectionStatus('error')
      setError(err.response?.data?.message || err.message || 'Failed to connect')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const disconnectDevice = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (selectedDevice?.raw) {
        const service = webusbServiceRef.current
        await service.disconnect()
        claimedInterfaceRef.current = null
      } else if (selectedDevice?.id) {
        await deviceApi.disconnect(selectedDevice.id)
      }
      setConnectionStatus('disconnected')
      setSelectedDevice(null)
    } catch (err) {
      console.warn('Disconnect warning:', err.message)
      try {
        if (selectedDevice?.raw) {
          await safeCloseDevice(selectedDevice.raw, claimedInterfaceRef.current)
        }
      } catch (_) { /* ignore */ }
      setConnectionStatus('disconnected')
      setSelectedDevice(null)
      claimedInterfaceRef.current = null
    } finally {
      setLoading(false)
    }
  }, [selectedDevice, safeCloseDevice])

  const attemptReconnect = useCallback(async () => {
    if (!selectedDevice || reconnectAttemptsRef.current >= maxReconnectAttempts) {
      return false
    }

    reconnectAttemptsRef.current += 1
    setConnectionStatus('reconnecting')
    setError(`正在重连 (尝试 ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`)

    try {
      if (selectedDevice.raw) {
        const service = webusbServiceRef.current
        const result = await service.connect(selectedDevice.raw)
        claimedInterfaceRef.current = result.interfaceNumber
        setConnectionStatus('connected')
        setSelectedDevice((prev) => prev ? {
          ...prev,
          opened: true,
          interfaceNumber: result.interfaceNumber,
          endpointIn: result.endpointIn,
          endpointOut: result.endpointOut,
        } : prev)
        setError(null)
        reconnectAttemptsRef.current = 0
        return true
      }
    } catch (err) {
      console.warn(`Reconnect attempt ${reconnectAttemptsRef.current} failed:`, err.message)
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        setError(`重连失败，请手动断开并重连：${err.message}`)
        setConnectionStatus('error')
      } else {
        setTimeout(() => attemptReconnect(), 1000 * reconnectAttemptsRef.current)
      }
    }
    return false
  }, [selectedDevice])

  const selectDevice = useCallback((device) => {
    setSelectedDevice(device)
    setConnectionStatus(device.opened ? 'connected' : 'disconnected')
  }, [])

  useEffect(() => {
    fetchDevices()
    listUsbDevices()
  }, [fetchDevices, listUsbDevices])

  useEffect(() => {
    if (!navigator.usb) return

    const handleUsbDisconnect = async (e) => {
      if (selectedDevice &&
          selectedDevice.vendorId === e.device.vendorId &&
          selectedDevice.productId === e.device.productId) {
        setConnectionStatus('disconnected')
        setError('设备已断开，正在尝试自动重连...')
        claimedInterfaceRef.current = null

        const reconnected = await attemptReconnect()
        if (!reconnected && reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setSelectedDevice(null)
        }
      }
    }

    const handleUsbConnect = (e) => {
      listUsbDevices()
      if (selectedDevice &&
          selectedDevice.vendorId === e.device.vendorId &&
          selectedDevice.productId === e.device.productId &&
          connectionStatus !== 'connected') {
        attemptReconnect()
      }
    }

    navigator.usb.addEventListener('disconnect', handleUsbDisconnect)
    navigator.usb.addEventListener('connect', handleUsbConnect)

    return () => {
      navigator.usb.removeEventListener('disconnect', handleUsbDisconnect)
      navigator.usb.removeEventListener('connect', handleUsbConnect)
    }
  }, [selectedDevice, connectionStatus, listUsbDevices, attemptReconnect])

  useEffect(() => {
    return () => {
      if (selectedDevice?.raw) {
        safeCloseDevice(selectedDevice.raw, claimedInterfaceRef.current)
          .catch((e) => console.warn('Cleanup on unmount failed:', e))
      }
    }
  }, [])

  const value = {
    devices,
    usbDevices,
    selectedDevice,
    connectionStatus,
    loading,
    error,
    fetchDevices,
    listUsbDevices,
    requestUsbDevice,
    connectDevice,
    disconnectDevice,
    selectDevice,
    attemptReconnect,
    safeReleaseInterface,
    safeCloseDevice,
  }

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>
}

export function useDevice() {
  const ctx = useContext(DeviceContext)
  if (!ctx) throw new Error('useDevice must be used within DeviceProvider')
  return ctx
}

export default DeviceContext
