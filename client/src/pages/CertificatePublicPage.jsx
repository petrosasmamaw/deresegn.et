import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from '../api/axiosInstance'
import { unwrap } from '../api/unwrap'
import VerificationCertificate from '../components/VerificationCertificate'
import { ShieldCheck } from 'lucide-react'

export default function CertificatePublicPage() {
  const { token } = useParams()
  const [certificate, setCertificate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const res = await axios.get(`/check/certificate/${token}`)
        const data = unwrap(res)
        if (!cancelled) {
          setCertificate(data.certificate)
          setError(null)
        }
      } catch {
        if (!cancelled) setError('This verification certificate could not be found.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [token])

  return (
    <div className="min-h-screen page-parchment flex flex-col">
      <header className="navbar">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-display font-bold" style={{ color: 'var(--color-foil-gold)' }}>
            <ShieldCheck size={20} />
            Deresegn
          </Link>
          <Link to="/login" className="btn-secondary text-sm">Sign in</Link>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="page-title mb-2">Verification Certificate</h1>
        <p className="page-subtitle mb-6">Public proof that a payment was verified against official records.</p>

        {loading && <div className="skeleton-card" style={{ height: 280 }} />}
        {error && <div className="alert alert-error"><p>{error}</p></div>}
        {certificate && (
          <VerificationCertificate
            check={{
              id: certificate.id,
              transactionCode: certificate.transactionCode,
              amount: certificate.amount,
              senderName: certificate.senderName,
              receiverName: certificate.receiverName,
              paymentMethod: certificate.paymentMethod,
              confidenceTier: certificate.confidenceTier,
              createdAt: certificate.verifiedAt,
              shareToken: certificate.shareToken,
            }}
          />
        )}
      </main>
    </div>
  )
}
