import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Navigate, Link } from 'react-router-dom'
import {
  KeyRound, Copy, Check, RefreshCw, Ban, AlertTriangle, Terminal, Shield,
  ArrowLeft, Sparkles, Wallet, Eye, EyeOff,
} from 'lucide-react'
import axios from '../api/axiosInstance'
import { unwrap } from '../api/unwrap'
import { fetchBalance } from '../features/balance/balanceSlice'
import { useDashboardUi } from '../context/DashboardUiContext'
import PricingTables from '../components/PricingTables'
import { getApiBaseUrl } from '../lib/apiBase'
import { useLocale } from '../i18n/LocaleContext'

const PACKAGE_ACCENTS = {
  starter: '#1B463A',
  growth: '#C6A24E',
  pro: '#0E2420',
  business: '#1B463A',
  enterprise: '#0E2420',
}

export default function DeveloperApiPage() {
  const { t } = useLocale()
  const user = useSelector((s) => s.auth.user)
  const balance = useSelector((s) => s.balance.current)
  const dispatch = useDispatch()
  const { openTopUp } = useDashboardUi()

  const [pricing, setPricing] = useState(null)
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [selectedPackage, setSelectedPackage] = useState('pro')
  const [freshSecret, setFreshSecret] = useState(null)
  const [copied, setCopied] = useState('')
  const [renewForId, setRenewForId] = useState(null)
  const [revealedKeys, setRevealedKeys] = useState({})
  const [visibleKeyIds, setVisibleKeyIds] = useState({})
  const [revealBusyId, setRevealBusyId] = useState(null)

  const apiBase = useMemo(() => getApiBaseUrl(), [])
  const verifyUrl = `${apiBase}/v1/verify/reference`

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await axios.get('/developer/keys')
      const data = unwrap(res)
      setKeys(data.keys || [])
      setPricing(data.pricing || null)
    } catch (err) {
      setError(err.response?.data?.message || err.message || t('dev.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    dispatch(fetchBalance())
    load()
  }, [dispatch])

  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'admin') return <Navigate to="/admin" replace />

  const copyText = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      setTimeout(() => setCopied(''), 1800)
    } catch {
      setError('Could not copy — select and copy manually')
    }
  }

  const buyOrRenew = async ({ renewKeyId } = {}) => {
    setBusy(true)
    setError(null)
    setFreshSecret(null)
    try {
      const res = renewKeyId
        ? await axios.post(`/developer/keys/${renewKeyId}/renew`, { packageId: selectedPackage })
        : await axios.post('/developer/keys', { packageId: selectedPackage })
      const data = unwrap(res)
      if (data.key?.apiKey) {
        setFreshSecret(data.key.apiKey)
        if (data.key.id) {
          setRevealedKeys((prev) => ({ ...prev, [data.key.id]: data.key.apiKey }))
        }
      }
      if (typeof data.newBalance === 'number') dispatch(fetchBalance())
      setRenewForId(null)
      await load()
    } catch (err) {
      const status = err.response?.status
      const msg = err.response?.data?.message || err.message
      setError(msg)
      if (status === 402) {
        // keep error visible; user can top up
      }
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (id) => {
    if (!window.confirm('Revoke this API key? External apps using it will stop working.')) return
    setBusy(true)
    try {
      await axios.post(`/developer/keys/${id}/revoke`)
      setRevealedKeys((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setVisibleKeyIds((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      await load()
    } catch (err) {
      setError(err.response?.data?.message || err.message)
    } finally {
      setBusy(false)
    }
  }

  const toggleRevealKey = async (k) => {
    const id = k.id
    if (visibleKeyIds[id]) {
      setVisibleKeyIds((prev) => ({ ...prev, [id]: false }))
      return
    }

    if (revealedKeys[id]) {
      setVisibleKeyIds((prev) => ({ ...prev, [id]: true }))
      return
    }

    if (freshSecret && k.keyPrefix && freshSecret.startsWith(k.keyPrefix)) {
      setRevealedKeys((prev) => ({ ...prev, [id]: freshSecret }))
      setVisibleKeyIds((prev) => ({ ...prev, [id]: true }))
      return
    }

    if (!k.canReveal) {
      setError('This older key cannot be recovered. Buy a new API key — you can reveal it anytime with the eye icon.')
      return
    }

    setRevealBusyId(id)
    setError(null)
    try {
      const res = await axios.post(`/developer/keys/${id}/reveal`)
      const data = unwrap(res)
      if (!data?.apiKey) throw new Error('No key returned')
      setRevealedKeys((prev) => ({ ...prev, [id]: data.apiKey }))
      setVisibleKeyIds((prev) => ({ ...prev, [id]: true }))
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not reveal API key')
    } finally {
      setRevealBusyId(null)
    }
  }

  const maskKey = (prefix) => {
    const base = prefix || 'dk_live_'
    return `${base}${'•'.repeat(Math.max(8, 28 - base.length))}`
  }

  const packages = pricing?.apiPackages || []

  return (
    <div className="page-parchment min-h-screen overflow-x-hidden">
      <div className="container mx-auto max-w-6xl px-3 sm:px-4 py-6 sm:py-8 pb-24">
        <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-start justify-between gap-4 mb-8">
          <div className="min-w-0 flex-1">
            <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm font-semibold mb-3" style={{ color: 'var(--color-foil-gold)' }}>
              <ArrowLeft size={16} /> {t('dev.backDashboard')}
            </Link>
            <p className="eyebrow mb-1">{t('dev.eyebrow')}</p>
            <h1 className="page-title flex items-center gap-2 flex-wrap">
              <KeyRound size={28} className="shrink-0" style={{ color: 'var(--color-foil-gold)' }} />
              <span className="break-words">{t('dev.title')}</span>
            </h1>
            <p className="page-subtitle max-w-2xl mt-2">
              {t('dev.lead')}
            </p>
          </div>
          <div className="stat-card w-full sm:w-auto sm:min-w-[160px] lg:shrink-0">
            <p className="eyebrow mb-1">{t('dev.wallet')}</p>
            <p className="balance-amount text-2xl">{Number(balance || 0).toFixed(2)}</p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">{t('dev.birrAvailable')}</p>
            <button type="button" className="btn-secondary w-full mt-3 text-sm" onClick={openTopUp}>
              <Wallet size={14} className="inline mr-1" /> {t('dev.topUp')}
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-error mb-6" role="alert">
            <AlertTriangle size={18} />
            <div className="flex-1">
              <p className="font-semibold text-sm">{error}</p>
              {/top up|insufficient/i.test(error) && (
                <button type="button" className="btn-primary text-xs mt-2" onClick={openTopUp}>{t('dev.topUpBalance')}</button>
              )}
            </div>
          </div>
        )}

        {freshSecret && (
          <div className="card mb-6 border-2" style={{ borderColor: 'var(--color-foil-gold)', background: 'rgba(198,162,78,0.08)' }}>
            <div className="flex items-start gap-3">
              <Sparkles size={20} style={{ color: 'var(--color-foil-gold)' }} />
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-sm mb-1">{t('dev.newKeyTitle')}</p>
                <p className="text-xs text-[var(--color-text-secondary)] mb-3">
                  {t('dev.newKeyHint')}
                </p>
                <div
                  className="flex items-center gap-2 rounded-lg px-3 py-2"
                  style={{ background: 'var(--color-ink)' }}
                >
                  <code className="flex-1 text-xs break-all font-mono" style={{ color: '#F4EEDC' }}>
                    {freshSecret}
                  </code>
                  <button
                    type="button"
                    className="shrink-0 p-1.5 rounded-md hover:bg-white/10"
                    style={{ color: '#F4EEDC' }}
                    onClick={() => copyText(freshSecret, 'secret')}
                    aria-label="Copy API key"
                  >
                    {copied === 'secret' ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <section className="mb-10">
          <h2 className="section-title mb-2">
            {renewForId ? t('dev.chooseRenew') : t('dev.choosePackage')}
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            Price is charged from your wallet. Capacity is verified receipt amounts (not the in-app per-check fee).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {packages.map((pkg) => {
              const active = selectedPackage === pkg.id
              const accent = PACKAGE_ACCENTS[pkg.id] || '#C6A24E'
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => setSelectedPackage(pkg.id)}
                  className="text-left rounded-xl p-4 transition-transform"
                  style={{
                    border: active ? `2px solid ${accent}` : '1px solid rgba(14,36,32,0.12)',
                    background: active ? 'rgba(198,162,78,0.12)' : 'var(--color-parchment)',
                    boxShadow: active ? '0 8px 24px rgba(14,36,32,0.12)' : 'none',
                    transform: active ? 'translateY(-2px)' : 'none',
                  }}
                >
                  <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: accent }}>{pkg.label}</p>
                  <p className="font-display text-2xl font-bold" style={{ color: 'var(--color-ink)' }}>{pkg.priceBirr}</p>
                  <p className="text-xs text-[var(--color-text-secondary)] mb-2">Birr</p>
                  <p className="text-sm font-semibold" style={{ color: accent }}>→ {pkg.capacityBirr} Birr verify</p>
                  <p className="text-[11px] text-[var(--color-text-tertiary)] mt-2 leading-snug">{pkg.note}</p>
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-3 mt-5">
            <button
              type="button"
              className="btn-primary"
              disabled={busy || loading}
              onClick={() => buyOrRenew({ renewKeyId: renewForId || undefined })}
            >
              {busy ? 'Processing…' : renewForId ? 'Renew selected key' : 'Buy API key'}
            </button>
            {renewForId && (
              <button type="button" className="btn-secondary" onClick={() => setRenewForId(null)}>
                Cancel renew
              </button>
            )}
          </div>
        </section>

        <section className="grid lg:grid-cols-2 gap-6 mb-10">
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <Terminal size={18} style={{ color: 'var(--color-foil-gold)' }} />
              <h2 className="section-title !mb-0 text-lg">Connect from your software</h2>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              Use the same URL + API key for <strong>Telebirr, CBE, Dashen, and Bank of Abyssinia</strong>.
              Change <code className="font-mono text-xs">method</code> and fields as below.
            </p>
            <label className="label">API URL</label>
            <div className="flex flex-col sm:flex-row gap-2 mb-3 min-w-0">
              <code className="flex-1 min-w-0 text-xs font-mono p-2 rounded-lg overflow-x-auto break-all" style={{ background: 'rgba(14,36,32,0.06)' }}>
                {verifyUrl}
              </code>
              <button type="button" className="btn-secondary btn-compact-icon self-end sm:self-auto" onClick={() => copyText(verifyUrl, 'url')} aria-label="Copy URL">
                {copied === 'url' ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <label className="label">Auth header (required)</label>
            <code className="block text-xs font-mono p-2 rounded-lg mb-4 whitespace-pre-wrap" style={{ background: 'rgba(14,36,32,0.06)' }}>
              {`X-API-Key: dk_live_…\nor\nAuthorization: Bearer dk_live_…`}
            </code>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-ink)' }}>Examples by bank</p>
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {[
                {
                  title: 'Telebirr — Invoice No.',
                  body: `curl -X POST "${verifyUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_KEY" \\
  -d '{"method":"telebirr","transactionCode":"DG65L5I9M5"}'`,
                },
                {
                  title: 'CBE — mbreciept link / v2-token (preferred)',
                  body: `curl -X POST "${verifyUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_KEY" \\
  -d '{"method":"cbe","transactionCode":"https://mbreciept.cbe.com.et/v2-xxxxxxxx"}'`,
                },
                {
                  title: 'CBE — legacy FT + full account',
                  body: `curl -X POST "${verifyUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_KEY" \\
  -d '{"method":"cbe","transactionCode":"FT26169D8C5M","accountSuffix":"1000333687112"}'`,
                },
                {
                  title: 'Bank of Abyssinia — FT/TT + full 9-digit sender account',
                  body: `curl -X POST "${verifyUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_KEY" \\
  -d '{"method":"boa","transactionCode":"FT26169X4SRS","accountSuffix":"246302723"}'`,
                },
                {
                  title: 'Dashen — IPSS reference (VAT)',
                  body: `curl -X POST "${verifyUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_KEY" \\
  -d '{"method":"dashen","transactionCode":"110IPSS2616900WO"}'`,
                },
                {
                  title: 'SMS (Telebirr, CBE, BOA, Dashen)',
                  body: `curl -X POST "${apiBase}/v1/verify/sms" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_KEY" \\
  -d '{"method":"telebirr","smsText":"PASTE FULL BANK SMS HERE"}'`,
                },
                {
                  title: 'Check remaining capacity',
                  body: `curl "${apiBase}/v1/me" -H "X-API-Key: YOUR_KEY"`,
                },
              ].map((ex) => (
                <div key={ex.title}>
                  <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--color-foil-gold)' }}>{ex.title}</p>
                  <pre className="text-[10px] font-mono p-2.5 rounded-lg overflow-x-auto leading-relaxed whitespace-pre-wrap" style={{ background: 'var(--color-ink)', color: '#E8DFC8' }}>
                    {ex.body}
                  </pre>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Shield size={18} style={{ color: 'var(--color-foil-gold)' }} />
                <h2 className="section-title !mb-0 text-lg">Your keys</h2>
              </div>
              <button type="button" className="btn-secondary text-xs" onClick={load} disabled={loading}>
                <RefreshCw size={12} className="inline mr-1" /> Refresh
              </button>
            </div>
            {loading ? (
              <div className="space-y-3">
                <div className="skeleton h-16 rounded" />
                <div className="skeleton h-16 rounded" />
              </div>
            ) : keys.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">No API keys yet. Buy a package to get started.</p>
            ) : (
              <ul className="space-y-3">
                {keys.map((k) => {
                  const pct = k.capacityAmount > 0 ? Math.min(100, (k.usedAmount / k.capacityAmount) * 100) : 0
                  const isVisible = Boolean(visibleKeyIds[k.id])
                  const fullKey = revealedKeys[k.id]
                  const displayKey = isVisible && fullKey ? fullKey : maskKey(k.keyPrefix)
                  return (
                    <li key={k.id} className="rounded-xl p-3 border" style={{ borderColor: 'rgba(14,36,32,0.1)' }}>
                      <div className="flex justify-between gap-2 mb-2">
                        <p className="font-semibold text-sm truncate">{k.name}</p>
                        <span className={`badge text-[10px] ${k.status === 'active' ? 'badge-success' : ''}`}>
                          {k.status}
                        </span>
                      </div>

                      <label className="label text-[10px] mb-1">API key</label>
                      <div
                        className="flex items-center gap-1.5 rounded-lg border px-2.5 py-2 mb-2"
                        style={{
                          borderColor: 'rgba(14,36,32,0.14)',
                          background: 'rgba(14,36,32,0.04)',
                        }}
                      >
                        <code
                          className="flex-1 min-w-0 text-xs font-mono truncate"
                          style={{ color: 'var(--color-ink)', letterSpacing: isVisible ? 'normal' : '0.04em' }}
                          title={isVisible && fullKey ? fullKey : undefined}
                        >
                          {displayKey}
                        </code>
                        <button
                          type="button"
                          className="shrink-0 p-1.5 rounded-md hover:bg-black/5 disabled:opacity-50"
                          style={{ color: 'var(--color-text-secondary)' }}
                          disabled={revealBusyId === k.id || k.status === 'revoked'}
                          onClick={() => toggleRevealKey(k)}
                          aria-label={isVisible ? 'Hide API key' : 'Show API key'}
                          title={k.canReveal || freshSecret ? (isVisible ? 'Hide' : 'Show') : 'Not recoverable — buy a new key'}
                        >
                          {revealBusyId === k.id
                            ? <RefreshCw size={15} className="animate-spin" />
                            : isVisible
                              ? <EyeOff size={15} />
                              : <Eye size={15} />}
                        </button>
                        <button
                          type="button"
                          className="shrink-0 p-1.5 rounded-md hover:bg-black/5 disabled:opacity-50"
                          style={{ color: 'var(--color-text-secondary)' }}
                          disabled={!fullKey || !isVisible}
                          onClick={() => copyText(fullKey, `key-${k.id}`)}
                          aria-label="Copy API key"
                          title={isVisible ? 'Copy' : 'Reveal first, then copy'}
                        >
                          {copied === `key-${k.id}` ? <Check size={15} /> : <Copy size={15} />}
                        </button>
                      </div>

                      <div className="h-2 rounded-full overflow-hidden mb-1" style={{ background: 'rgba(14,36,32,0.08)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--color-maroon)' : 'var(--color-foil-gold)' }} />
                      </div>
                      <p className="text-[11px] text-[var(--color-text-secondary)] mb-2">
                        {k.usedAmount.toFixed(0)} / {k.capacityAmount.toFixed(0)} Birr used · {k.remainingAmount.toFixed(0)} left
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn-secondary text-xs"
                          disabled={busy || k.status === 'revoked'}
                          onClick={() => { setRenewForId(k.id); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                        >
                          <RefreshCw size={12} className="inline mr-1" /> Renew
                        </button>
                        {k.status !== 'revoked' && (
                          <button type="button" className="btn-ghost text-xs" disabled={busy} onClick={() => revoke(k.id)}>
                            <Ban size={12} className="inline mr-1" /> Revoke
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        <PricingTables pricing={pricing} />
      </div>
    </div>
  )
}
