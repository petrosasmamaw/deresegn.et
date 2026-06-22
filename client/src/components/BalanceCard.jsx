import { Shield, TrendingUp } from 'lucide-react'

export default function BalanceCard({ balance = 0, onTopUpClick }) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between mb-8">
        {/* Left Section: Balance Info */}
        <div className="flex-1">
          <p className="eyebrow mb-2" style={{ color: 'var(--color-text-tertiary)' }}>Account Balance</p>
          <div className="mb-4">
            <p className="amount-mono-lg" style={{ fontSize: '48px', lineHeight: 1.1 }}>
              {Number(balance || 0).toFixed(2)}
            </p>
            <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] mt-1 font-medium">
              Birr available
            </p>
          </div>
        </div>

        {/* Right Section: Icon */}
        <div className="p-4 rounded-lg" style={{ background: 'rgba(198, 162, 78, 0.1)' }}>
          <Shield size={32} style={{ color: 'var(--color-foil-gold)' }} strokeWidth={1.5} />
        </div>
      </div>

      {/* Action Section */}
      <div className="flex gap-3 pt-4 border-t" style={{ borderColor: 'rgba(14, 36, 32, 0.08)' }}>
        <button 
          onClick={onTopUpClick} 
          className="btn-primary flex-1 flex items-center justify-center gap-2"
        >
          <TrendingUp size={18} strokeWidth={2} />
          Top Up Balance
        </button>
        <button 
          className="btn-secondary px-4"
          title="Balance information"
        >
          ?
        </button>
      </div>
    </div>
  )
}
