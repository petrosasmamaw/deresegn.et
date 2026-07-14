import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { logout } from '../features/auth/authSlice'
import { LogOut, Plus } from 'lucide-react'
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

  const handleLogout = async () => {
    await dispatch(logout())
    navigate('/login')
  }

  return (
    <nav className="navbar navbar-mobile-compact">
      <div className="container mx-auto px-4 navbar-inner flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 flex-shrink-0 min-w-0">
          <img
            src="/deresegn-logo.svg"
            alt={t('nav.logoAlt')}
            width={28}
            height={28}
            className="rounded-md flex-shrink-0"
          />
          <a href="/" className="navbar-brand truncate">
            {t('nav.brand')}
          </a>
        </div>

        <div className="flex items-center gap-2 md:gap-3 ml-auto flex-shrink-0">
          <LangToggle />

          {user ? (
            <>
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

              <span className="hidden md:inline navbar-user font-medium max-w-xs truncate">
                {user.email || user.name}
              </span>

              <button
                onClick={handleLogout}
                className="btn-ghost px-2 md:px-3 flex items-center gap-2"
                title={t('nav.logout')}
                aria-label={t('nav.logout')}
              >
                <LogOut size={18} strokeWidth={2} />
                <span className="hidden sm:inline text-sm">{t('nav.logout')}</span>
              </button>
            </>
          ) : (
            <a href="/login" className="btn-primary text-sm">
              {t('nav.signIn')}
            </a>
          )}
        </div>
      </div>
    </nav>
  )
}
