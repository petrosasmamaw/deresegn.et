import Modal from './Modal'
import VerificationCertificate from './VerificationCertificate'
import ReceiptSummaryCard from './ReceiptSummaryCard'
import { useLocale } from '../i18n/LocaleContext'

export default function CheckHistoryDetailModal({ check, onClose }) {
  const { t } = useLocale()
  if (!check) return null

  const details = {
    senderName: check.senderName,
    senderAccount: check.senderAccount,
    receiverName: check.receiverName,
    receiverAccount: check.receiverAccount,
    amount: check.amount,
    transactionCode: check.transactionCode,
  }

  const modeLabel =
    check.verifyMode === 'sms'
      ? t('check.methodSms')
      : check.verifyMode === 'reference'
        ? t('check.methodReference')
        : t('check.methodScreenshot')

  return (
    <Modal
      isOpen={Boolean(check)}
      onClose={onClose}
      title={`${t('detail.title') || 'Verification'} #${check.id}`}
      subtitle={check.transactionCode}
      contentClassName="max-w-2xl"
    >
      <div className="modal-body space-y-5">
        <VerificationCertificate check={check} compact />
        <ReceiptSummaryCard details={details} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="card p-3">
            <p className="receipt-label mb-1">{t('detail.cost')}</p>
            <p className="font-mono font-semibold">
              {check.isRecheck ? t('check.freeRecheck') : `−${check.balanceDeducted} ${t('common.birr')}`}
            </p>
          </div>
          <div className="card p-3">
            <p className="receipt-label mb-1">{t('detail.mode')}</p>
            <p className="capitalize">{modeLabel}</p>
          </div>
        </div>
      </div>
    </Modal>
  )
}
