let wasmModule = null;
let isLoading = false;
let loadPromise = null;

const MAGIC_HEADER = new TextEncoder().encode('LSB\x01');

function xorCipher(data, password) {
  const passwordBytes = new TextEncoder().encode(password);
  if (passwordBytes.length === 0) {
    return new Uint8Array(data);
  }
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ passwordBytes[i % passwordBytes.length];
  }
  return result;
}

export async function loadWasm() {
  if (wasmModule) {
    return wasmModule;
  }
  
  if (isLoading && loadPromise) {
    return loadPromise;
  }
  
  isLoading = true;
  loadPromise = (async () => {
    try {
      const wasm = await import('./pkg/lsb_steganography.js');
      await wasm.default();
      wasmModule = wasm;
      return wasm;
    } catch (error) {
      console.warn('WASM module not found, using JavaScript fallback...');
      return createJsFallback();
    }
  })();
  
  return loadPromise;
}

function createJsFallback() {
  return {
    encode_image: function(pixels, width, height, message, password = '') {
      const messageBytes = new TextEncoder().encode(message);
      const payload = new Uint8Array(MAGIC_HEADER.length + messageBytes.length);
      payload.set(MAGIC_HEADER, 0);
      payload.set(messageBytes, MAGIC_HEADER.length);
      const encryptedBytes = xorCipher(payload, password);
      const messageLen = encryptedBytes.length;
      
      const maxCapacity = Math.floor((width * height * 3) / 8) - 4;
      if (messageLen > maxCapacity) {
        throw new Error(`Message too long! Max capacity: ${maxCapacity} bytes, message size: ${messageLen} bytes`);
      }
      
      const lenBytes = new Uint8Array(4);
      lenBytes[0] = (messageLen >> 24) & 0xFF;
      lenBytes[1] = (messageLen >> 16) & 0xFF;
      lenBytes[2] = (messageLen >> 8) & 0xFF;
      lenBytes[3] = messageLen & 0xFF;
      
      let bitIndex = 0;
      const result = new Uint8Array(pixels);
      
      for (let i = 0; i < 4; i++) {
        const byte = lenBytes[i];
        for (let bit = 0; bit < 8; bit++) {
          const pixelOffset = Math.floor(bitIndex / 3) * 4;
          const channelOffset = bitIndex % 3;
          const pixelByte = pixelOffset + channelOffset;
          
          if (pixelByte >= result.length) {
            throw new Error('Image too small');
          }
          
          const bitValue = (byte >> (7 - bit)) & 1;
          result[pixelByte] = (result[pixelByte] & 0xFE) | bitValue;
          bitIndex++;
        }
      }
      
      for (let i = 0; i < encryptedBytes.length; i++) {
        const byte = encryptedBytes[i];
        for (let bit = 0; bit < 8; bit++) {
          const pixelOffset = Math.floor(bitIndex / 3) * 4;
          const channelOffset = bitIndex % 3;
          const pixelByte = pixelOffset + channelOffset;
          
          if (pixelByte >= result.length) {
            throw new Error('Image too small for message');
          }
          
          const bitValue = (byte >> (7 - bit)) & 1;
          result[pixelByte] = (result[pixelByte] & 0xFE) | bitValue;
          bitIndex++;
        }
      }
      
      return result;
    },
    
    decode_image: function(pixels, width, height, password = '') {
      const pixelData = new Uint8Array(pixels);
      let bitIndex = 0;
      const lenBytes = new Uint8Array(4);
      
      for (let i = 0; i < 4; i++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const pixelOffset = Math.floor(bitIndex / 3) * 4;
          const channelOffset = bitIndex % 3;
          const pixelByte = pixelOffset + channelOffset;
          
          if (pixelByte >= pixelData.length) {
            throw new Error('Image too small to extract length');
          }
          
          const lsb = pixelData[pixelByte] & 1;
          byte = (byte << 1) | lsb;
          bitIndex++;
        }
        lenBytes[i] = byte;
      }
      
      const messageLen = (lenBytes[0] << 24) | (lenBytes[1] << 16) | (lenBytes[2] << 8) | lenBytes[3];
      const maxCapacity = Math.floor((width * height * 3) / 8) - 4;
      
      if (messageLen === 0 || messageLen > maxCapacity) {
        throw new Error(`Invalid message length: ${messageLen} bytes (max: ${maxCapacity} bytes). No hidden message found.`);
      }
      
      const encryptedBytes = new Uint8Array(messageLen);
      
      for (let i = 0; i < messageLen; i++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const pixelOffset = Math.floor(bitIndex / 3) * 4;
          const channelOffset = bitIndex % 3;
          const pixelByte = pixelOffset + channelOffset;
          
          if (pixelByte >= pixelData.length) {
            throw new Error('Image too small to extract message');
          }
          
          const lsb = pixelData[pixelByte] & 1;
          byte = (byte << 1) | lsb;
          bitIndex++;
        }
        encryptedBytes[i] = byte;
      }
      
      const decryptedBytes = xorCipher(encryptedBytes, password);
      
      let validHeader = true;
      if (decryptedBytes.length < MAGIC_HEADER.length) {
        validHeader = false;
      } else {
        for (let i = 0; i < MAGIC_HEADER.length; i++) {
          if (decryptedBytes[i] !== MAGIC_HEADER[i]) {
            validHeader = false;
            break;
          }
        }
      }
      
      if (!validHeader) {
        throw new Error('Invalid magic header - wrong password or not a valid steganography image');
      }
      
      const messageBytes = decryptedBytes.slice(MAGIC_HEADER.length);
      
      try {
        return new TextDecoder('utf-8', { fatal: true }).decode(messageBytes);
      } catch (e) {
        const result = new TextDecoder('utf-8').decode(messageBytes);
        if (result && result.length > 0) {
          return result;
        }
        throw new Error('Failed to decode UTF-8 message (wrong password?)');
      }
    },
    
    calculate_psnr: function(original, modified) {
      if (original.length !== modified.length || original.length === 0) {
        return 0;
      }
      
      let mse = 0;
      for (let i = 0; i < original.length; i++) {
        const diff = original[i] - modified[i];
        mse += diff * diff;
      }
      mse /= original.length;
      
      if (mse === 0) {
        return Infinity;
      }
      
      const maxPixelValue = 255;
      return 10 * Math.log10((maxPixelValue * maxPixelValue) / mse);
    },
    
    get_utf8_byte_length: function(message) {
      return new TextEncoder().encode(message).length;
    },
    
    get_max_capacity: function(width, height) {
      return Math.floor((width * height * 3) / 8) - 4;
    }
  };
}

export async function encodeImage(pixels, width, height, message, password = '') {
  const wasm = await loadWasm();
  return wasm.encode_image(pixels, width, height, message, password);
}

export async function decodeImage(pixels, width, height, password = '') {
  const wasm = await loadWasm();
  return wasm.decode_image(pixels, width, height, password);
}

export async function calculatePSNR(original, modified) {
  const wasm = await loadWasm();
  return wasm.calculate_psnr(original, modified);
}

export async function getMaxCapacity(width, height) {
  const wasm = await loadWasm();
  return wasm.get_max_capacity(width, height);
}

export async function getUtf8ByteLength(message) {
  const wasm = await loadWasm();
  return wasm.get_utf8_byte_length(message);
}
