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
          <div className="p-2 rounded-lg" style={{ background: 'var(--color-primary-muted)' }}>
            <Shield size={20} style={{ color: 'var(--color-primary)' }} strokeWidth={2} />
          </div>
          <a href="/" className="font-display font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>
            Deresegn
          </a>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4 ml-auto">
          {user ? (
            <>
              {/* Balance Chip */}
              <div 
                className="badge badge-accent px-4 py-2"
                style={{
                  background: 'var(--color-primary-muted)',
                  color: 'var(--color-primary)',
                  borderColor: 'var(--color-primary-border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Shield size={16} strokeWidth={2} />
                <span className="font-mono font-bold">{balance}</span>
                <span className="text-xs font-semibold uppercase">units</span>
              </div>

              {/* User Email (desktop) */}
              <span className="hidden md:inline text-[var(--text-sm)] text-[var(--color-text-secondary)] font-medium max-w-xs truncate">
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
