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
import ProtectedRoute from './components/ProtectedRoute'

function postAuthPath(user) {
  if (!user) return '/login'
  return user.role === 'admin' ? '/admin' : '/dashboard'
}

/** After session resolve on `/`, send guests to login and members to their home. */
function BootLanding({ user }) {
  const location = useLocation()
  const [to, setTo] = useState(null)
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    if (location.pathname !== '/') return
    done.current = true
    setTo(postAuthPath(user))
  }, [user, location.pathname])

  if (!to) return null
  return <Navigate to={to} replace />
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
          <Route path="/admin" element={<ProtectedRoute requireAdmin={true}><AdminDashboard /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </DashboardUiProvider>
  )
}
