import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { DeviceProvider } from './context/DeviceContext.jsx'
import Header from './components/Common/Header.jsx'
import Sidebar from './components/Common/Sidebar.jsx'
import Login from './components/User/Login.jsx'
import UserManagement from './components/User/UserManagement.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Devices from './pages/Devices.jsx'
import Bitstreams from './pages/Bitstreams.jsx'
import Console from './pages/Console.jsx'
import Settings from './pages/Settings.jsx'
import LogicAnalyzer from './pages/LogicAnalyzer.jsx'
import Debugger from './pages/Debugger.jsx'
import Cluster from './pages/Cluster.jsx'

function ProtectedRoute({ children }) {
  const { user, token } = useAuth()
  if (!user || !token) return <Navigate to="/login" replace />
  return children
}

function AppLayout() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 bg-slate-900">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={
              <ProtectedRoute><Dashboard /></ProtectedRoute>
            } />
            <Route path="/devices" element={
              <ProtectedRoute><Devices /></ProtectedRoute>
            } />
            <Route path="/bitstreams" element={
              <ProtectedRoute><Bitstreams /></ProtectedRoute>
            } />
            <Route path="/console" element={
              <ProtectedRoute><Console /></ProtectedRoute>
            } />
            <Route path="/logic-analyzer" element={
              <ProtectedRoute><LogicAnalyzer /></ProtectedRoute>
            } />
            <Route path="/debugger" element={
              <ProtectedRoute><Debugger /></ProtectedRoute>
            } />
            <Route path="/cluster" element={
              <ProtectedRoute><Cluster /></ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute><Settings /></ProtectedRoute>
            } />
            <Route path="/users" element={
              <ProtectedRoute><UserManagement /></ProtectedRoute>
            } />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DeviceProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={<AppLayout />} />
          </Routes>
        </DeviceProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
