import Modal from './Modal'
import VerificationCertificate from './VerificationCertificate'
import ReceiptSummaryCard from './ReceiptSummaryCard'

export default function CheckHistoryDetailModal({ check, onClose }) {
  if (!check) return null

  const details = {
    senderName: check.senderName,
    senderAccount: check.senderAccount,
    receiverName: check.receiverName,
    receiverAccount: check.receiverAccount,
    amount: check.amount,
    transactionCode: check.transactionCode,
  }

  return (
    <Modal
      isOpen={Boolean(check)}
      onClose={onClose}
      title={`Verification #${check.id}`}
      subtitle={check.transactionCode}
      contentClassName="max-w-2xl"
    >
      <div className="modal-body space-y-5">
        <VerificationCertificate check={check} compact />
        <ReceiptSummaryCard details={details} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="card p-3">
            <p className="receipt-label mb-1">Cost</p>
            <p className="font-mono font-semibold">
              {check.isRecheck ? 'Free (re-check)' : `−${check.balanceDeducted} Birr`}
            </p>
          </div>
          <div className="card p-3">
            <p className="receipt-label mb-1">Mode</p>
            <p className="capitalize">{check.verifyMode || 'screenshot'}</p>
          </div>
        </div>
      </div>
    </Modal>
  )
}
