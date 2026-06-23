import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, Navigate } from 'react-router-dom'
import { signup } from '../features/auth/authSlice'
import { Shield, ArrowRight, Gift } from 'lucide-react'

function RegisterSkeleton() {
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
          <div className="skeleton h-10 rounded"></div>
          <div className="skeleton h-12 rounded"></div>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { user, initializing, submitting, error } = useSelector(s => s.auth)

  // Redirect to dashboard if already logged in
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />

  // Show skeleton while session is initializing
  if (initializing) return <RegisterSkeleton />

  const handleSubmit = async (e) => {
    e.preventDefault()
    const result = await dispatch(signup({ name, email, password }))
    if (signup.fulfilled.match(result)) {
      const role = result.payload?.role;
      navigate(role === 'admin' ? '/admin' : '/dashboard');
    }
  }

  return (
    <main className="auth-hero">
      <div className="hero-section auth-hero-top">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4" style={{ background: 'rgba(198, 162, 78, 0.12)' }}>
          <Shield size={28} style={{ color: 'var(--color-foil-gold)' }} strokeWidth={2} />
        </div>
        <h1 className="page-title mb-2">Create Account</h1>
        <p className="page-subtitle">Join Deresegn — get 20 Birr registration bonus</p>
        <div className="bonus-banner mt-4 max-w-sm mx-auto text-left">
          <Gift size={16} style={{ color: 'var(--color-foil-gold)' }} className="inline mr-2" />
          <span className="text-[13px]">New users receive <strong>20 Birr</strong> to try verification (registration bonus).</span>
        </div>
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
              <label className="label">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="John Doe"
                autoComplete="name"
                required
              />
            </div>

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
                autoComplete="new-password"
                minLength={8}
                required
              />
              <p className="helper-text">Minimum 8 characters</p>
            </div>

            <button 
              type="submit" 
              disabled={submitting} 
              className="btn-primary w-full flex items-center justify-center gap-2 mt-6"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-[var(--color-ink)] border-t-transparent rounded-full animate-spin" />
                  Registering...
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Sign In Link */}
        <p className="text-center text-[var(--text-sm)] text-[var(--color-text-secondary)] mt-6">
          Already have an account?{' '}
          <a href="/login" className="font-semibold" style={{ color: 'var(--color-foil-gold)' }}>
            Sign in
          </a>
        </p>
        </div>
      </div>
    </main>
  )
}
