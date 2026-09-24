import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import {
  ShieldCheck,
  CheckCircle2,
  ScanLine,
  Hash,
  MessageSquare,
  ArrowRight,
  Code2,
  Copy,
  Check,
  FileCheck,
  Lock,
  ExternalLink,
  Zap,
  TrendingUp,
  Cpu,
  Sparkles,
  Building2,
  Landmark,
  BadgeCheck,
  Layers
} from 'lucide-react'
import LandingNavbar from '../components/LandingNavbar'
import BirrVerifyHero from '../components/BirrVerifyHero'
import { useLocale } from '../i18n/LocaleContext'

const SUPPORTED_BANKS = [
  { id: 'telebirr', name: 'Telebirr', logo: '/banks/telebirr.svg', fallback: '/banks/telebirr.jpg', type: 'Mobile Wallet' },
  { id: 'cbe', name: 'Commercial Bank of Ethiopia', logo: '/banks/cbe.svg', fallback: '/banks/cbe.png', type: 'State Bank' },
  { id: 'boa', name: 'Bank of Abyssinia', logo: '/banks/boa.svg', fallback: '/banks/boa.jpg', type: 'Private Bank' },
  { id: 'dashen', name: 'Dashen Bank', logo: '/banks/dashen.svg', fallback: '/banks/dashen.png', type: 'Private Bank' },
  { id: 'cbebirr', name: 'CBE Birr', logo: '/banks/cbe.svg', fallback: '/banks/cbe.png', type: 'Mobile Banking' },
  { id: 'awash', name: 'Awash Bank', logo: '/deresegn-logo.svg', fallback: '/deresegn-logo.svg', type: 'Commercial' },
  { id: 'sinqee', name: 'Sinqee Bank', logo: '/deresegn-logo.svg', fallback: '/deresegn-logo.svg', type: 'Commercial' },
  { id: 'hibret', name: 'Hibret Bank', logo: '/deresegn-logo.svg', fallback: '/deresegn-logo.svg', type: 'Commercial' },
]

export default function HomePage() {
  const { user } = useSelector((s) => s.auth)
  const { t, locale } = useLocale()
  const navigate = useNavigate()
  const [copiedCode, setCopiedCode] = useState(false)
  const [apiTab, setApiTab] = useState('curl')

  const handleStartVerify = () => {
    if (user) {
      navigate(user.role === 'admin' ? '/admin' : '/dashboard')
    } else {
      navigate('/login', { state: { from: '/dashboard' } })
    }
  }

  const copyCode = (text) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const curlCode = `curl -X POST https://api.tamagncheck.online/api/v1/check/verify \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "method": "telebirr",
    "transactionCode": "TB2499104829",
    "accountSuffix": "0911223344",
    "expectedAmount": 1500
  }'`

  const jsCode = `import { DeresegnClient } from '@deresegn/sdk';

const client = new DeresegnClient({ apiKey: process.env.DERESEGN_API_KEY });

const result = await client.verifyPayment({
  method: 'cbe',
  transactionCode: 'FT24098492019',
  accountSuffix: '1000192837461'
});

if (result.isVerified) {
  console.log('Payment authentic:', result.amount, result.senderName);
}`

  return (
    <div className="landing-page-root flex flex-col selection:bg-[var(--color-foil-gold)] selection:text-[var(--color-ink)]">
      {/* Top Floating Navbar */}
      <LandingNavbar />

      {/* ── HERO SECTION WITH REGENERATED CLEAN LIGHT BACKGROUND & SEAMLESS BLEND ── */}
      <section className="landing-hero-wrap pt-28 sm:pt-32 pb-16 sm:pb-24 px-4 sm:px-6 relative overflow-hidden">
        <div className="landing-hero-overlay" />

        <div className="container mx-auto max-w-3xl lg:max-w-4xl relative z-10 text-center">
          {/* Glowing Badge */}
          <div className="inline-block mb-4 sm:mb-6 animate-fade-in">
            <span className="landing-glow-badge shadow-sm">
              <Sparkles size={14} className="text-[#1B463A]" />
              <span>{t('home.heroBadge')}</span>
            </span>
          </div>

          {/* Main Hero Headline - Perfectly Centered in Deep High-Contrast Emerald-Black */}
          <h1 className="text-3xl sm:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight text-[#091A16] mb-5 leading-[1.14] sm:leading-[1.16]">
            {locale === 'am' ? (
              <>
                <span className="landing-title-gradient">የሀሰተኛ ደረሰኝ ማጭበርበርን</span>{' '}
                በፈጣንና አስተማማኝ ማረጋገጫ ያስቁሙ
              </>
            ) : (
              <>
                <span className="landing-title-gradient">Instant Fraud Detection</span> for Ethiopian Bank Receipts & Payments
              </>
            )}
          </h1>

          {/* Subtitle - High Contrast Slate Emerald */}
          <p className="text-base sm:text-lg text-[#1F362D] max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed font-medium">
            {t('home.heroSub')}
          </p>

          {/* Call to Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 mb-12 sm:mb-14">
            <button
              type="button"
              onClick={handleStartVerify}
              className="btn-primary w-full sm:w-auto px-8 py-3.5 text-base font-bold flex items-center justify-center gap-3 shadow-xl hover:shadow-[0_8px_25px_rgba(27,70,58,0.25)] transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer bg-[#1B463A] text-white hover:bg-[#091A16]"
            >
              <ShieldCheck size={20} />
              <span>{t('home.startVerify')}</span>
              <ArrowRight size={18} />
            </button>

            <a
              href="#api"
              className="w-full sm:w-auto px-6 py-3.5 text-sm sm:text-base font-semibold text-[#1B463A] bg-white hover:bg-[#FAF8F5] border border-[rgba(27,70,58,0.25)] rounded-lg shadow-sm backdrop-blur-md transition-colors flex items-center justify-center gap-2"
            >
              <Code2 size={18} className="text-[#1B463A]" />
              <span>{t('home.exploreApi')}</span>
            </a>

            <a
              href="#features"
              className="text-sm font-semibold text-[#1B463A] hover:text-[#091A16] transition-colors underline-offset-4 hover:underline py-2 sm:py-0"
            >
              {t('home.howItWorks')} ↓
            </a>
          </div>

          {/* Metric Stats Cards Strip - Frosted White Glass with Crisp Dark Typography */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-left max-w-3xl mx-auto">
            <div className="landing-stat-card">
              <div className="flex items-center gap-2 text-[#8C6A21] mb-1">
                <ShieldCheck size={18} className="text-[#1B463A]" />
                <span className="font-bold text-lg sm:text-xl text-[#091A16]">99.9%</span>
              </div>
              <p className="text-xs font-bold text-[#091A16] mb-0.5">{t('home.statAccuracy')}</p>
              <p className="text-[11px] text-[#40564C] mb-0 leading-tight font-medium">{t('home.statAccuracySub')}</p>
            </div>

            <div className="landing-stat-card">
              <div className="flex items-center gap-2 text-[#1B463A] mb-1">
                <Zap size={18} />
                <span className="font-bold text-lg sm:text-xl text-[#091A16]">&lt; 1.2s</span>
              </div>
              <p className="text-xs font-bold text-[#091A16] mb-0.5">{t('home.statSpeed')}</p>
              <p className="text-[11px] text-[#40564C] mb-0 leading-tight font-medium">{t('home.statSpeedSub')}</p>
            </div>

            <div className="landing-stat-card">
              <div className="flex items-center gap-2 text-[#8C6A21] mb-1">
                <TrendingUp size={18} className="text-[#1B463A]" />
                <span className="font-bold text-lg sm:text-xl text-[#091A16]">15+</span>
              </div>
              <p className="text-xs font-bold text-[#091A16] mb-0.5">{t('home.statBanks')}</p>
              <p className="text-[11px] text-[#40564C] mb-0 leading-tight font-medium">{t('home.statBanksSub')}</p>
            </div>

            <div className="landing-stat-card">
              <div className="flex items-center gap-2 text-[#1B463A] mb-1">
                <FileCheck size={18} />
                <span className="font-bold text-lg sm:text-xl text-[#091A16]">100%</span>
              </div>
              <p className="text-xs font-bold text-[#091A16] mb-0.5">{t('home.statCert')}</p>
              <p className="text-[11px] text-[#40564C] mb-0 leading-tight font-medium">{t('home.statCertSub')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Seamless blend bridge between hero and content canvas */}
      <div className="landing-blend-bridge" />

      {/* ── LONG HIGH-QUALITY CONTINUOUS BACKGROUND CANVAS FOR ALL PAGE CONTENT ── */}
      <div className="landing-content-canvas">
        {/* ── LIVE VERIFICATION MACHINE ── */}
        <section id="live-engine" className="py-14 sm:py-20 px-3 sm:px-6 relative overflow-hidden">
          {/* Soft Ambient Glow Elements */}
          <div className="absolute -left-32 top-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-[#1B463A]/8 blur-3xl pointer-events-none" />
          <div className="absolute -right-32 top-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-[#C6A24E]/10 blur-3xl pointer-events-none" />

          <div className="container mx-auto max-w-5xl relative z-10">
            <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
              <span className="landing-glow-badge mb-3">
                <Cpu size={14} className="text-[#1B463A]" />
                <span>{t('home.liveDemoBadge')}</span>
              </span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#091A16] mb-3 tracking-tight">
                {t('home.liveDemoTitle')}
              </h2>
              <p className="text-sm sm:text-base text-[#284036] font-normal mb-0 leading-relaxed">
                {t('home.liveDemoSub')}
              </p>
            </div>

            {/* Interactive Mechanical AI Engine in Clean White Card Frame */}
            <div className="bg-white/95 backdrop-blur-md p-2 sm:p-4 rounded-2xl shadow-xl border border-[rgba(27,70,58,0.16)] overflow-hidden">
              <BirrVerifyHero hideCopy={true} />
            </div>
          </div>
        </section>

      {/* ── THREE WAYS TO VERIFY ── */}
      <section id="features" className="py-16 sm:py-24 px-4 sm:px-6 relative overflow-hidden border-t border-b border-[rgba(27,70,58,0.08)]">
        {/* Left Side Abstract Graphic: Green Optical Scanner & Radar in Green Stroke */}
        <div className="absolute -left-12 top-1/2 -translate-y-1/2 w-72 h-72 pointer-events-none opacity-25 hidden md:block">
          <svg viewBox="0 0 300 300" className="w-full h-full text-[#1B463A]" fill="none">
            <circle cx="150" cy="150" r="140" stroke="currentColor" strokeWidth="1" strokeDasharray="6 4" />
            <circle cx="150" cy="150" r="105" stroke="#C6A24E" strokeWidth="1" />
            <circle cx="150" cy="150" r="70" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
            <circle cx="150" cy="150" r="35" stroke="#C6A24E" strokeWidth="2" />
            <line x1="150" y1="0" x2="150" y2="300" stroke="currentColor" strokeWidth="1" opacity="0.4" />
            <line x1="0" y1="150" x2="300" y2="150" stroke="currentColor" strokeWidth="1" opacity="0.4" />
            <path d="M70,70 L230,230" stroke="#C6A24E" strokeWidth="1" opacity="0.3" />
            <path d="M70,230 L230,70" stroke="#C6A24E" strokeWidth="1" opacity="0.3" />
          </svg>
        </div>

        {/* Right Side Abstract Graphic: Green Verification Matrix & Shield */}
        <div className="absolute -right-12 top-1/2 -translate-y-1/2 w-72 h-72 pointer-events-none opacity-25 hidden md:block">
          <svg viewBox="0 0 300 300" className="w-full h-full text-[#1B463A]" fill="none">
            <polygon points="150,20 270,80 270,220 150,280 30,220 30,80" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 4" />
            <polygon points="150,55 240,105 240,195 150,245 60,195 60,105" stroke="#C6A24E" strokeWidth="1" />
            <circle cx="150" cy="150" r="28" stroke="currentColor" strokeWidth="2" />
            <circle cx="150" cy="150" r="6" fill="#C6A24E" />
            <circle cx="150" cy="55" r="4" fill="currentColor" />
            <circle cx="240" cy="105" r="4" fill="currentColor" />
            <circle cx="240" cy="195" r="4" fill="currentColor" />
            <circle cx="150" cy="245" r="4" fill="currentColor" />
            <circle cx="60" cy="195" r="4" fill="currentColor" />
            <circle cx="60" cy="105" r="4" fill="currentColor" />
          </svg>
        </div>

        <div className="container mx-auto max-w-5xl relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
            <span className="landing-glow-badge mb-3">
              <Layers size={13} className="text-[#1B463A]" />
              <span>{t('home.methodsBadge')}</span>
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-[#091A16] mb-4 tracking-tight">
              {t('home.methodsTitle')}
            </h2>
            <p className="text-sm sm:text-base text-[#284036] mb-0 leading-relaxed">
              {t('home.methodsSub')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {/* Method 1: Screenshot OCR */}
            <div className="landing-glass-card p-6 sm:p-7 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-[rgba(27,70,58,0.08)] border border-[rgba(27,70,58,0.18)] text-[#1B463A] flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-[#1B463A] group-hover:text-white transition-all">
                  <ScanLine size={24} />
                </div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-[#1B463A] mb-1.5 block">
                  {t('home.method1Badge')}
                </span>
                <h3 className="text-xl font-bold text-[#091A16] mb-3 group-hover:text-[#1B463A] transition-colors">
                  {t('home.method1Title')}
                </h3>
                <p className="text-sm text-[#284036] leading-relaxed">
                  {t('home.method1Desc')}
                </p>
              </div>
              <div className="pt-4 mt-5 border-t border-[rgba(27,70,58,0.1)] flex items-center gap-2 text-xs font-bold text-[#1B463A]">
                <CheckCircle2 size={16} className="text-[#1B463A] shrink-0" />
                <span>Telebirr, CBE, BoA screenshots</span>
              </div>
            </div>

            {/* Method 2: Transaction Reference ID */}
            <div className="landing-glass-card p-6 sm:p-7 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-[rgba(27,70,58,0.08)] border border-[rgba(27,70,58,0.18)] text-[#1B463A] flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-[#1B463A] group-hover:text-white transition-all">
                  <Hash size={24} />
                </div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-[#1B463A] mb-1.5 block">
                  {t('home.method2Badge')}
                </span>
                <h3 className="text-xl font-bold text-[#091A16] mb-3 group-hover:text-[#1B463A] transition-colors">
                  {t('home.method2Title')}
                </h3>
                <p className="text-sm text-[#284036] leading-relaxed">
                  {t('home.method2Desc')}
                </p>
              </div>
              <div className="pt-4 mt-5 border-t border-[rgba(27,70,58,0.1)] flex items-center gap-2 text-xs font-bold text-[#1B463A]">
                <CheckCircle2 size={16} className="text-[#1B463A] shrink-0" />
                <span>Account suffix match check</span>
              </div>
            </div>

            {/* Method 3: SMS Alert Parser */}
            <div className="landing-glass-card p-6 sm:p-7 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-[rgba(27,70,58,0.08)] border border-[rgba(27,70,58,0.18)] text-[#1B463A] flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-[#1B463A] group-hover:text-white transition-all">
                  <MessageSquare size={24} />
                </div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-[#1B463A] mb-1.5 block">
                  {t('home.method3Badge')}
                </span>
                <h3 className="text-xl font-bold text-[#091A16] mb-3 group-hover:text-[#1B463A] transition-colors">
                  {t('home.method3Title')}
                </h3>
                <p className="text-sm text-[#284036] leading-relaxed">
                  {t('home.method3Desc')}
                </p>
              </div>
              <div className="pt-4 mt-5 border-t border-[rgba(27,70,58,0.1)] flex items-center gap-2 text-xs font-bold text-[#1B463A]">
                <CheckCircle2 size={16} className="text-[#1B463A] shrink-0" />
                <span>Genuine sender header parse</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SUPPORTED BANKS & WALLETS ── */}
      <section id="banks" className="py-16 sm:py-24 px-4 sm:px-6 relative overflow-hidden border-b border-[rgba(27,70,58,0.08)]">
        {/* Left Side Abstract: Bank Pillars & Vault Dial */}
        <div className="absolute -left-10 top-1/2 -translate-y-1/2 w-80 h-80 pointer-events-none opacity-25 hidden md:block">
          <svg viewBox="0 0 320 320" className="w-full h-full text-[#1B463A]" fill="none">
            <circle cx="160" cy="160" r="145" stroke="currentColor" strokeWidth="1.5" strokeDasharray="10 5" />
            <circle cx="160" cy="160" r="120" stroke="#C6A24E" strokeWidth="1" />
            <circle cx="160" cy="160" r="90" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" />
            <circle cx="160" cy="160" r="50" stroke="#C6A24E" strokeWidth="2" />
            <path d="M90,240 L90,110 M125,240 L125,110 M160,240 L160,110 M195,240 L195,110 M230,240 L230,110" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
            <path d="M70,110 L160,60 L250,110 Z" stroke="currentColor" strokeWidth="2" opacity="0.6" />
            <rect x="70" y="240" width="180" height="12" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
          </svg>
        </div>

        {/* Right Side Abstract: Interbank Currency Network */}
        <div className="absolute -right-10 top-1/2 -translate-y-1/2 w-80 h-80 pointer-events-none opacity-25 hidden md:block">
          <svg viewBox="0 0 320 320" className="w-full h-full text-[#1B463A]" fill="none">
            <line x1="80" y1="80" x2="240" y2="100" stroke="#C6A24E" strokeWidth="1.5" strokeDasharray="6 4" />
            <line x1="240" y1="100" x2="200" y2="240" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
            <line x1="200" y1="240" x2="70" y2="210" stroke="#C6A24E" strokeWidth="1.5" strokeDasharray="6 4" />
            <line x1="70" y1="210" x2="80" y2="80" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
            <circle cx="80" cy="80" r="14" stroke="currentColor" strokeWidth="1.5" fill="rgba(27,70,58,0.08)" />
            <circle cx="240" cy="100" r="16" stroke="#C6A24E" strokeWidth="1.5" fill="rgba(198,162,78,0.12)" />
            <circle cx="200" cy="240" r="18" stroke="currentColor" strokeWidth="1.5" fill="rgba(27,70,58,0.08)" />
            <circle cx="70" cy="210" r="14" stroke="#C6A24E" strokeWidth="1.5" fill="rgba(198,162,78,0.12)" />
            <circle cx="155" cy="155" r="22" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
            <circle cx="155" cy="155" r="5" fill="#1B463A" />
          </svg>
        </div>

        <div className="container mx-auto max-w-5xl relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
            <span className="landing-glow-badge mb-3">
              <Landmark size={13} className="text-[#1B463A]" />
              <span>{t('home.banksBadge')}</span>
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#091A16] mb-3 tracking-tight">
              {t('home.banksTitle')}
            </h2>
            <p className="text-sm sm:text-base text-[#284036] mb-0 leading-relaxed">
              {t('home.banksSub')}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-5">
            {SUPPORTED_BANKS.map((bank) => (
              <div key={bank.id} className="landing-bank-badge group cursor-default">
                <div className="w-10 h-10 rounded-lg bg-[#FAF8F5] p-1.5 flex items-center justify-center shrink-0 border border-[rgba(27,70,58,0.1)] group-hover:scale-105 transition-transform shadow-xs">
                  <img
                    src={bank.logo}
                    alt={bank.name}
                    width={28}
                    height={28}
                    className="w-7 h-7 object-contain"
                    onError={(e) => {
                      e.currentTarget.src = bank.fallback || '/deresegn-logo.svg'
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-[#091A16] block truncate group-hover:text-[#1B463A] transition-colors">
                    {bank.name}
                  </span>
                  <span className="text-[10px] text-[#40564C] block font-semibold">
                    {bank.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEVELOPER API INTEGRATION SECTION ── */}
      <section id="api" className="py-16 sm:py-24 px-4 sm:px-6 relative overflow-hidden border-b border-[rgba(27,70,58,0.08)]">
        {/* Subtle Cyber Data Streams on Side in Green Stroke */}
        <div className="absolute -left-20 bottom-10 w-64 h-64 pointer-events-none opacity-20 hidden lg:block">
          <svg viewBox="0 0 200 200" className="w-full h-full text-[#1B463A]" fill="none">
            <path d="M10,20 L80,20 L110,60 L180,60" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10,80 L50,80 L80,120 L180,120" stroke="#C6A24E" strokeWidth="1.5" />
            <path d="M10,140 L70,140 L100,180 L180,180" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="180" cy="60" r="4" fill="currentColor" />
            <circle cx="180" cy="120" r="4" fill="#C6A24E" />
            <circle cx="180" cy="180" r="4" fill="currentColor" />
          </svg>
        </div>

        <div className="container mx-auto max-w-5xl relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Copy Column */}
            <div className="lg:col-span-5 space-y-5">
              <span className="landing-glow-badge">
                <Code2 size={14} className="text-[#1B463A]" />
                <span>{t('home.apiBadge')}</span>
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-[#091A16] tracking-tight leading-tight">
                {t('home.apiTitle')}
              </h2>
              <p className="text-sm sm:text-base text-[#284036] leading-relaxed">
                {t('home.apiSub')}
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2.5 text-sm text-[#183127] font-medium">
                  <CheckCircle2 size={18} className="text-[#1B463A] shrink-0" />
                  <span>Sub-second REST API endpoint responses</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-[#183127] font-medium">
                  <CheckCircle2 size={18} className="text-[#1B463A] shrink-0" />
                  <span>Webhook callbacks on payment arrival</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-[#183127] font-medium">
                  <CheckCircle2 size={18} className="text-[#1B463A] shrink-0" />
                  <span>Standardized JSON status & confidence tiers</span>
                </div>
              </div>

              <div className="pt-4">
                <Link
                  to="/developer"
                  className="btn-primary inline-flex items-center gap-2 text-sm px-5 py-2.5 shadow-md bg-[#1B463A] text-white hover:bg-[#091A16]"
                >
                  <span>{t('home.apiDocLink')}</span>
                  <ExternalLink size={15} />
                </Link>
              </div>
            </div>

            {/* Interactive Code Preview Column */}
            <div className="lg:col-span-7">
              <div className="landing-code-panel shadow-2xl border border-[rgba(27,70,58,0.25)]">
                {/* Panel Header */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-black/60 border-b border-[rgba(198,162,78,0.25)]">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setApiTab('curl')}
                      className={`text-xs px-2.5 py-1 rounded transition-colors cursor-pointer ${
                        apiTab === 'curl'
                          ? 'bg-[var(--color-foil-gold)] text-[var(--color-ink)] font-bold'
                          : 'text-[#F4EEDC]/70 hover:text-white'
                      }`}
                    >
                      cURL
                    </button>
                    <button
                      type="button"
                      onClick={() => setApiTab('js')}
                      className={`text-xs px-2.5 py-1 rounded transition-colors cursor-pointer ${
                        apiTab === 'js'
                          ? 'bg-[var(--color-foil-gold)] text-[var(--color-ink)] font-bold'
                          : 'text-[#F4EEDC]/70 hover:text-white'
                      }`}
                    >
                      Node.js
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => copyCode(apiTab === 'curl' ? curlCode : jsCode)}
                    className="text-xs text-[#F4EEDC]/70 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedCode ? <Check size={14} className="text-[#56C386]" /> : <Copy size={14} />}
                    <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                {/* Code Body */}
                <pre className="p-4 text-xs sm:text-[13px] text-[#F4EEDC] overflow-x-auto leading-relaxed bg-[#06120F]">
                  <code>{apiTab === 'curl' ? curlCode : jsCode}</code>
                </pre>

                {/* Sample JSON Response Preview */}
                <div className="p-3 bg-black/70 border-t border-white/10 text-[11px] text-[var(--color-foil-gold)] flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#56C386] animate-pulse" />
                    <span>Response: 200 OK — confidenceTier: "high" · verified: true</span>
                  </div>
                  <span className="text-[#F4EEDC]/50">340ms</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── VERIFIABLE CERTIFICATES EXPLAINER ── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 relative overflow-hidden">
        {/* Left Side Abstract: Guilloche Rosette in Green Stroke */}
        <div className="absolute -left-12 top-1/2 -translate-y-1/2 w-72 h-72 pointer-events-none opacity-25 hidden md:block">
          <svg viewBox="0 0 280 280" className="w-full h-full text-[#1B463A]" fill="none">
            <circle cx="140" cy="140" r="130" stroke="currentColor" strokeWidth="1" strokeDasharray="5 3" />
            <circle cx="140" cy="140" r="105" stroke="#C6A24E" strokeWidth="1" />
            <circle cx="140" cy="140" r="80" stroke="currentColor" strokeWidth="1.5" />
            <path d="M140,20 C180,60 220,100 260,140 C220,180 180,220 140,260 C100,220 60,180 20,140 C60,100 100,60 140,20 Z" stroke="currentColor" strokeWidth="1" opacity="0.5" />
          </svg>
        </div>

        {/* Right Side Abstract: Security Hologram Starburst in Green Stroke */}
        <div className="absolute -right-12 top-1/2 -translate-y-1/2 w-72 h-72 pointer-events-none opacity-25 hidden md:block">
          <svg viewBox="0 0 280 280" className="w-full h-full text-[#1B463A]" fill="none">
            <circle cx="140" cy="140" r="130" stroke="currentColor" strokeWidth="1" strokeDasharray="8 4" />
            <circle cx="140" cy="140" r="95" stroke="#C6A24E" strokeWidth="1.5" />
            <polygon points="140,30 170,105 250,140 170,175 140,250 110,175 30,140 110,105" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          </svg>
        </div>

        <div className="container mx-auto max-w-4xl text-center relative z-10">
          <span className="landing-glow-badge mb-3">
            <BadgeCheck size={14} className="text-[#1B463A]" />
            <span>{t('home.certBadge')}</span>
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-[#091A16] mb-3">
            {t('home.certTitle')}
          </h2>
          <p className="text-sm sm:text-base text-[#284036] max-w-2xl mx-auto mb-10 leading-relaxed">
            {t('home.certSub')}
          </p>

          {/* Tamper-Proof Digital Certificate Card on Crisp White Card */}
          <div className="card max-w-md mx-auto p-6 text-left border-2 border-[var(--color-foil-gold)] shadow-xl bg-white/95 backdrop-blur-md relative overflow-hidden rounded-2xl">
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-[var(--color-foil-gold)]/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex items-center justify-between pb-3.5 border-b border-[rgba(27,70,58,0.12)] mb-4">
              <div className="flex items-center gap-2.5">
                <img src="/deresegn-logo.svg" alt="" width={26} height={26} className="rounded" />
                <span className="font-bold text-xs sm:text-sm text-[#091A16]">ታማኝ ቸክ — Official Seal</span>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-[var(--color-verified)]/15 text-[#1B463A] border border-[#1B463A]/25 tracking-wider">
                AUTHENTICATED
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-[#40564C] font-medium">Tx Reference:</span>
                <span className="font-mono font-bold text-[#091A16] tracking-wide">TB8392019482</span>
              </div>
              <div className="flex justify-between items-center py-1 border-t border-[rgba(27,70,58,0.06)]">
                <span className="text-[#40564C] font-medium">Settled Amount:</span>
                <span className="font-bold text-[#1B463A] text-sm">3,500.00 ETB</span>
              </div>
              <div className="flex justify-between items-center py-1 border-t border-[rgba(27,70,58,0.06)]">
                <span className="text-[#40564C] font-medium">Method:</span>
                <span className="font-semibold text-[#091A16]">Telebirr SuperApp</span>
              </div>
              <div className="flex justify-between items-center py-1 border-t border-[rgba(27,70,58,0.06)]">
                <span className="text-[#40564C] font-medium">Verification Status:</span>
                <span className="font-bold text-[#1B463A] flex items-center gap-1">
                  <CheckCircle2 size={13} className="text-[#1B463A]" />
                  <span>100% Genuine Settlement</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
      </div>

      {/* ── FINAL CTA BANNER ── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-gradient-to-br from-[#0E2C24] via-[#091E18] to-[#04120E] text-white text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#C6A24E_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
        <div className="container mx-auto max-w-3xl relative z-10 space-y-5">
          <span className="landing-glow-badge text-[#E4C977] border-[#C6A24E]/40 bg-[#C6A24E]/15">
            <Lock size={13} className="text-[var(--color-foil-gold)]" />
            <span>{t('home.ctaBadge')}</span>
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            {t('home.ctaTitle')}
          </h2>
          <p className="text-sm sm:text-base text-[#F4EEDC]/85 max-w-xl mx-auto leading-relaxed">
            {t('home.ctaSub')}
          </p>
          <div className="pt-3">
            <button
              type="button"
              onClick={handleStartVerify}
              className="btn-primary px-8 py-3.5 text-base font-bold shadow-2xl inline-flex items-center gap-2 transform hover:-translate-y-0.5 cursor-pointer bg-[#C6A24E] text-[#091A16] hover:bg-[#E4C977]"
            >
              <ShieldCheck size={20} />
              <span>{t('home.ctaBtn')}</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#051410] text-[#F4EEDC]/75 py-10 sm:py-12 px-4 sm:px-6 border-t border-[rgba(27,70,58,0.25)]">
        <div className="container mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src="/deresegn-logo.svg" alt="Deresegn logo" width={32} height={32} className="rounded" />
            <div>
              <span className="font-bold text-white text-sm block">Deresegn.et (ታማኝ ቸክ)</span>
              <span className="text-[11px] text-[#F4EEDC]/50 block">Ethiopia’s Digital Transaction Verification Seal</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-[#F4EEDC]/80">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Back to Top
            </button>
            <Link to="/developer" className="hover:text-white transition-colors">
              {t('home.getApi')}
            </Link>
            <Link to="/login" className="hover:text-white transition-colors">
              {t('auth.signIn')}
            </Link>
            <Link to="/register" className="hover:text-white transition-colors">
              {t('home.register')}
            </Link>
          </div>

          <div className="text-[11px] text-[#F4EEDC]/50 text-center sm:text-right">
            © {new Date().getFullYear()} Deresegn.et. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
