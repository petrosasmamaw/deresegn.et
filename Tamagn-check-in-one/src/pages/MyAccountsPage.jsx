import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Building2, Smartphone, Save, Trash2, Wallet } from 'lucide-react'
import axios from '../api/axiosInstance'
import { unwrap } from '../api/unwrap'
import { useLocale } from '../i18n/LocaleContext'

const METHOD_META = [
  { id: 'telebirr', icon: Smartphone, hintKey: 'accounts.telebirrHint', placeholder: '09XXXXXXXX' },
  { id: 'cbe', icon: Building2, hintKey: 'accounts.cbeHint', placeholder: '1000333687112' },
  { id: 'boa', icon: Building2, hintKey: 'accounts.boaHint', placeholder: '246302723' },
  { id: 'dashen', icon: Building2, hintKey: 'accounts.dashenHint', placeholder: '0131XXXXXXXX' },
]

export default function MyAccountsPage() {
  const { t } = useLocale()
  const [forms, setForms] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const load = async () => {
    try {
      setLoading(true)
      const res = await axios.get('/me/accounts')
      const list = unwrap(res).accounts || []
      const next = {}
      list.forEach((row) => {
        next[row.method] = {
          accountName: row.accountName || '',
          accountNumber: row.accountNumber || '',
          saved: Boolean(row.id || (row.accountName && row.accountNumber)),
        }
      })
      METHOD_META.forEach((m) => {
        if (!next[m.id]) next[m.id] = { accountName: '', accountNumber: '', saved: false }
      })
      setForms(next)
      setError(null)
    } catch (err) {
      setError(err.response?.data?.message || t('accounts.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleChange = (method, field, value) => {
    setForms((prev) => ({
      ...prev,
      [method]: { ...prev[method], [field]: value },
    }))
  }

  const handleSave = async (method) => {
    try {
      setSaving(method)
      setSuccess(null)
      setError(null)
      const payload = forms[method]
      const res = await axios.put(`/me/accounts/${method}`, {
        accountName: payload.accountName,
        accountNumber: payload.accountNumber,
      })
      const updated = unwrap(res).account
      setForms((prev) => ({
        ...prev,
        [method]: {
          accountName: updated.accountName,
          accountNumber: updated.accountNumber,
          saved: true,
        },
      }))
      setSuccess(t('accounts.saved'))
    } catch (err) {
      setError(err.response?.data?.message || t('accounts.saveFailed'))
    } finally {
      setSaving(null)
    }
  }

  const handleRemove = async (method) => {
    try {
      setSaving(method)
      setError(null)
      await axios.delete(`/me/accounts/${method}`)
      setForms((prev) => ({
        ...prev,
        [method]: { accountName: '', accountNumber: '', saved: false },
      }))
      setSuccess(t('accounts.removed'))
    } catch (err) {
      setError(err.response?.data?.message || t('accounts.saveFailed'))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="page-parchment min-h-screen overflow-x-hidden">
      <div className="container mx-auto max-w-3xl px-3 sm:px-4 py-6 sm:py-8 pb-24">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm font-semibold mb-3" style={{ color: 'var(--color-foil-gold)' }}>
          <ArrowLeft size={16} /> {t('common.back')}
        </Link>
        <h1 className="page-title flex items-center gap-2 flex-wrap">
          <Wallet size={26} className="shrink-0" style={{ color: 'var(--color-foil-gold)' }} />
          {t('accounts.title')}
        </h1>
        <p className="page-subtitle max-w-2xl mt-2">{t('accounts.subtitle')}</p>

        {error && <div className="alert alert-error mt-4">{error}</div>}
        {success && <div className="alert alert-success mt-4">{success}</div>}

        {loading ? (
          <div className="card space-y-4 mt-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-36 rounded" />
            ))}
          </div>
        ) : (
          <div className="space-y-4 mt-6">
            {METHOD_META.map((meta) => {
              const Icon = meta.icon
              const form = forms[meta.id] || { accountName: '', accountNumber: '' }
              return (
                <div key={meta.id} className="card space-y-3">
                  <div className="flex items-center gap-2">
                    <Icon size={18} style={{ color: 'var(--color-birr-green)' }} />
                    <h2 className="font-display font-semibold">{t(`method.${meta.id}`)}</h2>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)]">{t(meta.hintKey)}</p>
                  <div>
                    <label className="label">{t('accounts.name')}</label>
                    <input
                      className="input w-full"
                      value={form.accountName}
                      onChange={(e) => handleChange(meta.id, 'accountName', e.target.value)}
                      placeholder={t('accounts.namePlaceholder')}
                    />
                  </div>
                  <div>
                    <label className="label">{t('accounts.number')}</label>
                    <input
                      className="input w-full"
                      value={form.accountNumber}
                      onChange={(e) => handleChange(meta.id, 'accountNumber', e.target.value)}
                      placeholder={meta.placeholder}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-primary flex-1 flex items-center justify-center gap-2"
                      disabled={saving === meta.id}
                      onClick={() => handleSave(meta.id)}
                    >
                      <Save size={16} />
                      {saving === meta.id ? t('common.loading') : t('accounts.save')}
                    </button>
                    {form.saved && (
                      <button
                        type="button"
                        className="btn-secondary flex items-center justify-center gap-2 px-3"
                        disabled={saving === meta.id}
                        onClick={() => handleRemove(meta.id)}
                      >
                        <Trash2 size={16} />
                        {t('accounts.remove')}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
