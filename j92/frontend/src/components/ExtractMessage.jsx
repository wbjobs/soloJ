import { useState, useRef } from 'react'
import { decryptMessage } from '../utils/encryption'
import SteganographyProgress from './SteganographyProgress'

const MAX_PIXELS = 50000000
const MAX_MESSAGE_SIZE = 5000000

function extractMessageJS(pixels) {
  if (pixels.length === 0) {
    throw new Error('像素数组为空')
  }

  if (pixels.length > MAX_PIXELS) {
    throw new Error(`图片过大！最大支持: ${MAX_PIXELS} 像素，当前: ${pixels.length} 像素`)
  }

  const headerBits = 4 * 8
  if (pixels.length < headerBits) {
    throw new Error('图片过小，无法包含隐藏消息')
  }

  const lenBytes = new Uint8Array(4)
  for (let i = 0; i < 4; i++) {
    const startIdx = i * 8
    if (startIdx + 7 >= pixels.length) {
      throw new Error('像素数组过小，无法读取头部')
    }
    lenBytes[i] = extractByte(pixels, startIdx)
  }
  
  const messageLen = (lenBytes[0] << 24) | (lenBytes[1] << 16) | (lenBytes[2] << 8) | lenBytes[3]
  
  if (messageLen === 0) {
    return new Uint8Array(0)
  }

  if (messageLen < 0 || messageLen > MAX_MESSAGE_SIZE) {
    throw new Error('未找到隐藏消息或消息已损坏（无效长度）')
  }

  const maxCapacity = Math.floor(pixels.length / 8) - 4
  if (messageLen > maxCapacity) {
    throw new Error(`消息长度超出图片容量！存储的: ${messageLen} 字节，容量: ${maxCapacity} 字节`)
  }

  const totalBitsNeeded = (4 + messageLen) * 8
  if (totalBitsNeeded > pixels.length) {
    throw new Error('像素数组过小，无法读取消息')
  }

  const messageBytes = new Uint8Array(messageLen)
  for (let i = 0; i < messageLen; i++) {
    const startIdx = (i + 4) * 8
    if (startIdx + 7 >= pixels.length) {
      throw new Error(`像素数组过小，无法读取消息字节 ${i}`)
    }
    messageBytes[i] = extractByte(pixels, startIdx)
  }

  return messageBytes
}

function extractByte(pixels, startIdx) {
  let byte = 0
  for (let bit = 0; bit < 8; bit++) {
    const pixelIdx = startIdx + bit
    const bitValue = pixels[pixelIdx] & 1
    byte |= bitValue << (7 - bit)
  }
  return byte
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function ExtractMessage({ wasm }) {
  const [image, setImage] = useState(null)
  const [imageData, setImageData] = useState(null)
  const [extractedMessage, setExtractedMessage] = useState(null)
  const [password, setPassword] = useState('')
  const [isEncrypted, setIsEncrypted] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [processing, setProcessing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [progress, setProgress] = useState(0)
  const [imageWarning, setImageWarning] = useState('')
  const [phase, setPhase] = useState('idle')
  const [processedPixels, setProcessedPixels] = useState(0)
  const fileInputRef = useRef(null)

  const handleImageUpload = (file) => {
    if (!file) {
      setError('请选择图片文件')
      return
    }

    if (file.type !== 'image/png') {
      setError('请上传 PNG 格式图片，其他格式无法正确提取隐藏消息')
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      setError('图片文件过大（超过 50MB），请选择较小的图片')
      return
    }

    setProcessing(true)
    setError('')
    setExtractedMessage(null)
    setImageWarning('')
    setProgress(10)
    setPhase('loading')

    const reader = new FileReader()
    
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress(10 + Math.floor((e.loaded / e.total) * 40))
      }
    }

    reader.onload = (e) => {
      setProgress(60)
      
      const img = new Image()
      
      img.onload = () => {
        try {
          const totalPixels = img.width * img.height * 4
          
          if (totalPixels > MAX_PIXELS) {
            setError(`图片分辨率过高（${img.width}×${img.height}），最大支持约 3500 万像素`)
            setProcessing(false)
            setProgress(0)
            setPhase('idle')
            return
          }

          if (totalPixels > 4096 * 2160 * 4) {
            setImageWarning(`注意：这是一张大图片（${img.width}×${img.height}），处理可能需要较长时间`)
          }

          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0)
          
          setProgress(80)
          
          try {
            const imgData = ctx.getImageData(0, 0, img.width, img.height)
            setImageData(imgData)
            setImage({ src: e.target.result, name: file.name })
            setProgress(100)
            setPhase('idle')
          } catch (err) {
            throw new Error('无法读取图片像素数据：' + err.message)
          }
        } catch (err) {
          setError('图片加载失败：' + err.message)
        } finally {
          setProcessing(false)
          setTimeout(() => {
            setProgress(0)
            setPhase('idle')
          }, 500)
        }
      }

      img.onerror = () => {
        setError('图片解码失败，请确保文件是有效的 PNG 图片')
        setProcessing(false)
        setProgress(0)
        setPhase('idle')
      }

      img.src = e.target.result
    }

    reader.onerror = () => {
      setError('文件读取失败')
      setProcessing(false)
      setProgress(0)
      setPhase('idle')
    }

    reader.readAsDataURL(file)
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    handleImageUpload(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    handleImageUpload(file)
  }

  const handleExtractMessage = async () => {
    if (!imageData) {
      setError('请上传包含隐藏消息的图片')
      return
    }

    setProcessing(true)
    setError('')
    setExtractedMessage(null)
    setProgress(20)
    setPhase('loading')

    try {
      await new Promise(resolve => setTimeout(resolve, 100))
      setProgress(40)

      const pixels = new Uint8ClampedArray(imageData.data)
      
      setPhase('extracting')
      setProgress(50)

      let extractedBytes

      if (wasm && wasm.extract_message) {
        try {
          const result = wasm.extract_message(pixels)
          const encoder = new TextEncoder()
          extractedBytes = encoder.encode(result)
        } catch (wasmErr) {
          console.warn('Wasm 处理失败，回退到 JavaScript 模式:', wasmErr.message)
          extractedBytes = extractMessageJS(pixels)
        }
      } else {
        extractedBytes = extractMessageJS(pixels)
      }

      setProcessedPixels(extractedBytes.length > 0 
        ? Math.min((4 + extractedBytes.length) * 8, pixels.length)
        : 0)
      setProgress(70)

      if (!extractedBytes || extractedBytes.length === 0) {
        setError('图片中未找到隐藏的消息')
        setProcessing(false)
        setProgress(0)
        setPhase('idle')
        return
      }

      let message
      let needsDecryption = true

      try {
        const decoder = new TextDecoder('utf-8', { fatal: true })
        message = decoder.decode(extractedBytes)
        
        if (/^[\x20-\x7E\u4E00-\u9FFF\n\r\t]*$/.test(message)) {
          needsDecryption = false
          setIsEncrypted(false)
        } else {
          needsDecryption = true
        }
      } catch (e) {
        needsDecryption = true
      }

      if (needsDecryption) {
        if (!password) {
          setIsEncrypted(true)
          setError('检测到加密消息，请输入解密密码')
          setProcessing(false)
          setProgress(0)
          setPhase('idle')
          return
        }

        setPhase('decrypting')
        setProgress(80)
        
        try {
          message = await decryptMessage(extractedBytes, password)
          setIsEncrypted(true)
        } catch (decryptErr) {
          throw new Error(decryptErr.message || '密码错误或数据已损坏')
        }
      }

      if (!message || message.trim() === '') {
        setError('图片中未找到有效的隐藏消息')
      } else {
        setExtractedMessage(message)
        setSuccess('消息提取成功！')
      }
      
      setProgress(100)
      setPhase('complete')
    } catch (err) {
      console.error('提取消息错误:', err)
      if (err.message?.includes('memory') || err.message?.includes('out of bounds')) {
        setError('内存不足，图片过大或浏览器资源受限。请尝试使用较小的图片。')
      } else if (err.message?.includes('corrupted') || err.message?.includes('损坏')) {
        setError('未检测到有效的隐藏消息。请确保上传的是正确的隐写图片。')
      } else if (err.message?.includes('密码')) {
        setError(err.message)
      } else {
        setError('提取消息失败：' + (err.message || '未知错误'))
      }
    } finally {
      setProcessing(false)
      setTimeout(() => {
        setProgress(0)
        setPhase('idle')
        setProcessedPixels(0)
      }, 1000)
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: '20px', color: '#333' }}>🔓 从图片中提取隐藏消息</h2>

      {error && <div className="error">{error}</div>}
      {imageWarning && (
        <div style={{
          background: '#fffbeb',
          color: '#d97706',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          borderLeft: '4px solid #f59e0b'
        }}>
          ⚠️ {imageWarning}
        </div>
      )}

      {imageData && (
        <SteganographyProgress
          progress={progress}
          imageData={imageData}
          processing={processing}
          processedPixels={processedPixels}
          totalPixels={imageData.data.length}
          phase={phase}
        />
      )}

      <div
        className={`image-upload-area ${dragOver ? 'dragover' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <p>📤 点击或拖拽包含隐藏消息的 PNG 图片到此处</p>
        <p style={{ fontSize: '12px', color: '#94a3b8' }}>
          支持 PNG 格式，建议不超过 4K 分辨率
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          disabled={processing}
        />
      </div>

      {image && (
        <div className="image-container">
          <h3>待分析图片</h3>
          <img src={image.src} alt="To extract" className="image-preview" />
        </div>
      )}

      {imageData && (
        <div className="capacity-info" style={{ marginBottom: '20px' }}>
          图片尺寸：{imageData.width} × {imageData.height} 像素<br />
          数据大小：{formatBytes(imageData.data.length)}<br />
          理论最大可提取：{Math.max(0, Math.floor(imageData.data.length / 8) - 4).toLocaleString()} 字符
        </div>
      )}

      <div className="form-group">
        <label>解密密码（如果消息已加密）</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="输入解密密码（可选，仅加密消息需要）"
          disabled={processing}
        />
      </div>

      <button
        className="btn btn-primary"
        onClick={handleExtractMessage}
        disabled={!imageData || processing}
      >
        {processing ? '处理中...' : '🔓 提取隐藏消息'}
      </button>

      {extractedMessage && (
        <div className="extracted-message">
          <h3>✅ 成功提取到隐藏消息：</h3>
          {isEncrypted && (
            <p style={{ 
              color: '#86efac', 
              fontSize: '13px', 
              marginBottom: '12px' 
            }}>
              🔐 AES-256 加密消息已解密
            </p>
          )}
          <div style={{ marginTop: '12px' }}>
            <p style={{ 
              color: '#15803d', 
              fontFamily: 'monospace', 
              whiteSpace: 'pre-wrap', 
              wordBreak: 'break-all' 
            }}>
              {extractedMessage}
            </p>
            <p style={{ 
              marginTop: '12px', 
              fontSize: '12px', 
              color: '#86efac' 
            }}>
              共提取 {extractedMessage.length} 字符
            </p>
          </div>
          <div style={{ marginTop: '16px' }}>
            <button 
              className="btn btn-secondary" 
              style={{ width: 'auto', padding: '8px 20px' }}
              onClick={() => {
                navigator.clipboard.writeText(extractedMessage)
                  .then(() => alert('已复制到剪贴板！'))
                  .catch(() => alert('复制失败，请手动复制'))
              }}
            >
              📋 复制到剪贴板
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExtractMessage
