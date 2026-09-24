import { useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, TrendingUp, Wallet, Layers, ShieldCheck, Copy, Check, ExternalLink, Coins } from 'lucide-react'
import Modal from './Modal'
import PricingTables from './PricingTables'
import { useLocale } from '../i18n/LocaleContext'

export default function BalanceCard({ balance = 0, error = null, onTopUpClick }) {
  const [pricingOpen, setPricingOpen] = useState(false)
  const [accountsOpen, setAccountsOpen] = useState(false)
  const [apiOpen, setApiOpen] = useState(false)
  const [copiedSnippet, setCopiedSnippet] = useState(false)
  const { t } = useLocale()

  const sampleSnippet = `curl -X POST https://api.tamagncheck.online/v1/verify \\
  -H "Authorization: Bearer tc_live_8f9024a1" \\
  -F "file=@receipt.jpg" \\
  -F "method=telebirr"`

  const handleCopyApi = async () => {
    try {
      await navigator.clipboard.writeText(sampleSnippet)
      setCopiedSnippet(true)
      setTimeout(() => setCopiedSnippet(false), 2000)
    } catch {}
  }

  return (
    <>
      <section
        className="bg-white rounded-3xl border border-[rgba(27,70,58,0.14)] p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5"
        aria-label="Account Balance & Quick Actions"
      >
        {/* Financial Counter */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#1B463A]/10 text-[#1B463A] flex items-center justify-center shrink-0 shadow-xs border border-[rgba(27,70,58,0.08)]">
            <Wallet size={24} strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono tabular-nums text-2xl sm:text-3xl font-black text-[#091A16] tracking-tight">
                {Number(balance || 0).toFixed(2)}
              </span>
              <span className="text-xs font-black text-[#1B463A] tracking-wider uppercase">ETB</span>
            </div>
            <p className="text-xs font-semibold text-[#40564C] mt-0.5">
              {error ? (
                <span role="alert" className="text-red-600 font-bold">Failed to load balance</span>
              ) : (
                'Birr available for live verification'
              )}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Distinctive Primary Action: Gold/Amber Top Up */}
          <button
            type="button"
            onClick={onTopUpClick}
            className="flex-1 sm:flex-none px-5 py-3 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#C6A24E] to-[#B8933E] text-[#091A16] font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs hover:brightness-105 active:scale-98 transition-all cursor-pointer"
          >
            <TrendingUp size={16} strokeWidth={2.5} />
            <span>Top Up Balance</span>
          </button>

          {/* Secondary Actions */}
          <button
            type="button"
            onClick={() => setPricingOpen(true)}
            className="flex-1 sm:flex-none px-4 py-3 rounded-2xl border border-[rgba(27,70,58,0.18)] bg-[#FAF8F5] hover:bg-white text-[#091A16] font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all"
          >
            <Layers size={15} className="text-[#1B463A]" />
            <span>Verification Pricing</span>
          </button>

          <button
            type="button"
            onClick={() => setAccountsOpen(true)}
            className="flex-1 sm:flex-none px-4 py-3 rounded-2xl border border-[rgba(27,70,58,0.18)] bg-[#FAF8F5] hover:bg-white text-[#091A16] font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all"
          >
            <ShieldCheck size={15} className="text-[#1B463A]" />
            <span>My Accounts</span>
          </button>

          <Link
            to="/finance"
            className="flex-1 sm:flex-none px-4 py-3 rounded-2xl border border-[rgba(27,70,58,0.18)] bg-[#FAF8F5] hover:bg-white text-[#091A16] font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all"
          >
            <Coins size={15} className="text-[#1B463A]" />
            <span>Financial Ledger</span>
          </Link>

          <button
            type="button"
            onClick={() => setApiOpen(true)}
            className="flex-1 sm:flex-none px-4 py-3 rounded-2xl border border-[rgba(27,70,58,0.18)] bg-[#FAF8F5] hover:bg-white text-[#091A16] font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all"
          >
            <KeyRound size={15} className="text-[#1B463A]" />
            <span>Get API</span>
          </button>
        </div>
      </section>

      {/* Verification Pricing Dialog */}
      <Modal
        isOpen={pricingOpen}
        onClose={() => setPricingOpen(false)}
        title="Verification Pricing Tiers"
        contentClassName="max-w-2xl"
      >
        <div className="modal-body space-y-4 text-left">
          <PricingTables compact />
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setPricingOpen(false); onTopUpClick() }}
              className="btn-primary text-xs font-extrabold px-5 py-2.5"
            >
              Top Up Now
            </button>
          </div>
        </div>
      </Modal>

      {/* My Accounts Quick Dialog */}
      <Modal
        isOpen={accountsOpen}
        onClose={() => setAccountsOpen(false)}
        title="Connected Merchant Accounts"
        contentClassName="max-w-lg"
      >
        <div className="modal-body space-y-4 text-left">
          <p className="text-xs text-[#40564C] leading-relaxed">
            These registered accounts are automatically protected against redirected screenshot scams. Payments made to other numbers will be immediately flagged.
          </p>

          <div className="space-y-2">
            <div className="p-3.5 rounded-xl border border-[rgba(27,70,58,0.15)] bg-[#FAF8F5] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#091A16] block">
                  Telebirr Merchant / Phone
                </span>
                <span className="font-mono text-xs text-[#1B463A] font-semibold">
                  0989886956 · seifeslasie asmamaw abebe
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                ACTIVE
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-[rgba(27,70,58,0.15)] bg-[#FAF8F5] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#091A16] block">
                  Commercial Bank of Ethiopia (CBE)
                </span>
                <span className="font-mono text-xs text-[#1B463A] font-semibold">
                  100033687112 · Petros Asmamaw
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                ACTIVE
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Link
              to="/accounts"
              onClick={() => setAccountsOpen(false)}
              className="text-xs font-bold text-[#1B463A] hover:underline flex items-center gap-1"
            >
              <span>Manage all accounts</span>
              <ExternalLink size={13} />
            </Link>
            <button
              type="button"
              onClick={() => setAccountsOpen(false)}
              className="btn-secondary text-xs px-4 py-2"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Get API Dialog */}
      <Modal
        isOpen={apiOpen}
        onClose={() => setApiOpen(false)}
        title="Developer Verification API"
        contentClassName="max-w-xl"
      >
        <div className="modal-body space-y-4 text-left">
          <p className="text-xs text-[#40564C] leading-relaxed">
            Integrate instant Ethiopian receipt verification directly into your Telegram bots, ERP, or e-commerce checkout.
          </p>

          <div className="rounded-xl bg-[#091A16] p-4 text-emerald-400 font-mono text-xs overflow-x-auto relative">
            <button
              type="button"
              onClick={handleCopyApi}
              className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              {copiedSnippet ? (
                <>
                  <Check size={12} className="text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copy cURL</span>
                </>
              )}
            </button>
            <pre className="whitespace-pre">{sampleSnippet}</pre>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Link
              to="/developer"
              onClick={() => setApiOpen(false)}
              className="btn-primary text-xs font-bold px-4 py-2 flex items-center gap-1.5"
            >
              <span>View Full API Docs & Keys</span>
              <ExternalLink size={13} />
            </Link>
            <button
              type="button"
              onClick={() => setApiOpen(false)}
              className="btn-secondary text-xs px-4 py-2"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
