import { Link, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { LogIn, UserPlus, CheckCircle2, KeyRound } from 'lucide-react'
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

  if (initializing) {
    return <AuthPageSkeleton />
  }

  const brandTitle = locale === 'am' ? t('home.titleAm') : t('home.title')
  const brandAlt = locale === 'am' ? 'Tamagn Tech' : t('home.titleAm')

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
          className="mx-auto mb-4 sm:mb-5 rounded-[var(--radius-seal)] shadow-md w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24"
        />
        <h1 className="page-title mb-0 break-words">{brandTitle}</h1>
        <p className="brand-alt">{brandAlt}</p>
        <p className="page-subtitle max-w-lg mx-auto px-1">
          {t('home.subtitle')}
        </p>
      </header>

      <div className="auth-hero-body px-3 sm:px-4 pb-8 sm:pb-10">
        <div className="w-full max-w-md mx-auto space-y-7 sm:space-y-8">
          <nav className="flex flex-col gap-3" aria-label={t('home.mainNav')}>
            <Link to="/login" className="btn-primary flex items-center justify-center gap-2 min-h-11">
              <LogIn size={18} />
              {t('home.login')}
            </Link>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/register" className="btn-secondary flex-1 flex items-center justify-center gap-2 min-h-11">
                <UserPlus size={18} />
                {t('home.register')}
              </Link>
              <Link to="/developer" className="btn-secondary flex-1 flex items-center justify-center gap-2 min-h-11">
                <KeyRound size={18} />
                {t('home.getApi')}
              </Link>
            </div>
          </nav>

          <section aria-labelledby="home-why-title">
            <h2 id="home-why-title" className="section-title" style={{ color: 'var(--color-birr-green)' }}>
              {t('home.whyTitle')}
            </h2>
            <ul className="why-list mt-4">
              <li>
                <CheckCircle2 size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--color-verified)' }} />
                <span className="min-w-0">{t('home.why1')}</span>
              </li>
              <li>
                <CheckCircle2 size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--color-verified)' }} />
                <span className="min-w-0">{t('home.why2')}</span>
              </li>
              <li>
                <CheckCircle2 size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--color-verified)' }} />
                <span className="min-w-0">{t('home.why3')}</span>
              </li>
            </ul>
          </section>

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
