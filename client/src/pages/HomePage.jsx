import { Link, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { Shield, LogIn, UserPlus, CheckCircle2 } from 'lucide-react'
import AuthSeoBlurb from '../components/AuthSeoBlurb'

const SITE_URL = 'https://check-deresegn-et.vercel.app'

export default function HomePage() {
  const { user } = useSelector((s) => s.auth)

  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />
  }

  return (
    <main className="auth-hero min-h-screen">
      <header className="hero-section auth-hero-top text-center px-4">
        <img
          src="/deresegn-logo.png"
          alt="Check Deresegn logo — Ethiopia receipt verification"
          width={96}
          height={96}
          className="mx-auto mb-5 rounded-2xl shadow-md"
        />
        <h1 className="page-title mb-3">Check Deresegn</h1>
        <p className="page-subtitle max-w-lg mx-auto">
          Ethiopia deresegn &amp; deresegn ethiopia receipt checker — verify Telebirr, CBE, Dashen
          &amp; Bank of Abyssinia payments online. ደረሰኝ ያረጋግጡ።
        </p>
      </header>

      <div className="auth-hero-body px-4 pb-10">
        <div className="w-full max-w-md mx-auto space-y-4">
          <nav className="card flex flex-col sm:flex-row gap-3 p-4" aria-label="Main navigation">
            <Link to="/login" className="btn-primary flex-1 flex items-center justify-center gap-2">
              <LogIn size={18} />
              Login
            </Link>
            <Link to="/register" className="btn-secondary flex-1 flex items-center justify-center gap-2">
              <UserPlus size={18} />
              Register
            </Link>
          </nav>

          <div className="card space-y-3">
            <p className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--color-birr-green)' }}>
              <Shield size={16} />
              Why Check Deresegn?
            </p>
            <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--color-verified)' }} />
                Deresegn check with screenshot, QR, payment ID, or SMS
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--color-verified)' }} />
                Shareable verification certificate for every valid receipt
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--color-verified)' }} />
                New users get 20 Birr registration bonus to try free
              </li>
            </ul>
          </div>

          <AuthSeoBlurb />
        </div>
      </div>

      {/* Structured nav for search engines */}
      <footer className="sr-only">
        <a href={`${SITE_URL}/login`}>Login to Check Deresegn</a>
        <a href={`${SITE_URL}/register`}>Register for Deresegn Check</a>
      </footer>
    </main>
  )
}
