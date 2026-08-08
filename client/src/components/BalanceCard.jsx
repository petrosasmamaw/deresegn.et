import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Shield, TrendingUp } from 'lucide-react'
import Modal from './Modal'
import PricingTables from './PricingTables'
import { useLocale } from '../i18n/LocaleContext'

export default function BalanceCard({ balance = 0, onTopUpClick }) {
  const [pricingOpen, setPricingOpen] = useState(false)
  const { t } = useLocale()

  return (
    <>
      <div className="stat-card balance-card">
        <div className="flex items-start justify-between balance-header">
          <div className="flex-1 min-w-0">
            <p className="meta-label mb-2">{t('balance.title')}</p>
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
        contentClassName="max-w-2xl"
      >
        <div className="modal-body space-y-4">
          <PricingTables compact />
          <Link to="/developer" className="btn-primary w-full text-center text-sm" onClick={() => setPricingOpen(false)}>
            {t('nav.getApi')}
          </Link>
        </div>
      </Modal>
    </>
  )
}
