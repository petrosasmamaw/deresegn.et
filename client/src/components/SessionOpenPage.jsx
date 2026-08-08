/* Direction contract — SessionOpenPage
   THESIS: Timed three-act verification title that names the product while the session cookie resolves — not a dashboard skeleton.
   OWN-WORLD: Tamagn ink, birr green, foil gold, parchment; guilloché field; seal / receipt / certificate silhouettes.
   STORY: Visitor understands Tamagn verifies Ethiopian receipts (screenshot · QR · ID · SMS) and receives a certificate; then lands Dashboard or Login.
   FIRST VIEWPORT: Full-bleed parchment guilloché; centered foil seal + brand; act line under it; soft gold progress.
   FORM: Three-act verification title (surface seed 03adeec1 · candidate 6).
   FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
*/

import { useEffect, useState } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import './SessionOpenPage.css'

const ACTS = [
  { id: 'trust', titleKey: 'sessionOpen.act1Title', bodyKey: 'sessionOpen.act1Body' },
  { id: 'prove', titleKey: 'sessionOpen.act2Title', bodyKey: 'sessionOpen.act2Body' },
  { id: 'certify', titleKey: 'sessionOpen.act3Title', bodyKey: 'sessionOpen.act3Body' },
]

/** Act slides while waiting; exit after session is ready and a readable beat. */
const ACT_MS = 1400
const MIN_HOLD_MS = 1200
const EXIT_MS = 400

export default function SessionOpenPage({ ready = false, onFinished }) {
  const { t, locale } = useLocale()
  const [actIndex, setActIndex] = useState(0)
  const [exiting, setExiting] = useState(false)
  const brand = locale === 'am' ? t('home.titleAm') : t('home.title')
  const brandAlt = locale === 'am' ? 'Tamagn Tech' : t('home.titleAm')
  const act = ACTS[actIndex]

  useEffect(() => {
    const started = performance.now()
    let exitTimer
    let finished = false

    const actTimer = window.setInterval(() => {
      setActIndex((i) => (i + 1) % ACTS.length)
    }, ACT_MS)

    const tryFinish = () => {
      if (finished || !ready) return
      if (performance.now() - started < MIN_HOLD_MS) return
      finished = true
      window.clearInterval(actTimer)
      setExiting(true)
      exitTimer = window.setTimeout(() => onFinished?.(), EXIT_MS)
    }

    const poll = window.setInterval(tryFinish, 40)
    tryFinish()

    return () => {
      window.clearInterval(actTimer)
      window.clearInterval(poll)
      window.clearTimeout(exitTimer)
    }
  }, [ready, onFinished])

  return (
    <div
      className={`session-open${exiting ? ' is-exiting' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy={!ready}
    >
      <div className="session-open__field" aria-hidden="true" />
      <div className="session-open__glow" aria-hidden="true" />

      <div className="session-open__stage">
        <div className={`session-open__seal session-open__seal--${act.id}`} aria-hidden="true">
          <svg className="session-open__ring" viewBox="0 0 120 120">
            <circle className="session-open__ring-track" cx="60" cy="60" r="52" />
            <circle className="session-open__ring-foil" cx="60" cy="60" r="52" />
          </svg>

          <div className="session-open__mark">
            <img
              src="/deresegn-logo.svg"
              alt=""
              width={72}
              height={72}
              className={`session-open__logo${act.id === 'trust' ? ' is-active' : ''}`}
            />
            <svg
              className={`session-open__icon session-open__icon--prove${act.id === 'prove' ? ' is-active' : ''}`}
              viewBox="0 0 64 64"
              fill="none"
            >
              <rect x="10" y="8" width="36" height="48" rx="3" stroke="currentColor" strokeWidth="2" />
              <path d="M18 20h20M18 28h16M18 36h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <rect x="28" y="34" width="26" height="22" rx="2" fill="var(--color-birr-green)" stroke="var(--color-foil-gold)" strokeWidth="2" />
              <path d="M34 45h14M34 50h10" stroke="var(--color-foil-gold)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <svg
              className={`session-open__icon session-open__icon--certify${act.id === 'certify' ? ' is-active' : ''}`}
              viewBox="0 0 64 64"
              fill="none"
            >
              <path d="M12 10h40v36l-8 8H12V10z" stroke="currentColor" strokeWidth="2" />
              <path d="M44 46v8l8-8" stroke="currentColor" strokeWidth="2" />
              <circle cx="32" cy="30" r="10" stroke="var(--color-foil-gold)" strokeWidth="2" />
              <path d="M27 30l3.2 3.2L38 25.5" stroke="var(--color-verified)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <p className="session-open__brand">{brand}</p>
        <p className="session-open__brand-alt">{brandAlt}</p>

        <div key={act.id} className="session-open__act">
          <h1 className="session-open__title">{t(act.titleKey)}</h1>
          <p className="session-open__body">{t(act.bodyKey)}</p>
        </div>

        {act.id === 'prove' && (
          <ul className="session-open__methods" aria-hidden="true">
            <li>{t('sessionOpen.methodShot')}</li>
            <li>{t('sessionOpen.methodQr')}</li>
            <li>{t('sessionOpen.methodId')}</li>
            <li>{t('sessionOpen.methodSms')}</li>
          </ul>
        )}

        <div className="session-open__progress" aria-hidden="true">
          <span
            className="session-open__progress-bar"
            style={{ transform: `scaleX(${(actIndex + 1) / ACTS.length})` }}
          />
        </div>
        <p className="session-open__hint">{t('sessionOpen.checking')}</p>
      </div>
    </div>
  )
}
