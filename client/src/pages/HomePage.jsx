import { Link, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { Shield, LogIn, UserPlus, CheckCircle2, KeyRound } from 'lucide-react'
import AuthSeoBlurb from '../components/AuthSeoBlurb'
import LangToggle from '../components/LangToggle'
import { useLocale } from '../i18n/LocaleContext'
import { AuthPageSkeleton } from '../components/PageSkeletons'

const SITE_URL = 'https://tamagncheck.online'

export default function HomePage() {
  const { user, initializing } = useSelector((s) => s.auth)
  const { t, locale } = useLocale()

  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />
  }

  // Session boot uses SessionOpenPage in App — keep AuthPageSkeleton only if
  // this page is somehow reached while auth is still initializing.
  if (initializing) {
    return <AuthPageSkeleton />
  }

  const brandTitle = locale === 'am' ? t('home.titleAm') : t('home.title')

  return (
    <main className="auth-hero min-h-screen overflow-x-hidden">
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20">
        <LangToggle />
      </div>

      <header className="hero-section auth-hero-top text-center px-3 sm:px-4">
        <img
          src="/deresegn-logo.svg"
          alt={t('home.logoAlt')}
          width={96}
          height={96}
          className="mx-auto mb-4 sm:mb-5 rounded-2xl shadow-md w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24"
        />
        <h1 className="page-title mb-1 break-words">{brandTitle}</h1>
        {locale !== 'am' && (
          <p className="text-base sm:text-lg font-semibold mb-2" style={{ color: 'var(--color-foil-gold)' }}>
            {t('home.titleAm')}
          </p>
        )}
        {locale === 'am' && (
          <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-foil-gold)' }}>
            Tamagn Tech
          </p>
        )}
        <p className="page-subtitle max-w-lg mx-auto px-1">
          {t('home.subtitle')}
        </p>
      </header>

      <div className="auth-hero-body px-3 sm:px-4 pb-8 sm:pb-10">
        <div className="w-full max-w-md mx-auto space-y-3 sm:space-y-4">
          <nav className="card flex flex-wrap gap-2 p-3 justify-center" aria-label={t('home.quickLinks')}>
            <Link to="/developer" className="btn-secondary text-sm flex-1 min-w-[7.5rem] sm:flex-none">{t('home.getApi')}</Link>
            <Link to="/login" className="btn-secondary text-sm flex-1 min-w-[7.5rem] sm:flex-none">{t('home.login')}</Link>
            <Link to="/register" className="btn-secondary text-sm flex-1 min-w-[7.5rem] sm:flex-none">{t('home.register')}</Link>
            <a href="#verify-receipt" className="btn-secondary text-sm flex-1 min-w-[7.5rem] sm:flex-none">{t('home.verify')}</a>
          </nav>

          <nav className="card flex flex-col gap-3 p-3 sm:p-4" aria-label={t('home.mainNav')}>
            <Link to="/developer" className="btn-primary flex items-center justify-center gap-2">
              <KeyRound size={18} />
              {t('home.getApi')}
            </Link>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/login" className="btn-secondary flex-1 flex items-center justify-center gap-2">
                <LogIn size={18} />
                {t('home.login')}
              </Link>
              <Link to="/register" className="btn-secondary flex-1 flex items-center justify-center gap-2">
                <UserPlus size={18} />
                {t('home.register')}
              </Link>
            </div>
          </nav>

          <div className="card space-y-3">
            <p className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--color-birr-green)' }}>
              <Shield size={16} className="shrink-0" />
              {t('home.whyTitle')}
            </p>
            <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--color-verified)' }} />
                <span className="min-w-0">{t('home.why1')}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--color-verified)' }} />
                <span className="min-w-0">{t('home.why2')}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--color-verified)' }} />
                <span className="min-w-0">{t('home.why3')}</span>
              </li>
            </ul>
          </div>

          <AuthSeoBlurb />

          <section id="verify-receipt" className="sr-only">
            <h2>{t('home.verify')}</h2>
            <a href={`${SITE_URL}/login`}>{t('home.verify')}</a>
          </section>
          <section id="get-api" className="sr-only">
            <h2>{t('home.getApi')}</h2>
            <a href={`${SITE_URL}/developer`}>{t('home.getApi')}</a>
          </section>
          <section id="register" className="sr-only">
            <h2>{t('home.register')}</h2>
            <a href={`${SITE_URL}/register`}>{t('home.register')}</a>
          </section>
          <section id="login" className="sr-only">
            <h2>{t('home.login')}</h2>
            <a href={`${SITE_URL}/login`}>{t('home.login')}</a>
          </section>
        </div>
      </div>
    </main>
  )
}
