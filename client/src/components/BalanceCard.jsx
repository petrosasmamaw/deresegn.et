import { Shield, TrendingUp } from 'lucide-react'

export default function BalanceCard({ balance = 0, onTopUpClick }) {
  return (
    <div className="card" style={{ 
      background: `linear-gradient(135deg, var(--color-primary-muted) 0%, rgba(16, 185, 129, 0.08) 100%)`,
      borderColor: 'var(--color-primary-border)',
      borderWidth: '2px'
    }}>
      <div className="flex items-start justify-between mb-8">
        {/* Left Section: Balance Info */}
        <div className="flex-1">
          <p className="eyebrow mb-2">Account Balance</p>
          <div className="mb-4">
            <p className="font-display text-5xl font-bold" style={{ color: 'var(--color-primary)', lineHeight: 1.1 }}>
              {balance}
            </p>
            <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] mt-1 font-medium">
              Verification units available
            </p>
          </div>
        </div>

        {/* Right Section: Icon */}
        <div className="p-4 rounded-lg" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>
          <Shield size={32} style={{ color: 'var(--color-primary)' }} strokeWidth={1.5} />
        </div>
      </div>

      {/* Action Section */}
      <div className="flex gap-3 pt-4 border-t border-[var(--color-primary-border)]">
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
