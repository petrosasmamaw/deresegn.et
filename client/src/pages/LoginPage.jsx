import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { login } from '../features/auth/authSlice'
import { ReceiptText } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { loading, error } = useSelector(s => s.auth)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const result = await dispatch(login({ email, password }))
    if (login.fulfilled.match(result)) navigate('/dashboard')
  }

  return (
    <main className="flex-1 flex items-center justify-center bg-gradient-to-br from-[var(--color-bg-base)] to-[var(--color-bg-subtle)] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-lg mb-4" style={{ background: 'var(--color-accent-muted)' }}>
            <ReceiptText size={32} style={{ color: 'var(--color-accent)' }} />
          </div>
          <h1 className="page-title mb-2">Welcome Back</h1>
          <p className="page-subtitle">Sign in to verify receipts</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && <div className="alert alert-error">{error}</div>}

          <div>
            <label className="label">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="demo@deresegn.com"
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

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-[var(--text-sm)] text-[var(--color-text-secondary)] mt-6">
          Don't have an account?{' '}
          <a href="/register" className="font-medium" style={{ color: 'var(--color-accent)' }}>
            Create one
          </a>
        </p>
      </div>
    </main>
  )
}
