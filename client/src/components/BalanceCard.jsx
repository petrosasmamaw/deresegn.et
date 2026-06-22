import { Shield, TrendingUp } from 'lucide-react'

export default function BalanceCard({ balance = 0, onTopUpClick }) {
  return (
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
          className="btn-secondary btn-compact-icon"
          title="Balance information"
          aria-label="Balance information"
        >
          ?
        </button>
      </div>
    </div>
  )
}
