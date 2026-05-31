import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

export default function Settings() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  const [profileForm, setProfileForm] = useState({
    username: user?.username || '',
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [preferences, setPreferences] = useState({
    theme: 'dark',
    autoRefresh: true,
    refreshInterval: 5,
    notifications: true,
    soundEffects: false,
    defaultBaudRate: 115200,
    autoConnect: true,
  })
  const [apiSettings, setApiSettings] = useState({
    baseUrl: 'http://localhost:5000',
    timeout: 30,
    retries: 3,
  })
  const [saveSuccess, setSaveSuccess] = useState(null)

  const handleSaveProfile = (e) => {
    e.preventDefault()
    if (profileForm.newPassword && profileForm.newPassword !== profileForm.confirmPassword) {
      alert('Passwords do not match')
      return
    }
    setSaveSuccess('Profile updated successfully')
    setTimeout(() => setSaveSuccess(null), 3000)
  }

  const handleSavePreferences = (e) => {
    e.preventDefault()
    setSaveSuccess('Preferences saved successfully')
    setTimeout(() => setSaveSuccess(null), 3000)
  }

  const handleSaveApi = (e) => {
    e.preventDefault()
    setSaveSuccess('API settings saved successfully')
    setTimeout(() => setSaveSuccess(null), 3000)
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ) },
    { id: 'preferences', label: 'Preferences', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ) },
    { id: 'api', label: 'API', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ) },
    { id: 'about', label: 'About', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ) },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 mt-1">Manage your account and application settings</p>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
          <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-emerald-300">{saveSuccess}</p>
        </div>
      )}

      <div className="flex gap-6">
        <div className="w-48 flex-shrink-0">
          <nav className="bg-slate-800 rounded-xl border border-slate-700 p-2 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1">
          {activeTab === 'profile' && (
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-6">Profile Settings</h2>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Username</label>
                  <input
                    type="text"
                    value={profileForm.username}
                    onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div className="pt-4 border-t border-slate-700">
                  <h3 className="text-sm font-medium text-white mb-4">Change Password</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Current Password</label>
                      <input
                        type="password"
                        value={profileForm.currentPassword}
                        onChange={(e) => setProfileForm({ ...profileForm, currentPassword: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">New Password</label>
                      <input
                        type="password"
                        value={profileForm.newPassword}
                        onChange={(e) => setProfileForm({ ...profileForm, newPassword: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm New Password</label>
                      <input
                        type="password"
                        value={profileForm.confirmPassword}
                        onChange={(e) => setProfileForm({ ...profileForm, confirmPassword: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
                >
                  Save Changes
                </button>
              </form>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-6">Preferences</h2>
              <form onSubmit={handleSavePreferences} className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">Auto Refresh</p>
                      <p className="text-xs text-slate-400">Automatically refresh device status</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.autoRefresh}
                        onChange={(e) => setPreferences({ ...preferences, autoRefresh: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">Notifications</p>
                      <p className="text-xs text-slate-400">Show desktop notifications</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.notifications}
                        onChange={(e) => setPreferences({ ...preferences, notifications: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">Sound Effects</p>
                      <p className="text-xs text-slate-400">Play sounds on events</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.soundEffects}
                        onChange={(e) => setPreferences({ ...preferences, soundEffects: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">Auto Connect</p>
                      <p className="text-xs text-slate-400">Auto-connect to last device</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.autoConnect}
                        onChange={(e) => setPreferences({ ...preferences, autoConnect: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-700 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Refresh Interval (seconds)</label>
                    <input
                      type="number"
                      value={preferences.refreshInterval}
                      onChange={(e) => setPreferences({ ...preferences, refreshInterval: Number(e.target.value) })}
                      min={1}
                      max={60}
                      className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Default Baud Rate</label>
                    <select
                      value={preferences.defaultBaudRate}
                      onChange={(e) => setPreferences({ ...preferences, defaultBaudRate: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    >
                      {[9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600].map((rate) => (
                        <option key={rate} value={rate}>{rate}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
                >
                  Save Preferences
                </button>
              </form>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-6">API Settings</h2>
              <form onSubmit={handleSaveApi} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">API Base URL</label>
                  <input
                    type="text"
                    value={apiSettings.baseUrl}
                    onChange={(e) => setApiSettings({ ...apiSettings, baseUrl: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white font-mono focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Timeout (seconds)</label>
                  <input
                    type="number"
                    value={apiSettings.timeout}
                    onChange={(e) => setApiSettings({ ...apiSettings, timeout: Number(e.target.value) })}
                    min={1}
                    max={120}
                    className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Retries</label>
                  <input
                    type="number"
                    value={apiSettings.retries}
                    onChange={(e) => setApiSettings({ ...apiSettings, retries: Number(e.target.value) })}
                    min={0}
                    max={10}
                    className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
                >
                  Save API Settings
                </button>
              </form>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-6">About</h2>
              <div className="space-y-4">
                <div className="text-center py-8">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                    <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white">FPGA Remote Programming Platform</h3>
                  <p className="text-slate-400 mt-1">Version 1.0.0</p>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">React</p>
                    <p className="text-sm text-white mt-0.5">18.3.1</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Vite</p>
                    <p className="text-sm text-white mt-0.5">5.4.8</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Tailwind CSS</p>
                    <p className="text-sm text-white mt-0.5">3.4.13</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Node</p>
                    <p className="text-sm text-white mt-0.5">18+</p>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-700 text-center">
                  <p className="text-xs text-slate-500">FPGA Remote Programming Platform</p>
                  <p className="text-xs text-slate-600 mt-1">2026 All rights reserved</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
