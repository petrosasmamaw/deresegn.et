import { Gift, CheckCircle2, History } from 'lucide-react'
import Modal from './Modal'

export default function OnboardingModal({ isOpen, onClose, onTopUp, onVerify }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Welcome to Deresegn"
      subtitle="Get started in 3 quick steps"
      contentClassName="max-w-lg"
    >
      <div className="modal-body space-y-4">
        <div className="bonus-banner">
          <Gift size={18} style={{ color: 'var(--color-foil-gold)' }} />
          <span>You received <strong>20 Birr</strong> registration bonus to try your first verifications.</span>
        </div>

        <div className="onboarding-steps">
          <div className="onboarding-step">
            <span className="onboarding-step-num">1</span>
            <div>
              <p className="font-semibold text-sm">Top up when you need more</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">Send Birr via Telebirr or CBE to add balance anytime.</p>
              <button type="button" className="btn-secondary text-xs mt-2" onClick={onTopUp}>View top-up</button>
            </div>
          </div>
          <div className="onboarding-step">
            <span className="onboarding-step-num">2</span>
            <div>
              <p className="font-semibold text-sm">Verify a payment</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">Fastest: paste bank SMS. Most secure: screenshot + QR.</p>
              <button type="button" className="btn-primary text-xs mt-2" onClick={onVerify}>Verify now</button>
            </div>
          </div>
          <div className="onboarding-step">
            <span className="onboarding-step-num">3</span>
            <div>
              <p className="font-semibold text-sm flex items-center gap-1"><History size={14} /> Check history & certificate</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">Every success gets a shareable certificate with payment ID and timestamp.</p>
            </div>
          </div>
        </div>

        <button type="button" className="btn-primary w-full" onClick={onClose}>
          <CheckCircle2 size={16} className="inline mr-1" />
          Got it — let&apos;s go
        </button>
      </div>
    </Modal>
  )
}
