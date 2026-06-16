import { ReceiptText } from 'lucide-react'

export default function BalanceCard({ balance = 0, onTopUpClick }) {
  return (
    <div className="card" style={{ background: 'var(--color-accent-muted)', borderColor: 'var(--color-accent-border)' }}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="eyebrow mb-1">Account Balance</p>
          <p className="font-display text-4xl font-bold" style={{ color: 'var(--color-accent)' }}>
            {balance}
          </p>
          <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] mt-1">Verification units available</p>
        </div>
        <div className="p-3 rounded-lg" style={{ background: 'rgba(108, 99, 255, 0.2)' }}>
          <ReceiptText size={28} style={{ color: 'var(--color-accent)' }} />
        </div>
      </div>
      <button onClick={onTopUpClick} className="btn-primary w-full">
        Top Up Balance
      </button>
    </div>
  )
}
