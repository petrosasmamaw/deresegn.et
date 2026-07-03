import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { logout } from '../features/auth/authSlice'
import { LogOut, Plus } from 'lucide-react'
import { useDashboardUi } from '../context/DashboardUiContext'

export default function Navbar() {
  const user = useSelector(s => s.auth.user)
  const balance = useSelector(s => s.balance.current)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { openTopUp } = useDashboardUi()

  const handleLogout = async () => {
    await dispatch(logout())
    navigate('/login')
  }

  return (
    <nav className="navbar navbar-mobile-compact">
      <div className="container mx-auto px-4 navbar-inner flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2.5 flex-shrink-0 min-w-0">
          <img
            src="/deresegn-logo.svg"
            alt="Deresegn logo"
            width={28}
            height={28}
            className="rounded-md flex-shrink-0"
          />
          <a href="/" className="navbar-brand truncate">
            Deresegn
          </a>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2 md:gap-4 ml-auto flex-shrink-0">
          {user ? (
            <>
              <button
                type="button"
                onClick={openTopUp}
                className="credit-pill credit-pill-mobile credit-pill-btn"
                title="Top up balance"
                aria-label={`Balance ${balance} Birr. Click to top up`}
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: 'var(--color-verified)' }}
                />
                <span>{balance}</span>
                <span className="text-[10px] opacity-75 uppercase tracking-wide">Birr</span>
                <Plus size={12} className="credit-pill-plus" strokeWidth={2.5} />
              </button>

              <span className="hidden md:inline navbar-user font-medium max-w-xs truncate">
                {user.email || user.name}
              </span>

              <button
                onClick={handleLogout}
                className="btn-ghost px-2 md:px-3 flex items-center gap-2"
                title="Logout"
                aria-label="Logout"
              >
                <LogOut size={18} strokeWidth={2} />
                <span className="hidden sm:inline text-sm">Logout</span>
              </button>
            </>
          ) : (
            <a href="/login" className="btn-primary text-sm">
              Sign In
            </a>
          )}
        </div>
      </div>
    </nav>
  )
}
