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
      <div className="container mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div
            className="p-2 rounded-lg flex-shrink-0"
            style={{ background: 'rgba(198, 162, 78, 0.12)' }}
          >
            <Shield size={22} style={{ color: 'var(--color-foil-gold)' }} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h1 className="navbar-brand leading-tight truncate">Tamagn Tech</h1>
            <p className="text-xs truncate" style={{ color: 'rgba(244, 238, 220, 0.5)' }}>Admin Console</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          <div className="text-right hidden sm:block min-w-0 max-w-[10rem] md:max-w-xs">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-parchment)' }}>{user?.name}</p>
            <p className="text-xs navbar-user truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="btn-ghost px-2 sm:px-3 flex items-center gap-2 min-h-[44px]"
            title="Logout"
            aria-label="Logout"
          >
            <LogOut size={18} strokeWidth={2} />
            <span className="hidden sm:inline text-sm">Logout</span>
          </button>
        </div>
      </div>
    </nav>
  )
}
