import { useState, useEffect } from 'react'
import api from '../services/api'

function ImageGallery() {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadImages()
  }, [])

  const loadImages = async () => {
    setLoading(true)
    try {
      const response = await api.get('/images')
      setImages(response.data.images || [])
    } catch (err) {
      setError('加载图片列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (imageId) => {
    if (!confirm('确定要删除这张图片吗？')) return

    try {
      await api.delete(`/images/${imageId}`)
      loadImages()
    } catch (err) {
      setError('删除图片失败')
    }
  }

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('zh-CN')
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>加载图片列表中...</p>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ marginBottom: '20px', color: '#333' }}>📁 我的图片库</h2>

      {error && <div className="error">{error}</div>}

      {images.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
          <p style={{ fontSize: '48px', marginBottom: '16px' }}>🖼️</p>
          <p>暂无上传的图片</p>
          <p style={{ marginTop: '8px', fontSize: '14px' }}>
            去「隐藏消息」选项卡上传图片并保存到服务器
          </p>
        </div>
      ) : (
        <div className="images-grid">
          {images.map((image) => (
            <div key={image.id} className="image-card">
              <img src={image.url} alt={image.originalName} />
              <div className="image-card-info">
                {image.isStego && (
                  <span className="stego-badge">🔒 含隐藏消息</span>
                )}
                <h4 title={image.originalName}>{image.originalName}</h4>
                <p>
                  {formatSize(image.size)} · {formatDate(image.uploadTime)}
                </p>
                <div className="button-group" style={{ gap: '8px' }}>
                  <a
                    href={image.url}
                    download={image.originalName}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{ 
                      flex: 1,
                      textDecoration: 'none',
                      textAlign: 'center',
                      padding: '8px 12px',
                      fontSize: '12px'
                    }}
                  >
                    ⬇️ 下载
                  </a>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDelete(image.id)}
                    style={{ 
                      flex: 1,
                      padding: '8px 12px',
                      fontSize: '12px'
                    }}
                  >
                    🗑️ 删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ImageGallery
