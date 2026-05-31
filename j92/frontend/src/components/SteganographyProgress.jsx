import { useEffect, useRef, useState } from 'react'

function SteganographyProgress({ 
  progress = 0, 
  imageData = null, 
  processing = false,
  processedPixels = 0,
  totalPixels = 0,
  phase = 'idle'
}) {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const [particles, setParticles] = useState([])

  useEffect(() => {
    if (!imageData || !processing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const displayWidth = 400
    const displayHeight = 300
    
    const ratio = Math.min(
      displayWidth / imageData.width,
      displayHeight / imageData.height,
      1
    )
    
    canvas.width = displayWidth
    canvas.height = displayHeight

    const particlesList = []
    for (let i = 0; i < 50; i++) {
      particlesList.push({
        x: Math.random() * displayWidth,
        y: Math.random() * displayHeight,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        size: Math.random() * 3 + 1,
        opacity: Math.random() * 0.5 + 0.2
      })
    }
    setParticles(particlesList)

    let frameCount = 0
    
    const animate = () => {
      frameCount++
      
      ctx.fillStyle = 'rgba(15, 23, 42, 0.1)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      if (imageData) {
        const imgCanvas = document.createElement('canvas')
        imgCanvas.width = imageData.width
        imgCanvas.height = imageData.height
        const imgCtx = imgCanvas.getContext('2d')
        imgCtx.putImageData(imageData, 0, 0)

        const targetWidth = imageData.width * ratio
        const targetHeight = imageData.height * ratio
        const offsetX = (canvas.width - targetWidth) / 2
        const offsetY = (canvas.height - targetHeight) / 2

        ctx.globalAlpha = 0.3
        ctx.drawImage(imgCanvas, offsetX, offsetY, targetWidth, targetHeight)
        ctx.globalAlpha = 1

        const scanY = offsetY + (progress / 100) * targetHeight
        const gradient = ctx.createLinearGradient(offsetX, scanY - 50, offsetX, scanY + 10)
        gradient.addColorStop(0, 'rgba(102, 126, 234, 0)')
        gradient.addColorStop(0.5, 'rgba(102, 126, 234, 0.5)')
        gradient.addColorStop(1, 'rgba(118, 75, 162, 0)')
        
        ctx.fillStyle = gradient
        ctx.fillRect(offsetX, scanY - 50, targetWidth, 60)

        ctx.strokeStyle = '#667eea'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(offsetX, scanY)
        ctx.lineTo(offsetX + targetWidth, scanY)
        ctx.stroke()

        ctx.fillStyle = '#667eea'
        for (let i = 0; i < 10; i++) {
          const px = offsetX + Math.random() * targetWidth
          const py = scanY - 20 + Math.random() * 40
          const size = Math.random() * 3 + 1
          ctx.beginPath()
          ctx.arc(px, py, size, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      particlesList.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1

        ctx.fillStyle = `rgba(102, 126, 234, ${p.opacity})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      })

      if (processing) {
        animationRef.current = requestAnimationFrame(animate)
      }
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [imageData, processing, progress])

  const phaseLabels = {
    idle: '准备就绪',
    loading: '加载图片...',
    encrypting: 'AES-256 加密中...',
    embedding: '嵌入像素中...',
    generating: '生成结果...',
    decrypting: 'AES-256 解密中...',
    extracting: '提取数据中...',
    complete: '完成!'
  }

  const phaseColors = {
    idle: '#64748b',
    loading: '#f59e0b',
    encrypting: '#8b5cf6',
    embedding: '#3b82f6',
    generating: '#10b981',
    decrypting: '#8b5cf6',
    extracting: '#3b82f6',
    complete: '#22c55e'
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '24px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h3 style={{ 
          color: '#f1f5f9', 
          margin: 0,
          fontSize: '16px',
          fontWeight: 600
        }}>
          🔐 处理进度可视化
        </h3>
        <span style={{
          color: phaseColors[phase] || '#64748b',
          fontSize: '14px',
          fontWeight: 500
        }}>
          {phaseLabels[phase]}
        </span>
      </div>

      <div style={{
        display: 'flex',
        gap: '20px',
        alignItems: 'center'
      }}>
        <canvas
          ref={canvasRef}
          style={{
            borderRadius: '12px',
            background: '#0f172a',
            border: '1px solid #334155'
          }}
          width={400}
          height={300}
        />

        <div style={{ flex: 1 }}>
          <div style={{
            background: '#1e293b',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '12px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '8px',
              color: '#94a3b8',
              fontSize: '13px'
            }}>
              <span>整体进度</span>
              <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{progress}%</span>
            </div>
            <div style={{
              background: '#334155',
              borderRadius: '4px',
              height: '8px',
              overflow: 'hidden'
            }}>
              <div style={{
                background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                height: '100%',
                width: `${progress}%`,
                transition: 'width 0.3s ease',
                borderRadius: '4px'
              }}></div>
            </div>
          </div>

          {totalPixels > 0 && (
            <div style={{
              background: '#1e293b',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '12px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px',
                color: '#94a3b8',
                fontSize: '13px'
              }}>
                <span>像素处理</span>
                <span style={{ color: '#f1f5f9' }}>
                  {processedPixels.toLocaleString()} / {totalPixels.toLocaleString()}
                </span>
              </div>
              <div style={{
                background: '#334155',
                borderRadius: '4px',
                height: '6px',
                overflow: 'hidden'
              }}>
                <div style={{
                  background: '#22c55e',
                  height: '100%',
                  width: `${totalPixels > 0 ? (processedPixels / totalPixels) * 100 : 0}%`,
                  transition: 'width 0.3s ease',
                  borderRadius: '4px'
                }}></div>
              </div>
            </div>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px'
          }}>
            <div style={{
              background: '#1e293b',
              borderRadius: '8px',
              padding: '12px',
              textAlign: 'center'
            }}>
              <div style={{ 
                color: '#667eea', 
                fontSize: '20px',
                fontWeight: 700,
                marginBottom: '4px'
              }}>
                AES-256
              </div>
              <div style={{ color: '#64748b', fontSize: '12px' }}>加密算法</div>
            </div>
            <div style={{
              background: '#1e293b',
              borderRadius: '8px',
              padding: '12px',
              textAlign: 'center'
            }}>
              <div style={{ 
                color: '#22c55e', 
                fontSize: '20px',
                fontWeight: 700,
                marginBottom: '4px'
              }}>
                LSB
              </div>
              <div style={{ color: '#64748b', fontSize: '12px' }}>隐写方式</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SteganographyProgress
