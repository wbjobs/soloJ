import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { authApi } from '../services/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const login = useCallback(async (credentials) => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await authApi.login(credentials)
      const { token: newToken, user: newUser } = data
      setToken(newToken)
      setUser(newUser)
      localStorage.setItem('token', newToken)
      localStorage.setItem('user', JSON.stringify(newUser))
      return newUser
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed'
      setError(message)
      throw new Error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const register = useCallback(async (data) => {
    setLoading(true)
    setError(null)
    try {
      const { data: result } = await authApi.register(data)
      return result
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed'
      setError(message)
      throw new Error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem('token')
    if (stored && !user) {
      authApi.getMe()
        .then(({ data }) => {
          setUser(data)
          localStorage.setItem('user', JSON.stringify(data))
        })
        .catch(() => {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
        })
    }
  }, [])

  const value = { user, token, loading, error, login, register, logout }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export default AuthContext
