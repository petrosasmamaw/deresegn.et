import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { ShieldCheck, Menu, X, ArrowRight } from 'lucide-react'
import LangToggle from './LangToggle'
import { useLocale } from '../i18n/LocaleContext'

export default function LandingNavbar() {
  const { user } = useSelector((s) => s.auth)
  const { t, locale } = useLocale()
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const top = window.pageYOffset || document.documentElement.scrollTop || window.scrollY || 0
      setScrolled(top > 20)
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleVerifyClick = (e) => {
    e.preventDefault()
    setMobileMenuOpen(false)
    if (user) {
      navigate(user.role === 'admin' ? '/admin' : '/dashboard')
    } else {
      navigate('/login', { state: { from: '/dashboard' } })
    }
  }

  const handleNavClick = (id) => {
    setMobileMenuOpen(false)
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const brandName = locale === 'am' ? 'ታማኝ ቸክ' : 'Tamagn Check'

  return (
    <header className={`landing-header ${scrolled ? 'landing-header--scrolled' : 'landing-header--top'}`}>
      {/* Sleek Floating Frosted Glass Box */}
      <div className="landing-nav-box">
        {/* Brand Logo & Name */}
        <Link
          to="/"
          className="flex items-center gap-2.5 sm:gap-3 group select-none text-decoration-none"
          style={{ textDecoration: 'none' }}
        >
          <div className="relative">
            <img
              src="/deresegn-logo.svg"
              alt="Deresegn Logo"
              width={38}
              height={38}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg shadow-md transition-transform duration-200 group-hover:scale-105"
            />
            <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-verified)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--color-verified)] border-2 border-[#0E2420]"></span>
            </span>
          </div>
          <div className="flex flex-col">
            <span className="landing-brand-title text-base sm:text-lg font-bold tracking-tight flex items-center gap-1.5 leading-tight transition-colors duration-200">
              {brandName}
              <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#C6A24E]/20 text-[#E4C977] border border-[#C6A24E]/40">
                .et
              </span>
            </span>
            <span className="landing-brand-sub text-[11px] leading-none transition-colors duration-200">
              {locale === 'am' ? 'ደረሰኝ ማረጋገጫ' : 'Digital Receipt Seal'}
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6" aria-label="Main Navigation">
          <button
            type="button"
            onClick={() => handleNavClick('features')}
            className="landing-nav-link text-sm font-medium transition-colors duration-200 cursor-pointer"
          >
            {t('home.navFeatures')}
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('live-engine')}
            className="landing-nav-link text-sm font-medium transition-colors duration-200 cursor-pointer flex items-center gap-1.5"
          >
            <span className="w-2 h-2 rounded-full animate-pulse bg-[var(--color-foil-gold)]" />
            {t('home.navEngine')}
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('banks')}
            className="landing-nav-link text-sm font-medium transition-colors duration-200 cursor-pointer"
          >
            {t('home.navBanks')}
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('api')}
            className="landing-nav-link text-sm font-medium transition-colors duration-200 cursor-pointer"
          >
            {t('home.navApi')}
          </button>
        </nav>

        {/* Action Buttons & Lang Toggle */}
        <div className="hidden sm:flex items-center gap-3">
          <LangToggle />

          {user ? (
            <Link
              to={user.role === 'admin' ? '/admin' : '/dashboard'}
              className="landing-btn-signin text-sm font-medium px-3.5 py-1.5 rounded-lg transition-all duration-200"
            >
              {t('home.navDashboard')}
            </Link>
          ) : (
            <Link
              to="/login"
              className="landing-btn-signin text-sm font-medium px-3.5 py-1.5 rounded-lg transition-all duration-200"
            >
              {t('auth.signIn')}
            </Link>
          )}

          <button
            type="button"
            onClick={handleVerifyClick}
            className="landing-btn-verify text-sm px-4 py-2 flex items-center gap-2 rounded-lg font-semibold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <ShieldCheck size={16} className="shrink-0" />
            <span>{t('home.navVerify')}</span>
            <ArrowRight size={14} className="opacity-80" />
          </button>
        </div>

        {/* Mobile Menu Toggle */}
        <div className="flex sm:hidden items-center gap-2">
          <LangToggle />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="landing-menu-toggle p-2 rounded-lg transition-colors duration-200 cursor-pointer text-[#1B463A] hover:bg-[rgba(27,70,58,0.08)] active:bg-[rgba(27,70,58,0.15)]"
            aria-label="Toggle Menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={22} className="text-[#1B463A]" /> : <Menu size={22} className="text-[#1B463A]" />}
          </button>
        </div>
      </div>

      {/* Mobile Slide-down Menu Box */}
      {mobileMenuOpen && (
        <div className="landing-mobile-panel space-y-3 sm:hidden animate-fade-in">
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => handleNavClick('features')}
              className="text-left py-2.5 px-3.5 text-sm font-semibold rounded-lg transition-colors text-[#0E2420] hover:text-[#1B463A] hover:bg-[rgba(27,70,58,0.07)] cursor-pointer"
            >
              {t('home.navFeatures')}
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('live-engine')}
              className="text-left py-2.5 px-3.5 text-sm font-semibold rounded-lg flex items-center justify-between transition-colors text-[#0E2420] hover:text-[#1B463A] hover:bg-[rgba(27,70,58,0.07)] cursor-pointer"
            >
              <span>{t('home.navEngine')}</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[rgba(27,70,58,0.08)] text-[#1B463A] border border-[rgba(27,70,58,0.2)]">
                Live
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('banks')}
              className="text-left py-2.5 px-3.5 text-sm font-semibold rounded-lg transition-colors text-[#0E2420] hover:text-[#1B463A] hover:bg-[rgba(27,70,58,0.07)] cursor-pointer"
            >
              {t('home.navBanks')}
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('api')}
              className="text-left py-2.5 px-3.5 text-sm font-semibold rounded-lg transition-colors text-[#0E2420] hover:text-[#1B463A] hover:bg-[rgba(27,70,58,0.07)] cursor-pointer"
            >
              {t('home.navApi')}
            </button>
          </div>

          <div className="pt-3 flex flex-col gap-2.5 border-t border-[rgba(27,70,58,0.12)]">
            <button
              type="button"
              onClick={handleVerifyClick}
              className="w-full py-2.5 flex items-center justify-center gap-2 text-sm font-bold rounded-lg shadow-md transition-all cursor-pointer bg-[#1B463A] text-white hover:bg-[#0E2420] active:scale-[0.99]"
            >
              <ShieldCheck size={18} />
              <span>{t('home.navVerify')}</span>
            </button>

            {user ? (
              <Link
                to={user.role === 'admin' ? '/admin' : '/dashboard'}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-2.5 text-center text-sm font-bold rounded-lg transition-all border border-[#1B463A] text-[#1B463A] hover:bg-[#1B463A] hover:text-white"
              >
                {t('home.navDashboard')}
              </Link>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-2.5 text-center text-sm font-bold rounded-lg transition-all border border-[#1B463A] text-[#1B463A] hover:bg-[#1B463A] hover:text-white"
              >
                {t('auth.signIn')}
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
