import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import HideMessage from './HideMessage'
import ExtractMessage from './ExtractMessage'
import ImageGallery from './ImageGallery'

function Dashboard() {
  const [activeTab, setActiveTab] = useState('hide')
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
  }

  return (
    <div>
      <nav className="navbar">
        <h1>🖼️ LSB 图像隐写术</h1>
        <div className="nav-links">
          <span>👤 {user?.username}</span>
          <button onClick={handleLogout}>退出登录</button>
        </div>
      </nav>

      <div className="dashboard">
        <div className="tabs">
          <button
            className={`tab-btn ${activeTab === 'hide' ? 'active' : ''}`}
            onClick={() => setActiveTab('hide')}
          >
            🔒 隐藏消息
          </button>
          <button
            className={`tab-btn ${activeTab === 'extract' ? 'active' : ''}`}
            onClick={() => setActiveTab('extract')}
          >
            🔓 提取消息
          </button>
          <button
            className={`tab-btn ${activeTab === 'gallery' ? 'active' : ''}`}
            onClick={() => setActiveTab('gallery')}
          >
            📁 图片库
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'hide' && <HideMessage wasm={null} />}
          {activeTab === 'extract' && <ExtractMessage wasm={null} />}
          {activeTab === 'gallery' && <ImageGallery />}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
