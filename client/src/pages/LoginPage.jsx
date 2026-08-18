import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
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
  const { user, submitting, error } = useSelector((s) => s.auth)
  const { t, locale } = useLocale()
  const from = location.state?.from

  if (user) {
    return <Navigate to={postLoginPath(user.role, from)} replace />
  }

  const brandTitle = locale === 'am' ? t('home.titleAm') : t('auth.brand')
  const brandAlt = locale === 'am' ? 'Tamagn Check' : t('home.titleAm')

  const handleSubmit = async (e) => {
    e.preventDefault()
    await dispatch(login({ email, password }))
  }

  return (
    <main className="auth-hero overflow-x-hidden">
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20">
        <LangToggle />
      </div>

      <header className="hero-section auth-hero-top px-3 sm:px-4">
        <img
          src="/deresegn-logo.svg"
          alt={t('auth.brand')}
          width={64}
          height={64}
          className="mx-auto mb-4 rounded-[var(--radius-seal)] w-14 h-14 sm:w-16 sm:h-16"
        />
        <h1 className="page-title mb-0 break-words">{brandTitle}</h1>
        <p className="brand-alt">{brandAlt}</p>
        <p className="page-subtitle px-1">{t('auth.loginSubtitle')}</p>
      </header>

      <div className="auth-hero-body px-3 sm:px-4">
        <div className="w-full max-w-sm mx-auto">
          <div className="auth-form-card space-y-5">
            {error && (
              <div className="alert alert-error">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm break-words">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="label" htmlFor="login-email">{t('auth.email')}</label>
                <input
                  id="login-email"
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
                <label className="label" htmlFor="login-password">{t('auth.password')}</label>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <div className="text-right mt-1.5">
                  <Link to="/forgot-password" className="text-sm font-medium" style={{ color: 'var(--color-birr-green)' }}>
                    {t('auth.forgotLink')}
                  </Link>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full flex items-center justify-center gap-2 mt-2 min-h-11"
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

          <p className="auth-footer-links px-2">
            <Link to="/">{t('auth.backHome')}</Link>
            {' · '}
            {t('auth.noAccount')}{' '}
            <Link
              to="/register"
              onClick={(e) => {
                if (from) {
                  e.preventDefault()
                  navigate('/register', { state: { from } })
                }
              }}
            >
              {t('auth.createOne')}
            </Link>
          </p>
          <AuthSeoBlurb />
        </div>
      </div>
    </main>
  )
}
