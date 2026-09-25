import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { logout } from '../features/auth/authSlice'
import { LogOut, Plus, KeyRound, Menu, X, Wallet, User, Home, ChevronDown, ShieldCheck, Coins, Globe } from 'lucide-react'
import { useDashboardUi } from '../context/DashboardUiContext'
import { useLocale } from '../i18n/LocaleContext'
import LangToggle from './LangToggle'

export default function Navbar() {
  const user = useSelector(s => s.auth.user)
  const balance = useSelector(s => s.balance.current)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { openTopUp } = useDashboardUi()
  const { t } = useLocale()
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const closeBtnRef = useRef(null)
  const profileRef = useRef(null)

  const closeMenu = () => setMenuOpen(false)

  // Click outside to close profile dropdown
  useEffect(() => {
    if (!profileOpen) return undefined
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false)
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setProfileOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', onKey)
    }
  }, [profileOpen])

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
    setProfileOpen(false)
    await dispatch(logout())
    navigate('/login')
  }

  const go = (path) => {
    closeMenu()
    setProfileOpen(false)
    navigate(path)
  }

  return (
    <>
      <nav className="navbar navbar-mobile-compact">
      <div className="navbar-inner container mx-auto px-3.5 sm:px-5 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-4">
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

        {/* Center: The Navigation & Balance Items (Verify, Finance, My Accounts, Get API, Balance Button) */}
        {user ? (
          <div className="hidden md:flex flex-1 items-center justify-center px-4">
            <div className="navbar-tools">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className={`navbar-tool ${location.pathname === '/dashboard' ? 'active' : ''}`}
                title="Verify"
                aria-label="Verify"
              >
                <ShieldCheck size={16} strokeWidth={2} />
                <span>Verify</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/finance')}
                className={`navbar-tool ${location.pathname.startsWith('/finance') ? 'active' : ''}`}
                title="Finance"
                aria-label="Finance"
              >
                <Coins size={16} strokeWidth={2} />
                <span>Finance</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/accounts')}
                className={`navbar-tool ${location.pathname === '/accounts' ? 'active' : ''}`}
                title={t('nav.myAccounts')}
                aria-label={t('nav.myAccounts')}
              >
                <Wallet size={16} strokeWidth={2} />
                <span>{t('nav.myAccounts')}</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/developer')}
                className={`navbar-tool ${location.pathname === '/developer' ? 'active' : ''}`}
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
            </div>
          </div>
        ) : null}

        {/* Right: Petros Client Profile Button with Dropdown (or Sign In if logged out) */}
        <div className="hidden md:flex items-center flex-shrink-0">
          {user ? (
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((prev) => !prev)}
                className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-full bg-white/90 hover:bg-white border border-[rgba(27,70,58,0.22)] shadow-xs transition-all cursor-pointer"
                title="Profile & Settings"
                aria-expanded={profileOpen}
              >
                <div className="w-6 h-6 rounded-full bg-[#1B463A] text-[#FAF8F5] flex items-center justify-center text-xs font-bold shrink-0">
                  {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-bold text-[#0E2420] max-w-[7.5rem] truncate">
                  {user.name || user.email?.split('@')[0]}
                </span>
                <ChevronDown
                  size={14}
                  className={`text-[#1B463A]/70 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-[#FAF8F5] border border-[rgba(27,70,58,0.18)] shadow-2xl backdrop-blur-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {/* User Info Header */}
                  <div className="px-3.5 py-3 rounded-xl bg-white border border-[rgba(27,70,58,0.08)] mb-2 shadow-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#1B463A] text-white flex items-center justify-center font-bold text-sm shrink-0">
                        {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-extrabold text-[#091A16] truncate" title={user.email}>
                          {user.email}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <ShieldCheck size={12} className="text-[#1B463A]" />
                          <span className="text-[10px] font-bold text-[#1B463A] uppercase tracking-wide">
                            Verified Member
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-[rgba(27,70,58,0.08)] flex items-center justify-between text-xs">
                      <span className="text-[#40564C] font-medium">Balance</span>
                      <span className="font-extrabold text-[#091A16]">{balance} {t('common.birr')}</span>
                    </div>
                  </div>

                  {/* Language Toggle inside dropdown */}
                  <div className="px-3.5 py-2 rounded-xl bg-white border border-[rgba(27,70,58,0.08)] mb-2 shadow-xs flex items-center justify-between">
                    <span className="text-xs font-bold text-[#40564C] flex items-center gap-1.5">
                      <Globe size={14} className="text-[#1B463A]" />
                      <span>Language / ቋንቋ</span>
                    </span>
                    <LangToggle />
                  </div>

                  {/* Menu Links */}
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => go('/')}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-[#1F362D] hover:text-[#091A16] hover:bg-white rounded-lg transition-colors text-left cursor-pointer"
                    >
                      <Home size={16} className="text-[#1B463A]" />
                      <span>Back to Home</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => go('/finance')}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-[#1F362D] hover:text-[#091A16] hover:bg-white rounded-lg transition-colors text-left cursor-pointer"
                    >
                      <Coins size={16} className="text-[#1B463A]" />
                      <span>Finance</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => go('/accounts')}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-[#1F362D] hover:text-[#091A16] hover:bg-white rounded-lg transition-colors text-left cursor-pointer"
                    >
                      <Wallet size={16} className="text-[#1B463A]" />
                      <span>{t('nav.myAccounts')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => go('/developer')}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-[#1F362D] hover:text-[#091A16] hover:bg-white rounded-lg transition-colors text-left cursor-pointer"
                    >
                      <KeyRound size={16} className="text-[#1B463A]" />
                      <span>{t('nav.getApi')}</span>
                    </button>
                  </div>

                  <div className="my-2 border-t border-[rgba(27,70,58,0.1)]" />

                  {/* Logout */}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors text-left cursor-pointer"
                  >
                    <LogOut size={16} className="text-red-600" />
                    <span>{t('nav.logout')}</span>
                  </button>
                </div>
              )}
            </div>
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
          <button
            type="button"
            onClick={() => {
              if (location.pathname !== '/dashboard') {
                navigate('/dashboard')
              } else {
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }
            }}
            className={`navbar-tool-mobile-verify ${location.pathname === '/dashboard' ? 'active' : ''}`}
            title="Verify"
            aria-label="Verify"
          >
            <ShieldCheck size={16} strokeWidth={2.2} />
            <span>Verify</span>
          </button>

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
            {/* Language toggle inside mobile drawer */}
            <div className="px-3 py-2 rounded-xl bg-white/10 border border-[rgba(198,162,78,0.25)] mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--color-parchment)] flex items-center gap-1.5">
                <Globe size={15} className="text-[#E4C977]" />
                <span>Language / ቋንቋ</span>
              </span>
              <LangToggle />
            </div>

            {user ? (
              <>
                <p className="nav-drawer-user">{user.email || user.name}</p>
                <button
                  type="button"
                  onClick={() => go('/')}
                  className="nav-drawer-link"
                  tabIndex={menuOpen ? 0 : -1}
                >
                  <Home size={18} strokeWidth={2} />
                  <span>Back to Home</span>
                </button>
                <button
                  type="button"
                  onClick={() => go('/dashboard')}
                  className="nav-drawer-link"
                  tabIndex={menuOpen ? 0 : -1}
                >
                  <ShieldCheck size={18} strokeWidth={2} />
                  <span>Verify</span>
                </button>
                <button
                  type="button"
                  onClick={() => { closeMenu(); openTopUp() }}
                  className="nav-drawer-link"
                  tabIndex={menuOpen ? 0 : -1}
                >
                  <Plus size={18} strokeWidth={2} />
                  {t('nav.topUpTitle')}
                </button>
                <button type="button" onClick={() => go('/finance')} className="nav-drawer-link" tabIndex={menuOpen ? 0 : -1}>
                  <Coins size={18} strokeWidth={2} />
                  <span>Finance</span>
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
    <div className="h-28 sm:h-36 w-full pointer-events-none" aria-hidden="true" />
  </>
  )
}
