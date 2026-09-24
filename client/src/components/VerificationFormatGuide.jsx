import { useLocale } from '../i18n/LocaleContext'
import {
  ShieldCheck,
  Activity,
  CheckCircle2,
  Lock,
  Cpu,
  Layers,
  FileCheck2,
  Radio,
  ExternalLink,
} from 'lucide-react'

const SETTLEMENT_NODES = [
  {
    id: 'telebirr',
    name: 'Telebirr Gateway',
    type: 'Mobile Wallet API',
    latency: '94ms',
    status: 'Operational',
    uptime: '99.98%',
    logo: '/banks/telebirr.svg',
    fallback: '/banks/telebirr.jpg',
  },
  {
    id: 'cbe',
    name: 'CBE Core Banking',
    type: 'State Bank Bridge',
    latency: '138ms',
    status: 'Operational',
    uptime: '99.95%',
    logo: '/banks/cbe.svg',
    fallback: '/banks/cbe.png',
  },
  {
    id: 'boa',
    name: 'Bank of Abyssinia',
    type: 'Private Bank Ledger',
    latency: '112ms',
    status: 'Operational',
    uptime: '99.99%',
    logo: '/banks/boa.svg',
    fallback: '/banks/boa.jpg',
  },
  {
    id: 'dashen',
    name: 'Dashen SuperApp',
    type: 'IPSS Clearing Node',
    latency: '120ms',
    status: 'Operational',
    uptime: '99.94%',
    logo: '/banks/dashen.svg',
    fallback: '/banks/dashen.png',
  },
]

export default function VerificationFormatGuide({ method = 'telebirr', mode = 'screenshot' }) {
  const { t } = useLocale()

  return (
    <aside className="space-y-4 text-left">
      {/* ── 1. Bank Settlement Nodes Diagnostics Card ── */}
      <div className="bg-white rounded-3xl border border-[rgba(27,70,58,0.14)] p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-3.5 pb-2.5 border-b border-[rgba(27,70,58,0.08)]">
          <div className="flex items-center gap-2">
            <Radio size={16} className="text-emerald-600 animate-pulse" />
            <h3 className="text-xs sm:text-sm font-black text-[#091A16] uppercase tracking-wider">
              Bank Settlement Nodes
            </h3>
          </div>
          <span className="text-[11px] font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            ● 4 Nodes Active
          </span>
        </div>

        <div className="space-y-2.5">
          {SETTLEMENT_NODES.map((node) => {
            const isTarget = method === node.id
            return (
              <div
                key={node.id}
                className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  isTarget
                    ? 'bg-[#EBF5EE] border-[#1B463A] shadow-xs ring-1 ring-[#1B463A]/20 scale-[1.01]'
                    : 'bg-[#FAF8F5]/80 border-[rgba(27,70,58,0.08)] hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-white p-1 border border-[rgba(27,70,58,0.1)] flex items-center justify-center shrink-0 shadow-2xs">
                    <img
                      src={node.logo}
                      alt=""
                      onError={(e) => { e.currentTarget.src = node.fallback }}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-[#091A16] truncate">
                        {node.name}
                      </span>
                      {isTarget && (
                        <span className="text-[9px] font-black text-[#1B463A] bg-[#1B463A]/10 px-1.5 py-0.2 rounded uppercase">
                          Selected
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[#40564C] font-semibold block">
                      {node.type} · {node.uptime}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono tabular-nums text-xs font-black text-emerald-700 block">
                    {node.latency}
                  </span>
                  <span className="text-[10px] font-extrabold text-[#1B463A] flex items-center justify-end gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                    Live
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 2. AI Forensic Engine & Anti-Tamper Mechanisms ── */}
      <div className="bg-white rounded-3xl border border-[rgba(27,70,58,0.14)] p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-[rgba(27,70,58,0.08)]">
          <Cpu size={16} className="text-[#1B463A]" />
          <h3 className="text-xs sm:text-sm font-black text-[#091A16] uppercase tracking-wider">
            AI Forensic Anti-Tamper Engine
          </h3>
        </div>

        <div className="space-y-3.5">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
              <Layers size={14} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-xs font-black text-[#091A16] mb-0.5">Pixel Typography Inspection</p>
              <p className="text-[11px] text-[#40564C] leading-relaxed font-medium">
                Detects Photoshop overlays, canvas font substitutions, and altered Birr digits.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
              <FileCheck2 size={14} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-xs font-black text-[#091A16] mb-0.5">Official Ledger Match</p>
              <p className="text-[11px] text-[#40564C] leading-relaxed font-medium">
                Validates cryptographic transaction existence against official bank gateway records.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
              <Lock size={14} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-xs font-black text-[#091A16] mb-0.5">Recipient Account Lock</p>
              <p className="text-[11px] text-[#40564C] leading-relaxed font-medium">
                Ensures funds were sent to the authentic merchant number, stopping diverted screenshot scams.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[rgba(27,70,58,0.08)] flex items-center justify-between text-[11px] text-[#40564C]">
          <span className="font-semibold">Security Standard</span>
          <span className="font-black text-[#091A16]">Tamagn Cryptographic Seal v2.4</span>
        </div>
      </div>
    </aside>
  )
}
