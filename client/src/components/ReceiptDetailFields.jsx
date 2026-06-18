export default function ReceiptDetailFields({ form, onChange, txPlaceholder }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="label">Sender Name</label>
        <input className="input" value={form.senderName} onChange={(e) => onChange('senderName', e.target.value)} placeholder="Person sending money" required />
      </div>
      <div>
        <label className="label">Sender Account</label>
        <input className="input font-mono" value={form.senderAccount} onChange={(e) => onChange('senderAccount', e.target.value)} placeholder="Phone or account number" required />
      </div>
      <div>
        <label className="label">Receiver Name</label>
        <input className="input" value={form.receiverName} onChange={(e) => onChange('receiverName', e.target.value)} placeholder="Person receiving money" required />
      </div>
      <div>
        <label className="label">Receiver Account</label>
        <input className="input font-mono" value={form.receiverAccount} onChange={(e) => onChange('receiverAccount', e.target.value)} placeholder="Phone or account number" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Amount (ETB)</label>
          <input type="number" step="0.01" className="input" value={form.amount} onChange={(e) => onChange('amount', e.target.value)} placeholder="0.00" required />
        </div>
        <div>
          <label className="label">Payment ID</label>
          <input className="input font-mono" value={form.transactionCode} onChange={(e) => onChange('transactionCode', e.target.value)} placeholder={txPlaceholder || 'Transaction reference'} required />
        </div>
      </div>
    </div>
  )
}
