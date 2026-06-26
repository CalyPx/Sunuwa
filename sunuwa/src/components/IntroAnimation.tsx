'use client'

import { useEffect, useRef, useCallback } from 'react'

// ── constants ──────────────────────────────────────────────────────────────
const STORAGE_KEY = 'sunuwa_intro_v3'
const EXPIRY_MS   = 30 * 24 * 60 * 60 * 1000
const DEEP        = '#060C18'
const CRIMSON_R   = 200
const CRIMSON_G   = 16
const CRIMSON_B   = 46

// ── helpers ────────────────────────────────────────────────────────────────
function alreadySeen(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    return Date.now() - parseInt(raw, 10) < EXPIRY_MS
  } catch { return false }
}

function markSeen(): void {
  try { localStorage.setItem(STORAGE_KEY, String(Date.now())) } catch { /* noop */ }
}

function reducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

// ── component ──────────────────────────────────────────────────────────────
interface Props { onComplete: () => void }

interface Particle {
  x: number; y: number           // current position
  tx: number; ty: number          // text-assemble target
  nx: number; ny: number          // network-dissolve target
  alpha: number
  size: number
}

interface Node { x: number; y: number }

export default function IntroAnimation({ onComplete }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const rafRef       = useRef<number>(0)
  const doneRef      = useRef(false)

  // particle + network data built once
  const particlesRef = useRef<Particle[]>([])
  const nodesRef     = useRef<Node[]>([])
  const edgesRef     = useRef<[number, number][]>([])
  const signalPathRef = useRef<Node[]>([])

  // ── finish ─────────────────────────────────────────────────────────────
  const finish = useCallback((immediate = false) => {
    if (doneRef.current) return
    doneRef.current = true
    markSeen()
    cancelAnimationFrame(rafRef.current)

    const el = containerRef.current
    if (!el || immediate) { onComplete(); return }
    el.style.transition = 'opacity 0.4s ease'
    el.style.opacity    = '0'
    setTimeout(onComplete, 420)
  }, [onComplete])

  // ── main effect ────────────────────────────────────────────────────────
  useEffect(() => {
    if (alreadySeen()) { onComplete(); return }

    // reduced motion: just fade
    if (reducedMotion()) {
      markSeen()
      const el = containerRef.current
      if (el) {
        el.style.transition = 'opacity 0.3s ease'
        el.style.opacity    = '0'
        setTimeout(onComplete, 320)
      } else { onComplete() }
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // ── resize ────────────────────────────────────────────────────────────
    function resize() {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // ── build node network ────────────────────────────────────────────────
    function buildNetwork() {
      const W = canvas.width
      const H = canvas.height
      const COUNT = 38
      const nodes: Node[] = []

      // spread across viewport with some structure
      for (let i = 0; i < COUNT; i++) {
        nodes.push({
          x: 60 + Math.random() * (W - 120),
          y: 60 + Math.random() * (H - 120),
        })
      }
      nodesRef.current = nodes

      // edges: connect if within 22% of viewport width
      const threshold = W * 0.22
      const edges: [number, number][] = []
      for (let a = 0; a < nodes.length; a++) {
        for (let b = a + 1; b < nodes.length; b++) {
          const dx = nodes[a].x - nodes[b].x
          const dy = nodes[a].y - nodes[b].y
          if (Math.sqrt(dx * dx + dy * dy) < threshold) {
            edges.push([a, b])
          }
        }
      }
      edgesRef.current = edges

      // signal path: greedy walk from node 0
      const path: Node[] = [nodes[0]]
      const visited = new Set([0])
      let cur = 0
      for (let step = 0; step < 22; step++) {
        const next = edges
          .filter(([a, b]) => (a === cur || b === cur) && !visited.has(a === cur ? b : a))
          .map(([a, b]) => a === cur ? b : a)[0]
        if (next === undefined) break
        path.push(nodes[next])
        visited.add(next)
        cur = next
      }
      signalPathRef.current = path
    }

    // ── sample text pixels → particles ────────────────────────────────────
    async function buildParticles() {
      await document.fonts.load('900 80px "Noto Sans Devanagari"')

      const W = canvas.width
      const H = canvas.height

      const off    = document.createElement('canvas')
      off.width    = W
      off.height   = H
      const octx   = off.getContext('2d')!

      const fsz  = Math.min(W / 7, 88)
      const gap  = fsz * 1.35
      const cy   = H / 2

      octx.clearRect(0, 0, W, H)
      octx.fillStyle    = '#ffffff'
      octx.font         = `900 ${fsz}px "Noto Sans Devanagari", sans-serif`
      octx.textAlign    = 'center'
      octx.textBaseline = 'middle'
      octx.fillText('नागरिकको आवाज,', W / 2, cy - gap / 2)
      octx.fillText('सरकारसम्म।',     W / 2, cy + gap / 2)

      const data   = octx.getImageData(0, 0, W, H).data
      const sample = 4 // every Nth pixel
      const pts: { x: number; y: number }[] = []

      for (let y = 0; y < H; y += sample) {
        for (let x = 0; x < W; x += sample) {
          const i = (y * W + x) * 4
          if (data[i + 3] > 100) pts.push({ x, y })
        }
      }

      // cap to ~900 particles for performance
      const MAX  = 900
      const step = pts.length > MAX ? Math.ceil(pts.length / MAX) : 1
      const nodes = nodesRef.current
      const nc    = nodes.length

      const particles: Particle[] = []
      for (let i = 0; i < pts.length; i += step) {
        const tp  = pts[i]
        const ni  = i % nc
        particles.push({
          x:     Math.random() * W,
          y:     Math.random() * H,
          tx:    tp.x,
          ty:    tp.y,
          nx:    nodes[ni].x + (Math.random() - 0.5) * 50,
          ny:    nodes[ni].y + (Math.random() - 0.5) * 50,
          alpha: 0,
          size:  Math.random() * 1.4 + 0.5,
        })
      }
      particlesRef.current = particles
    }

    // ── animation loop ─────────────────────────────────────────────────────
    let startTime = 0

    function drawFrame(now: number) {
      if (doneRef.current) return

      if (startTime === 0) startTime = now
      const t = now - startTime

      const W = canvas.width
      const H = canvas.height
      const cx = W / 2
      const cy = H / 2

      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = DEEP
      ctx.fillRect(0, 0, W, H)

      // ── PULSE 1 (700–1300ms) ───────────────────────────────────────────
      if (t >= 700 && t < 1300) {
        const p  = (t - 700) / 600
        const r  = easeInOut(p) * Math.min(W, H) * 0.38
        const al = (1 - p) * 0.55
        const g  = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
        g.addColorStop(0, `rgba(${CRIMSON_R},${CRIMSON_G},${CRIMSON_B},${al})`)
        g.addColorStop(1, `rgba(${CRIMSON_R},${CRIMSON_G},${CRIMSON_B},0)`)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fill()
      }

      // ── PULSE 2 (1300–2000ms) ──────────────────────────────────────────
      if (t >= 1300 && t < 2000) {
        const p  = (t - 1300) / 700
        const r  = easeInOut(p) * Math.min(W, H) * 0.48
        const al = (1 - p) * 0.85
        const g  = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
        g.addColorStop(0, `rgba(220,38,38,${al})`)
        g.addColorStop(0.35, `rgba(${CRIMSON_R},${CRIMSON_G},${CRIMSON_B},${al * 0.65})`)
        g.addColorStop(1,   `rgba(${CRIMSON_R},${CRIMSON_G},${CRIMSON_B},0)`)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fill()
      }

      // ── ASSEMBLE (2000–3300ms) ─────────────────────────────────────────
      if (t >= 2000 && t < 3300) {
        const p    = Math.min((t - 2000) / 1300, 1)
        const ease = easeInOut(p)

        for (const par of particlesRef.current) {
          par.alpha = Math.min(par.alpha + 0.03, 1)
          // spring toward text target
          par.x += (par.tx - par.x) * (0.04 + ease * 0.04)
          par.y += (par.ty - par.y) * (0.04 + ease * 0.04)

          ctx.globalAlpha = par.alpha * ease
          ctx.fillStyle   = '#ffffff'
          ctx.beginPath()
          ctx.arc(par.x, par.y, par.size, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1
      }

      // ── HOLD + SHIMMER (3300–3600ms) ───────────────────────────────────
      if (t >= 3300 && t < 3600) {
        // draw held particles
        for (const par of particlesRef.current) {
          ctx.globalAlpha = par.alpha
          ctx.fillStyle   = '#ffffff'
          ctx.beginPath()
          ctx.arc(par.x, par.y, par.size, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1

        // horizontal shimmer sweep
        const sp  = (t - 3300) / 300
        const sx  = sp * (W + 160) - 80
        const shg = ctx.createLinearGradient(sx - 70, 0, sx + 70, 0)
        shg.addColorStop(0,   'rgba(255,255,255,0)')
        shg.addColorStop(0.5, 'rgba(255,255,255,0.22)')
        shg.addColorStop(1,   'rgba(255,255,255,0)')
        ctx.fillStyle = shg
        ctx.fillRect(0, 0, W, H)
      }

      // ── DISSOLVE → NETWORK (3600–4100ms) ──────────────────────────────
      if (t >= 3600 && t < 4100) {
        const p = (t - 3600) / 500

        for (const par of particlesRef.current) {
          // drift toward network node positions
          par.x += (par.nx - par.x) * 0.05
          par.y += (par.ny - par.y) * 0.05
          par.alpha = Math.max(0, 1 - p * 0.8)

          ctx.globalAlpha = par.alpha
          ctx.fillStyle   = '#8baed4'
          ctx.beginPath()
          ctx.arc(par.x, par.y, par.size * 0.8, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1

        // network edges fading in
        const edgeAlpha = easeInOut(p) * 0.35
        ctx.globalAlpha  = edgeAlpha
        ctx.strokeStyle  = `rgba(${CRIMSON_R},${CRIMSON_G},${CRIMSON_B},0.6)`
        ctx.lineWidth    = 0.6
        for (const [a, b] of edgesRef.current) {
          const na = nodesRef.current[a]
          const nb = nodesRef.current[b]
          ctx.beginPath()
          ctx.moveTo(na.x, na.y)
          ctx.lineTo(nb.x, nb.y)
          ctx.stroke()
        }
        ctx.globalAlpha = 1
      }

      // ── SIGNAL (4100–4500ms) ───────────────────────────────────────────
      if (t >= 4100 && t < 4500) {
        const p = (t - 4100) / 400

        // edges
        ctx.globalAlpha = 0.35
        ctx.strokeStyle = `rgba(${CRIMSON_R},${CRIMSON_G},${CRIMSON_B},0.5)`
        ctx.lineWidth   = 0.6
        for (const [a, b] of edgesRef.current) {
          const na = nodesRef.current[a]
          const nb = nodesRef.current[b]
          ctx.beginPath()
          ctx.moveTo(na.x, na.y)
          ctx.lineTo(nb.x, nb.y)
          ctx.stroke()
        }

        // nodes
        ctx.globalAlpha = 0.45
        ctx.fillStyle   = '#6b8fb5'
        for (const n of nodesRef.current) {
          ctx.beginPath()
          ctx.arc(n.x, n.y, 2.2, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1

        // signal dot
        const path = signalPathRef.current
        if (path.length >= 2) {
          const total = path.length - 1
          const raw   = p * total
          const seg   = Math.min(Math.floor(raw), total - 1)
          const frac  = raw - seg
          const from  = path[seg]
          const to    = path[seg + 1]
          const sx    = from.x + (to.x - from.x) * frac
          const sy    = from.y + (to.y - from.y) * frac

          // glow
          const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 14)
          glow.addColorStop(0, `rgba(${CRIMSON_R},${CRIMSON_G},${CRIMSON_B},0.7)`)
          glow.addColorStop(1, `rgba(${CRIMSON_R},${CRIMSON_G},${CRIMSON_B},0)`)
          ctx.fillStyle = glow
          ctx.beginPath()
          ctx.arc(sx, sy, 14, 0, Math.PI * 2)
          ctx.fill()

          // core
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.arc(sx, sy, 2.8, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // ── DONE (≥ 4500ms) ────────────────────────────────────────────────
      if (t >= 4500) {
        finish()
        return
      }

      rafRef.current = requestAnimationFrame(drawFrame)
    }

    // ── kick off ───────────────────────────────────────────────────────────
    buildNetwork()
    buildParticles().then(() => {
      if (doneRef.current) return
      rafRef.current = requestAnimationFrame(drawFrame)
    })

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [finish, onComplete])

  return (
    <div
      ref={containerRef}
      onClick={() => finish()}
      style={{
        position:   'fixed',
        inset:      0,
        zIndex:     9999,
        background: DEEP,
        cursor:     'pointer',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />

      {/* skip hint */}
      <span
        style={{
          position:      'absolute',
          bottom:        28,
          right:         32,
          fontSize:      11,
          fontFamily:    'system-ui, -apple-system, sans-serif',
          fontWeight:    600,
          letterSpacing: '0.12em',
          color:         'rgba(255,255,255,0.22)',
          textTransform: 'uppercase',
          pointerEvents: 'none',
          userSelect:    'none',
        }}
      >
        Click to skip
      </span>
    </div>
  )
}
