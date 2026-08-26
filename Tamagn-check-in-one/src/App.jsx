import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { fetchSession } from './features/auth/authSlice'
import Navbar from './components/Navbar'
import SessionOpenPage from './components/SessionOpenPage'
import RouteFallback from './components/RouteFallback'
import { DashboardUiProvider } from './context/DashboardUiContext'
import ProtectedRoute from './components/ProtectedRoute'

// Route-level code splitting: each page ships as its own chunk so the initial
// bundle stays small and users only download the screens they visit.
const HomePage = lazy(() => import('./pages/HomePage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const CertificatePublicPage = lazy(() => import('./pages/CertificatePublicPage'))
const DeveloperApiPage = lazy(() => import('./pages/DeveloperApiPage'))
const MyAccountsPage = lazy(() => import('./pages/MyAccountsPage'))

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
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify/:token" element={<CertificatePublicPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/developer" element={<ProtectedRoute><DeveloperApiPage /></ProtectedRoute>} />
            <Route path="/accounts" element={<ProtectedRoute><MyAccountsPage /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute requireAdmin={true}><AdminDashboard /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </DashboardUiProvider>
  )
}
