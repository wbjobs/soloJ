import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { userApi } from '../../services/api.js'
import { useAuth } from '../../context/AuthContext.jsx'

export default function UserManagement() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user',
  })
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)

  const fetchUsers = async () => {
    try {
      const { data } = await userApi.list()
      setUsers(data.users || data || [])
    } catch (err) {
      console.error('Failed to fetch users:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setError(null)
    setActionLoading('create')
    try {
      await userApi.create(formData)
      setShowCreateModal(false)
      setFormData({ username: '', email: '', password: '', role: 'user' })
      fetchUsers()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create user')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    setActionLoading(userId)
    try {
      await userApi.changeRole(userId, newRole)
      fetchUsers()
    } catch (err) {
      console.error('Failed to change role:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return
    setActionLoading(userId)
    try {
      await userApi.delete(userId)
      fetchUsers()
    } catch (err) {
      console.error('Failed to delete user:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const roleColors = {
    admin: 'bg-primary-500/20 text-primary-400 border-primary-500/30',
    user: 'bg-slate-600 text-slate-300 border-slate-500',
    operator: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="text-slate-400 mt-1">Manage platform users and permissions</p>
        </div>
        {user?.role === 'admin' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Create User
          </button>
        )}
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-slate-400 mt-4">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No Users Found</h3>
            <p className="text-slate-400 text-sm">Create a user to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-600 flex items-center justify-center text-sm font-semibold text-white">
                          {u.username?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{u.username}</p>
                          {u.id === user?.id && (
                            <p className="text-xs text-primary-400">(You)</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-300">{u.email}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${roleColors[u.role] || roleColors.user}`}>
                          {u.role}
                        </span>
                        {user?.role === 'admin' && u.id !== user?.id && (
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            disabled={actionLoading === u.id}
                            className="text-xs bg-slate-700 border border-slate-600 rounded text-slate-300 focus:outline-none focus:border-primary-500 px-1 py-0.5"
                          >
                            <option value="user">User</option>
                            <option value="operator">Operator</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-300">
                        {u.createdAt ? format(new Date(u.createdAt), 'MMM d, yyyy') : 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {user?.role === 'admin' && u.id !== user?.id && (
                          <button
                            onClick={() => handleDelete(u.id)}
                            disabled={actionLoading === u.id}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-rose-500/50 text-rose-400 hover:bg-rose-500/10 disabled:opacity-50 transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Create New User</h3>
              <button
                onClick={() => { setShowCreateModal(false); setError(null) }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30">
                <p className="text-sm text-rose-400">{error}</p>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  placeholder="Enter username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  placeholder="Enter email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  placeholder="Enter password (min 6 chars)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                >
                  <option value="user">User</option>
                  <option value="operator">Operator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setError(null) }}
                  className="flex-1 px-4 py-2.5 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'create'}
                  className="flex-1 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                >
                  {actionLoading === 'create' ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
