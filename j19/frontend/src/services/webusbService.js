/**
 * @fileoverview WebUSB service for FPGA/JTAG device communication.
 *
 * Provides a high-level API over the WebUSB browser API, including device
 * enumeration, connection management, bitstream burning, signal acquisition,
 * breakpoint control, and JTAG register shifting.
 */

import {
  USB_COMMAND,
  USB_COMMAND_NAME,
  MAGIC,
  HEADER_SIZE,
  CHUNK_SIZE,
  encodeCommand,
  decodeCommand,
  JTAG_TAP_STATES,
  jtagStateTransition,
  generateJtagSequence,
} from '../utils/webusbProtocol.js';

// ---------------------------------------------------------------------------
// Vendor IDs
// ---------------------------------------------------------------------------

/**
 * Known FPGA vendor USB product/vendor IDs.
 * @type {number[]}
 */
export const vendorIds = Object.freeze([0x0403, 0x09FB, 0x1204, 0x20A0]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a Uint8Array of length `len` filled with 0x00.
 * @param {number} len
 * @returns {Uint8Array}
 */
function emptyBytes(len) {
  return new Uint8Array(len);
}

/**
 * Pack a 32-bit unsigned integer in little-endian into a Uint8Array.
 * @param {number} value
 * @param {Uint8Array} buf
 * @param {number} offset
 */
function writeUint32LE(value, buf, offset) {
  buf[offset]     = value & 0xFF;
  buf[offset + 1] = (value >> 8) & 0xFF;
  buf[offset + 2] = (value >> 16) & 0xFF;
  buf[offset + 3] = (value >>> 24) & 0xFF;
}

/**
 * Read a 32-bit unsigned integer in little-endian from a Uint8Array.
 * @param {Uint8Array} buf
 * @param {number} offset
 * @returns {number}
 */
function readUint32LE(buf, offset) {
  return (
    (buf[offset]) |
    (buf[offset + 1] << 8) |
    (buf[offset + 2] << 16) |
    (buf[offset + 3] << 24)
  ) >>> 0;
}

// ---------------------------------------------------------------------------
// WebUSBService
// ---------------------------------------------------------------------------

/**
 * Service class that wraps WebUSB for FPGA/JTAG debug adapters.
 *
 * All long-running operations (burn, readSignals, etc.) return Promises
 * that resolve on completion and reject on error.
 */
export class WebUSBService {
  constructor() {
    /** @private */
    this._device = null;
    /** @private */
    this._configuration = null;
    /** @private */
    this._interfaceNumber = null;
    /** @private */
    this._endpointIn = null;
    /** @private */
    this._endpointOut = null;
    /** @private */
    this._seq = 0;
    /** @private */
    this._connected = false;
    /** @private */
    this._burnInProgress = false;
    /** @private */
    this._burnAbortController = null;
  }

  // -----------------------------------------------------------------------
  // Support / capability checks
  // -----------------------------------------------------------------------

  /**
   * Check whether the WebUSB API is available in the current browser.
   * @returns {boolean}
   */
  isSupported() {
    return typeof navigator !== 'undefined' && !!navigator.usb;
  }

  // -----------------------------------------------------------------------
  // Device enumeration
  // -----------------------------------------------------------------------

  /**
   * Ask the user to pick a USB device via the browser picker.
   *
   * @param {Array<{ vendorId?: number, productId?: number, classCode?: number, subclassCode?: number, protocolCode?: number, serialNumber?: string }>} [filters]
   *   USB device filters.  Defaults to filters for known FPGA vendors.
   * @returns {Promise<USBDevice>} The selected USBDevice.
   * @throws {Error} If WebUSB is not supported or the user cancels.
   */
  async requestDevice(filters) {
    if (!this.isSupported()) {
      throw new Error('WebUSB is not supported in this browser');
    }

    const finalFilters = filters || vendorIds.map((vid) => ({ vendorId: vid }));

    try {
      const device = await navigator.usb.requestDevice({ filters: finalFilters });
      return device;
    } catch (err) {
      throw new Error(`Device request failed: ${err.message || err}`);
    }
  }

  /**
   * List all USB devices that the origin has previously been granted
   * access to (no user gesture required).
   *
   * @returns {Promise<USBDevice[]>}
   */
  async listDevices() {
    if (!this.isSupported()) {
      throw new Error('WebUSB is not supported in this browser');
    }

    try {
      const devices = await navigator.usb.getDevices();
      return devices;
    } catch (err) {
      throw new Error(`Listing devices failed: ${err.message || err}`);
    }
  }

  // -----------------------------------------------------------------------
  // Connection management
  // -----------------------------------------------------------------------

  /**
   * Open a session with the given USB device: open, select configuration,
   * claim the first available interface, and discover bulk endpoints.
   *
   * @param {USBDevice} device
   * @returns {Promise<{ interfaceNumber: number, endpointIn: number, endpointOut: number }>}
   *   The claimed interface and discovered endpoints.
   * @throws {Error} On any failure during the open/claim process.
   */
  async connect(device) {
    if (!device) {
      throw new Error('No device provided');
    }

    try {
      await device.open();
    } catch (err) {
      throw new Error(`Failed to open device: ${err.message || err}`);
    }

    try {
      // Prefer configuration 1 if available
      if (device.configuration === null) {
        const configValue = device.configurations?.[0]?.configurationValue ?? 1;
        await device.selectConfiguration(configValue);
      }

      // Find first interface with bulk endpoints
      const configuration = device.configuration || device.configurations?.[0];
      if (!configuration) {
        throw new Error('Device has no USB configuration');
      }

      let iface = null;
      let epIn = null;
      let epOut = null;

      for (const i of configuration.interfaces) {
        for (const alt of i.alternates) {
          const bulkIn = alt.endpoints?.find(
            (e) => e.type === 'bulk' && e.direction === 'in',
          );
          const bulkOut = alt.endpoints?.find(
            (e) => e.type === 'bulk' && e.direction === 'out',
          );
          if (bulkIn && bulkOut) {
            iface = i;
            epIn = bulkIn;
            epOut = bulkOut;
            break;
          }
        }
        if (iface) break;
      }

      if (!iface || !epIn || !epOut) {
        throw new Error('No bulk IN/OUT endpoints found on device');
      }

      await device.claimInterface(iface.interfaceNumber);

      this._device = device;
      this._configuration = configuration;
      this._interfaceNumber = iface.interfaceNumber;
      this._endpointIn = epIn;
      this._endpointOut = epOut;
      this._connected = true;
      this._seq = 0;

      return {
        interfaceNumber: iface.interfaceNumber,
        endpointIn: epIn.endpointNumber,
        endpointOut: epOut.endpointNumber,
      };
    } catch (err) {
      // Clean up on failure
      try { await this.disconnect(); } catch (_) { /* ignore */ }
      throw new Error(`Connection failed: ${err.message || err}`);
    }
  }

  /**
   * Close the currently connected device and release all resources.
   * This method is idempotent and safe to call even if already disconnected.
   * @returns {Promise<void>}
   */
  async disconnect() {
    const device = this._device;
    const ifaceNum = this._interfaceNumber;

    this._burnInProgress = false;
    this._burnAbortController = null;

    if (!device) {
      this._connected = false;
      return;
    }

    try {
      if (ifaceNum !== null && device.opened) {
        try {
          await device.releaseInterface(ifaceNum);
        } catch (err) {
          console.warn('Interface release failed (may already be released):', err.message);
        }
      }
    } catch (_) { /* ignore */ }

    try {
      if (device.opened) {
        await device.close();
      }
    } catch (err) {
      console.warn('Device close failed:', err.message);
    }

    this._device = null;
    this._configuration = null;
    this._interfaceNumber = null;
    this._endpointIn = null;
    this._endpointOut = null;
    this._connected = false;
    this._seq = 0;
  }

  /**
   * Perform a safe reset of the USB connection state.
   * Use this when a transfer error occurs to ensure clean state for reconnection.
   * @returns {Promise<void>}
   */
  async safeReset() {
    try {
      await this.disconnect();
    } catch (_) { /* ignore */ }
    this._device = null;
    this._configuration = null;
    this._interfaceNumber = null;
    this._endpointIn = null;
    this._endpointOut = null;
    this._connected = false;
    this._seq = 0;
    this._burnInProgress = false;
    this._burnAbortController = null;
  }

  /**
   * Check if a burn operation is currently in progress.
   * @returns {boolean}
   */
  isBurnInProgress() {
    return this._burnInProgress;
  }

  /**
   * Abort the currently running burn operation.
   */
  abortBurn() {
    if (this._burnAbortController) {
      this._burnAbortController.abort();
    }
    this._burnInProgress = false;
  }

  // -----------------------------------------------------------------------
  // Low-level send / receive
  // -----------------------------------------------------------------------

  /**
   * Send raw data to the bulk OUT endpoint.
   *
   * @param {number} endpoint - Endpoint number for bulk OUT.
   * @param {ArrayBuffer|Uint8Array} data
   * @returns {Promise<number>} Number of bytes written.
   */
  async sendData(endpoint, data) {
    if (!this._device || !this._connected) {
      throw new Error('Device not connected');
    }

    const buffer = data instanceof Uint8Array ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data;
    const result = await this._device.transferOut(endpoint, buffer);
    return result.bytesWritten;
  }

  /**
   * Receive raw data from the bulk IN endpoint.
   *
   * @param {number} endpoint - Endpoint number for bulk IN.
   * @param {number} length   - Maximum number of bytes to read.
   * @returns {Promise<Uint8Array>} Received data.
   */
  async receiveData(endpoint, length) {
    if (!this._device || !this._connected) {
      throw new Error('Device not connected');
    }

    const result = await this._device.transferIn(endpoint, length);
    const view = new DataView(result.data.buffer, result.data.byteOffset, result.data.byteLength);
    const arr = new Uint8Array(result.data.byteLength);
    for (let i = 0; i < arr.length; i++) {
      arr[i] = view.getUint8(i);
    }
    return arr;
  }

  // -----------------------------------------------------------------------
  // Protocol helpers
  // -----------------------------------------------------------------------

  /**
   * Send a command packet and wait for a matching response.
   *
   * @param {number} cmd      - USB_COMMAND code.
   * @param {Uint8Array|null} [payload=null]
   * @param {number}          [responseLen=64] - Expected response buffer size.
   * @returns {Promise<{cmd:number, seq:number, length:number, payload:Uint8Array, valid:boolean}>}
   * @private
   */
  async _sendAndReceive(cmd, payload = null, responseLen = 64) {
    if (!this._device || !this._connected) {
      throw new Error('Device not connected');
    }

    const seq = this._seq++;
    const packet = encodeCommand(cmd, seq, payload);

    await this.sendData(this._endpointOut.endpointNumber, packet);

    const raw = await this.receiveData(this._endpointIn.endpointNumber, responseLen);
    const decoded = decodeCommand(raw);

    // Validate response checksum
    if (!decoded.valid) {
      throw new Error(`Invalid response (checksum mismatch): ${decoded.error || 'unknown'}`);
    }

    return decoded;
  }

  // -----------------------------------------------------------------------
  // Bitstream burning
  // -----------------------------------------------------------------------

  /**
   * Burn a bitstream (FPGA configuration bitfile) to the device.
   *
   * The data is split into 4 KB chunks and sent sequentially.
   *
   * @param {USBDevice} device      - Target device (must be connected via `connect` first).
   * @param {Uint8Array} bitstreamData - Raw bitstream bytes.
   * @param {(percent:number, blockNum:number, totalBlocks:number)=>void} [onProgress]
   *   Optional progress callback (0–100).
   * @returns {Promise<{success:boolean, duration:number, blocksSent:number, error?:string}>}
   */
  async burnBitstream(device, bitstreamData, onProgress) {
    if (!this._connected || !this._device) {
      throw new Error('Device not connected');
    }
    if (!bitstreamData || bitstreamData.length === 0) {
      throw new Error('Empty bitstream data');
    }
    if (this._burnInProgress) {
      throw new Error('Burn operation already in progress');
    }

    this._burnInProgress = true;
    this._burnAbortController = new AbortController();
    const signal = this._burnAbortController.signal;

    const startTime = performance.now();
    const totalChunks = Math.ceil(bitstreamData.length / CHUNK_SIZE);
    let blocksSent = 0;

    try {
      // -- BURN_START ----------------------------------------------------
      const startPayload = new Uint8Array(4);
      writeUint32LE(bitstreamData.length, startPayload, 0);
      const startResp = await this._sendAndReceive(USB_COMMAND.BURN_START, startPayload);
      if (startResp.payload[0] !== 0x00) {
        throw new Error(`BURN_START rejected: status=0x${startResp.payload[0]?.toString(16) || '??'}`);
      }

      // -- BURN_BLOCK (loop) ---------------------------------------------
      for (let i = 0; i < totalChunks; i++) {
        if (signal.aborted) {
          throw new Error('Burn operation aborted by user');
        }

        const offset = i * CHUNK_SIZE;
        const chunk = bitstreamData.slice(offset, Math.min(offset + CHUNK_SIZE, bitstreamData.length));

        const blockPayload = new Uint8Array(4 + chunk.length);
        writeUint32LE(i, blockPayload, 0);
        blockPayload.set(chunk, 4);

        let retryCount = 0;
        const maxRetries = 3;
        let success = false;

        while (!success && retryCount < maxRetries) {
          try {
            const resp = await this._sendAndReceive(USB_COMMAND.BURN_BLOCK, blockPayload);
            if (resp.payload[0] !== 0x00) {
              throw new Error(`BURN_BLOCK ${i} rejected: status=0x${resp.payload[0]?.toString(16) || '??'}`);
            }
            success = true;
          } catch (err) {
            retryCount++;
            if (retryCount >= maxRetries) {
              throw err;
            }
            console.warn(`BURN_BLOCK ${i} retry ${retryCount}/${maxRetries}: ${err.message}`);
            await new Promise((r) => setTimeout(r, 100 * retryCount));
          }
        }

        blocksSent = i + 1;

        if (onProgress) {
          const percent = Math.round(((i + 1) / totalChunks) * 100);
          onProgress(percent, i + 1, totalChunks);
        }
      }

      // -- BURN_END ------------------------------------------------------
      const endResp = await this._sendAndReceive(USB_COMMAND.BURN_END);
      if (endResp.payload[0] !== 0x00) {
        throw new Error(`BURN_END rejected: status=0x${endResp.payload[0]?.toString(16) || '??'}`);
      }

      const duration = performance.now() - startTime;
      this._burnInProgress = false;
      this._burnAbortController = null;
      return { success: true, duration, blocksSent };
    } catch (err) {
      const duration = performance.now() - startTime;
      this._burnInProgress = false;
      this._burnAbortController = null;

      // -- SAFE RECOVERY: Try to send BURN_END to reset device state --
      try {
        await this._sendAndReceive(USB_COMMAND.BURN_END).catch(() => {});
      } catch (_) { /* ignore */ }

      // If it's a disconnect error, reset state fully
      if (err.message && err.message.toLowerCase().includes('disconnect')) {
        console.warn('Device disconnected during burn, resetting connection state');
        await this.safeReset();
      }

      return { success: false, duration, blocksSent, error: err.message || String(err) };
    }
  }

  // -----------------------------------------------------------------------
  // Signal acquisition
  // -----------------------------------------------------------------------

  /**
   * Read signal samples from the device.
   *
   * @param {USBDevice} device
   * @param {number} signalMask  - Bitmask of signals to capture.
   * @param {number} sampleRate  - Samples per second (Hz).
   * @param {number} duration    - Capture duration in milliseconds.
   * @returns {Promise<{signals: Array<{name:string, data:Array<{time:number,value:number}>}>}>}
   */
  async readSignals(device, signalMask, sampleRate, duration) {
    if (!this._connected) {
      throw new Error('Device not connected');
    }

    const params = new Uint8Array(12);
    writeUint32LE(signalMask, params, 0);
    writeUint32LE(sampleRate, params, 4);
    writeUint32LE(duration, params, 8);

    const resp = await this._sendAndReceive(USB_COMMAND.READ_SIGNALS, params, 2048);

    // Parse response: each signal is a section of interleaved time/value pairs
    const signals = [];
    const payload = resp.payload;

    if (payload.length < 4) {
      return { signals: [] };
    }

    const numSignals = payload[0];
    let offset = 1;

    for (let s = 0; s < numSignals; s++) {
      if (offset + 3 > payload.length) break;
      const nameLen = payload[offset];
      offset += 1;
      const nameBytes = payload.slice(offset, offset + nameLen);
      offset += nameLen;
      const name = new TextDecoder().decode(nameBytes);

      const sampleCount = readUint32LE(payload, offset);
      offset += 4;

      const data = [];
      for (let i = 0; i < sampleCount; i++) {
        if (offset + 8 > payload.length) break;
        const time = readUint32LE(payload, offset);
        offset += 4;
        const value = readUint32LE(payload, offset);
        offset += 4;
        data.push({ time, value });
      }

      signals.push({ name, data });
    }

    return { signals };
  }

  // -----------------------------------------------------------------------
  // Breakpoint management
  // -----------------------------------------------------------------------

  /**
   * Set a hardware breakpoint on the device.
   *
   * @param {USBDevice} device
   * @param {number} signalId    - ID of the signal to trigger on.
   * @param {{ value?: number, mask?: number, type?: number }} condition
   *   Breakpoint condition: trigger value, optional mask, and condition type.
   * @returns {Promise<number>} Breakpoint ID assigned by the device.
   */
  async setBreakpoint(device, signalId, condition) {
    if (!this._connected) {
      throw new Error('Device not connected');
    }

    const payload = new Uint8Array(16);
    writeUint32LE(signalId, payload, 0);
    writeUint32LE(condition.value ?? 0, payload, 4);
    writeUint32LE(condition.mask ?? 0xFFFFFFFF, payload, 8);
    writeUint32LE(condition.type ?? 0, payload, 12);

    const resp = await this._sendAndReceive(USB_COMMAND.SET_BREAKPOINT, payload);
    if (resp.payload.length < 1) {
      throw new Error('Invalid SET_BREAKPOINT response');
    }
    return resp.payload[0];
  }

  /**
   * Clear a previously set breakpoint.
   *
   * @param {USBDevice} device
   * @param {number} breakpointId - ID returned by `setBreakpoint`.
   * @returns {Promise<void>}
   */
  async clearBreakpoint(device, breakpointId) {
    if (!this._connected) {
      throw new Error('Device not connected');
    }

    const payload = new Uint8Array(4);
    writeUint32LE(breakpointId, payload, 0);

    const resp = await this._sendAndReceive(USB_COMMAND.CLEAR_BREAKPOINT, payload);
    if (resp.payload.length > 0 && resp.payload[0] !== 0x00) {
      throw new Error(`CLEAR_BREAKPOINT failed: status=0x${resp.payload[0].toString(16)}`);
    }
  }

  // -----------------------------------------------------------------------
  // JTAG operations
  // -----------------------------------------------------------------------

  /**
   * Reset the JTAG TAP state machine to TEST_LOGIC_RESET.
   *
   * @param {USBDevice} device
   * @returns {Promise<void>}
   */
  async resetJtag(device) {
    if (!this._connected) {
      throw new Error('Device not connected');
    }

    const resp = await this._sendAndReceive(USB_COMMAND.JTAG_RESET);
    if (resp.payload.length > 0 && resp.payload[0] !== 0x00) {
      throw new Error(`JTAG_RESET failed: status=0x${resp.payload[0].toString(16)}`);
    }
  }

  /**
   * Shift data through the JTAG chain.
   *
   * @param {USBDevice} device
   * @param {number[]} tmsValues  - Array of TMS bits (0/1).
   * @param {number[]} tdiValues  - Array of TDI bits (0/1).
   * @returns {Promise<number[]>} TDO bits captured from the device.
   */
  async shiftJtag(device, tmsValues, tdiValues) {
    if (!this._connected) {
      throw new Error('Device not connected');
    }

    const bitCount = Math.min(tmsValues.length, tdiValues.length);
    if (bitCount === 0) {
      return [];
    }

    // Pack bits into bytes (LSB first)
    const byteCount = Math.ceil(bitCount / 8);
    const tmsBytes = new Uint8Array(byteCount);
    const tdiBytes = new Uint8Array(byteCount);

    for (let i = 0; i < bitCount; i++) {
      const byteIdx = Math.floor(i / 8);
      const bitIdx = i % 8;
      if (tmsValues[i]) tmsBytes[byteIdx] |= (1 << bitIdx);
      if (tdiValues[i]) tdiBytes[byteIdx] |= (1 << bitIdx);
    }

    const payload = new Uint8Array(4 + byteCount * 2);
    writeUint32LE(bitCount, payload, 0);
    payload.set(tmsBytes, 4);
    payload.set(tdiBytes, 4 + byteCount);

    const resp = await this._sendAndReceive(USB_COMMAND.JTAG_SHIFT, payload, byteCount * 8 + 16);

    // Unpack TDO bits
    const tdoValues = [];
    const tdoByteCount = resp.payload.length > 0 ? resp.payload[0] : 0;
    for (let i = 1; i < Math.min(1 + tdoByteCount, resp.payload.length); i++) {
      const b = resp.payload[i];
      for (let bit = 0; bit < 8; bit++) {
        if (tdoValues.length < bitCount) {
          tdoValues.push((b >> bit) & 1);
        }
      }
    }

    return tdoValues;
  }

  // -----------------------------------------------------------------------
  // Status
  // -----------------------------------------------------------------------

  /**
   * Query device status.
   *
   * @param {USBDevice} device
   * @returns {Promise<{connected:boolean, busy:boolean, error:string|null, temperature:number, voltage:number}>}
   */
  async getStatus(device) {
    if (!this._connected) {
      return { connected: false, busy: false, error: 'Not connected', temperature: 0, voltage: 0 };
    }

    try {
      const resp = await this._sendAndReceive(USB_COMMAND.GET_STATUS);

      if (resp.payload.length < 12) {
        return { connected: true, busy: false, error: 'Short status response', temperature: 0, voltage: 0 };
      }

      const flags = resp.payload[0];
      const connected = (flags & 0x01) !== 0;
      const busy = (flags & 0x02) !== 0;
      const temperature = readUint32LE(resp.payload, 4) / 1000; // °C * 1000
      const voltage = readUint32LE(resp.payload, 8) / 1000;    // V * 1000

      let error = null;
      if (resp.payload.length > 12) {
        const errBytes = resp.payload.slice(12);
        if (errBytes.length > 0 && errBytes[0] !== 0) {
          error = new TextDecoder().decode(errBytes.filter((b) => b !== 0));
        }
      }

      return { connected, busy, error, temperature, voltage };
    } catch (err) {
      return { connected: true, busy: false, error: err.message || String(err), temperature: 0, voltage: 0 };
    }
  }
}

// Re-export protocol utilities for convenience
export {
  USB_COMMAND,
  USB_COMMAND_NAME,
  MAGIC,
  HEADER_SIZE,
  CHUNK_SIZE,
  encodeCommand,
  decodeCommand,
  JTAG_TAP_STATES,
  jtagStateTransition,
  generateJtagSequence,
};