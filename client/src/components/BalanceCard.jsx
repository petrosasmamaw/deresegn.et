import { useState } from 'react'
import { Shield, TrendingUp } from 'lucide-react'
import Modal from './Modal'
import { useLocale } from '../i18n/LocaleContext'

export default function BalanceCard({ balance = 0, onTopUpClick }) {
  const [pricingOpen, setPricingOpen] = useState(false)
  const { t } = useLocale()

  const tiers = [
    { rangeKey: 'balance.tierUnder100', cost: 2 },
    { rangeKey: 'balance.tier100', cost: 5 },
    { rangeKey: 'balance.tier1000', cost: 10 },
    { rangeKey: 'balance.tier5000', cost: 15 },
    { rangeKey: 'balance.tier10000', cost: 20 },
  ]

  return (
    <>
      <div className="stat-card balance-card">
        <div className="flex items-start justify-between balance-header">
          <div className="flex-1 min-w-0">
            <p className="eyebrow mb-2" style={{ color: 'var(--color-text-tertiary)' }}>{t('balance.title')}</p>
            <div>
              <p className="balance-amount">
                {Number(balance || 0).toFixed(2)}
              </p>
              <p className="text-[13px] text-[var(--color-text-secondary)] mt-1 font-medium">
                {t('balance.available')}
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
            {t('balance.topUp')}
          </button>
          <button
            type="button"
            className="btn-secondary btn-compact-icon"
            title={t('balance.pricingAria')}
            aria-label={t('balance.pricingAria')}
            onClick={() => setPricingOpen(true)}
          >
            ?
          </button>
        </div>
      </div>

      <Modal
        isOpen={pricingOpen}
        onClose={() => setPricingOpen(false)}
        title={t('balance.pricingTitle')}
        contentClassName="max-w-md"
      >
        <div className="modal-body space-y-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t('balance.pricingIntro')}
          </p>
          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'rgba(14, 36, 32, 0.12)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('balance.amountCol')}</th>
                  <th>{t('balance.costCol')}</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((tier) => (
                  <tr key={tier.rangeKey}>
                    <td>{t(tier.rangeKey)}</td>
                    <td className="font-mono font-semibold">{t('balance.costBirr', { cost: tier.cost })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            {t('balance.bonusNote')}
          </p>
        </div>
      </Modal>
    </>
  )
}
