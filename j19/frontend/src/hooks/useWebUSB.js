/**
 * @fileoverview React hook for WebUSB-based FPGA/JTAG device communication.
 *
 * Provides a high-level, declarative interface for:
 *   - Device enumeration (listDevices, requestDevice)
 *   - Connection management (connect, disconnect)
 *   - Bitstream burning with progress callbacks
 *   - Signal acquisition and time-series data
 *   - Hardware breakpoint management
 *   - JTAG reset and shift operations
 *   - Device status polling
 *
 * The hook maintains its own WebUSBService instance and internal state.
 * It listens for WebUSB connect/disconnect events and automatically
 * refreshes the device list.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { WebUSBService, vendorIds } from '../services/webusbService.js';

// ---------------------------------------------------------------------------
// Types (JSDoc)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} UsbDeviceInfo
 * @property {number} vendorId
 * @property {number} productId
 * @property {string} productName
 * @property {string} manufacturerName
 * @property {string} serialNumber
 * @property {number} deviceClass
 * @property {boolean} opened
 * @property {USBDevice} raw - The raw USBDevice instance.
 */

/**
 * @typedef {Object} TransferProgress
 * @property {number} percent   - 0–100
 * @property {number} blockNum  - Current block (1-indexed)
 * @property {number} totalBlocks
 */

/**
 * @typedef {Object} SignalSample
 * @property {number} time
 * @property {number} value
 */

/**
 * @typedef {Object} SignalData
 * @property {string} name
 * @property {SignalSample[]} data
 */

/**
 * @typedef {Object} DeviceStatus
 * @property {boolean} connected
 * @property {boolean} busy
 * @property {string|null} error
 * @property {number} temperature  - °C
 * @property {number} voltage      - V
 */

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useWebUSB – central hook for all WebUSB operations.
 *
 * @returns {{
 *   devices: UsbDeviceInfo[],
 *   selectedDevice: UsbDeviceInfo|null,
 *   connected: boolean,
 *   loading: boolean,
 *   error: string|null,
 *   transferProgress: TransferProgress|null,
 *   refreshDevices: () => Promise<void>,
 *   selectDevice: (device: UsbDeviceInfo) => void,
 *   connect: () => Promise<void>,
 *   disconnect: () => Promise<void>,
 *   burnBitstream: (data: Uint8Array, onProgress?: (p:number,bn:number,tb:number)=>void) => Promise<{success:boolean, duration:number, blocksSent:number}>,
 *   readSignals: (config: {signalMask:number, sampleRate:number, duration:number}) => Promise<{signals:SignalData[]}>,
 *   setBreakpoint: (config: {signalId:number, condition:object}) => Promise<number>,
 *   clearBreakpoint: (id: number) => Promise<void>,
 *   resetJtag: () => Promise<void>,
 * }}
 */
export function useWebUSB() {
  // -- persistent service instance -----------------------------------------
  const serviceRef = useRef(null);
  if (serviceRef.current === null) {
    serviceRef.current = new WebUSBService();
  }

  // -- state ---------------------------------------------------------------
  const [devices, setDevices] = useState(/** @type {UsbDeviceInfo[]} */ ([]));
  const [selectedDevice, setSelectedDevice] = useState(/** @type {UsbDeviceInfo|null} */ (null));
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(/** @type {string|null} */ (null));
  const [transferProgress, setTransferProgress] = useState(/** @type {TransferProgress|null} */ (null));
  const [reconnecting, setReconnecting] = useState(false);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;

  // -- helpers -------------------------------------------------------------

  /**
   * Convert a raw USBDevice into our info shape.
   * @param {USBDevice} d
   * @returns {UsbDeviceInfo}
   */
  const _toDeviceInfo = useCallback((d) => ({
    vendorId: d.vendorId,
    productId: d.productId,
    productName: d.productName || 'Unknown Device',
    manufacturerName: d.manufacturerName || 'Unknown',
    serialNumber: d.serialNumber || 'N/A',
    deviceClass: d.deviceClass,
    opened: d.opened || false,
    raw: d,
  }), []);

  // -- device enumeration --------------------------------------------------

  /**
   * Enumerate all accessible USB devices and update the device list.
   * @returns {Promise<void>}
   */
  const refreshDevices = useCallback(async () => {
    const service = serviceRef.current;
    if (!service.isSupported()) {
      setError('WebUSB is not supported in this browser');
      setDevices([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const rawDevices = await service.listDevices();
      setDevices(rawDevices.map(_toDeviceInfo));
    } catch (err) {
      setError(err.message || 'Failed to enumerate USB devices');
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, [_toDeviceInfo]);

  /**
   * Prompt the user to select a USB device via the browser picker.
   * @returns {Promise<UsbDeviceInfo>}
   */
  const requestDevice = useCallback(async () => {
    const service = serviceRef.current;
    setError(null);
    try {
      const raw = await service.requestDevice();
      const info = _toDeviceInfo(raw);
      setDevices((prev) => {
        const exists = prev.find((d) => d.vendorId === raw.vendorId && d.productId === raw.productId);
        if (exists) return prev.map((d) => (d === exists ? info : d));
        return [...prev, info];
      });
      return info;
    } catch (err) {
      setError(err.message || 'Device selection cancelled');
      throw err;
    }
  }, [_toDeviceInfo]);

  // -- selection -----------------------------------------------------------

  /**
   * Set the active USB device (without connecting).
   * @param {UsbDeviceInfo} device
   */
  const selectDevice = useCallback((device) => {
    setSelectedDevice(device);
  }, []);

  // -- connect / disconnect ------------------------------------------------

  /**
   * Open a connection to the currently selected device.
   * @returns {Promise<void>}
   */
  const connect = useCallback(async () => {
    if (!selectedDevice) {
      setError('No device selected');
      return;
    }
    const service = serviceRef.current;
    setLoading(true);
    setError(null);
    try {
      await service.connect(selectedDevice.raw);
      setConnected(true);
      // Update the selected device info to reflect opened state
      setSelectedDevice((prev) => prev ? { ...prev, opened: true } : prev);
    } catch (err) {
      setConnected(false);
      setError(err.message || 'Connection failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [selectedDevice]);

  /**
   * Close the connection to the currently active device.
   * @returns {Promise<void>}
   */
  const disconnect = useCallback(async () => {
    const service = serviceRef.current;
    setLoading(true);
    setError(null);
    reconnectAttemptsRef.current = 0;
    try {
      await service.disconnect();
      setConnected(false);
      setReconnecting(false);
      setSelectedDevice((prev) => prev ? { ...prev, opened: false } : prev);
    } catch (err) {
      setError(err.message || 'Disconnect failed');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Attempt to reconnect to the currently selected device after an unexpected disconnect.
   * @returns {Promise<boolean>} True if reconnected successfully.
   */
  const attemptReconnect = useCallback(async () => {
    if (!selectedDevice) return false;
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) return false;

    const service = serviceRef.current;
    reconnectAttemptsRef.current += 1;
    setReconnecting(true);
    setError(`正在重连 (尝试 ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);

    try {
      await service.disconnect();
      await service.connect(selectedDevice.raw);
      setConnected(true);
      setReconnecting(false);
      setError(null);
      reconnectAttemptsRef.current = 0;
      setSelectedDevice((prev) => prev ? { ...prev, opened: true } : prev);
      return true;
    } catch (err) {
      console.warn(`Reconnect attempt ${reconnectAttemptsRef.current} failed:`, err.message);
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        setReconnecting(false);
        setError(`重连失败，请手动断开并重连：${err.message}`);
        setConnected(false);
      } else {
        setTimeout(() => attemptReconnect(), 1000 * reconnectAttemptsRef.current);
      }
      return false;
    }
  }, [selectedDevice]);

  /**
   * Abort the currently running burn operation.
   */
  const abortBurn = useCallback(() => {
    const service = serviceRef.current;
    service.abortBurn();
    setTransferProgress(null);
  }, []);

  // -- bitstream burn ------------------------------------------------------

  /**
   * Burn a bitstream to the connected device.
   *
   * @param {Uint8Array} data - Raw bitstream bytes.
   * @param {(percent:number, blockNum:number, totalBlocks:number)=>void} [onProgress]
   * @returns {Promise<{success:boolean, duration:number, blocksSent:number}>}
   */
  const burnBitstream = useCallback(async (data, onProgress) => {
    const service = serviceRef.current;
    if (!selectedDevice) {
      setError('No device selected');
      return { success: false, duration: 0, blocksSent: 0 };
    }

    setTransferProgress(null);
    setError(null);

    try {
      const result = await service.burnBitstream(selectedDevice.raw, data, (percent, blockNum, totalBlocks) => {
        setTransferProgress({ percent, blockNum, totalBlocks });
        if (onProgress) onProgress(percent, blockNum, totalBlocks);
      });
      return result;
    } catch (err) {
      setError(err.message || 'Bitstream burn failed');
      return { success: false, duration: 0, blocksSent: 0 };
    }
  }, [selectedDevice]);

  // -- signal acquisition --------------------------------------------------

  /**
   * Read signals from the connected device.
   *
   * @param {{signalMask:number, sampleRate:number, duration:number}} config
   * @returns {Promise<{signals: SignalData[]}>}
   */
  const readSignals = useCallback(async (config) => {
    const service = serviceRef.current;
    if (!selectedDevice) {
      setError('No device selected');
      return { signals: [] };
    }

    setError(null);
    try {
      const { signalMask, sampleRate, duration } = config;
      return await service.readSignals(selectedDevice.raw, signalMask, sampleRate, duration);
    } catch (err) {
      setError(err.message || 'Signal read failed');
      return { signals: [] };
    }
  }, [selectedDevice]);

  // -- breakpoint management -----------------------------------------------

  /**
   * Set a hardware breakpoint.
   *
   * @param {{signalId:number, condition:object}} config
   * @returns {Promise<number>} Breakpoint ID.
   */
  const setBreakpoint = useCallback(async (config) => {
    const service = serviceRef.current;
    if (!selectedDevice) {
      setError('No device selected');
      return -1;
    }

    setError(null);
    try {
      return await service.setBreakpoint(selectedDevice.raw, config.signalId, config.condition);
    } catch (err) {
      setError(err.message || 'Failed to set breakpoint');
      return -1;
    }
  }, [selectedDevice]);

  /**
   * Clear a hardware breakpoint.
   *
   * @param {number} id - Breakpoint ID from setBreakpoint.
   * @returns {Promise<void>}
   */
  const clearBreakpoint = useCallback(async (id) => {
    const service = serviceRef.current;
    if (!selectedDevice) {
      setError('No device selected');
      return;
    }

    setError(null);
    try {
      await service.clearBreakpoint(selectedDevice.raw, id);
    } catch (err) {
      setError(err.message || 'Failed to clear breakpoint');
    }
  }, [selectedDevice]);

  // -- JTAG operations -----------------------------------------------------

  /**
   * Reset the JTAG TAP state machine.
   * @returns {Promise<void>}
   */
  const resetJtag = useCallback(async () => {
    const service = serviceRef.current;
    if (!selectedDevice) {
      setError('No device selected');
      return;
    }

    setError(null);
    try {
      await service.resetJtag(selectedDevice.raw);
    } catch (err) {
      setError(err.message || 'JTAG reset failed');
    }
  }, [selectedDevice]);

  // -- event listeners: connect / disconnect -------------------------------

  useEffect(() => {
    const service = serviceRef.current;

    /** @param {USBConnectionEvent} e */
    const onConnect = (e) => {
      const info = {
        vendorId: e.device.vendorId,
        productId: e.device.productId,
        productName: e.device.productName || 'Unknown Device',
        manufacturerName: e.device.manufacturerName || 'Unknown',
        serialNumber: e.device.serialNumber || 'N/A',
        deviceClass: e.device.deviceClass,
        opened: e.device.opened || false,
        raw: e.device,
      };
      setDevices((prev) => {
        const exists = prev.find((d) =>
          d.vendorId === info.vendorId && d.productId === info.productId,
        );
        if (exists) return prev.map((d) => (d === exists ? info : d));
        return [...prev, info];
      });

      // Auto-attempt reconnect if this is our selected device
      if (selectedDevice &&
          selectedDevice.vendorId === info.vendorId &&
          selectedDevice.productId === info.productId &&
          !connected) {
        attemptReconnect();
      }
    };

    /** @param {USBConnectionEvent} e */
    const onDisconnect = (e) => {
      setDevices((prev) => prev.filter((d) =>
        !(d.vendorId === e.device.vendorId && d.productId === e.device.productId),
      ));
      // If the disconnected device was selected, trigger reconnect
      if (selectedDevice &&
          selectedDevice.vendorId === e.device.vendorId &&
          selectedDevice.productId === e.device.productId) {
        setConnected(false);
        setReconnecting(true);
        setError('设备已断开，正在尝试自动重连...');
        // Reset service state to ensure clean reconnection
        service.safeReset().catch(() => {});
        attemptReconnect();
      }
    };

    if (service.isSupported()) {
      navigator.usb.addEventListener('connect', onConnect);
      navigator.usb.addEventListener('disconnect', onDisconnect);
    }

    // Initial enumeration
    if (service.isSupported()) {
      refreshDevices();
    }

    return () => {
      if (service.isSupported()) {
        navigator.usb.removeEventListener('connect', onConnect);
        navigator.usb.removeEventListener('disconnect', onDisconnect);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDevice, connected, attemptReconnect]);

  // -- return --------------------------------------------------------------

  return {
    devices,
    selectedDevice,
    connected,
    reconnecting,
    loading,
    error,
    transferProgress,
    refreshDevices,
    selectDevice,
    connect,
    disconnect,
    attemptReconnect,
    burnBitstream,
    readSignals,
    setBreakpoint,
    clearBreakpoint,
    resetJtag,
    abortBurn,
    // Expose requestDevice for use in UI that needs the browser picker
    requestDevice,
  };
}

export default useWebUSB;