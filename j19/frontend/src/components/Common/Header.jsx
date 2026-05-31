import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useDevice } from '../../context/DeviceContext.jsx'

export default function Header() {
  const { user, logout } = useAuth()
  const { connectionStatus, selectedDevice } = useDevice()
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const statusColor = connectionStatus === 'connected'
    ? 'bg-emerald-500'
    : connectionStatus === 'reconnecting'
    ? 'bg-amber-500'
    : connectionStatus === 'connecting'
    ? 'bg-amber-500'
    : connectionStatus === 'error'
    ? 'bg-rose-500'
    : 'bg-slate-500'

  const statusLabel = connectionStatus === 'connected'
    ? `已连接: ${selectedDevice?.productName || 'Device'}`
    : connectionStatus === 'reconnecting'
    ? '正在重连...'
    : connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)

  return (
    <header className="h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-4">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">FPGA Remote</h1>
            <p className="text-xs text-slate-400">Programming Platform</p>
          </div>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700/50">
          <span className={`w-2.5 h-2.5 rounded-full ${statusColor} ${connectionStatus === 'connecting' ? 'pulse-dot' : ''}`} />
          <span className="text-sm text-slate-300">{statusLabel}</span>
        </div>

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-sm font-semibold text-white">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium text-white">{user?.username || 'User'}</p>
              <p className="text-xs text-slate-400">{user?.role || 'user'}</p>
            </div>
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-lg bg-slate-800 border border-slate-700 shadow-xl py-1 z-50 slide-in">
              <div className="px-4 py-2 border-b border-slate-700">
                <p className="text-sm font-medium text-white">{user?.username}</p>
                <p className="text-xs text-slate-400">{user?.email}</p>
              </div>
              <Link
                to="/settings"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              >
                Settings
              </Link>
              <button
                onClick={handleLogout}
                className="block w-full text-left px-4 py-2 text-sm text-rose-400 hover:bg-slate-700 hover:text-rose-300 transition-colors"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
