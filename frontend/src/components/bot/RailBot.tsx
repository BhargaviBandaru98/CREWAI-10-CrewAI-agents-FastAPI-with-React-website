import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useLocation } from 'react-router-dom'
import CrewBot from './CrewBot'
import BotBubble from './BotBubble'
import { useBot, type BotPoint, type BotState } from '../../context/BotContext'

interface Stop {
  el: HTMLElement
  text: string
  state: BotState
  point: BotPoint
}

const BOT_SIZE = 96

/**
 * CrewBot inside its own reserved rail (a real layout column, so it never covers content).
 * Sections mark themselves with data-bot-stop / data-bot-text / data-bot-state / data-bot-point.
 * As the visitor scrolls, CrewBot glides along the rail beside the active section and
 * changes expression and message. When a workflow diagram is on screen it hands over to
 * the bot inside that diagram.
 */
export default function RailBot() {
  const { visible, laneActive, override, paused } = useBot()
  const location = useLocation()
  const wrap = useRef<HTMLDivElement>(null)
  const botEl = useRef<HTMLDivElement>(null)
  const progressEl = useRef<HTMLDivElement>(null)
  const [stop, setStop] = useState<Omit<Stop, 'el'>>({ text: 'Hi! I am CrewBot.', state: 'wave', point: 'right' })
  const [moving, setMoving] = useState(false)
  const [lowerHalf, setLowerHalf] = useState(false)

  useEffect(() => {
    if (!visible) return
    const container = wrap.current
    const bot = botEl.current
    if (!container || !bot) return

    let stops: Stop[] = []
    const collect = () => {
      stops = Array.from(document.querySelectorAll<HTMLElement>('[data-bot-stop]')).map((el) => ({
        el,
        text: el.dataset.botText ?? '',
        state: (el.dataset.botState as BotState) ?? 'idle',
        point: (el.dataset.botPoint as BotPoint) ?? 'right',
      }))
    }
    collect()
    const mo = new MutationObserver(() => collect())
    mo.observe(document.querySelector('main') ?? document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-bot-text', 'data-bot-state'] })

    const yTo = gsap.quickTo(bot, 'y', { duration: 0.9, ease: 'power3.out' })
    const xTo = gsap.quickTo(bot, 'x', { duration: 1.1, ease: 'power3.out' })
    let settleTimer = 0
    let lastIdx = -1
    let raf = 0

    const update = () => {
      raf = 0
      const h = container.clientHeight
      const vh = window.innerHeight
      const anchor = vh * 0.45
      // active stop = the last one whose top has passed the anchor line
      let idx = 0
      for (let i = 0; i < stops.length; i++) if (stops[i].el.getBoundingClientRect().top <= anchor) idx = i
      const s = stops[idx]
      let p = 0
      if (s) {
        const r = s.el.getBoundingClientRect()
        // 0 when the section top reaches the navbar, 1 when its bottom leaves the anchor line
        p = Math.min(1, Math.max(0, (64 - r.top) / Math.max(r.height - anchor + 64, 1)))
      }
      // glide down and back up along each section, so the motion is continuous between sections
      const top = 24
      const bottom = Math.max(top + 40, h - BOT_SIZE * 1.17 - 120)
      const y = top + (bottom - top) * Math.sin(p * Math.PI) * 0.9
      yTo(y)
      xTo(Math.sin(p * Math.PI * 2) * 14)
      setLowerHalf(y > h * 0.5)
      if (s && idx !== lastIdx) {
        lastIdx = idx
        setStop({ text: s.text, state: s.state, point: s.point })
      }
      const doc = document.documentElement
      const total = doc.scrollHeight - vh
      if (progressEl.current) progressEl.current.style.transform = `scaleY(${total > 0 ? window.scrollY / total : 0})`
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
      setMoving(true)
      window.clearTimeout(settleTimer)
      settleTimer = window.setTimeout(() => setMoving(false), 380)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    const t = window.setTimeout(() => { collect(); update() }, 400)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      window.clearTimeout(settleTimer)
      window.clearTimeout(t)
      if (raf) cancelAnimationFrame(raf)
      mo.disconnect()
    }
  }, [visible, location.pathname])

  if (!visible) return null
  const msg = override ?? stop
  const state: BotState = override?.state ?? (moving && !paused ? 'move' : stop.state)
  const showBubble = !moving || !!override

  return (
    <div ref={wrap} className="relative h-full w-full" aria-label="CrewBot guide">
      {/* the glowing path CrewBot travels along */}
      <div className="absolute left-1/2 top-4 bottom-4 w-px -translate-x-1/2 bg-line" aria-hidden />
      <div
        ref={progressEl}
        className="absolute left-1/2 top-4 bottom-4 w-[3px] -translate-x-1/2 origin-top rounded-full"
        style={{ background: 'linear-gradient(var(--violet), var(--cyan))', boxShadow: '0 0 12px var(--violet)', transform: 'scaleY(0)' }}
        aria-hidden
      />
      <div
        ref={botEl}
        className="absolute left-0 right-0 top-0 flex flex-col items-center transition-opacity duration-500"
        style={{ opacity: laneActive ? 0 : 1, pointerEvents: laneActive ? 'none' : 'auto' }}
      >
        {lowerHalf && showBubble && msg.text && <BotBubble text={msg.text} tail="bottom" className="mb-2 w-[150px]" />}
        <CrewBot size={BOT_SIZE} state={state} point={msg.point ?? 'right'} />
        {!lowerHalf && showBubble && msg.text && <BotBubble text={msg.text} tail="top" className="mt-1 w-[150px]" />}
      </div>
      {laneActive && (
        <p className="reveal absolute inset-x-3 top-1/2 rounded-xl border border-line bg-surface-solid px-2 py-2 text-center text-[11px] text-muted">
          CrewBot jumped into the workflow
          <span className="block text-lg">→</span>
        </p>
      )}
    </div>
  )
}
