import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { signup } from '../features/auth/authSlice'
import { ReceiptText } from 'lucide-react'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { submitting, error } = useSelector(s => s.auth)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const result = await dispatch(signup({ name, email, password }))
    if (signup.fulfilled.match(result)) navigate('/dashboard')
  }

  return (
    <main className="flex-1 flex items-center justify-center bg-gradient-to-br from-[var(--color-bg-base)] to-[var(--color-bg-subtle)] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-lg mb-4" style={{ background: 'var(--color-accent-muted)' }}>
            <ReceiptText size={32} style={{ color: 'var(--color-accent)' }} />
          </div>
          <h1 className="page-title mb-2">Create Account</h1>
          <p className="page-subtitle">Join Deresegn to verify receipts</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && <div className="alert alert-error">{error}</div>}

          <div>
            <label className="label">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="Demo User"
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
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Registering…' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-[var(--text-sm)] text-[var(--color-text-secondary)] mt-6">
          Already have an account?{' '}
          <a href="/login" className="font-medium" style={{ color: 'var(--color-accent)' }}>
            Sign in
          </a>
        </p>
      </div>
    </main>
  )
}
