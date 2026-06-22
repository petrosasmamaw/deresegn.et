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
    <nav className="navbar">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg"
            style={{ background: 'rgba(198, 162, 78, 0.12)' }}
          >
            <Shield size={24} style={{ color: 'var(--color-foil-gold)' }} strokeWidth={2} />
          </div>
          <div>
            <h1 className="navbar-brand leading-tight">Deresegn</h1>
            <p className="text-xs" style={{ color: 'rgba(244, 238, 220, 0.5)' }}>Admin Console</p>
          </div>
        </div>

        {/* User Info & Logout */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold" style={{ color: 'var(--color-parchment)' }}>{user?.name}</p>
            <p className="text-xs navbar-user">{user?.email}</p>
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
