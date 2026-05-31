import { useState, useRef } from 'react'
import api from '../services/api'
import { encryptMessage, getEncryptedOverhead } from '../utils/encryption'
import SteganographyProgress from './SteganographyProgress'

const MAX_PIXELS = 50000000
const MAX_MESSAGE_SIZE = 5000000
const WARNING_IMAGE_SIZE = 4096 * 2160 * 4

function hideMessageJS(pixels, messageBytes) {
  if (pixels.length === 0) {
    throw new Error('像素数组为空')
  }

  if (pixels.length > MAX_PIXELS) {
    throw new Error(`图片过大！最大支持: ${MAX_PIXELS} 像素，当前: ${pixels.length} 像素`)
  }

  const messageLen = messageBytes.length

  if (messageLen > MAX_MESSAGE_SIZE) {
    throw new Error(`消息过大！最大支持: ${MAX_MESSAGE_SIZE} 字节，当前: ${messageLen} 字节`)
  }

  const maxCapacity = Math.floor(pixels.length / 8) - 4
  if (messageLen > maxCapacity) {
    throw new Error(`消息过大！图片容量: ${maxCapacity} 字节，消息大小: ${messageLen} 字节`)
  }

  const totalBitsNeeded = (4 + messageLen) * 8
  if (totalBitsNeeded > pixels.length) {
    throw new Error(`像素数据不足！需要: ${totalBitsNeeded} 像素，当前: ${pixels.length} 像素`)
  }

  const lenBytes = new Uint8Array([
    (messageLen >> 24) & 0xFF,
    (messageLen >> 16) & 0xFF,
    (messageLen >> 8) & 0xFF,
    messageLen & 0xFF
  ])

  for (let i = 0; i < 4; i++) {
    const startIdx = i * 8
    if (startIdx + 7 >= pixels.length) {
      throw new Error('像素数组过小，无法写入头部')
    }
    hideByte(pixels, lenBytes[i], startIdx)
  }

  for (let i = 0; i < messageLen; i++) {
    const startIdx = (i + 4) * 8
    if (startIdx + 7 >= pixels.length) {
      throw new Error(`像素数组过小，无法写入消息字节 ${i}`)
    }
    hideByte(pixels, messageBytes[i], startIdx)
  }
}

function hideByte(pixels, byte, startIdx) {
  for (let bit = 0; bit < 8; bit++) {
    const pixelIdx = startIdx + bit
    const bitValue = (byte >> (7 - bit)) & 1
    pixels[pixelIdx] = (pixels[pixelIdx] & 0xFE) | bitValue
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function HideMessage({ wasm }) {
  const [image, setImage] = useState(null)
  const [imageData, setImageData] = useState(null)
  const [message, setMessage] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [useEncryption, setUseEncryption] = useState(true)
  const [stegoImage, setStegoImage] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [processing, setProcessing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [maxCapacity, setMaxCapacity] = useState(0)
  const [imageWarning, setImageWarning] = useState('')
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState('idle')
  const [processedPixels, setProcessedPixels] = useState(0)
  const fileInputRef = useRef(null)

  const handleImageUpload = (file) => {
    if (!file) {
      setError('请选择图片文件')
      return
    }

    if (file.type !== 'image/png') {
      setError('请上传 PNG 格式图片，其他格式可能导致隐写失败')
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      setError('图片文件过大（超过 50MB），请选择较小的图片')
      return
    }

    setProcessing(true)
    setError('')
    setImageWarning('')
    setProgress(10)
    setPhase('loading')

    const reader = new FileReader()
    
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress(10 + Math.floor((e.loaded / e.total) * 30))
      }
    }

    reader.onload = (e) => {
      setProgress(50)
      
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

          if (totalPixels > WARNING_IMAGE_SIZE) {
            setImageWarning(`注意：这是一张大图片（${img.width}×${img.height}），处理可能需要较长时间`)
          }

          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0)
          
          setProgress(70)
          
          try {
            const imgData = ctx.getImageData(0, 0, img.width, img.height)
            setImageData(imgData)
            const rawCapacity = Math.max(0, Math.floor(imgData.data.length / 8) - 4)
            setMaxCapacity(Math.max(0, rawCapacity - getEncryptedOverhead()))
            setImage({ src: e.target.result, name: file.name, width: img.width, height: img.height })
            setStegoImage(null)
            setSuccess('')
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

  const handleHideMessage = async () => {
    if (!imageData || !message) {
      setError('请上传图片并输入要隐藏的消息')
      return
    }

    if (useEncryption) {
      if (!password) {
        setError('请输入加密密码')
        return
      }
      if (password.length < 6) {
        setError('密码至少需要 6 个字符')
        return
      }
      if (password !== confirmPassword) {
        setError('两次输入的密码不一致')
        return
      }
    }

    if (message.length > maxCapacity) {
      setError(`消息过长！最大容量: ${maxCapacity} 字符`)
      return
    }

    setProcessing(true)
    setError('')
    setSuccess('')
    setProgress(5)
    setPhase('loading')
    setProcessedPixels(0)

    try {
      await new Promise(resolve => setTimeout(resolve, 100))
      
      let payloadBytes
      
      if (useEncryption) {
        setPhase('encrypting')
        setProgress(20)
        payloadBytes = await encryptMessage(message, password)
        setProgress(40)
      } else {
        setProgress(20)
        payloadBytes = new TextEncoder().encode(message)
        setProgress(40)
      }

      setPhase('embedding')
      setProgress(50)

      const pixels = new Uint8ClampedArray(imageData.data)
      
      if (wasm && wasm.hide_message) {
        try {
          const messageStr = useEncryption 
            ? String.fromCharCode.apply(null, payloadBytes)
            : message
          
          if (useEncryption) {
            const decoder = new TextDecoder('latin1')
            wasm.hide_message(pixels, decoder.decode(payloadBytes))
          } else {
            wasm.hide_message(pixels, message)
          }
        } catch (wasmErr) {
          console.warn('Wasm 处理失败，回退到 JavaScript 模式:', wasmErr.message)
          hideMessageJS(pixels, payloadBytes)
        }
      } else {
        hideMessageJS(pixels, payloadBytes)
      }

      setProcessedPixels(Math.min((4 + payloadBytes.length) * 8, pixels.length))
      setProgress(75)

      setPhase('generating')
      const canvas = document.createElement('canvas')
      canvas.width = imageData.width
      canvas.height = imageData.height
      const ctx = canvas.getContext('2d')
      const newImageData = new ImageData(pixels, imageData.width, imageData.height)
      ctx.putImageData(newImageData, 0, 0)

      setProgress(90)

      const stegoUrl = canvas.toDataURL('image/png')
      setStegoImage(stegoUrl)
      setSuccess(useEncryption ? '消息已加密并隐藏成功！' : '消息隐藏成功！')
      setProgress(100)
      setPhase('complete')
    } catch (err) {
      console.error('隐藏消息错误:', err)
      if (err.message?.includes('memory') || err.message?.includes('out of bounds')) {
        setError('内存不足，图片过大或浏览器资源受限。请尝试使用较小的图片。')
      } else {
        setError('隐藏消息失败：' + (err.message || '未知错误'))
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

  const handleSaveToServer = async () => {
    if (!stegoImage) return

    setProcessing(true)
    setProgress(20)
    setPhase('generating')
    
    try {
      const response = await fetch(stegoImage)
      setProgress(40)
      
      const blob = await response.blob()
      setProgress(60)
      
      const formData = new FormData()
      formData.append('image', blob, 'stego-image.png')
      formData.append('originalName', image?.name || 'image.png')
      formData.append('messageLength', message.length)
      formData.append('encrypted', useEncryption ? 'true' : 'false')

      setProgress(80)

      const result = await api.post('/images/save-stego', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000
      })

      setSuccess('图片已保存到服务器！')
      setProgress(100)
      setPhase('complete')
    } catch (err) {
      console.error('保存失败:', err)
      if (err.code === 'ECONNABORTED') {
        setError('保存超时，图片可能过大。请下载到本地或使用较小的图片。')
      } else {
        setError('保存到服务器失败：' + (err.response?.data?.error || err.message))
      }
    } finally {
      setProcessing(false)
      setTimeout(() => {
        setProgress(0)
        setPhase('idle')
      }, 500)
    }
  }

  const handleDownload = () => {
    if (!stegoImage) return
    const link = document.createElement('a')
    link.download = image?.name ? `stego_${image.name}` : 'stego-image.png'
    link.href = stegoImage
    link.click()
  }

  const effectiveCapacity = useEncryption 
    ? Math.max(0, maxCapacity - getEncryptedOverhead())
    : maxCapacity

  return (
    <div>
      <h2 style={{ marginBottom: '20px', color: '#333' }}>🔒 将文本隐藏到图片中</h2>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}
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
        <p>📤 点击或拖拽 PNG 图片到此处</p>
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
          <h3>原始图片</h3>
          <img src={image.src} alt="Original" className="image-preview" />
        </div>
      )}

      {imageData && (
        <div className="capacity-info">
          图片尺寸：{imageData.width} × {imageData.height} 像素<br />
          数据大小：{formatBytes(imageData.data.length)}<br />
          可用容量：{effectiveCapacity.toLocaleString()} 字符（{formatBytes(effectiveCapacity)}）
          {useEncryption && <span style={{ color: '#8b5cf6' }}>（含 AES-256 加密开销）</span>}
        </div>
      )}

      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={useEncryption}
            onChange={(e) => setUseEncryption(e.target.checked)}
            style={{ marginRight: '8px' }}
            disabled={processing}
          />
          🔐 使用 AES-256 加密消息
        </label>
      </div>

      {useEncryption && (
        <>
          <div className="form-group">
            <label>加密密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="设置加密密码（至少 6 位）"
              disabled={processing}
            />
          </div>
          <div className="form-group">
            <label>确认密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入密码"
              disabled={processing}
            />
          </div>
        </>
      )}

      <div className="form-group">
        <label>要隐藏的消息</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="输入要隐藏在图片中的文本..."
          rows={5}
          disabled={processing}
        />
        {message && (
          <p style={{ marginTop: '8px', color: message.length > effectiveCapacity ? '#ef4444' : '#64748b' }}>
            已输入 {message.length.toLocaleString()} 字符
            {message.length > effectiveCapacity && ' (超出容量！)'}
          </p>
        )}
      </div>

      <button
        className="btn btn-primary"
        onClick={handleHideMessage}
        disabled={!imageData || !message || processing}
      >
        {processing ? '处理中...' : (useEncryption ? '🔐 加密并隐藏消息' : '🔒 隐藏消息')}
      </button>

      {stegoImage && (
        <div style={{ marginTop: '24px' }}>
          <div className="image-container">
            <h3>处理后的图片（含隐藏消息）</h3>
            <img src={stegoImage} alt="Stego" className="image-preview" />
            {useEncryption && (
              <p style={{ 
                color: '#8b5cf6', 
                fontSize: '14px', 
                marginTop: '8px',
                fontWeight: 500 
              }}>
                🔐 此图片包含 AES-256 加密的消息
              </p>
            )}
          </div>
          <div className="button-group">
            <button className="btn btn-primary" onClick={handleDownload}>
              ⬇️ 下载图片
            </button>
            <button className="btn btn-secondary" onClick={handleSaveToServer} disabled={processing}>
              💾 保存到服务器
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default HideMessage
