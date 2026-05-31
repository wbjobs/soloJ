const XILINX_BIT_MAGIC = [0x00, 0x09, 0x0F, 0xF0, 0x0F, 0xF0, 0x0F, 0xF0, 0x0F, 0xF0, 0x00, 0x00, 0x01]
const XILINX_SYNC_WORD = 0xAA995566
const ALTERA_SYNC_WORD = 0x00000001
const LATTICE_SYNC_WORD = 0x72A15033
const GOWIN_SYNC_WORD = 0x4757314E

const DEVICE_DATABASE = {
  xilinx: {
    '7series': {
      patterns: ['xc7a', 'xc7k', 'xc7v', 'xc7z'],
      family: 'Xilinx 7-Series',
      packages: {
        'cpg236': 'CPG236', 'cpg238': 'CPG238', 'fgg484': 'FGG484',
        'fgg676': 'FGG676', 'fgg900': 'FGG900', 'ffg1156': 'FFG1156',
        'ffg1926': 'FFG1926', 'ffg1927': 'FFG1927',
      },
    },
    ultrascale: {
      patterns: ['xcku', 'xcvu', 'xczu'],
      family: 'Xilinx UltraScale',
      packages: {
        'flva1156': 'FLVA1156', 'flgb1760': 'FLGB1760',
        'fgga1517': 'FGGA1517', 'fsvh2104': 'FSVH2104',
      },
    },
    spartan: {
      patterns: ['xc3s', 'xc6sl', 'xc6s'],
      family: 'Xilinx Spartan',
      packages: {
        'ft256': 'FT256', 'ftg256': 'FTG256', 'cp132': 'CP132',
        'vq100': 'VQ100', 'tq144': 'TQ144',
      },
    },
  },
  altera: {
    cyclone: {
      patterns: ['ep1c', 'ep2c', 'ep3c', 'ep4c', '5cse', '5csm'],
      family: 'Altera Cyclone',
    },
    stratix: {
      patterns: ['ep1s', 'ep2s', 'ep3s', 'ep4s', '10ax', '10cx'],
      family: 'Altera Stratix',
    },
    max: {
      patterns: ['epm240', 'epm570', 'epm1270', 'epm2210', '5m40', '5m80', '5m160', '5m240', '5m570', '5m1270', '5m2210'],
      family: 'Altera MAX',
    },
  },
  lattice: {
    ice40: {
      patterns: ['ice40', 'lp1k', 'lp4k', 'lp8k', 'hx1k', 'hx4k', 'hx8k', 'up5k', 'ul1k'],
      family: 'Lattice iCE40',
    },
    ecp5: {
      patterns: ['ecp5', 'lfe5u', 'lfe5um', 'lfe5um5g'],
      family: 'Lattice ECP5',
    },
  },
  gowin: {
    gw1n: {
      patterns: ['gw1n', 'gw1nz', 'gw1nr', 'gw1ns'],
      family: 'Gowin GW1N',
    },
    gw2a: {
      patterns: ['gw2a', 'gw2ar'],
      family: 'Gowin GW2A',
    },
  },
}

const XILINX_SPEED_GRADES = ['-1', '-2', '-3', '-1L', '-2L', '-1H', '-2H']
const ALTERA_SPEED_GRADES = ['C6', 'C7', 'C8', 'I7', 'A7']

function _hexToAscii(hex) {
  let str = ''
  for (let i = 0; i < hex.length; i += 2) {
    str += String.fromCharCode(parseInt(hex.substr(i, 2), 16))
  }
  return str
}

function _bufToHex(buffer, offset, length) {
  const bytes = new Uint8Array(buffer, offset, length)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}

function _readUint32BE(buffer, offset) {
  const view = new DataView(buffer)
  return view.getUint32(offset, false)
}

function _readUint16BE(buffer, offset) {
  const view = new DataView(buffer)
  return view.getUint16(offset, false)
}

function _matchMagic(buffer, magic, offset = 0) {
  const bytes = new Uint8Array(buffer, offset, magic.length)
  for (let i = 0; i < magic.length; i++) {
    if (bytes[i] !== magic[i]) return false
  }
  return true
}

function _findSyncWord(buffer, syncWord, maxOffset) {
  const view = new DataView(buffer)
  const searchLen = Math.min(maxOffset || 4096, buffer.byteLength - 4)
  for (let i = 0; i < searchLen; i += 4) {
    if (view.getUint32(i, false) === syncWord) {
      return i
    }
  }
  return -1
}

export function parseBitFileHeader(buffer) {
  const result = {
    designName: '',
    partNumber: '',
    date: '',
    time: '',
    dataOffset: 0,
    dataLength: 0,
    isValid: false,
    error: null,
  }

  try {
    if (buffer.byteLength < 13) {
      result.error = 'File too small for .bit header'
      return result
    }

    if (!_matchMagic(buffer, XILINX_BIT_MAGIC, 0)) {
      result.error = 'Invalid .bit file magic bytes'
      return result
    }

    let offset = XILINX_BIT_MAGIC.length

    const view = new DataView(buffer)

    while (offset < buffer.byteLength - 1) {
      const tag = String.fromCharCode(view.getUint8(offset))
      offset += 1

      if (tag === 'e') {
        break
      }

      const length = view.getUint16(offset, false)
      offset += 2

      if (offset + length > buffer.byteLength) {
        result.error = 'Unexpected end of header data'
        return result
      }

      const value = _hexToAscii(_bufToHex(buffer, offset, length))

      switch (tag) {
        case 'a':
          result.designName = value.replace(/\0/g, '').trim()
          break
        case 'b':
          result.partNumber = value.trim()
          break
        case 'c':
          result.date = value.trim()
          break
        case 'd':
          result.time = value.trim()
          break
        default:
          break
      }

      offset += length
    }

    if (offset >= buffer.byteLength - 4) {
      result.error = 'No bitstream data found'
      return result
    }

    result.dataOffset = offset + 4
    result.dataLength = buffer.byteLength - result.dataOffset
    result.isValid = true

    return result
  } catch (err) {
    result.error = err.message || 'Failed to parse .bit header'
    return result
  }
}

export function parseBinFileHeader(buffer) {
  const result = {
    deviceType: 'unknown',
    syncWord: null,
    dataOffset: 0,
    dataLength: 0,
    isValid: false,
    error: null,
  }

  try {
    if (buffer.byteLength < 4) {
      result.error = 'File too small'
      return result
    }

    const searchLimit = Math.min(65536, buffer.byteLength)

    const xilinxOffset = _findSyncWord(buffer, XILINX_SYNC_WORD, searchLimit)
    if (xilinxOffset >= 0) {
      result.deviceType = 'xilinx'
      result.syncWord = XILINX_SYNC_WORD
      result.dataOffset = xilinxOffset
      result.dataLength = buffer.byteLength - xilinxOffset
      result.isValid = true
      return result
    }

    const alteraOffset = _findSyncWord(buffer, ALTERA_SYNC_WORD, searchLimit)
    if (alteraOffset >= 0) {
      result.deviceType = 'altera'
      result.syncWord = ALTERA_SYNC_WORD
      result.dataOffset = alteraOffset
      result.dataLength = buffer.byteLength - alteraOffset
      result.isValid = true
      return result
    }

    const latticeOffset = _findSyncWord(buffer, LATTICE_SYNC_WORD, searchLimit)
    if (latticeOffset >= 0) {
      result.deviceType = 'lattice'
      result.syncWord = LATTICE_SYNC_WORD
      result.dataOffset = latticeOffset
      result.dataLength = buffer.byteLength - latticeOffset
      result.isValid = true
      return result
    }

    const gowinOffset = _findSyncWord(buffer, GOWIN_SYNC_WORD, searchLimit)
    if (gowinOffset >= 0) {
      result.deviceType = 'gowin'
      result.syncWord = GOWIN_SYNC_WORD
      result.dataOffset = gowinOffset
      result.dataLength = buffer.byteLength - gowinOffset
      result.isValid = true
      return result
    }

    result.deviceType = 'raw'
    result.syncWord = null
    result.dataOffset = 0
    result.dataLength = buffer.byteLength
    result.isValid = true
    result.error = null

    return result
  } catch (err) {
    result.error = err.message || 'Failed to parse .bin header'
    return result
  }
}

export function getDeviceInfo(partNumber) {
  if (!partNumber || typeof partNumber !== 'string') {
    return {
      family: 'Unknown',
      manufacturer: 'Unknown',
      package: 'Unknown',
      speedGrade: 'Unknown',
      device: partNumber || 'Unknown',
    }
  }

  const pn = partNumber.toLowerCase()

  for (const [manufacturer, families] of Object.entries(DEVICE_DATABASE)) {
    for (const [familyId, familyInfo] of Object.entries(families)) {
      for (const pattern of familyInfo.patterns) {
        if (pn.includes(pattern)) {
          let pkg = 'Unknown'
          let speedGrade = 'Unknown'

          if (manufacturer === 'xilinx') {
            for (const [pkgKey, pkgName] of Object.entries(familyInfo.packages || {})) {
              if (pn.includes(pkgKey)) {
                pkg = pkgName
                break
              }
            }
            for (const sg of XILINX_SPEED_GRADES) {
              if (pn.includes(sg.toLowerCase())) {
                speedGrade = sg
                break
              }
            }
          } else if (manufacturer === 'altera') {
            for (const sg of ALTERA_SPEED_GRADES) {
              if (pn.includes(sg.toLowerCase())) {
                speedGrade = sg
                break
              }
            }
          }

          return {
            family: familyInfo.family,
            manufacturer: manufacturer.charAt(0).toUpperCase() + manufacturer.slice(1),
            package: pkg,
            speedGrade,
            device: partNumber,
          }
        }
      }
    }
  }

  return {
    family: 'Unknown',
    manufacturer: 'Unknown',
    package: 'Unknown',
    speedGrade: 'Unknown',
    device: partNumber,
  }
}

export function validateBitstream(file) {
  const result = {
    isValid: false,
    format: null,
    error: null,
  }

  if (!file) {
    result.error = 'No file provided'
    return result
  }

  if (!(file instanceof File) && !(file instanceof Blob)) {
    result.error = 'Invalid file object'
    return result
  }

  const name = file.name || ''
  const ext = '.' + name.split('.').pop().toLowerCase()
  const validExtensions = ['.bit', '.bin', '.svf', '.jed', '.pof', '.rbf', '.jam']

  if (!validExtensions.includes(ext)) {
    result.error = `Invalid file extension: ${ext}. Supported: ${validExtensions.join(', ')}`
    return result
  }

  if (file.size === 0) {
    result.error = 'File is empty'
    return result
  }

  if (file.size > 512 * 1024 * 1024) {
    result.error = 'File exceeds 512MB limit'
    return result
  }

  const minSizes = {
    '.bit': 13,
    '.bin': 4,
    '.svf': 1,
    '.jed': 1,
    '.pof': 1,
    '.rbf': 1,
    '.jam': 1,
  }

  if (file.size < (minSizes[ext] || 0)) {
    result.error = 'File too small for the specified format'
    return result
  }

  result.isValid = true
  result.format = ext.slice(1)

  return result
}

export function extractBitstreamData(buffer, format) {
  if (!buffer || !(buffer instanceof ArrayBuffer)) {
    throw new Error('Invalid buffer')
  }

  const fmt = (format || '').toLowerCase()

  switch (fmt) {
    case 'bit': {
      const header = parseBitFileHeader(buffer)
      if (!header.isValid) {
        throw new Error(header.error || 'Invalid .bit file')
      }
      return new Uint8Array(buffer, header.dataOffset, header.dataLength)
    }

    case 'bin':
    case 'rbf': {
      const header = parseBinFileHeader(buffer)
      return new Uint8Array(buffer, header.dataOffset, header.dataLength)
    }

    case 'svf':
    case 'jed':
    case 'pof':
    case 'jam': {
      return new Uint8Array(buffer)
    }

    default: {
      return new Uint8Array(buffer)
    }
  }
}

export async function calculateBitstreamHash(data) {
  if (!data || !(data instanceof Uint8Array)) {
    throw new Error('Invalid data')
  }

  if (!crypto.subtle || !crypto.subtle.digest) {
    return hashFallback(data)
  }

  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return hashFallback(data)
  }
}

function hashFallback(data) {
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data[i]
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  const hex = Math.abs(hash).toString(16)
  return '0'.repeat(64 - hex.length) + hex
}

export function estimateBurnTime(dataSize, transferRate) {
  const rate = transferRate || 10000000

  const overheadBase = 2.0
  const overheadPerMB = 0.5
  const dataSizeMB = dataSize / (1024 * 1024)
  const overhead = overheadBase + (dataSizeMB * overheadPerMB)

  const transferTime = dataSize / rate
  const programTime = transferTime * 3
  const verifyTime = transferTime * 1.5
  const initTime = 1.0

  const totalTime = overhead + programTime + verifyTime + initTime

  return {
    total: totalTime,
    transfer: transferTime,
    program: programTime,
    verify: verifyTime,
    overhead,
    init: initTime,
    formatted: _formatDuration(totalTime),
  }
}

function _formatDuration(seconds) {
  if (seconds < 0.001) {
    return `${(seconds * 1000000).toFixed(0)}us`
  } else if (seconds < 1) {
    return `${(seconds * 1000).toFixed(1)}ms`
  } else if (seconds < 60) {
    return `${seconds.toFixed(1)}s`
  } else {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs.toFixed(1)}s`
  }
}

export default {
  parseBitFileHeader,
  parseBinFileHeader,
  getDeviceInfo,
  validateBitstream,
  extractBitstreamData,
  calculateBitstreamHash,
  estimateBurnTime,
}
