import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { logout } from '../features/auth/authSlice'
import { LogOut, Plus, KeyRound, Menu, X } from 'lucide-react'
import { useDashboardUi } from '../context/DashboardUiContext'
import { useLocale } from '../i18n/LocaleContext'
import LangToggle from './LangToggle'

export default function Navbar() {
  const user = useSelector(s => s.auth.user)
  const balance = useSelector(s => s.balance.current)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { openTopUp } = useDashboardUi()
  const { t } = useLocale()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const handleLogout = async () => {
    setMenuOpen(false)
    await dispatch(logout())
    navigate('/login')
  }

  const go = (path) => {
    setMenuOpen(false)
    navigate(path)
  }

  return (
    <nav className="navbar navbar-mobile-compact">
      <div className="container mx-auto px-3 sm:px-4 navbar-inner flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
          <img
            src="/deresegn-logo.svg"
            alt={t('nav.logoAlt')}
            width={28}
            height={28}
            className="rounded-md flex-shrink-0 w-7 h-7"
          />
          <a href="/dashboard" className="navbar-brand truncate max-w-[9rem] sm:max-w-none">
            {t('nav.brand')}
          </a>
        </div>

        {/* Desktop / tablet bar */}
        <div className="hidden md:flex items-center gap-2 md:gap-3 ml-auto flex-shrink-0">
          <LangToggle />

          {user ? (
            <>
              <button
                type="button"
                onClick={() => navigate('/developer')}
                className="btn-ghost px-2 md:px-3 flex items-center gap-1.5"
                title={t('nav.getApi')}
                aria-label={t('nav.getApi')}
              >
                <KeyRound size={17} strokeWidth={2} />
                <span className="hidden lg:inline text-sm">{t('nav.getApi')}</span>
              </button>

              <button
                type="button"
                onClick={openTopUp}
                className="credit-pill credit-pill-mobile credit-pill-btn"
                title={t('nav.topUpTitle')}
                aria-label={t('nav.balanceAria', { balance })}
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: 'var(--color-verified)' }}
                />
                <span>{balance}</span>
                <span className="text-[10px] opacity-75 uppercase tracking-wide">{t('common.birr')}</span>
                <Plus size={12} className="credit-pill-plus" strokeWidth={2.5} />
              </button>

              <span className="hidden lg:inline navbar-user font-medium max-w-xs truncate">
                {user.email || user.name}
              </span>

              <button
                onClick={handleLogout}
                className="btn-ghost px-2 md:px-3 flex items-center gap-2"
                title={t('nav.logout')}
                aria-label={t('nav.logout')}
              >
                <LogOut size={18} strokeWidth={2} />
                <span className="hidden lg:inline text-sm">{t('nav.logout')}</span>
              </button>
            </>
          ) : (
            <a href="/login" className="btn-primary text-sm">
              {t('nav.signIn')}
            </a>
          )}
        </div>

        {/* Mobile compact controls */}
        <div className="flex md:hidden items-center gap-1.5 ml-auto flex-shrink-0">
          <LangToggle />
          {user && (
            <button
              type="button"
              onClick={openTopUp}
              className="credit-pill credit-pill-mobile credit-pill-btn"
              title={t('nav.topUpTitle')}
              aria-label={t('nav.balanceAria', { balance })}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: 'var(--color-verified)' }}
              />
              <span>{balance}</span>
              <Plus size={12} className="credit-pill-plus" strokeWidth={2.5} />
            </button>
          )}
          <button
            type="button"
            className="btn-ghost px-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t" style={{ borderColor: 'rgba(198, 162, 78, 0.25)' }}>
          <div className="container mx-auto px-3 py-3 flex flex-col gap-2">
            {user ? (
              <>
                <p className="navbar-user text-xs truncate px-1 pb-1">{user.email || user.name}</p>
                <button
                  type="button"
                  onClick={() => go('/developer')}
                  className="btn-ghost w-full justify-start gap-2"
                >
                  <KeyRound size={17} />
                  {t('nav.getApi')}
                </button>
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); openTopUp() }}
                  className="btn-ghost w-full justify-start gap-2"
                >
                  <Plus size={17} />
                  {t('nav.topUpTitle')}
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="btn-ghost w-full justify-start gap-2"
                >
                  <LogOut size={17} />
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <a href="/login" className="btn-primary w-full text-center" onClick={() => setMenuOpen(false)}>
                {t('nav.signIn')}
              </a>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
