import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, Navigate } from 'react-router-dom'
import { signup } from '../features/auth/authSlice'
import { ArrowRight, Gift } from 'lucide-react'
import AuthSeoBlurb from '../components/AuthSeoBlurb'
import LangToggle from '../components/LangToggle'
import { useLocale } from '../i18n/LocaleContext'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { user, submitting, error } = useSelector(s => s.auth)
  const { t } = useLocale()

  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    const result = await dispatch(signup({ name, email, password }))
    if (signup.fulfilled.match(result)) {
      const role = result.payload?.role
      navigate(role === 'admin' ? '/admin' : '/dashboard')
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
        <h1 className="page-title mb-2">{t('auth.registerTitle')}</h1>
        <p className="page-subtitle">{t('auth.registerSubtitle')}</p>
        <div className="bonus-banner mt-4 max-w-sm mx-auto text-left">
          <Gift size={16} style={{ color: 'var(--color-foil-gold)' }} className="inline mr-2" />
          <span className="text-[13px]">{t('auth.bonusBanner', { amount: 20 })}</span>
        </div>
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
                <label className="label">{t('auth.fullName')}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  placeholder={t('auth.namePlaceholder')}
                  autoComplete="name"
                  required
                />
              </div>

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
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <p className="helper-text">{t('auth.minPassword')}</p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full flex items-center justify-center gap-2 mt-6"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[var(--color-ink)] border-t-transparent rounded-full animate-spin" />
                    {t('auth.registering')}
                  </>
                ) : (
                  <>
                    {t('auth.createAccount')}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="text-center text-[var(--text-sm)] text-[var(--color-text-secondary)] mt-6">
            <a href="/" className="font-semibold" style={{ color: 'var(--color-foil-gold)' }}>{t('auth.backHome')}</a>
            {' · '}
            {t('auth.haveAccount')}{' '}
            <a href="/login" className="font-semibold" style={{ color: 'var(--color-foil-gold)' }}>
              {t('auth.signIn')}
            </a>
          </p>
          <AuthSeoBlurb />
        </div>
      </div>
    </main>
  )
}
