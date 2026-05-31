const SALT_SIZE = 16
const IV_SIZE = 12
const TAG_SIZE = 16
const KEY_ITERATIONS = 100000
const KEY_SIZE = 256

export async function deriveKey(password, salt) {
  const encoder = new TextEncoder()
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: KEY_ITERATIONS,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: KEY_SIZE },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptMessage(message, password) {
  if (!password || password.length < 6) {
    throw new Error('密码至少需要 6 个字符')
  }

  const encoder = new TextEncoder()
  const messageBytes = encoder.encode(message)

  const salt = crypto.getRandomValues(new Uint8Array(SALT_SIZE))
  const iv = crypto.getRandomValues(new Uint8Array(IV_SIZE))

  const key = await deriveKey(password, salt)

  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    messageBytes
  )

  const encryptedBytes = new Uint8Array(encrypted)
  
  const result = new Uint8Array(SALT_SIZE + IV_SIZE + encryptedBytes.length)
  result.set(salt, 0)
  result.set(iv, SALT_SIZE)
  result.set(encryptedBytes, SALT_SIZE + IV_SIZE)

  return result
}

export async function decryptMessage(encryptedData, password) {
  if (!password) {
    throw new Error('请输入密码')
  }

  if (encryptedData.length < SALT_SIZE + IV_SIZE + TAG_SIZE) {
    throw new Error('加密数据格式无效或已损坏')
  }

  const salt = encryptedData.slice(0, SALT_SIZE)
  const iv = encryptedData.slice(SALT_SIZE, SALT_SIZE + IV_SIZE)
  const ciphertext = encryptedData.slice(SALT_SIZE + IV_SIZE)

  try {
    const key = await deriveKey(password, salt)

    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      ciphertext
    )

    const decoder = new TextDecoder()
    return decoder.decode(decrypted)
  } catch (e) {
    throw new Error('密码错误或数据已损坏')
  }
}

export function getEncryptedOverhead() {
  return SALT_SIZE + IV_SIZE + TAG_SIZE
}

export function base64ToUint8Array(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function uint8ArrayToBase64(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
