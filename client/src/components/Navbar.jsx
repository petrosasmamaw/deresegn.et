import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { logout } from '../features/auth/authSlice'
import { LogOut, Shield } from 'lucide-react'

export default function Navbar() {
  const user = useSelector(s => s.auth.user)
  const balance = useSelector(s => s.balance.current)
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await dispatch(logout())
    navigate('/login')
  }

  return (
    <nav className="navbar">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-6">
        {/* Logo */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="p-2 rounded-lg" style={{ background: 'rgba(198, 162, 78, 0.12)' }}>
            <Shield size={20} style={{ color: 'var(--color-foil-gold)' }} strokeWidth={2} />
          </div>
          <a href="/" className="navbar-brand">
            Deresegn
          </a>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4 ml-auto">
          {user ? (
            <>
              {/* Balance Chip */}
              <div className="credit-pill">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ background: 'var(--color-verified)' }}
                />
                <span>{balance}</span>
                <span className="text-xs opacity-80">Birr</span>
              </div>

              {/* User Email (desktop) */}
              <span className="hidden md:inline navbar-user font-medium max-w-xs truncate">
                {user.email || user.name}
              </span>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="btn-ghost px-3 flex items-center gap-2"
                title="Logout"
              >
                <LogOut size={18} strokeWidth={2} />
                <span className="hidden sm:inline text-sm">Logout</span>
              </button>
            </>
          ) : (
            <a href="/login" className="btn-primary">
              Sign In
            </a>
          )}
        </div>
      </div>
    </nav>
  )
}
