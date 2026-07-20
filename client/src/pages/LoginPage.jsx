import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, Navigate, useLocation } from 'react-router-dom'
import { login } from '../features/auth/authSlice'
import { ArrowRight } from 'lucide-react'
import AuthSeoBlurb from '../components/AuthSeoBlurb'
import LangToggle from '../components/LangToggle'
import { useLocale } from '../i18n/LocaleContext'

function postLoginPath(role, from) {
  if (role === 'admin') return '/admin'
  if (from && from !== '/login' && from !== '/register') return from
  return '/dashboard'
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, submitting, error } = useSelector(s => s.auth)
  const { t } = useLocale()
  const from = location.state?.from

  if (user) {
    return <Navigate to={postLoginPath(user.role, from)} replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const result = await dispatch(login({ email, password }))
    if (login.fulfilled.match(result)) {
      const role = result.payload?.role
      navigate(postLoginPath(role, from))
    }
  }

  return (
    <main className="auth-hero">
      <div className="absolute top-4 right-4 z-20">
        <LangToggle />
      </div>

      <div className="hero-section auth-hero-top">
        <img
          src="/deresegn-logo.svg"
          alt={t('auth.brand')}
          width={56}
          height={56}
          className="mx-auto mb-4 rounded-xl"
        />
        <h1 className="page-title mb-2">{t('auth.brand')}</h1>
        <p className="page-subtitle">{t('auth.loginSubtitle')}</p>
      </div>

      <div className="auth-hero-body">
        <div className="w-full max-w-sm mx-auto">
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
                <label className="label">{t('auth.email')}</label>
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
                <label className="label">{t('auth.password')}</label>
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
                    {t('auth.loggingIn')}
                  </>
                ) : (
                  <>
                    {t('auth.signIn')}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="text-center text-[var(--text-sm)] text-[var(--color-text-secondary)] mt-6">
            <a href="/" className="font-semibold" style={{ color: 'var(--color-foil-gold)' }}>{t('auth.backHome')}</a>
            {' · '}
            {t('auth.noAccount')}{' '}
            <a
              href="/register"
              className="font-semibold"
              style={{ color: 'var(--color-foil-gold)' }}
              onClick={(e) => {
                if (from) {
                  e.preventDefault()
                  navigate('/register', { state: { from } })
                }
              }}
            >
              {t('auth.createOne')}
            </a>
          </p>
          <AuthSeoBlurb />
        </div>
      </div>
    </main>
  )
}
