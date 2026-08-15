import { useEffect, useRef } from 'react'
import { useLocale } from '../i18n/LocaleContext'
import './BirrVerifyHero.css'

const NOTE_W = 96

const NOTES = [
  { src: '/200BirrNote.jpg', lbl: '200 ETB', cls: 's200' },
  { src: '/100BirrNote.jpg', lbl: '100 ETB', cls: 's100' },
  { src: '/50BirrNote.png', lbl: '50 ETB', cls: 's50' },
]

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

export default function BirrVerifyHero() {
  const { t } = useLocale()
  const sceneRef = useRef(null)
  const dhRef = useRef(null)
  const hexRef = useRef(null)
  const dialRef = useRef(null)
  const slotRef = useRef(null)
  const smRef = useRef(null)
  const sfRef = useRef(null)
  const ssRef = useRef(null)
  const hiRef = useRef(null)
  const l1Ref = useRef(null)
  const l2Ref = useRef(null)
  const l3Ref = useRef(null)
  const dlRef = useRef(null)
  const drRef = useRef(null)
  const machRef = useRef(null)
  const stackRef = useRef(null)
  const beamRef = useRef(null)
  const dotsRef = useRef([])

  useEffect(() => {
    const hero = dhRef.current
    const scene = sceneRef.current
    if (!hero || !scene) return

    const hxC = hexRef.current
    const dC = dialRef.current
    const slot = slotRef.current
    const sm = smRef.current
    const sf = sfRef.current
    const ss = ssRef.current
    const hxi = hiRef.current
    const l1 = l1Ref.current
    const l2 = l2Ref.current
    const l3 = l3Ref.current
    const dL = dlRef.current
    const dR = drRef.current
    const mach = machRef.current
    const stack = stackRef.current
    const beam = beamRef.current
    const dots = dotsRef.current.filter(Boolean)

    if (!hxC || !dC || !slot || !sm || !sf || !ss || !hxi || !mach || !stack || !beam || !dL || !dR) {
      return undefined
    }

    const hCtx = hxC.getContext('2d')
    const dCtx = dC.getContext('2d')

    let ni = 0
    const strips = []
    const timers = []
    let running = true
    let hxAng = 0
    let dialAng = 0
    let rafId = 0
    let cycleBusy = false
    let cycleGen = 0

    const drawHex = (ang, highlight) => {
      hCtx.clearRect(0, 0, 58, 58)
      hCtx.save()
      hCtx.translate(29, 29)
      hCtx.rotate(ang)
      for (let s = 0; s < 6; s += 1) {
        const a0 = (s * Math.PI) / 3 - Math.PI / 6
        const a1 = ((s + 1) * Math.PI) / 3 - Math.PI / 6
        const c = highlight
          ? (s % 2 ? 'rgba(62,143,98,0.75)' : 'rgba(62,143,98,0.3)')
          : (s % 2 ? 'rgba(198,162,78,0.5)' : 'rgba(198,162,78,0.18)')
        hCtx.beginPath()
        hCtx.moveTo(0, 0)
        hCtx.lineTo(Math.cos(a0) * 27, Math.sin(a0) * 27)
        hCtx.lineTo(Math.cos(a1) * 27, Math.sin(a1) * 27)
        hCtx.closePath()
        hCtx.fillStyle = c
        hCtx.fill()
        hCtx.strokeStyle = 'rgba(6,14,12,0.55)'
        hCtx.lineWidth = 1
        hCtx.stroke()
      }
      hCtx.beginPath()
      hCtx.arc(0, 0, 27, 0, Math.PI * 2)
      hCtx.strokeStyle = highlight ? 'rgba(62,143,98,0.85)' : 'rgba(198,162,78,0.5)'
      hCtx.lineWidth = 1.5
      hCtx.stroke()
      hCtx.restore()
    }

    const drawDial = (ang) => {
      dCtx.clearRect(0, 0, 50, 50)
      dCtx.beginPath()
      dCtx.arc(25, 25, 22, 0, Math.PI * 2)
      dCtx.strokeStyle = 'rgba(198,162,78,0.32)'
      dCtx.lineWidth = 1.5
      dCtx.stroke()
      for (let i = 0; i < 12; i += 1) {
        const a = (i * Math.PI) / 6
        const x1 = 25 + Math.cos(a) * 18
        const y1 = 25 + Math.sin(a) * 18
        const x2 = 25 + Math.cos(a) * 22
        const y2 = 25 + Math.sin(a) * 22
        dCtx.beginPath()
        dCtx.moveTo(x1, y1)
        dCtx.lineTo(x2, y2)
        dCtx.strokeStyle = 'rgba(198,162,78,0.38)'
        dCtx.lineWidth = 1
        dCtx.stroke()
      }
      dCtx.save()
      dCtx.translate(25, 25)
      dCtx.rotate(ang)
      dCtx.beginPath()
      dCtx.moveTo(0, 0)
      dCtx.lineTo(0, -14)
      dCtx.strokeStyle = 'rgba(198,162,78,0.8)'
      dCtx.lineWidth = 2
      dCtx.lineCap = 'round'
      dCtx.stroke()
      dCtx.restore()
      dCtx.beginPath()
      dCtx.arc(25, 25, 3, 0, Math.PI * 2)
      dCtx.fillStyle = 'rgba(198,162,78,0.7)'
      dCtx.fill()
    }

    drawDial(0)

    const loop = () => {
      if (!running) return
      hxAng += 0.018
      dialAng += 0.007
      drawHex(hxAng, false)
      drawDial(dialAng)
      rafId = requestAnimationFrame(loop)
    }
    loop()

    const setDot = (i) => {
      dots.forEach((d, x) => d.classList.toggle('on', x === i))
    }

    const setLights = (mode) => {
      ;[l1, l2, l3].forEach((light, i) => {
        light.className = 'dh-light'
        if (mode === 'gold' && i < 2) light.classList.add('a')
        if (mode === 'green') light.classList.add('g')
      })
    }

    const openDoors = () => {
      dL.classList.add('open')
      dR.classList.add('open')
    }

    const closeDoors = () => {
      dL.classList.remove('open')
      dR.classList.remove('open')
    }

    const startVibrate = () => mach.classList.add('vibrate')
    const stopVibrate = () => mach.classList.remove('vibrate')

    const T = (fn, ms) => {
      const id = setTimeout(fn, ms)
      timers.push(id)
      return id
    }

    const clearTs = () => {
      timers.forEach((id) => {
        clearTimeout(id)
        clearInterval(id)
      })
      timers.length = 0
    }

    const sweepNotes = () => {
      hero.querySelectorAll('.dh-note,.dh-particle').forEach((el) => el.remove())
    }

    const alive = (gen) => running && gen === cycleGen

    const W = () => hero.offsetWidth || scene.offsetWidth || 680

    const readSceneVar = (name, fallback) => {
      const raw = getComputedStyle(scene).getPropertyValue(name).trim()
      const value = parseFloat(raw)
      return Number.isNaN(value) ? fallback : value
    }

    const centerX = (el) => {
      if (!el) return W() / 2
      const rect = el.getBoundingClientRect()
      const heroRect = hero.getBoundingClientRect()
      return rect.left - heroRect.left + rect.width / 2
    }

    const MX = () => centerX(mach)
    const VX = () => centerX(hero.querySelector('.dh-vault'))
    const railB = () => readSceneVar('--dh-rail-bottom', 38)
    const noteHalf = () => {
      const sample = hero.querySelector('.dh-note-inner')
      const width = sample?.offsetWidth || readSceneVar('--dh-note-w', NOTE_W)
      return width / 2
    }
    const slotInsertBottom = () => {
      const slotRect = slot.getBoundingClientRect()
      const heroRect = hero.getBoundingClientRect()
      return heroRect.bottom - slotRect.top + 6
    }

    const burst = (cx, cy, green) => {
      for (let i = 0; i < 8; i += 1) {
        const p = document.createElement('div')
        p.className = `dh-particle${green ? ' gr' : ''}`
        const a = (i / 8) * Math.PI * 2
        const d = 20 + Math.random() * 16
        p.style.left = `${cx - 2}px`
        p.style.top = `${cy - 2}px`
        p.style.setProperty('--dx', `${Math.cos(a) * d}px`)
        p.style.setProperty('--dy', `${Math.sin(a) * d}px`)
        hero.appendChild(p)
        T(() => p.parentNode?.removeChild(p), 780)
      }
    }

    const addStrip = (cls) => {
      strips.push(cls)
      if (strips.length > 6) strips.shift()
      stack.innerHTML = ''
      strips.forEach((c) => {
        const s = document.createElement('div')
        s.className = `dh-v-strip ${c}`
        stack.appendChild(s)
        requestAnimationFrame(() => requestAnimationFrame(() => s.classList.add('show')))
      })
    }

    const makeNote = (src) => {
      const wrap = document.createElement('div')
      wrap.className = 'dh-note'
      const inner = document.createElement('div')
      inner.className = 'dh-note-inner'
      const img = document.createElement('img')
      img.src = src
      img.alt = ''
      const blu = document.createElement('div')
      blu.className = 'dh-note-blu'
      const holo = document.createElement('div')
      holo.className = 'dh-note-holo'
      const stamp = document.createElement('div')
      stamp.className = 'dh-stamp'
      stamp.innerHTML = '<span class="dh-stamp-txt">PASS<br>✓ OK</span>'
      inner.appendChild(img)
      inner.appendChild(blu)
      inner.appendChild(holo)
      inner.appendChild(stamp)
      wrap.appendChild(inner)
      hero.appendChild(wrap)
      return { wrap, inner, stamp }
    }

    const setNotePos = (note, x, bottomPx) => {
      note.wrap.style.left = `${x - noteHalf()}px`
      note.wrap.style.bottom = `${bottomPx}px`
    }

    const moveNote = (note, fromX, toX, fromB, toB, dur, gen, cb) => {
      let start = null
      const frame = (ts) => {
        if (!alive(gen)) return
        if (!start) start = ts
        const p = Math.min((ts - start) / dur, 1)
        const ep = easeInOut(p)
        setNotePos(note, fromX + (toX - fromX) * ep, fromB + (toB - fromB) * ep)
        if (p < 1) requestAnimationFrame(frame)
        else if (cb) cb()
      }
      requestAnimationFrame(frame)
    }

    const phaseReceive = (note, data, vaultX, gen) => {
      if (!alive(gen)) return
      setDot(5)
      dialAng += Math.PI * 0.45
      addStrip(data.cls)
      burst(vaultX, hero.offsetHeight - 70, true)
      note.wrap.style.transition = 'opacity 0.4s'
      note.wrap.style.opacity = '0'
      T(() => {
        if (!alive(gen)) return
        closeDoors()
        slot.className = 'dh-slot'
        setLights('')
      }, 320)
      T(() => {
        note.wrap.parentNode?.removeChild(note.wrap)
        if (gen !== cycleGen) return
        cycleBusy = false
        T(() => {
          if (running && gen === cycleGen) runCycle()
        }, 420)
      }, 500)
    }

    const phaseExit = (note, data, machX, insideB, railBottom, vaultX, gen) => {
      if (!alive(gen)) return
      setDot(4)
      moveNote(note, machX, machX, insideB, railBottom, 300, gen, () => {
        note.inner.style.transform = 'perspective(200px) rotateY(4deg)'
        moveNote(note, machX, vaultX, railBottom, railBottom, 950, gen, () => {
          phaseReceive(note, data, vaultX, gen)
        })
      })
    }

    const phaseVerified = (note, data, machX, insideB, railBottom, vaultX, gen) => {
      if (!alive(gen)) return
      setDot(3)
      sm.textContent = 'VERIFIED'
      sm.className = 'dh-scr-main green'
      ss.textContent = 'AUTHENTICATED ✓'
      setLights('green')
      hxi.style.color = '#C6A24E'

      note.inner.style.filter = 'blur(0) brightness(1.03)'
      note.inner.style.opacity = '1'
      note.inner.style.transform = 'perspective(200px) rotateY(0deg) scale(1)'
      note.wrap.classList.add('verified')
      note.wrap.classList.remove('pending')
      note.stamp.classList.add('pop')

      burst(machX, hero.offsetHeight - 110, false)
      openDoors()
      T(() => phaseExit(note, data, machX, insideB, railBottom, vaultX, gen), 650)
    }

    const phaseInside = (note, data, machX, insideB, railBottom, vaultX, gen) => {
      if (!alive(gen)) return
      setDot(2)
      note.inner.style.opacity = '0.15'
      note.inner.style.transform = 'perspective(200px) rotateY(-8deg) scale(0.9)'

      slot.classList.remove('gold')
      slot.classList.add('green')
      sm.textContent = 'SCANNING'
      sm.className = 'dh-scr-main green'
      ss.textContent = 'VERIFYING...'
      sf.style.width = '0%'
      T(() => {
        if (!alive(gen)) return
        sf.style.width = '100%'
        sf.className = 'dh-scr-fill green'
      }, 40)

      startVibrate()
      beam.style.height = '0px'
      beam.style.background = 'linear-gradient(to bottom,transparent,rgba(62,143,98,0.7),transparent)'
      beam.classList.add('on')

      let bStart = null
      const animBeam = (ts) => {
        if (!alive(gen)) {
          beam.classList.remove('on')
          return
        }
        if (!bStart) bStart = ts
        const p = (ts - bStart) / 900
        if (p > 1) {
          beam.classList.remove('on')
          return
        }
        beam.style.height = `${Math.sin(p * Math.PI) * 48}px`
        requestAnimationFrame(animBeam)
      }
      requestAnimationFrame(animBeam)

      let blinkN = 0
      const blinkId = setInterval(() => {
        if (!alive(gen)) {
          clearInterval(blinkId)
          return
        }
        blinkN += 1
        hxi.style.color = blinkN % 2 ? '#3E8F62' : 'rgba(62,143,98,0.3)'
        hxAng += 0.06
      }, 150)
      timers.push(blinkId)

      T(() => {
        clearInterval(blinkId)
        stopVibrate()
        phaseVerified(note, data, machX, insideB, railBottom, vaultX, gen)
      }, 1100)
    }

    const phaseEnter = (note, data, machX, railBottom, vaultX, gen) => {
      if (!alive(gen)) return
      setDot(1)
      slot.classList.add('gold')
      setLights('gold')
      sm.textContent = 'CERTIFY'
      sm.className = 'dh-scr-main'
      ss.textContent = 'INSERTING...'
      sf.style.width = '30%'

      const slotBottom = slotInsertBottom()
      const insideB = slotBottom - 12

      moveNote(note, machX, machX, railBottom, insideB, 380, gen, () => {
        phaseInside(note, data, machX, insideB, railBottom, vaultX, gen)
      })
    }

    const runCycle = () => {
      if (!running || cycleBusy) return
      cycleBusy = true
      cycleGen += 1
      const gen = cycleGen
      sweepNotes()

      const data = NOTES[ni % NOTES.length]
      ni += 1
      const note = makeNote(data.src)
      note.wrap.classList.add('pending')
      note.inner.style.filter = 'blur(2.5px)'
      note.inner.style.transform = 'perspective(200px) rotateY(-5deg)'
      note.inner.style.transition = 'none'

      sm.textContent = 'IDLE'
      sm.className = 'dh-scr-main'
      ss.textContent = 'AWAITING NOTE'
      sf.style.width = '0%'
      sf.className = 'dh-scr-fill'
      setLights('')
      slot.className = 'dh-slot'
      hxi.style.color = '#3E8F62'

      const startX = -120
      const machX = MX()
      const vaultX = VX()
      const bottom = railB()
      setNotePos(note, startX, bottom)
      setDot(0)

      T(() => {
        if (!alive(gen)) return
        note.inner.style.transition = 'filter 0.5s,transform 0.4s'
        moveNote(note, startX, machX, bottom, bottom, 1200, gen, () => {
          phaseEnter(note, data, machX, bottom, vaultX, gen)
        })
      }, 100)
    }

    const halt = () => {
      running = false
      cycleBusy = false
      cycleGen += 1
      clearTs()
      cancelAnimationFrame(rafId)
      stopVibrate()
      beam.classList.remove('on')
      sweepNotes()
    }

    const obs = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) {
          halt()
        } else if (!running) {
          running = true
          loop()
          runCycle()
        }
      })
    })
    obs.observe(scene)

    runCycle()

    return () => {
      halt()
      obs.disconnect()
    }
  }, [])

  return (
    <section className="birr-verify-hero" aria-label={t('hero.title')}>
      <div className="birr-verify-hero-inner">
        <div className="birr-verify-hero-copy">
          <h1 className="birr-verify-hero-title">{t('hero.title')}</h1>
          <p className="birr-verify-hero-alt">{t('hero.brandAlt')}</p>
          <p className="birr-verify-hero-sub">{t('hero.body')}</p>
          <p className="birr-verify-hero-banks">{t('hero.coverage')}</p>
        </div>

        <div className="birr-verify-scene" ref={sceneRef} aria-hidden="true">
          <div className="dh" ref={dhRef}>
            <div className="dh-entry">
              <div className="dh-entry-top">
                <div className="dh-entry-inner"><div className="dh-entry-dot" /></div>
              </div>
              <div className="dh-entry-post" />
              <div className="dh-entry-lbl">ENTRY<br />GATE</div>
            </div>

            <div className="dh-machine" ref={machRef}>
              <div className="dh-m-label">
                <span className="dh-m-name">Tamagn Check</span>
                <span className="dh-m-sub">AI VERIFY MACHINE</span>
              </div>
              <div className="dh-m-body">
                <div className="dh-m-side-l" />
                <div className="dh-m-side-b" />
                <div className="dh-m-face">
                  <div className="dh-m-top-stripe" />
                  <div className="dh-m-corner tl" /><div className="dh-m-corner tr" />
                  <div className="dh-m-corner bl" /><div className="dh-m-corner br" />
                  <div className="dh-slot-wrap">
                    <div className="dh-slot" ref={slotRef}>
                      <div className="dh-slot-teeth">
                        {Array.from({ length: 12 }).map((_, i) => (
                          <div key={i} className="dh-slot-tooth" />
                        ))}
                      </div>
                    </div>
                    <span className="dh-slot-label">INPUT SLOT</span>
                  </div>
                  <div className="dh-hex-ring">
                    <canvas ref={hexRef} id="dhHC" width="58" height="58" />
                    <div className="dh-hex-inner" ref={hiRef}>⬡</div>
                  </div>
                  <div className="dh-screen">
                    <div className="dh-screen-scanline" />
                    <div className="dh-screen-content">
                      <span className="dh-scr-main" ref={smRef}>IDLE</span>
                      <div className="dh-scr-bar"><div className="dh-scr-fill" ref={sfRef} /></div>
                      <span className="dh-scr-sub" ref={ssRef}>AWAITING NOTE</span>
                    </div>
                  </div>
                  <div className="dh-m-bottom">
                    <div className="dh-lights">
                      <div className="dh-light" ref={l1Ref} />
                      <div className="dh-light" ref={l2Ref} />
                      <div className="dh-light" ref={l3Ref} />
                    </div>
                    <span className="dh-m-ver">DRS-3D</span>
                  </div>
                </div>
              </div>
              <div className="dh-m-feet"><div className="dh-m-foot" /><div className="dh-m-foot" /></div>
            </div>

            <div className="dh-door-wrap">
              <div className="dh-door-l" ref={dlRef}><div className="dh-door-etch"><div className="dh-door-sym" /></div></div>
              <div className="dh-door-r" ref={drRef}><div className="dh-door-etch"><div className="dh-door-sym" /></div></div>
            </div>

            <div className="dh-vault">
              <div className="dh-vault-body">
                <div className="dh-vault-top" />
                <div className="dh-vault-side-r" />
                <div className="dh-vault-dial">
                  <canvas ref={dialRef} width="50" height="50" />
                  <div className="dh-vault-dial-center">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <circle cx="7" cy="7" r="5" stroke="#C6A24E" strokeWidth="1.2" />
                      <path d="M7 3v4l3 2" stroke="#C6A24E" strokeWidth="1" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
                <span className="dh-vault-lbl">Secure Vault</span>
                <div className="dh-vault-div" />
                <div className="dh-vault-stack" ref={stackRef} />
              </div>
            </div>

            <div className="dh-scan-beam" ref={beamRef} />

            <div className="dh-rail">
              <div className="dh-rail-line" />
              <div className="dh-rail-top" />
              <div className="dh-rail-glow" />
            </div>
            <div className="dh-floor"><div className="dh-floor-grid" /></div>

            <div className="dh-phase-bar">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`dh-ph${i === 0 ? ' on' : ''}`}
                  ref={(el) => { dotsRef.current[i] = el }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
