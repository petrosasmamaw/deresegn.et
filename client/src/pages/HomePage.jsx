import { Link, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { Shield, LogIn, UserPlus, CheckCircle2 } from 'lucide-react'
import AuthSeoBlurb from '../components/AuthSeoBlurb'
import LangToggle from '../components/LangToggle'
import { useLocale } from '../i18n/LocaleContext'
import { AuthPageSkeleton } from '../components/PageSkeletons'

const SITE_URL = 'https://check-deresegn-et.vercel.app'

export default function HomePage() {
  const { user, initializing } = useSelector((s) => s.auth)
  const { t } = useLocale()

  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />
  }

  if (initializing) {
    return <AuthPageSkeleton />
  }

  return (
    <main className="auth-hero min-h-screen">
      <div className="absolute top-4 right-4 z-20">
        <LangToggle />
      </div>

      <header className="hero-section auth-hero-top text-center px-4">
        <img
          src="/deresegn-logo.svg"
          alt={t('home.logoAlt')}
          width={96}
          height={96}
          className="mx-auto mb-5 rounded-2xl shadow-md"
        />
        <h1 className="page-title mb-3">{t('home.title')}</h1>
        <p className="page-subtitle max-w-lg mx-auto">
          {t('home.subtitle')}
        </p>
      </header>

      <div className="auth-hero-body px-4 pb-10">
        <div className="w-full max-w-md mx-auto space-y-4">
          <nav className="card flex flex-wrap gap-2 p-3 justify-center" aria-label={t('home.quickLinks')}>
            <a href="#verify-deresegn" className="btn-secondary">{t('home.verify')}</a>
            <a href="#topup" className="btn-secondary">{t('home.topup')}</a>
            <a href="#register" className="btn-secondary">{t('home.register')}</a>
            <a href="#login" className="btn-secondary">{t('home.login')}</a>
          </nav>

          <nav className="card flex flex-col sm:flex-row gap-3 p-4" aria-label={t('home.mainNav')}>
            <Link to="/login" className="btn-primary flex-1 flex items-center justify-center gap-2">
              <LogIn size={18} />
              {t('home.login')}
            </Link>
            <Link to="/register" className="btn-secondary flex-1 flex items-center justify-center gap-2">
              <UserPlus size={18} />
              {t('home.register')}
            </Link>
          </nav>

          <div className="card space-y-3">
            <p className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--color-birr-green)' }}>
              <Shield size={16} />
              {t('home.whyTitle')}
            </p>
            <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--color-verified)' }} />
                {t('home.why1')}
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--color-verified)' }} />
                {t('home.why2')}
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--color-verified)' }} />
                {t('home.why3')}
              </li>
            </ul>
          </div>

          <AuthSeoBlurb />

          <section id="verify-deresegn" className="sr-only">
            <h2>{t('home.verify')}</h2>
            <a href={`${SITE_URL}/login`}>{t('home.verify')}</a>
          </section>
          <section id="topup" className="sr-only">
            <h2>{t('home.topup')}</h2>
            <a href={`${SITE_URL}/login`}>{t('home.topup')}</a>
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
