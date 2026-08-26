import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, MailCheck } from 'lucide-react'
import { authClient } from '../lib/authClient'
import AuthSeoBlurb from '../components/AuthSeoBlurb'
import LangToggle from '../components/LangToggle'
import { useLocale } from '../i18n/LocaleContext'

export default function ForgotPasswordPage() {
  const { t, locale } = useLocale()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  const brandTitle = locale === 'am' ? t('home.titleAm') : t('auth.brand')
  const brandAlt = locale === 'am' ? 'Tamagn Check' : t('home.titleAm')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const { error: reqError } = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (reqError) {
        setError(reqError.message || t('auth.resetRequestFailed'))
        return
      }
      setSent(true)
    } catch (err) {
      setError(err?.message || t('auth.resetRequestFailed'))
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
        <p className="page-subtitle px-1">{t('auth.forgotSubtitle')}</p>
      </header>

      <div className="auth-hero-body px-3 sm:px-4">
        <div className="w-full max-w-sm mx-auto">
          <h2 className="section-title text-center mb-4" style={{ color: 'var(--color-birr-green)' }}>
            {t('auth.forgotTitle')}
          </h2>

          <div className="auth-form-card space-y-5">
            {sent ? (
              <div className="text-center space-y-4">
                <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full" style={{ background: 'rgba(15,77,58,0.1)' }}>
                  <MailCheck size={24} style={{ color: 'var(--color-birr-green)' }} />
                </div>
                <p className="font-semibold text-sm">{t('auth.resetSentTitle')}</p>
                <p className="helper-text">{t('auth.resetSentBody', { email: email.trim() })}</p>
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

                <p className="helper-text">{t('auth.forgotHelp')}</p>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="label" htmlFor="forgot-email">{t('auth.email')}</label>
                    <input
                      id="forgot-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input"
                      placeholder="your@email.com"
                      autoComplete="email"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !email.trim()}
                    className="btn-primary w-full flex items-center justify-center gap-2 mt-2 min-h-11"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-[var(--color-ink)] border-t-transparent rounded-full animate-spin" />
                        {t('auth.sending')}
                      </>
                    ) : (
                      <>
                        {t('auth.sendResetLink')}
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
