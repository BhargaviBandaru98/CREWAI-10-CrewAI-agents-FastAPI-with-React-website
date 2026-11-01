import { useEffect, useId, useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import type { BotPoint, BotState } from '../../context/BotContext'
import { useBot } from '../../context/BotContext'

interface Props {
  state?: BotState
  point?: BotPoint
  size?: number
  className?: string
  title?: string
}

/** Arm rotation (degrees) for each pointing direction. Arms hang down at 0deg. */
const POINT_RIGHT: Record<BotPoint, number> = { right: -95, down: -28, up: -160, left: -20 }
const POINT_LEFT: Record<BotPoint, number> = { left: 95, down: 28, up: 160, right: 20 }

/**
 * CrewBot: the CREWAI mascot. Pure SVG, animated with GSAP.
 * States: idle, wave, move, look, point, think, explain, celebrate, react.
 */
export default function CrewBot({ state = 'idle', point = 'right', size = 120, className = '', title = 'CrewBot' }: Props) {
  const uid = useId().replace(/:/g, '')
  const { paused } = useBot()
  const scope = useRef<SVGSVGElement>(null)
  const tl = useRef<gsap.core.Timeline | null>(null)

  // ---- per-state animation ------------------------------------------------
  useLayoutEffect(() => {
    const root = scope.current
    if (!root) return
    const q = (s: string) => root.querySelector(`[data-part="${s}"]`)
    const body = q('body')
    const armL = q('armL')
    const armR = q('armR')
    const eyes = q('eyes')
    const eyesOpen = q('eyesOpen')
    const eyesHappy = q('eyesHappy')
    const mouth = root.querySelectorAll('[data-part="mouthbar"]')
    const dots = root.querySelectorAll('[data-part="thinkdot"]')
    const sparks = root.querySelectorAll('[data-part="spark"]')
    const jet = q('jet')
    const shadow = q('shadow')

    tl.current?.kill()
    const ctx = gsap.context(() => {
      // reset to a neutral pose
      gsap.set(body, { y: 0, rotation: 0, scale: 1, svgOrigin: '60 120' })
      gsap.set(armL, { rotation: 8, svgOrigin: '41 88' })
      gsap.set(armR, { rotation: -8, svgOrigin: '79 88' })
      gsap.set(eyes, { x: 0, y: 0, scaleY: 1, svgOrigin: '60 51' })
      gsap.set(eyesOpen, { opacity: 1 })
      gsap.set(eyesHappy, { opacity: 0 })
      gsap.set(mouth, { scaleY: 0.35, svgOrigin: '60 61' })
      gsap.set(dots, { opacity: 0, y: 0 })
      gsap.set(sparks, { opacity: 0, scale: 0.2, transformOrigin: '50% 50%' })
      gsap.set(jet, { scaleY: 1, opacity: 0.85, svgOrigin: '60 116' })
      gsap.set(shadow, { scale: 1, opacity: 0.35, svgOrigin: '60 133' })

      const t = gsap.timeline({ repeat: -1, defaults: { ease: 'sine.inOut' } })
      tl.current = t

      // gentle hover is part of every state
      const hover = gsap.timeline({ repeat: -1, yoyo: true })
      hover.to(body, { y: -5, duration: 1.6, ease: 'sine.inOut' }, 0)
      hover.to(shadow, { scale: 0.82, opacity: 0.22, duration: 1.6, ease: 'sine.inOut' }, 0)
      hover.to(jet, { scaleY: 1.25, opacity: 1, duration: 0.8, ease: 'sine.inOut', repeat: 1, yoyo: true }, 0)

      switch (state) {
        case 'wave':
          t.to(armR, { rotation: -150, duration: 0.35, ease: 'back.out(2)' })
            .to(armR, { rotation: -120, duration: 0.22, repeat: 5, yoyo: true })
            .to(eyesOpen, { opacity: 0, duration: 0.1 }, 0.2)
            .to(eyesHappy, { opacity: 1, duration: 0.1 }, 0.2)
            .to(armR, { rotation: -8, duration: 0.5, ease: 'power2.inOut' })
            .to(eyesHappy, { opacity: 0, duration: 0.1 }, '<')
            .to(eyesOpen, { opacity: 1, duration: 0.1 }, '<')
            .to({}, { duration: 1.6 })
          break
        case 'move':
          t.to(body, { rotation: point === 'left' ? -7 : 7, duration: 0.3 })
            .to(armL, { rotation: 35, duration: 0.3 }, 0)
            .to(armR, { rotation: -35, duration: 0.3 }, 0)
            .to(jet, { scaleY: 1.8, duration: 0.3 }, 0)
            .to(body, { y: -3, duration: 0.18, repeat: 3, yoyo: true })
          break
        case 'look':
          t.to(eyes, { x: -4, duration: 0.5 })
            .to({}, { duration: 0.7 })
            .to(eyes, { x: 4, duration: 0.7 })
            .to({}, { duration: 0.7 })
            .to(eyes, { x: 0, duration: 0.5 })
            .to(body, { rotation: 4, duration: 0.6, yoyo: true, repeat: 1 }, 0.4)
          break
        case 'point':
          gsap.set(eyes, { x: point === 'left' ? -3 : point === 'right' ? 3 : 0, y: point === 'down' ? 2.5 : point === 'up' ? -2.5 : 0 })
          if (point === 'left') {
            t.to(armL, { rotation: POINT_LEFT[point], duration: 0.4, ease: 'back.out(1.8)' })
              .to(armL, { rotation: POINT_LEFT[point] - 8, duration: 0.5, repeat: 3, yoyo: true })
              .to({}, { duration: 0.6 })
          } else {
            t.to(armR, { rotation: POINT_RIGHT[point], duration: 0.4, ease: 'back.out(1.8)' })
              .to(armR, { rotation: POINT_RIGHT[point] + 8, duration: 0.5, repeat: 3, yoyo: true })
              .to({}, { duration: 0.6 })
          }
          break
        case 'think':
          gsap.set(eyes, { x: -3, y: -3 })
          t.to(dots, { opacity: 1, y: -3, duration: 0.35, stagger: 0.25 })
            .to(dots, { opacity: 0.2, y: 0, duration: 0.35, stagger: 0.25 })
            .to(armR, { rotation: -55, duration: 0.6 }, 0)
            .to(body, { rotation: -3, duration: 1.2, yoyo: true, repeat: 1 }, 0)
          break
        case 'explain':
          t.to(mouth, { scaleY: 1, duration: 0.12, stagger: { each: 0.05, repeat: 9, yoyo: true } })
            .to(armR, { rotation: -60, duration: 0.45, yoyo: true, repeat: 3 }, 0)
            .to(armL, { rotation: 20, duration: 0.6, yoyo: true, repeat: 1 }, 0.3)
            .to({}, { duration: 0.6 })
          break
        case 'celebrate':
          gsap.set(eyesOpen, { opacity: 0 })
          gsap.set(eyesHappy, { opacity: 1 })
          t.to(armL, { rotation: 150, duration: 0.3, ease: 'back.out(2)' }, 0)
            .to(armR, { rotation: -150, duration: 0.3, ease: 'back.out(2)' }, 0)
            .to(body, { y: -16, duration: 0.3, ease: 'power2.out', yoyo: true, repeat: 3 }, 0)
            .to(sparks, { opacity: 1, scale: 1, duration: 0.3, stagger: 0.06 }, 0.1)
            .to(sparks, { opacity: 0, scale: 1.4, duration: 0.5, stagger: 0.06 }, 0.6)
            .to({}, { duration: 0.8 })
          break
        case 'react':
          t.to(body, { scale: 1.08, duration: 0.15, ease: 'power2.out' })
            .to(eyes, { scaleY: 1.35, duration: 0.15 }, 0)
            .to(body, { scale: 1, duration: 0.4, ease: 'elastic.out(1, 0.4)' })
            .to(eyes, { scaleY: 1, duration: 0.3 }, '<')
            .to({}, { duration: 2 })
          break
        default: // idle
          t.to(armL, { rotation: 14, duration: 1.4 })
            .to(armR, { rotation: -14, duration: 1.4 }, 0)
            .to(armL, { rotation: 6, duration: 1.4 })
            .to(armR, { rotation: -6, duration: 1.4 }, '<')
      }
    }, root)
    return () => ctx.revert()
  }, [state, point])

  useEffect(() => {
    if (!tl.current) return
    if (paused) tl.current.pause()
    else tl.current.resume()
  }, [paused, state])

  const g = (n: string) => `${n}-${uid}`
  return (
    <svg
      ref={scope}
      viewBox="0 0 120 140"
      width={size}
      height={(size * 140) / 120}
      className={className}
      role="img"
      aria-label={title}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={g('shell')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--bot-body)" />
          <stop offset="1" stopColor="var(--bot-body-2)" />
        </linearGradient>
        <linearGradient id={g('trim')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--violet)" />
          <stop offset="1" stopColor="var(--cyan)" />
        </linearGradient>
        <radialGradient id={g('visor')} cx="0.5" cy="0.3" r="0.8">
          <stop offset="0" stopColor="color-mix(in srgb, var(--bot-visor) 70%, var(--violet))" />
          <stop offset="1" stopColor="var(--bot-visor)" />
        </radialGradient>
        <radialGradient id={g('jet')} cx="0.5" cy="0" r="1">
          <stop offset="0" stopColor="var(--cyan-2)" stopOpacity="0.95" />
          <stop offset="0.5" stopColor="var(--violet)" stopOpacity="0.45" />
          <stop offset="1" stopColor="var(--violet)" stopOpacity="0" />
        </radialGradient>
        <filter id={g('glow')} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ground shadow */}
      <ellipse data-part="shadow" cx="60" cy="133" rx="22" ry="4" fill="var(--violet)" opacity="0.35" />

      <g data-part="body">
        {/* hover jet */}
        <ellipse data-part="jet" cx="60" cy="122" rx="11" ry="12" fill={`url(#${g('jet')})`} />

        {/* antenna */}
        <line x1="60" y1="23" x2="60" y2="11" stroke={`url(#${g('trim')})`} strokeWidth="3" strokeLinecap="round" />
        <circle cx="60" cy="9" r="4.5" fill="var(--cyan)" filter={`url(#${g('glow')})`}>
          <animate attributeName="opacity" values="1;0.45;1" dur="2.2s" repeatCount="indefinite" />
        </circle>

        {/* think dots */}
        <g>
          <circle data-part="thinkdot" cx="86" cy="16" r="2.6" fill="var(--cyan)" />
          <circle data-part="thinkdot" cx="94" cy="9" r="3.4" fill="var(--violet-2)" />
          <circle data-part="thinkdot" cx="104" cy="2" r="4.2" fill="var(--cyan)" />
        </g>

        {/* arms (behind torso) */}
        <g data-part="armL">
          <rect x="35" y="86" width="11" height="25" rx="5.5" fill={`url(#${g('shell')})`} stroke="var(--border-strong)" strokeWidth="0.8" />
          <circle cx="40.5" cy="112" r="5.6" fill={`url(#${g('trim')})`} />
        </g>
        <g data-part="armR">
          <rect x="74" y="86" width="11" height="25" rx="5.5" fill={`url(#${g('shell')})`} stroke="var(--border-strong)" strokeWidth="0.8" />
          <circle cx="79.5" cy="112" r="5.6" fill={`url(#${g('trim')})`} />
        </g>

        {/* torso */}
        <rect x="41" y="80" width="38" height="34" rx="15" fill={`url(#${g('shell')})`} stroke="var(--border-strong)" strokeWidth="0.8" />
        <circle cx="60" cy="96" r="6.5" fill="var(--bot-visor)" />
        <circle cx="60" cy="96" r="3.8" fill="var(--violet-2)" filter={`url(#${g('glow')})`}>
          <animate attributeName="r" values="3.4;4.4;3.4" dur="1.8s" repeatCount="indefinite" />
        </circle>

        {/* head */}
        <rect x="20" y="22" width="80" height="60" rx="27" fill={`url(#${g('shell')})`} stroke="var(--border-strong)" strokeWidth="0.8" />
        <rect x="14" y="40" width="9" height="22" rx="4.5" fill={`url(#${g('trim')})`} />
        <rect x="97" y="40" width="9" height="22" rx="4.5" fill={`url(#${g('trim')})`} />
        {/* glossy highlight */}
        <path d="M34 30 Q48 25 64 26" stroke="white" strokeOpacity="0.7" strokeWidth="3" strokeLinecap="round" fill="none" />

        {/* visor */}
        <rect x="28" y="34" width="64" height="36" rx="18" fill={`url(#${g('visor')})`} />
        <rect x="28" y="34" width="64" height="36" rx="18" fill="none" stroke={`url(#${g('trim')})`} strokeOpacity="0.55" strokeWidth="1.2" />

        {/* eyes */}
        <g data-part="eyes">
          <g data-part="eyesOpen" filter={`url(#${g('glow')})`}>
            <rect x="41" y="44" width="10" height="14" rx="5" fill="var(--bot-eye)" style={{ transformOrigin: '46px 51px', animation: 'blink 4.6s infinite' }} />
            <rect x="69" y="44" width="10" height="14" rx="5" fill="var(--bot-eye)" style={{ transformOrigin: '74px 51px', animation: 'blink 4.6s infinite' }} />
          </g>
          <g data-part="eyesHappy" filter={`url(#${g('glow')})`} opacity="0">
            <path d="M40 54 Q46 44 52 54" stroke="var(--bot-eye)" strokeWidth="3.4" strokeLinecap="round" fill="none" />
            <path d="M68 54 Q74 44 80 54" stroke="var(--bot-eye)" strokeWidth="3.4" strokeLinecap="round" fill="none" />
          </g>
        </g>
        {/* mouth: small talking bars */}
        <g fill="var(--bot-eye)" opacity="0.85">
          <rect data-part="mouthbar" x="53" y="59" width="3" height="5" rx="1.5" />
          <rect data-part="mouthbar" x="58.5" y="58" width="3" height="7" rx="1.5" />
          <rect data-part="mouthbar" x="64" y="59" width="3" height="5" rx="1.5" />
        </g>
        {/* cheeks */}
        <ellipse cx="35" cy="66" rx="4" ry="2.4" fill="var(--pink)" opacity="0.35" />
        <ellipse cx="85" cy="66" rx="4" ry="2.4" fill="var(--pink)" opacity="0.35" />

        {/* celebration sparks */}
        <g fill="var(--amber)">
          <path data-part="spark" d="M12 20 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" />
          <path data-part="spark" d="M106 18 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6z" fill="var(--cyan)" />
          <path data-part="spark" d="M6 70 l1.4 3.4 3.4 1.4 -3.4 1.4 -1.4 3.4 -1.4 -3.4 -3.4 -1.4 3.4 -1.4z" fill="var(--pink)" />
          <path data-part="spark" d="M112 66 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6z" />
        </g>
      </g>
    </svg>
  )
}
