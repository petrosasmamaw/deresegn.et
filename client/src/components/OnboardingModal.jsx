import { Gift, CheckCircle2, History } from 'lucide-react'
import Modal from './Modal'
import { useLocale } from '../i18n/LocaleContext'

export default function OnboardingModal({ isOpen, onClose, onTopUp, onVerify }) {
  const { t } = useLocale()

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('onboard.title')}
      subtitle={t('onboard.subtitle')}
      contentClassName="max-w-lg"
    >
      <div className="modal-body space-y-4">
        <div className="bonus-banner">
          <Gift size={18} style={{ color: 'var(--color-foil-gold)' }} />
          <span>{t('onboard.bonus', { amount: 20 })}</span>
        </div>

        <div className="onboarding-steps">
          <div className="onboarding-step">
            <span className="onboarding-step-num">1</span>
            <div>
              <p className="font-semibold text-sm">{t('onboard.step1Title')}</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">{t('onboard.step1Desc')}</p>
              <button type="button" className="btn-secondary text-xs mt-2" onClick={onTopUp}>{t('onboard.step1Btn')}</button>
            </div>
          </div>
          <div className="onboarding-step">
            <span className="onboarding-step-num">2</span>
            <div>
              <p className="font-semibold text-sm">{t('onboard.step2Title')}</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">{t('onboard.step2Desc')}</p>
              <button type="button" className="btn-primary text-xs mt-2" onClick={onVerify}>{t('onboard.step2Btn')}</button>
            </div>
          </div>
          <div className="onboarding-step">
            <span className="onboarding-step-num">3</span>
            <div>
              <p className="font-semibold text-sm flex items-center gap-1"><History size={14} /> {t('onboard.step3Title')}</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">{t('onboard.step3Desc')}</p>
            </div>
          </div>
        </div>

        <button type="button" className="btn-primary w-full" onClick={onClose}>
          <CheckCircle2 size={16} className="inline mr-1" />
          {t('onboard.gotIt')}
        </button>
      </div>
    </Modal>
  )
}
