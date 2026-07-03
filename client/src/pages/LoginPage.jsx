import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, Navigate } from 'react-router-dom'
import { login } from '../features/auth/authSlice'
import { ArrowRight } from 'lucide-react'
import AuthSeoBlurb from '../components/AuthSeoBlurb'

function LoginSkeleton() {
  return (
    <div className="min-h-screen page-parchment flex items-center justify-center p-4">
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
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />

  // Show skeleton while session is initializing
  if (initializing) return <LoginSkeleton />

  const handleSubmit = async (e) => {
    e.preventDefault()
    const result = await dispatch(login({ email, password }))
    if (login.fulfilled.match(result)) {
      const role = result.payload?.role;
      navigate(role === 'admin' ? '/admin' : '/dashboard');
    }
  }

  return (
    <main className="auth-hero">
      <div className="hero-section auth-hero-top">
        <img
          src="/deresegn-logo.svg"
          alt="Check Deresegn"
          width={56}
          height={56}
          className="mx-auto mb-4 rounded-xl"
        />
        <h1 className="page-title mb-2">Check Deresegn</h1>
        <p className="page-subtitle">Ethiopia deresegn verification — Telebirr, CBE, Dashen &amp; BOA</p>
      </div>

      <div className="auth-hero-body">
        <div className="w-full max-w-sm mx-auto">
          {/* Form Card */}
          <div className="card space-y-5" style={{ boxShadow: 'var(--shadow-md)' }}>
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
                  <div className="w-4 h-4 border-2 border-[var(--color-ink)] border-t-transparent rounded-full animate-spin" />
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
          <a href="/" className="font-semibold" style={{ color: 'var(--color-foil-gold)' }}>← Home</a>
          {' · '}
          Don't have an account?{' '}
          <a href="/register" className="font-semibold" style={{ color: 'var(--color-foil-gold)' }}>
            Create one
          </a>
        </p>
        <AuthSeoBlurb />
        </div>
      </div>
    </main>
  )
}
