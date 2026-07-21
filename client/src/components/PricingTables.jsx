import { useEffect, useState } from 'react'
import axios from '../api/axiosInstance'
import { unwrap } from '../api/unwrap'

const FALLBACK = {
  verifyFees: [
    { range: 'Under 100 ETB', costBirr: 2 },
    { range: '100 – 999 ETB', costBirr: 5 },
    { range: '1,000 – 4,999 ETB', costBirr: 10 },
    { range: '5,000 – 9,999 ETB', costBirr: 15 },
    { range: '10,000+ ETB', costBirr: 20 },
  ],
  apiPackages: [
    { id: 'starter', label: 'Starter', priceBirr: 100, capacityBirr: 150 },
    { id: 'growth', label: 'Growth', priceBirr: 500, capacityBirr: 850 },
    { id: 'pro', label: 'Pro', priceBirr: 1000, capacityBirr: 2000 },
    { id: 'business', label: 'Business', priceBirr: 2000, capacityBirr: 5000 },
    { id: 'enterprise', label: 'Enterprise', priceBirr: 5000, capacityBirr: 15000 },
  ],
}

export default function PricingTables({ pricing: pricingProp = null, compact = false }) {
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
          <h2 className="section-title mb-2">Pricing</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-6 max-w-2xl">
            In-app verification uses wallet fees by receipt amount. The Paid API uses prepaid packages:
            you pay once, then verify until the sum of payment amounts reaches package capacity.
          </p>
        </>
      )}

      <div className={`grid grid-cols-1 ${compact ? 'gap-4' : 'md:grid-cols-2 gap-6'}`}>
        <div className="rounded-xl overflow-hidden border min-w-0" style={{ borderColor: 'rgba(14,36,32,0.12)' }}>
          <div className="px-4 py-3" style={{ background: 'var(--color-ink)' }}>
            <p className="font-display font-bold text-sm" style={{ color: 'var(--color-foil-gold)' }}>In-app verify fees</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'rgba(244,238,220,0.65)' }}>Charged from wallet per successful check</p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Receipt amount</th>
                  <th>Fee</th>
                </tr>
              </thead>
              <tbody>
                {verifyFees.map((row) => (
                  <tr key={row.range}>
                    <td>{row.range}</td>
                    <td className="font-mono font-semibold">{row.costBirr} Birr</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-[var(--color-text-tertiary)] px-4 py-2">
            Re-checks of the same payment ID within 24 hours are free.
          </p>
        </div>

        <div className="rounded-xl overflow-hidden border min-w-0" style={{ borderColor: 'rgba(14,36,32,0.12)' }}>
          <div className="px-4 py-3" style={{ background: 'linear-gradient(135deg, #2F5D50, #0E2420)' }}>
            <p className="font-display font-bold text-sm" style={{ color: 'var(--color-foil-gold)' }}>Paid API packages</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'rgba(244,238,220,0.65)' }}>URL + API key for external software</p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Package</th>
                  <th>Price</th>
                  <th>Verify capacity</th>
                </tr>
              </thead>
              <tbody>
                {apiPackages.map((pkg) => (
                  <tr key={pkg.id || pkg.label}>
                    <td className="font-semibold">{pkg.label}</td>
                    <td className="font-mono">{pkg.priceBirr} Birr</td>
                    <td className="font-mono font-semibold" style={{ color: 'var(--color-birr-green)' }}>
                      {pkg.capacityBirr} Birr
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-[var(--color-text-tertiary)] px-4 py-2">
            Capacity = sum of verified payment amounts. When empty, renew after topping up.
          </p>
        </div>
      </div>
    </section>
  )
}
