import { useSelector } from 'react-redux'
import { Navigate } from 'react-router-dom'

export default function ProtectedRoute({ children }) {
  const { user, initializing } = useSelector((s) => s.auth)

  if (initializing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[var(--color-bg-base)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--color-accent)' }}></div>
        <p className="text-sm text-[var(--color-text-secondary)]">Loading session…</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return children
}
