import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { logout } from '../features/auth/authSlice'
import { LogOut, ReceiptText } from 'lucide-react'

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
      <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg" style={{ background: 'var(--color-accent-muted)' }}>
            <ReceiptText size={20} style={{ color: 'var(--color-accent)' }} />
          </div>
          <a href="/" className="font-display font-bold text-xl" style={{ color: 'var(--color-text-primary)' }}>
            Deresegn
          </a>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <div className="badge badge-accent">
                <ReceiptText size={14} strokeWidth={2} />
                <span className="font-mono font-semibold ml-2">{balance} units</span>
              </div>
              <span className="hidden md:inline text-[var(--text-sm)] text-[var(--color-text-secondary)]">
                {user.name}
              </span>
              <button
                onClick={handleLogout}
                className="btn-ghost flex items-center gap-2"
              >
                <LogOut size={16} strokeWidth={1.5} />
                <span className="hidden sm:inline">Logout</span>
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
