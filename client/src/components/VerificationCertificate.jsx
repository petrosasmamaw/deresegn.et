import { useRef, useState } from 'react'
import { CheckCircle2, Download, Link2, ShieldCheck } from 'lucide-react'
import './VerificationCertificate.css'

const METHOD_LABELS = {
  telebirr: 'Telebirr',
  cbe: 'Commercial Bank of Ethiopia',
  boa: 'Bank of Abyssinia',
  dashen: 'Dashen Bank',
}

const TIER_LABELS = {
  verified: 'Verified',
  likely_valid: 'Likely Valid',
  suspicious: 'Suspicious',
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function displayValue(value) {
  if (value == null || value === '') return '—'
  return String(value).trim() || '—'
}

function drawCertificateToCanvas(cert) {
  const width = 720
  const height = 500
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#F4EEDC'
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = '#1B463A'
  ctx.lineWidth = 3
  ctx.strokeRect(18, 18, width - 36, height - 36)

  ctx.strokeStyle = '#C6A24E'
  ctx.lineWidth = 1
  ctx.strokeRect(28, 28, width - 56, height - 56)

  ctx.fillStyle = '#0E2420'
  ctx.font = 'bold 28px Georgia, serif'
  ctx.fillText('Deresegn', 48, 68)

  ctx.fillStyle = '#3E8F62'
  ctx.font = 'bold 18px sans-serif'
  ctx.fillText('VERIFIED PAYMENT', 48, 100)

  ctx.fillStyle = '#1B463A'
  ctx.font = '14px sans-serif'
  const lines = [
    `Check ID: #${cert.id}`,
    `Payment ID: ${displayValue(cert.transactionCode)}`,
    `Amount: ${displayValue(cert.amount)} ETB`,
    `Sender: ${displayValue(cert.senderName)}`,
    `Receiver: ${displayValue(cert.receiverName)}`,
    `Bank: ${METHOD_LABELS[cert.paymentMethod] || cert.paymentMethod}`,
    `Confidence: ${TIER_LABELS[cert.confidenceTier] || cert.confidenceTier}`,
    `Verified: ${formatDate(cert.createdAt || cert.verifiedAt)}`,
  ]
  lines.forEach((line, i) => ctx.fillText(line, 48, 132 + i * 26))

  ctx.beginPath()
  ctx.arc(width - 110, height - 110, 52, 0, Math.PI * 2)
  ctx.strokeStyle = '#3E8F62'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.fillStyle = '#3E8F62'
  ctx.font = 'bold 16px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('VALID', width - 110, height - 104)

  return canvas
}

export default function VerificationCertificate({ check, compact = false }) {
  const cardRef = useRef(null)
  const [copied, setCopied] = useState(false)

  if (!check) return null

  const shareUrl = check.shareToken
    ? `${window.location.origin}/verify/${check.shareToken}`
    : null

  const handleCopyLink = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const canvas = drawCertificateToCanvas(check)
    const link = document.createElement('a')
    link.download = `deresegn-certificate-${check.id}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div className={`verify-certificate${compact ? ' verify-certificate--compact' : ''}`} ref={cardRef}>
      <div className="verify-certificate-header">
        <div className="verify-certificate-brand">
          <ShieldCheck size={18} strokeWidth={2} />
          <span>Verified by Deresegn</span>
        </div>
        <div className="verified-stamp verify-certificate-stamp">Valid</div>
      </div>

      <div className="verify-certificate-body">
        <p className="verify-certificate-check-id">Certificate #{check.id}</p>
        <h3 className="verify-certificate-title">Payment Verification Certificate</h3>

        <dl className="verify-certificate-grid">
          <div>
            <dt>Payment ID</dt>
            <dd className="font-mono">{displayValue(check.transactionCode)}</dd>
          </div>
          <div>
            <dt>Amount</dt>
            <dd className="amount-mono">{displayValue(check.amount)} ETB</dd>
          </div>
          <div>
            <dt>Sender</dt>
            <dd>{displayValue(check.senderName)}</dd>
          </div>
          <div>
            <dt>Receiver</dt>
            <dd>{displayValue(check.receiverName)}</dd>
          </div>
          <div>
            <dt>Bank / Method</dt>
            <dd>{METHOD_LABELS[check.paymentMethod] || check.paymentMethod}</dd>
          </div>
          <div>
            <dt>Confidence</dt>
            <dd>
              <span className={`confidence-badge confidence-badge--${check.confidenceTier || 'verified'}`}>
                <CheckCircle2 size={12} />
                {TIER_LABELS[check.confidenceTier] || 'Verified'}
              </span>
            </dd>
          </div>
          <div className="verify-certificate-grid-span">
            <dt>Verified at</dt>
            <dd>{formatDate(check.createdAt)}</dd>
          </div>
        </dl>
      </div>

      {shareUrl && (
        <div className="verify-certificate-actions">
          <button type="button" className="btn-secondary verify-certificate-action" onClick={handleCopyLink}>
            <Link2 size={15} />
            {copied ? 'Link copied' : 'Copy share link'}
          </button>
          <button type="button" className="btn-primary verify-certificate-action" onClick={handleDownload}>
            <Download size={15} />
            Download PNG
          </button>
        </div>
      )}
    </div>
  )
}
