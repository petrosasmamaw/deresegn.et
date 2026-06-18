import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { logout } from '../features/auth/authSlice'
import { Shield, LogOut } from 'lucide-react'

export default function AdminNavbar({ user }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await dispatch(logout())
    navigate('/login')
  }

  return (
    <nav className="navbar border-b border-[var(--color-border)]">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg"
            style={{ background: 'var(--color-primary-muted)' }}
          >
            <Shield size={24} style={{ color: 'var(--color-primary)' }} strokeWidth={2} />
          </div>
          <div>
            <h1 className="font-display font-bold text-[var(--color-text-primary)]">Deresegn</h1>
            <p className="text-xs text-[var(--color-text-secondary)]">Admin Console</p>
          </div>
        </div>

        {/* User Info & Logout */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">{user?.name}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="btn-ghost px-3 flex items-center gap-2"
            title="Logout"
          >
            <LogOut size={18} strokeWidth={2} />
            <span className="hidden sm:inline text-sm">Logout</span>
          </button>
        </div>
      </div>
    </nav>
  )
}
