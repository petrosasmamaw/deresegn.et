import { useSelector } from 'react-redux'
import { Navigate, useLocation } from 'react-router-dom'

function DashboardSkeleton() {
  return (
    <div className="min-h-screen page-parchment p-4">
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
    </div>
  )
}

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, initializing } = useSelector((s) => s.auth)
  const location = useLocation()

  if (initializing) {
    return <DashboardSkeleton />
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
