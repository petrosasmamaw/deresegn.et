import { useLocation, useNavigate } from 'react-router-dom'
import { Coins, Wallet, ShieldCheck, History, KeyRound } from 'lucide-react'
import { useLocale } from '../i18n/LocaleContext'
import { useDashboardUiOptional } from '../context/DashboardUiContext'

export default function BottomNav({ activeTab: propActiveTab, onTabChange: propOnTabChange, onFabClick }) {
  const { t } = useLocale()
  const location = useLocation()
  const navigate = useNavigate()
  const ui = useDashboardUiOptional()

  const activeTab = propActiveTab !== undefined ? propActiveTab : (ui?.mobileTab ?? 'home')
  const setMobileTab = propOnTabChange || ui?.setMobileTab

  const path = location.pathname

  const isFinance = path.startsWith('/finance') || path.startsWith('/financial')
  const isAccounts = path === '/accounts'
  const isDeveloper = path === '/developer'
  const isDashboard = path === '/dashboard'
  const isHistory = isDashboard && activeTab === 'history'
  const isVerify = isDashboard && activeTab !== 'history'

  const handleNav = (targetPath, tabKey) => {
    if (path === targetPath) {
      if (tabKey && setMobileTab) {
        setMobileTab(tabKey)
      }
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    navigate(targetPath)
  }

  const handleFab = () => {
    if (onFabClick) {
      onFabClick()
      return
    }
    if (setMobileTab) setMobileTab('home')
    if (path !== '/dashboard') {
      navigate('/dashboard')
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleHistory = () => {
    if (setMobileTab) setMobileTab('history')
    if (path === '/dashboard') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      navigate('/dashboard?tab=history')
    }
  }

  return (
    <>
      <nav
        className="bottom-nav fixed bottom-0 left-0 right-0 z-40 md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Mobile Navigation"
      >
        <div className="relative">
          <div className="bottom-nav-inner">
            {/* 1. Finance */}
            <button
              type="button"
              onClick={() => handleNav('/finance')}
              className={`bottom-nav-tab${isFinance ? ' active' : ''}`}
              aria-label="Finance"
            >
              <Coins size={20} strokeWidth={isFinance ? 2.5 : 2} className={isFinance ? 'text-[#E4C977]' : ''} />
              <span className={isFinance ? 'font-black text-[#E4C977]' : ''}>Finance</span>
            </button>

            {/* 2. Accounts */}
            <button
              type="button"
              onClick={() => handleNav('/accounts')}
              className={`bottom-nav-tab${isAccounts ? ' active' : ''}`}
              aria-label={t('nav.myAccounts')}
            >
              <Wallet size={20} strokeWidth={isAccounts ? 2.5 : 2} className={isAccounts ? 'text-[#E4C977]' : ''} />
              <span className={isAccounts ? 'font-black text-[#E4C977]' : ''}>Accounts</span>
            </button>

            {/* 3. Center FAB spacer slot */}
            <div className="bottom-nav-fab-slot" aria-hidden="true" />

            {/* 4. History */}
            <button
              type="button"
              onClick={handleHistory}
              className={`bottom-nav-tab${isHistory ? ' active' : ''}`}
              aria-label="History"
            >
              <History size={20} strokeWidth={isHistory ? 2.5 : 2} className={isHistory ? 'text-[#E4C977]' : ''} />
              <span className={isHistory ? 'font-black text-[#E4C977]' : ''}>History</span>
            </button>

            {/* 5. API */}
            <button
              type="button"
              onClick={() => handleNav('/developer')}
              className={`bottom-nav-tab${isDeveloper ? ' active' : ''}`}
              aria-label={t('nav.getApi')}
            >
              <KeyRound size={20} strokeWidth={isDeveloper ? 2.5 : 2} className={isDeveloper ? 'text-[#E4C977]' : ''} />
              <span className={isDeveloper ? 'font-black text-[#E4C977]' : ''}>API</span>
            </button>
          </div>

          {/* Elevated Center FAB: Verify */}
          <button
            type="button"
            onClick={handleFab}
            className={`bottom-nav-fab${isVerify ? ' ring-2 ring-[#E4C977]' : ''}`}
            aria-label="Verify Receipt"
          >
            <ShieldCheck size={24} strokeWidth={2.5} className="text-[#E4C977]" />
            <span className="text-[10px] tracking-wider font-extrabold text-white">Verify</span>
          </button>
        </div>
      </nav>

      <div className="bottom-nav-spacer md:hidden" aria-hidden="true" />
    </>
  )
}
