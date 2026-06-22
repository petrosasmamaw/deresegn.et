import { useEffect, useRef, useState, useCallback } from 'react'
import { Landmark, CheckCircle2, ShieldCheck } from 'lucide-react'
import './BirrVerifyHero.css'

const NOTE_WIDTH = 96
const NOTE_HEIGHT = 56

const NOTES = [
  { src: '/200BirrNote.jpg', stripColor: '#c8a44e' },
  { src: '/100BirrNote.jpg', stripColor: '#4a90c8' },
  { src: '/50BirrNote.png', stripColor: '#c84a4a' },
]

const PHASE = {
  APPROACH: 1200,
  SCANNING: 900,
  EXIT: 900,
  BANK: 400,
  RESET: 600,
}

function createParticles(originX, originY) {
  const distance = 28 + Math.random() * 14
  return Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.4
    return {
      id: `${Date.now()}-${i}-${Math.random()}`,
      left: originX,
      top: originY,
      px: `${Math.cos(angle) * distance}px`,
      py: `${Math.sin(angle) * distance}px`,
    }
  })
}

export default function BirrVerifyHero({ onVerifyClick }) {
  const sceneRef = useRef(null)
  const machineRef = useRef(null)
  const bankRef = useRef(null)
  const noteIndexRef = useRef(0)
  const timeoutsRef = useRef([])
  const mountedRef = useRef(true)

  const [noteVisible, setNoteVisible] = useState(false)
  const [noteLeft, setNoteLeft] = useState(-120)
  const [noteTop, setNoteTop] = useState(0)
  const [noteTransition, setNoteTransition] = useState('none')
  const [noteOpacity, setNoteOpacity] = useState(1)
  const [verified, setVerified] = useState(false)
  const [doorsOpen, setDoorsOpen] = useState(false)
  const [screenStatus, setScreenStatus] = useState('idle')
  const [slotGlow, setSlotGlow] = useState('')
  const [lightState, setLightState] = useState('green')
  const [bankStrips, setBankStrips] = useState([])
  const [particles, setParticles] = useState([])
  const [activeNoteIndex, setActiveNoteIndex] = useState(0)

  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
  }, [])

  const schedule = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      if (mountedRef.current) fn()
    }, ms)
    timeoutsRef.current.push(id)
    return id
  }, [])

  const getPositions = useCallback(() => {
    const scene = sceneRef.current
    const machine = machineRef.current
    const bank = bankRef.current
    if (!scene || !machine || !bank) return null

    const sceneRect = scene.getBoundingClientRect()
    const machineRect = machine.getBoundingClientRect()
    const bankRect = bank.getBoundingClientRect()

    const noteW = window.innerWidth <= 640 ? 80 : NOTE_WIDTH
    const noteH = window.innerWidth <= 640 ? 48 : NOTE_HEIGHT

    return {
      start: -120,
      machine: machineRect.left - sceneRect.left + machineRect.width / 2 - noteW / 2,
      bank: bankRect.left - sceneRect.left + bankRect.width / 2 - noteW / 2,
      noteTop: machineRect.top - sceneRect.top + machineRect.height / 2 - noteH / 2,
      machineCenterX: machineRect.left - sceneRect.left + machineRect.width / 2,
      machineCenterY: machineRect.top - sceneRect.top + machineRect.height / 2,
      bankCenterX: bankRect.left - sceneRect.left + bankRect.width / 2,
      bankCenterY: bankRect.top - sceneRect.top + bankRect.height / 2,
    }
  }, [])

  const burstParticles = useCallback((x, y) => {
    const burst = createParticles(x, y)
    setParticles((prev) => [...prev, ...burst])
    schedule(() => {
      setParticles((prev) => prev.filter((p) => !burst.find((b) => b.id === p.id)))
    }, 650)
  }, [schedule])

  const addBankStrip = useCallback((color) => {
    const id = `${Date.now()}-${Math.random()}`
    setBankStrips((prev) => {
      const next = [...prev, { id, color }]
      return next.length > 6 ? next.slice(-6) : next
    })
  }, [])

  const runCycle = useCallback(() => {
    if (!mountedRef.current) return

    const pos = getPositions()
    if (!pos) {
      schedule(runCycle, 100)
      return
    }

    const idx = noteIndexRef.current
    setActiveNoteIndex(idx)

    setNoteVisible(true)
    setVerified(false)
    setDoorsOpen(false)
    setScreenStatus('idle')
    setSlotGlow('')
    setLightState('green')
    setNoteOpacity(1)
    setNoteTop(pos.noteTop)
    setNoteTransition('none')
    setNoteLeft(pos.start)

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!mountedRef.current) return
        setNoteTransition('left 1200ms ease-in-out')
        setNoteLeft(pos.machine)
      })
    })

    schedule(() => {
      setScreenStatus('scanning')
      setSlotGlow('gold')
      setLightState('gold')

      schedule(() => {
        setVerified(true)
        setScreenStatus('verified')
        setSlotGlow('green')
        setLightState('green')
        setDoorsOpen(true)
        burstParticles(pos.machineCenterX, pos.machineCenterY)

        schedule(() => {
          setNoteTransition('left 900ms ease-in-out')
          setNoteLeft(pos.bank)

          schedule(() => {
            addBankStrip(NOTES[idx].stripColor)
            burstParticles(pos.bankCenterX, pos.bankCenterY)
            setNoteOpacity(0)
            setDoorsOpen(false)
            setScreenStatus('idle')
            setSlotGlow('')
            setLightState('green')

            schedule(() => {
              setNoteVisible(false)
              setVerified(false)
              noteIndexRef.current = (idx + 1) % NOTES.length

              schedule(() => {
                runCycle()
              }, PHASE.RESET)
            }, PHASE.BANK)
          }, PHASE.EXIT)
        }, 80)
      }, PHASE.SCANNING)
    }, PHASE.APPROACH)
  }, [getPositions, schedule, burstParticles, addBankStrip])

  const runCycleRef = useRef(null)
  runCycleRef.current = runCycle

  useEffect(() => {
    mountedRef.current = true

    const startDelay = setTimeout(() => {
      runCycleRef.current?.()
    }, 300)

    const handleResize = () => {
      const pos = getPositions()
      if (pos) setNoteTop(pos.noteTop)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      mountedRef.current = false
      clearTimeout(startDelay)
      clearAllTimeouts()
      window.removeEventListener('resize', handleResize)
    }
  }, [clearAllTimeouts, getPositions])

  const screenContent = () => {
    if (screenStatus === 'scanning') return <span>SCANNING...</span>
    if (screenStatus === 'verified') {
      return (
        <>
          <span>VERIFIED</span>
          <span>PASS</span>
        </>
      )
    }
    return <span>IDLE</span>
  }

  return (
    <section className="birr-verify-hero">
      <div className="birr-verify-hero-inner">
        <div className="birr-verify-hero-copy">
          <div className="birr-verify-hero-copy-text">
            <p className="eyebrow">Dashboard</p>
            <h1 className="page-title">Receipt Verification</h1>
            <p className="page-subtitle">Manage your balance and verify transaction receipts</p>
          </div>
          {onVerifyClick && (
            <div className="hero-verify-cta">
              <div className="hero-verify-cta-icon" aria-hidden="true">
                <ShieldCheck size={18} strokeWidth={2} />
              </div>
              <div className="hero-verify-cta-copy">
                <p className="hero-verify-cta-title">Verify Receipt</p>
                <p className="hero-verify-cta-desc">Confirm Telebirr, CBE &amp; bank payments in seconds</p>
              </div>
              <button
                type="button"
                onClick={onVerifyClick}
                className="hero-verify-btn"
              >
                <CheckCircle2 size={14} strokeWidth={2.25} />
                <span>Verify now</span>
              </button>
            </div>
          )}
        </div>

        <div className="birr-verify-scene" ref={sceneRef} aria-hidden="true">
        <div className="birr-verify-conveyor" />

        <div className="verify-machine-wrap" ref={machineRef}>
          <div className="verify-machine-label">
            <div className="verify-machine-title">Check Deresegn</div>
            <div className="verify-machine-subtitle">VERIFY MACHINE</div>
          </div>
          <div className="verify-machine-body">
            <div className={`verify-slot${slotGlow ? ` verify-slot--${slotGlow}` : ''}`} />
            <div className={`verify-screen verify-screen--${screenStatus}`}>
              {screenContent()}
            </div>
            <div className={`verify-light${lightState === 'gold' ? ' verify-light--gold' : ' verify-light--green'}`} />
          </div>
        </div>

        <div className={`verify-doors${doorsOpen ? ' verify-doors--open' : ''}`}>
          <div className="verify-doors-inner">
            <div className="verify-door verify-door-left" />
            <div className="verify-door verify-door-right" />
          </div>
        </div>

        <div className="verify-bank" ref={bankRef}>
          <Landmark className="verify-bank-icon" size={24} strokeWidth={1.5} />
          <div className="verify-bank-label">Secure Bank</div>
          <div className="verify-bank-strips">
            {bankStrips.map((strip) => (
              <div
                key={strip.id}
                className="verify-bank-strip"
                style={{ background: strip.color }}
              />
            ))}
          </div>
        </div>

        {noteVisible && (
          <div
            className={`verify-note${verified ? ' verify-note--verified' : ' verify-note--unverified'}`}
            style={{
              left: noteLeft,
              top: noteTop,
              opacity: noteOpacity,
              transition: `${noteTransition}, opacity 400ms ease`,
            }}
          >
            <img src={NOTES[activeNoteIndex].src} alt="" draggable={false} />
            <span className={`verify-note-stamp${verified ? ' verify-note-stamp--visible' : ''}`}>
              OK
            </span>
          </div>
        )}

        {particles.map((p) => (
          <span
            key={p.id}
            className="verify-particle"
            style={{
              left: p.left,
              top: p.top,
              '--px': p.px,
              '--py': p.py,
            }}
          />
        ))}
        </div>
      </div>
    </section>
  )
}
