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
          src="/deresegn-logo.svg"
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
          <nav className="card flex flex-wrap gap-2 p-3 justify-center" aria-label="Quick links">
            <a href="#verify-deresegn" className="btn-secondary">Verify Deresegn</a>
            <a href="#topup" className="btn-secondary">Topup</a>
            <a href="#register" className="btn-secondary">Register</a>
            <a href="#login" className="btn-secondary">Login</a>
          </nav>

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

          <section id="verify-deresegn" className="sr-only">
            <h2>Verify Deresegn</h2>
            <p>Verify Ethiopian receipts by screenshot, payment ID, QR, and SMS after login.</p>
            <a href={`${SITE_URL}/login`}>Open verify deresegn</a>
          </section>

          <section id="topup" className="sr-only">
            <h2>Topup</h2>
            <p>Top up your account balance to run more verifications.</p>
            <a href={`${SITE_URL}/login`}>Open topup</a>
          </section>

          <section id="register" className="sr-only">
            <h2>Register</h2>
            <a href={`${SITE_URL}/register`}>Open register</a>
          </section>

          <section id="login" className="sr-only">
            <h2>Login</h2>
            <a href={`${SITE_URL}/login`}>Open login</a>
          </section>
        </div>
      </div>

      {/* Structured nav for search engines */}
      <footer className="sr-only">
        <a href={`${SITE_URL}/#verify-deresegn`}>Verify Deresegn</a>
        <a href={`${SITE_URL}/#topup`}>Topup</a>
        <a href={`${SITE_URL}/login`}>Login to Check Deresegn</a>
        <a href={`${SITE_URL}/register`}>Register for Deresegn Check</a>
      </footer>
    </main>
  )
}
