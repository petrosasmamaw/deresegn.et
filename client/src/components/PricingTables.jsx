import { useEffect, useState } from 'react'
import axios from '../api/axiosInstance'
import { unwrap } from '../api/unwrap'
import { useLocale } from '../i18n/LocaleContext'

const FALLBACK = {
  verifyFees: [
    { rangeKey: 'balance.tierUnder100', range: 'Under 100 ETB', costBirr: 2 },
    { rangeKey: 'balance.tier100', range: '100 – 999 ETB', costBirr: 5 },
    { rangeKey: 'balance.tier1000', range: '1,000 – 4,999 ETB', costBirr: 10 },
    { rangeKey: 'balance.tier5000', range: '5,000 – 9,999 ETB', costBirr: 15 },
    { rangeKey: 'balance.tier10000', range: '10,000+ ETB', costBirr: 20 },
  ],
  apiPackages: [
    { id: 'starter', label: 'Starter', priceBirr: 100, capacityBirr: 150 },
    { id: 'growth', label: 'Growth', priceBirr: 500, capacityBirr: 850 },
    { id: 'pro', label: 'Pro', priceBirr: 1000, capacityBirr: 2000 },
    { id: 'business', label: 'Business', priceBirr: 2000, capacityBirr: 5000 },
    { id: 'enterprise', label: 'Enterprise', priceBirr: 5000, capacityBirr: 15000 },
  ],
}

const FEE_RANGE_BY_COST = {
  2: 'balance.tierUnder100',
  5: 'balance.tier100',
  10: 'balance.tier1000',
  15: 'balance.tier5000',
  20: 'balance.tier10000',
}

function feeRangeLabel(row, t) {
  const key = row.rangeKey || FEE_RANGE_BY_COST[Number(row.costBirr)]
  if (key) return t(key)
  return row.range || ''
}

function packageLabel(pkg, t) {
  const key = `pricing.pkg.${pkg.id}`
  const translated = t(key)
  if (translated && translated !== key) return translated
  return pkg.label || pkg.id
}

export default function PricingTables({ pricing: pricingProp = null, compact = false }) {
  const { t } = useLocale()
  const [pricing, setPricing] = useState(pricingProp || FALLBACK)

  useEffect(() => {
    if (pricingProp) {
      setPricing(pricingProp)
      return
    }
    axios.get('/developer/pricing')
      .then((res) => setPricing(unwrap(res) || FALLBACK))
      .catch(() => setPricing(FALLBACK))
  }, [pricingProp])

  const verifyFees = pricing?.verifyFees || FALLBACK.verifyFees
  const apiPackages = pricing?.apiPackages || FALLBACK.apiPackages

  return (
    <section className={compact ? '' : 'mb-4'}>
      {!compact && (
        <>
          <h2 className="section-title mb-2">{t('pricing.title')}</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-6 max-w-2xl">
            {t('pricing.subtitle')}
          </p>
        </>
      )}

      <div className={`grid grid-cols-1 ${compact ? 'gap-4' : 'md:grid-cols-2 gap-6'}`}>
        <div className="rounded-xl overflow-hidden border min-w-0" style={{ borderColor: 'rgba(14,36,32,0.12)' }}>
          <div className="px-4 py-3" style={{ background: 'var(--color-ink)' }}>
            <p className="font-display font-bold text-sm" style={{ color: 'var(--color-foil-gold)' }}>
              {t('pricing.inAppFees')}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: 'rgba(244,238,220,0.65)' }}>
              {t('pricing.inAppSub')}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>{t('pricing.receiptAmount')}</th>
                  <th>{t('pricing.fee')}</th>
                </tr>
              </thead>
              <tbody>
                {verifyFees.map((row) => (
                  <tr key={row.range || row.costBirr}>
                    <td>{feeRangeLabel(row, t)}</td>
                    <td className="font-mono font-semibold">{row.costBirr} {t('common.birr')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-[var(--color-text-tertiary)] px-4 py-2">
            {t('pricing.recheckNote')}
          </p>
        </div>

        <div className="rounded-xl overflow-hidden border min-w-0" style={{ borderColor: 'rgba(14,36,32,0.12)' }}>
          <div className="px-4 py-3" style={{ background: 'linear-gradient(135deg, #2F5D50, #0E2420)' }}>
            <p className="font-display font-bold text-sm" style={{ color: 'var(--color-foil-gold)' }}>
              {t('pricing.paidApiPackages')}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: 'rgba(244,238,220,0.65)' }}>
              {t('pricing.paidApiSub')}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>{t('pricing.package')}</th>
                  <th>{t('pricing.price')}</th>
                  <th>{t('pricing.capacity')}</th>
                </tr>
              </thead>
              <tbody>
                {apiPackages.map((pkg) => (
                  <tr key={pkg.id || pkg.label}>
                    <td className="font-semibold">{packageLabel(pkg, t)}</td>
                    <td className="font-mono">{pkg.priceBirr} {t('common.birr')}</td>
                    <td className="font-mono font-semibold" style={{ color: 'var(--color-birr-green)' }}>
                      {pkg.capacityBirr} {t('common.birr')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-[var(--color-text-tertiary)] px-4 py-2">
            {t('pricing.capacityNote')}
          </p>
        </div>
      </div>
    </section>
  )
}
