import { useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, TrendingUp, Wallet } from 'lucide-react'
import Modal from './Modal'
import PricingTables from './PricingTables'
import { useLocale } from '../i18n/LocaleContext'

export default function BalanceCard({ balance = 0, error = null, onTopUpClick }) {
  const [pricingOpen, setPricingOpen] = useState(false)
  const { t } = useLocale()

  return (
    <>
      <section className="dash-tools" aria-label={t('balance.title')}>
        <div className="dash-tools-balance">
          <p className="dash-tools-amount">{Number(balance || 0).toFixed(2)}</p>
          <p className="dash-tools-meta">
            {error ? (
              <span role="alert" style={{ color: '#dc2626' }}>{t('errors.loadBalance')}</span>
            ) : (
              t('balance.available')
            )}
          </p>
        </div>

        <div className="dash-tools-actions">
          <button type="button" onClick={onTopUpClick} className="dash-tools-topup">
            <TrendingUp size={20} strokeWidth={2} />
            {t('balance.topUp')}
          </button>
          <button type="button" className="dash-tools-link" onClick={() => setPricingOpen(true)}>
            {t('balance.pricingTitle')}
          </button>
          <Link to="/accounts" className="dash-tools-link">
            <Wallet size={18} strokeWidth={2} />
            {t('nav.myAccounts')}
          </Link>
          <Link to="/developer" className="dash-tools-link">
            <KeyRound size={18} strokeWidth={2} />
            {t('nav.getApi')}
          </Link>
        </div>
      </section>

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
