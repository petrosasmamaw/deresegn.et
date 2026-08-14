import { useCallback, useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { fetchSession } from './features/auth/authSlice'
import Navbar from './components/Navbar'
import SessionOpenPage from './components/SessionOpenPage'
import { DashboardUiProvider } from './context/DashboardUiContext'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import AdminDashboard from './pages/AdminDashboard'
import CertificatePublicPage from './pages/CertificatePublicPage'
import DeveloperApiPage from './pages/DeveloperApiPage'
import MyAccountsPage from './pages/MyAccountsPage'
import ProtectedRoute from './components/ProtectedRoute'

function postAuthPath(user) {
  if (!user) return '/login'
  return user.role === 'admin' ? '/admin' : '/dashboard'
}

/**
 * One-shot redirect from `/` after session gate.
 * Must NOT keep rendering <Navigate> after the user leaves `/` —
 * that caused login↔dashboard vibration loops.
 */
function BootLanding({ user }) {
  const location = useLocation()
  const applied = useRef(false)

  if (applied.current || location.pathname !== '/') {
    return null
  }

  applied.current = true
  return <Navigate to={postAuthPath(user)} replace />
}

export default function App() {
  const dispatch = useDispatch()
  const { user, initializing } = useSelector((s) => s.auth)
  const [gateOpen, setGateOpen] = useState(true)

  useEffect(() => {
    dispatch(fetchSession())
  }, [dispatch])

  const finishOpen = useCallback(() => {
    setGateOpen(false)
  }, [])

  if (gateOpen) {
    return <SessionOpenPage ready={!initializing} onFinished={finishOpen} />
  }

  return (
    <DashboardUiProvider>
      <BootLanding user={user} />
      {user && user.role !== 'admin' && <Navbar />}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify/:token" element={<CertificatePublicPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/developer" element={<ProtectedRoute><DeveloperApiPage /></ProtectedRoute>} />
          <Route path="/accounts" element={<ProtectedRoute><MyAccountsPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute requireAdmin={true}><AdminDashboard /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </DashboardUiProvider>
  )
}
