import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from '../api/axiosInstance'
import { unwrap } from '../api/unwrap'
import VerificationCertificate from '../components/VerificationCertificate'
import LangToggle from '../components/LangToggle'
import { ShieldCheck } from 'lucide-react'
import { useLocale } from '../i18n/LocaleContext'

export default function CertificatePublicPage() {
  const { token } = useParams()
  const { t } = useLocale()
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
        if (!cancelled) setError('not_found')
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
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 font-display font-bold" style={{ color: 'var(--color-foil-gold)' }}>
            <ShieldCheck size={20} />
            {t('cert.brand')}
          </Link>
          <div className="flex items-center gap-2">
            <LangToggle />
            <Link to="/login" className="btn-secondary text-sm">{t('cert.signIn')}</Link>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="page-title mb-2">{t('cert.title')}</h1>
        <p className="page-subtitle mb-6">{t('cert.publicSubtitle')}</p>

        {loading && <div className="skeleton-card" style={{ height: 280 }} />}
        {error && <div className="alert alert-error"><p>{t('cert.notFound')}</p></div>}
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
