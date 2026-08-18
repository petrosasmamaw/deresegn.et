import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { authClient } from '../lib/authClient'
import AuthSeoBlurb from '../components/AuthSeoBlurb'
import LangToggle from '../components/LangToggle'
import { useLocale } from '../i18n/LocaleContext'

export default function ResetPasswordPage() {
  const { t, locale } = useLocale()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const invalidLink = searchParams.get('error') === 'INVALID_TOKEN'

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)

  const brandTitle = locale === 'am' ? t('home.titleAm') : t('auth.brand')
  const brandAlt = locale === 'am' ? 'Tamagn Check' : t('home.titleAm')

  if (!token && !invalidLink) {
    return <Navigate to="/forgot-password" replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError(t('auth.minPassword'))
      return
    }
    if (password !== confirm) {
      setError(t('auth.passwordMismatch'))
      return
    }

    setSubmitting(true)
    try {
      const { error: resetError } = await authClient.resetPassword({
        newPassword: password,
        token,
      })
      if (resetError) {
        setError(resetError.message || t('auth.resetFailed'))
        return
      }
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 2200)
    } catch (err) {
      setError(err?.message || t('auth.resetFailed'))
    } finally {
      setSubmitting(false)
    }
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
        <p className="page-subtitle px-1">{t('auth.resetSubtitle')}</p>
      </header>

      <div className="auth-hero-body px-3 sm:px-4">
        <div className="w-full max-w-sm mx-auto">
          <h2 className="section-title text-center mb-4" style={{ color: 'var(--color-birr-green)' }}>
            {t('auth.resetTitle')}
          </h2>

          <div className="auth-form-card space-y-5">
            {done ? (
              <div className="text-center space-y-4">
                <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full" style={{ background: 'rgba(15,77,58,0.1)' }}>
                  <CheckCircle2 size={24} style={{ color: 'var(--color-birr-green)' }} />
                </div>
                <p className="font-semibold text-sm">{t('auth.resetDoneTitle')}</p>
                <p className="helper-text">{t('auth.resetDoneBody')}</p>
              </div>
            ) : invalidLink ? (
              <div className="text-center space-y-4">
                <div className="alert alert-error">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm break-words">{t('auth.invalidResetLink')}</p>
                  </div>
                </div>
                <Link to="/forgot-password" className="btn-primary w-full flex items-center justify-center gap-2 min-h-11">
                  {t('auth.requestNewLink')}
                  <ArrowRight size={16} />
                </Link>
              </div>
            ) : (
              <>
                {error && (
                  <div className="alert alert-error">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm break-words">{error}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="label" htmlFor="reset-password">{t('auth.newPassword')}</label>
                    <input
                      id="reset-password"
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

                  <div>
                    <label className="label" htmlFor="reset-confirm">{t('auth.confirmPassword')}</label>
                    <input
                      id="reset-confirm"
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="input"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary w-full flex items-center justify-center gap-2 mt-2 min-h-11"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-[var(--color-ink)] border-t-transparent rounded-full animate-spin" />
                        {t('auth.resetting')}
                      </>
                    ) : (
                      <>
                        {t('auth.updatePassword')}
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>

          <p className="auth-footer-links px-2">
            <Link to="/login">{t('auth.backToLogin')}</Link>
          </p>
          <AuthSeoBlurb />
        </div>
      </div>
    </main>
  )
}
