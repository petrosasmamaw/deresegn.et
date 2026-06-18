import { useSelector } from 'react-redux'
import { Navigate } from 'react-router-dom'

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--color-bg-base)] to-[var(--color-bg-subtle)] p-4">
      <div className="container mx-auto">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="skeleton h-4 w-24 rounded mb-2"></div>
          <div className="skeleton h-8 w-48 rounded"></div>
        </div>

        {/* Balance Card Skeleton */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="md:col-span-2 skeleton-card"></div>
          <div className="skeleton-card"></div>
        </div>

        {/* Table Skeleton */}
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

  if (initializing) {
    return <DashboardSkeleton />
  }

  if (!user) return <Navigate to="/login" replace />

  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
