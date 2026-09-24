import { Suspense, lazy, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import RouteFallback from './components/RouteFallback'
import { DashboardUiProvider } from './context/DashboardUiContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import { fetchSession } from './features/auth/authSlice'

// Route-level code splitting: each page ships as its own chunk so the initial
// bundle stays small and users only download the screens they visit.
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const CertificatePublicPage = lazy(() => import('./pages/CertificatePublicPage'))
const DeveloperApiPage = lazy(() => import('./pages/DeveloperApiPage'))
const MyAccountsPage = lazy(() => import('./pages/MyAccountsPage'))
const FinancialDashboardPage = lazy(() => import('./pages/FinancialDashboardPage'))

export default function App() {
  const dispatch = useDispatch()
  const location = useLocation()
  const { user } = useSelector((s) => s.auth)
  const isLandingPage = location.pathname === '/'

  useEffect(() => {
    dispatch(fetchSession())
  }, [dispatch])

  return (
    <DashboardUiProvider>
      {user && user.role !== 'admin' && !isLandingPage && <Navbar />}
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
            <Route path="/finance" element={<ProtectedRoute><FinancialDashboardPage /></ProtectedRoute>} />
            <Route path="/financial" element={<ProtectedRoute><FinancialDashboardPage /></ProtectedRoute>} />
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
