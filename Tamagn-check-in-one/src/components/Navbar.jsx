import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { logout } from '../features/auth/authSlice'
import { LogOut, Plus, KeyRound, Menu, X, Wallet } from 'lucide-react'
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
  const closeBtnRef = useRef(null)

  const closeMenu = () => setMenuOpen(false)

  useEffect(() => {
    if (!menuOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') closeMenu()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    closeBtnRef.current?.focus()
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const handleLogout = async () => {
    closeMenu()
    await dispatch(logout())
    navigate('/login')
  }

  const go = (path) => {
    closeMenu()
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
          <a href="/dashboard" className="navbar-brand truncate max-w-[11rem] sm:max-w-none">
            {t('nav.brand')}
          </a>
        </div>

        <div className="hidden md:flex items-center ml-auto flex-shrink-0">
          {user ? (
            <>
              <div className="navbar-tools">
                <button
                  type="button"
                  onClick={() => navigate('/accounts')}
                  className="navbar-tool"
                  title={t('nav.myAccounts')}
                  aria-label={t('nav.myAccounts')}
                >
                  <Wallet size={16} strokeWidth={2} />
                  <span>{t('nav.myAccounts')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/developer')}
                  className="navbar-tool"
                  title={t('nav.getApi')}
                  aria-label={t('nav.getApi')}
                >
                  <KeyRound size={16} strokeWidth={2} />
                  <span>{t('nav.getApi')}</span>
                </button>

                <div className="navbar-wallet">
                  <span className="credit-pill" title={t('nav.balanceAria', { balance })}>
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: 'var(--color-verified)' }}
                    />
                    <span>{balance}</span>
                    <span className="credit-pill-unit">{t('common.birr')}</span>
                  </span>
                  <button
                    type="button"
                    onClick={openTopUp}
                    className="navbar-topup"
                    title={t('nav.topUpTitle')}
                    aria-label={t('nav.topUpTitle')}
                  >
                    <Plus size={18} strokeWidth={2.75} />
                  </button>
                </div>

                <LangToggle />
              </div>

              <div className="navbar-session">
                <span className="navbar-user" title={user.email || user.name}>
                  {user.email || user.name}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="navbar-tool navbar-logout"
                  title={t('nav.logout')}
                  aria-label={t('nav.logout')}
                >
                  <LogOut size={16} strokeWidth={2} />
                  <span>{t('nav.logout')}</span>
                </button>
              </div>
            </>
          ) : (
            <div className="navbar-tools">
              <LangToggle />
              <a href="/login" className="btn-primary text-sm">
                {t('nav.signIn')}
              </a>
            </div>
          )}
        </div>

        <div className="flex md:hidden items-center gap-1.5 ml-auto flex-shrink-0">
          <LangToggle />
          {user && (
            <>
              <span className="credit-pill credit-pill-mobile">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: 'var(--color-verified)' }}
                />
                <span>{balance}</span>
              </span>
              <button
                type="button"
                onClick={openTopUp}
                className="navbar-topup navbar-topup-compact"
                title={t('nav.topUpTitle')}
                aria-label={t('nav.topUpTitle')}
              >
                <Plus size={20} strokeWidth={2.75} />
              </button>
            </>
          )}
          <button
            type="button"
            className="nav-menu-btn"
            aria-label={t('nav.openMenu')}
            aria-expanded={menuOpen}
            aria-controls="nav-drawer"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={22} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className={`nav-drawer-root md:hidden${menuOpen ? ' is-open' : ''}`} aria-hidden={!menuOpen}>
        <button
          type="button"
          className="nav-drawer-scrim"
          tabIndex={menuOpen ? 0 : -1}
          aria-label={t('nav.closeMenu')}
          onClick={closeMenu}
        />
        <aside
          id="nav-drawer"
          className="nav-drawer"
          role="dialog"
          aria-modal="true"
          aria-label={t('nav.brand')}
        >
          <div className="nav-drawer-head">
            <div className="nav-drawer-brand">
              <img src="/deresegn-logo.svg" alt="" width={32} height={32} />
              <span>{t('nav.brand')}</span>
            </div>
            <button
              ref={closeBtnRef}
              type="button"
              className="nav-drawer-close"
              aria-label={t('nav.closeMenu')}
              onClick={closeMenu}
              tabIndex={menuOpen ? 0 : -1}
            >
              <X size={20} strokeWidth={2.25} />
            </button>
          </div>

          <div className="nav-drawer-body">
            {user ? (
              <>
                <p className="nav-drawer-user">{user.email || user.name}</p>
                <button
                  type="button"
                  onClick={() => { closeMenu(); openTopUp() }}
                  className="nav-drawer-link"
                  tabIndex={menuOpen ? 0 : -1}
                >
                  <Plus size={18} strokeWidth={2} />
                  {t('nav.topUpTitle')}
                </button>
                <button type="button" onClick={() => go('/accounts')} className="nav-drawer-link" tabIndex={menuOpen ? 0 : -1}>
                  <Wallet size={18} strokeWidth={2} />
                  {t('nav.myAccounts')}
                </button>
                <button type="button" onClick={() => go('/developer')} className="nav-drawer-link" tabIndex={menuOpen ? 0 : -1}>
                  <KeyRound size={18} strokeWidth={2} />
                  {t('nav.getApi')}
                </button>
                <button type="button" onClick={handleLogout} className="nav-drawer-link nav-drawer-link-out" tabIndex={menuOpen ? 0 : -1}>
                  <LogOut size={18} strokeWidth={2} />
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <a href="/login" className="btn-primary w-full text-center" onClick={closeMenu} tabIndex={menuOpen ? 0 : -1}>
                {t('nav.signIn')}
              </a>
            )}
          </div>
        </aside>
      </div>
    </nav>
  )
}
