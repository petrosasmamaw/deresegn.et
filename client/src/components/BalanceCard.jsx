import { useState } from 'react'
import { Shield, TrendingUp } from 'lucide-react'
import Modal from './Modal'

const PRICING_TIERS = [
  { range: 'Under 100 ETB', cost: 2 },
  { range: '100 – 999 ETB', cost: 5 },
  { range: '1,000 – 4,999 ETB', cost: 10 },
  { range: '5,000 – 9,999 ETB', cost: 15 },
  { range: '10,000+ ETB', cost: 20 },
]

export default function BalanceCard({ balance = 0, onTopUpClick }) {
  const [pricingOpen, setPricingOpen] = useState(false)

  return (
    <>
      <div className="stat-card balance-card">
        <div className="flex items-start justify-between balance-header">
          <div className="flex-1 min-w-0">
            <p className="eyebrow mb-2" style={{ color: 'var(--color-text-tertiary)' }}>Account Balance</p>
            <div>
              <p className="balance-amount">
                {Number(balance || 0).toFixed(2)}
              </p>
              <p className="text-[13px] text-[var(--color-text-secondary)] mt-1 font-medium">
                Birr available
              </p>
            </div>
          </div>

          <div className="balance-icon-wrap flex-shrink-0 ml-3">
            <Shield size={28} style={{ color: 'var(--color-foil-gold)' }} strokeWidth={1.5} />
          </div>
        </div>

        <div className="flex balance-actions border-t" style={{ borderColor: 'rgba(14, 36, 32, 0.08)' }}>
          <button
            onClick={onTopUpClick}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <TrendingUp size={17} strokeWidth={2} />
            Top Up Balance
          </button>
          <button
            type="button"
            className="btn-secondary btn-compact-icon"
            title="Verification pricing"
            aria-label="Verification pricing"
            onClick={() => setPricingOpen(true)}
          >
            ?
          </button>
        </div>
      </div>

      <Modal
        isOpen={pricingOpen}
        onClose={() => setPricingOpen(false)}
        title="Verification Pricing"
        contentClassName="max-w-md"
      >
        <div className="modal-body space-y-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Each verification costs Birr based on the payment amount. Re-checks within 24 hours are free.
          </p>
          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'rgba(14, 36, 32, 0.12)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Amount</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {PRICING_TIERS.map((tier) => (
                  <tr key={tier.range}>
                    <td>{tier.range}</td>
                    <td className="font-mono font-semibold">{tier.cost} Birr</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            New accounts receive a 20 Birr registration bonus (tracked separately in admin).
          </p>
        </div>
      </Modal>
    </>
  )
}
