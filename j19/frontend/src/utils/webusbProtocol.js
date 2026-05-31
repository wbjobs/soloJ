/**
 * @fileoverview WebUSB communication protocol implementation.
 * Provides packet encoding/decoding, checksums, and JTAG state machine logic.
 *
 * Packet format:
 *   [MAGIC(2)][CMD(1)][SEQ(2)][LEN(2)][CHECKSUM(1)][PAYLOAD(N)]
 *
 * MAGIC = 0xAA55 (little-endian in stream)
 */

// ---------------------------------------------------------------------------
// Command codes
// ---------------------------------------------------------------------------

/** @enum {number} USB_COMMAND */
export const USB_COMMAND = Object.freeze({
  CONNECT:          0x01,
  DISCONNECT:       0x02,
  BURN_START:       0x03,
  BURN_BLOCK:       0x04,
  BURN_END:         0x05,
  READ_SIGNALS:     0x06,
  SET_BREAKPOINT:   0x07,
  CLEAR_BREAKPOINT: 0x08,
  JTAG_RESET:       0x09,
  JTAG_SHIFT:       0x0A,
  GET_STATUS:       0x0B,
});

/** Reverse-lookup from code to name for logging. */
export const USB_COMMAND_NAME = Object.fromEntries(
  Object.entries(USB_COMMAND).map(([k, v]) => [v, k]),
);

// ---------------------------------------------------------------------------
// Packet constants
// ---------------------------------------------------------------------------

export const MAGIC = 0xAA55;
export const HEADER_SIZE = 8; // MAGIC(2) + CMD(1) + SEQ(2) + LEN(2) + CHECKSUM(1)
export const CHUNK_SIZE = 4096;

// ---------------------------------------------------------------------------
// Checksum
// ---------------------------------------------------------------------------

/**
 * Calculate a simple XOR checksum over a byte array.
 * @param {Uint8Array} data - Bytes to checksum.
 * @returns {number} Single-byte checksum (0x00–0xFF).
 */
export function calculateChecksum(data) {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum ^= data[i];
  }
  return sum & 0xFF;
}

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

/**
 * Encode a command into a full protocol packet.
 *
 * @param {number} cmd      - USB_COMMAND code.
 * @param {number} seq      - 16-bit sequence number.
 * @param {Uint8Array|null} [payload=null] - Optional payload bytes.
 * @returns {Uint8Array} Complete packet including header and checksum.
 */
export function encodeCommand(cmd, seq, payload = null) {
  const payloadLen = payload ? payload.length : 0;
  const totalLen = HEADER_SIZE + payloadLen;
  const packet = new Uint8Array(totalLen);

  // MAGIC (little-endian)
  packet[0] = MAGIC & 0xFF;
  packet[1] = (MAGIC >> 8) & 0xFF;

  // CMD
  packet[2] = cmd & 0xFF;

  // SEQ (little-endian)
  packet[3] = seq & 0xFF;
  packet[4] = (seq >> 8) & 0xFF;

  // LEN (little-endian) – length of payload only
  packet[5] = payloadLen & 0xFF;
  packet[6] = (payloadLen >> 8) & 0xFF;

  // CHECKSUM – placeholder for now
  packet[7] = 0x00;

  // PAYLOAD
  if (payload && payloadLen > 0) {
    packet.set(payload, HEADER_SIZE);
  }

  // Calculate checksum over the entire packet (excluding checksum byte itself)
  const forChecksum = new Uint8Array(totalLen - 1);
  forChecksum.set(packet.slice(0, 7));
  if (payloadLen > 0) {
    forChecksum.set(packet.slice(8, 8 + payloadLen), 7);
  }
  packet[7] = calculateChecksum(forChecksum);

  return packet;
}

// ---------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------

/**
 * Decode a protocol packet from raw bytes.
 *
 * @param {Uint8Array} data - Raw bytes received from the device.
 * @returns {{
 *   cmd: number,
 *   seq: number,
 *   length: number,
 *   payload: Uint8Array,
 *   valid: boolean,
 *   error?: string,
 * }} Decoded packet.  `valid` is false if the header/checksum is corrupt.
 */
export function decodeCommand(data) {
  // Minimum: header only
  if (data.length < HEADER_SIZE) {
    return { cmd: 0, seq: 0, length: 0, payload: new Uint8Array(0), valid: false, error: 'Packet too short' };
  }

  const magic = (data[0] | (data[1] << 8)) & 0xFFFF;
  if (magic !== MAGIC) {
    return { cmd: 0, seq: 0, length: 0, payload: new Uint8Array(0), valid: false, error: 'Invalid magic bytes' };
  }

  const cmd = data[2];
  const seq = (data[3] | (data[4] << 8)) & 0xFFFF;
  const length = (data[5] | (data[6] << 8)) & 0xFFFF;
  const checksumByte = data[7];

  const totalExpected = HEADER_SIZE + length;
  if (data.length < totalExpected) {
    return { cmd, seq, length, payload: new Uint8Array(0), valid: false, error: 'Truncated payload' };
  }

  // Verify checksum
  const forChecksum = new Uint8Array(HEADER_SIZE - 1 + length);
  forChecksum.set(data.slice(0, 7), 0);
  if (length > 0) {
    forChecksum.set(data.slice(HEADER_SIZE, HEADER_SIZE + length), 7);
  }
  const computedChecksum = calculateChecksum(forChecksum);
  const valid = checksumByte === computedChecksum;

  const payload = data.slice(HEADER_SIZE, HEADER_SIZE + length);

  return { cmd, seq, length, payload, valid };
}

// ---------------------------------------------------------------------------
// JTAG TAP state machine
// ---------------------------------------------------------------------------

/** @enum {string} JTAG_TAP_STATES */
export const JTAG_TAP_STATES = Object.freeze({
  TEST_LOGIC_RESET: 'TEST_LOGIC_RESET',
  RUN_TEST_IDLE:    'RUN_TEST_IDLE',
  SELECT_DR:        'SELECT_DR',
  CAPTURE_DR:       'CAPTURE_DR',
  SHIFT_DR:         'SHIFT_DR',
  EXIT1_DR:         'EXIT1_DR',
  PAUSE_DR:         'PAUSE_DR',
  EXIT2_DR:         'EXIT2_DR',
  UPDATE_DR:        'UPDATE_DR',
  SELECT_IR:        'SELECT_IR',
  CAPTURE_IR:       'CAPTURE_IR',
  SHIFT_IR:         'SHIFT_IR',
  EXIT1_IR:         'EXIT1_IR',
  PAUSE_IR:         'PAUSE_IR',
  EXIT2_IR:         'EXIT2_IR',
  UPDATE_IR:        'UPDATE_IR',
});

/**
 * JTAG TAP state transition table.
 * Maps (currentState, tmsValue) -> nextState.
 * tmsValue is 0 or 1.
 * @type {Record<string, Record<0|1, string>>}
 */
const JTAG_STATE_TRANSITIONS = {
  [JTAG_TAP_STATES.TEST_LOGIC_RESET]: { 0: JTAG_TAP_STATES.RUN_TEST_IDLE,   1: JTAG_TAP_STATES.TEST_LOGIC_RESET },
  [JTAG_TAP_STATES.RUN_TEST_IDLE]:    { 0: JTAG_TAP_STATES.RUN_TEST_IDLE,   1: JTAG_TAP_STATES.SELECT_DR },
  [JTAG_TAP_STATES.SELECT_DR]:        { 0: JTAG_TAP_STATES.CAPTURE_DR,      1: JTAG_TAP_STATES.SELECT_IR },
  [JTAG_TAP_STATES.CAPTURE_DR]:       { 0: JTAG_TAP_STATES.SHIFT_DR,        1: JTAG_TAP_STATES.EXIT1_DR },
  [JTAG_TAP_STATES.SHIFT_DR]:         { 0: JTAG_TAP_STATES.SHIFT_DR,        1: JTAG_TAP_STATES.EXIT1_DR },
  [JTAG_TAP_STATES.EXIT1_DR]:         { 0: JTAG_TAP_STATES.PAUSE_DR,        1: JTAG_TAP_STATES.UPDATE_DR },
  [JTAG_TAP_STATES.PAUSE_DR]:         { 0: JTAG_TAP_STATES.PAUSE_DR,        1: JTAG_TAP_STATES.EXIT2_DR },
  [JTAG_TAP_STATES.EXIT2_DR]:         { 0: JTAG_TAP_STATES.SHIFT_DR,        1: JTAG_TAP_STATES.UPDATE_DR },
  [JTAG_TAP_STATES.UPDATE_DR]:        { 0: JTAG_TAP_STATES.RUN_TEST_IDLE,   1: JTAG_TAP_STATES.SELECT_DR },
  [JTAG_TAP_STATES.SELECT_IR]:        { 0: JTAG_TAP_STATES.CAPTURE_IR,      1: JTAG_TAP_STATES.TEST_LOGIC_RESET },
  [JTAG_TAP_STATES.CAPTURE_IR]:       { 0: JTAG_TAP_STATES.SHIFT_IR,        1: JTAG_TAP_STATES.EXIT1_IR },
  [JTAG_TAP_STATES.SHIFT_IR]:         { 0: JTAG_TAP_STATES.SHIFT_IR,        1: JTAG_TAP_STATES.EXIT1_IR },
  [JTAG_TAP_STATES.EXIT1_IR]:         { 0: JTAG_TAP_STATES.PAUSE_IR,        1: JTAG_TAP_STATES.UPDATE_IR },
  [JTAG_TAP_STATES.PAUSE_IR]:         { 0: JTAG_TAP_STATES.PAUSE_IR,        1: JTAG_TAP_STATES.EXIT2_IR },
  [JTAG_TAP_STATES.EXIT2_IR]:         { 0: JTAG_TAP_STATES.SHIFT_IR,        1: JTAG_TAP_STATES.UPDATE_IR },
  [JTAG_TAP_STATES.UPDATE_IR]:        { 0: JTAG_TAP_STATES.RUN_TEST_IDLE,   1: JTAG_TAP_STATES.SELECT_DR },
};

/**
 * Compute the next JTAG TAP state given the current state and a TMS value.
 *
 * @param {string} currentState - One of JTAG_TAP_STATES.
 * @param {0|1} tmsValue - TMS signal level for this clock.
 * @returns {string} The next JTAG_TAP_STATES value.
 * @throws {Error} If currentState is unknown.
 */
export function jtagStateTransition(currentState, tmsValue) {
  const transitions = JTAG_STATE_TRANSITIONS[currentState];
  if (!transitions) {
    throw new Error(`Unknown JTAG state: ${currentState}`);
  }
  const next = transitions[tmsValue & 1 ? 1 : 0];
  return next;
}

/**
 * Generate a sequence of TMS and TDI values to traverse from TEST_LOGIC_RESET
 * through a list of target states.  The returned arrays can be sent to the
 * device via JTAG_SHIFT.
 *
 * @param {string[]} targetStates - Ordered list of target JTAG_TAP_STATES to visit.
 * @returns {{ tms: number[], tdi: number[], statesVisited: string[] }}
 *   Arrays of bit values (0/1) for TMS and TDI, and the visited state names.
 *   TDI is filled with 0 (placeholder – caller can override for actual data).
 */
export function generateJtagSequence(targetStates) {
  const tms = [];
  const tdi = [];
  const statesVisited = [JTAG_TAP_STATES.TEST_LOGIC_RESET];

  let currentState = JTAG_TAP_STATES.TEST_LOGIC_RESET;

  for (const target of targetStates) {
    // BFS / DFS to find shortest path of TMS transitions from currentState to target
    const path = findStatePath(currentState, target);
    for (const tmsVal of path) {
      const next = jtagStateTransition(currentState, tmsVal);
      tms.push(tmsVal);
      tdi.push(0);
      statesVisited.push(next);
      currentState = next;
    }
  }

  return { tms, tdi, statesVisited };
}

/**
 * Find the shortest sequence of TMS values that moves from `fromState` to `toState`.
 * Uses BFS over the state transition graph.
 *
 * @param {string} fromState - Starting JTAG_TAP_STATES.
 * @param {string} toState   - Target JTAG_TAP_STATES.
 * @returns {number[]} Array of TMS bit values (0/1).
 */
function findStatePath(fromState, toState) {
  if (fromState === toState) {
    return [];
  }

  /** @type {Array<{ state: string, path: number[] }>} */
  const queue = [{ state: fromState, path: [] }];
  const visited = new Set([fromState]);

  while (queue.length > 0) {
    const { state, path } = queue.shift();

    for (const tmsVal of /** @type {[0, 1]} */ ([0, 1])) {
      const next = jtagStateTransition(state, tmsVal);
      if (visited.has(next)) continue;

      const newPath = [...path, tmsVal];
      if (next === toState) {
        return newPath;
      }

      visited.add(next);
      queue.push({ state: next, path: newPath });
    }
  }

  throw new Error(`No JTAG path found from ${fromState} to ${toState}`);
}