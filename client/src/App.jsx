import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Routes, Route, Navigate } from 'react-router-dom'
import { fetchSession } from './features/auth/authSlice'
import Navbar from './components/Navbar'
import { DashboardUiProvider } from './context/DashboardUiContext'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import AdminDashboard from './pages/AdminDashboard'
import ProtectedRoute from './components/ProtectedRoute'

function DashboardSkeleton() {
  return (
    <div className="min-h-screen page-parchment">
      <nav className="navbar">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="skeleton w-10 h-10 rounded-lg"></div>
            <div className="skeleton w-24 h-6 rounded"></div>
          </div>
          <div className="skeleton w-32 h-8 rounded ml-auto"></div>
        </div>
      </nav>

      <main className="flex-1 p-4">
        <div className="container mx-auto">
          <div className="mb-8">
            <div className="skeleton h-4 w-24 rounded mb-2"></div>
            <div className="skeleton h-8 w-48 rounded"></div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="md:col-span-2 skeleton-card"></div>
            <div className="skeleton-card"></div>
          </div>

          <div className="card">
            <div className="skeleton h-6 w-40 rounded mb-4"></div>
            <div className="space-y-3">
              <div className="skeleton h-12 rounded"></div>
              <div className="skeleton h-12 rounded"></div>
              <div className="skeleton h-12 rounded"></div>
              <div className="skeleton h-12 rounded"></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  const dispatch = useDispatch()
  const { user, initializing } = useSelector(s => s.auth)

  useEffect(() => {
    dispatch(fetchSession())
  }, [dispatch])

  if (initializing) {
    return <DashboardSkeleton />
  }

  return (
    <DashboardUiProvider>
      {user && user.role !== 'admin' && <Navbar />}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace /> : <Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute requireAdmin={true}><AdminDashboard /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </DashboardUiProvider>
  )
}
