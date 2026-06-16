import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, Navigate } from 'react-router-dom'
import { login } from '../features/auth/authSlice'
import { Shield, ArrowRight } from 'lucide-react'

function LoginSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--color-bg-base)] to-[var(--color-bg-subtle)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="skeleton w-14 h-14 rounded-xl mx-auto mb-4"></div>
          <div className="skeleton h-8 w-40 rounded mx-auto mb-2"></div>
          <div className="skeleton h-4 w-48 rounded mx-auto"></div>
        </div>
        <div className="card space-y-4">
          <div className="skeleton h-10 rounded"></div>
          <div className="skeleton h-10 rounded"></div>
          <div className="skeleton h-12 rounded"></div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { user, initializing, submitting, error } = useSelector(s => s.auth)

  // Redirect to dashboard if already logged in
  if (user) return <Navigate to="/dashboard" replace />

  // Show skeleton while session is initializing
  if (initializing) return <LoginSkeleton />

  const handleSubmit = async (e) => {
    e.preventDefault()
    const result = await dispatch(login({ email, password }))
    if (login.fulfilled.match(result)) navigate('/dashboard')
  }

  return (
    <main className="flex-1 flex items-center justify-center min-h-screen px-4 py-12" style={{ background: `linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)` }}>
      <div className="w-full max-w-sm">
        {/* Logo Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4" style={{ background: 'var(--color-primary-muted)' }}>
            <Shield size={28} style={{ color: 'var(--color-primary)' }} strokeWidth={2} />
          </div>
          <h1 className="page-title mb-2">Welcome Back</h1>
          <p className="page-subtitle">Secure receipt verification for your business</p>
        </div>

        {/* Form Card */}
        <div className="card space-y-5">
          {error && (
            <div className="alert alert-error">
              <div className="flex-1">
                <p className="font-semibold text-sm">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="your@email.com"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={submitting} 
              className="btn-primary w-full flex items-center justify-center gap-2 mt-6"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Logging in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Sign Up Link */}
        <p className="text-center text-[var(--text-sm)] text-[var(--color-text-secondary)] mt-6">
          Don't have an account?{' '}
          <a href="/register" className="font-semibold" style={{ color: 'var(--color-primary)' }}>
            Create one
          </a>
        </p>
      </div>
    </main>
  )
}
