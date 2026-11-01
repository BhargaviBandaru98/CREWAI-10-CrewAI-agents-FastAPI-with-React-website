import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { gsap } from 'gsap'

export type BotState = 'idle' | 'wave' | 'move' | 'look' | 'point' | 'think' | 'explain' | 'celebrate' | 'react'
export type BotPoint = 'right' | 'left' | 'down' | 'up'

export interface BotMessage {
  text: string
  state?: BotState
  point?: BotPoint
}

interface BotCtx {
  /** CrewBot shown at all (user can hide it) */
  visible: boolean
  setVisible: (v: boolean) => void
  /** animations paused by the user or by the OS reduced-motion setting */
  paused: boolean
  togglePaused: () => void
  reducedMotion: boolean
  /** a workflow "lane" is on screen: the rail bot steps aside and the lane bot takes over */
  laneActive: boolean
  registerLane: (id: string, active: boolean) => void
  /** short-lived message from the page (e.g. "Your agents are working...") */
  override: BotMessage | null
  announce: (msg: BotMessage | null, ms?: number) => void
}

const Ctx = createContext<BotCtx | null>(null)

export function BotProvider({ children }: { children: ReactNode }) {
  const [visible, setVisibleState] = useState(() => localStorage.getItem('crewbot-hidden') !== '1')
  const [userPaused, setUserPaused] = useState(() => localStorage.getItem('crewbot-paused') === '1')
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [lanes, setLanes] = useState<Record<string, boolean>>({})
  const [override, setOverride] = useState<BotMessage | null>(null)
  const overrideTimer = useRef<number | null>(null)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const paused = userPaused || reducedMotion
  useEffect(() => {
    document.documentElement.classList.toggle('motion-paused', userPaused)
    if (paused) gsap.globalTimeline.pause()
    else gsap.globalTimeline.resume()
  }, [paused, userPaused])

  const setVisible = useCallback((v: boolean) => {
    setVisibleState(v)
    localStorage.setItem('crewbot-hidden', v ? '0' : '1')
  }, [])
  const togglePaused = useCallback(() => {
    setUserPaused((p) => {
      localStorage.setItem('crewbot-paused', p ? '0' : '1')
      return !p
    })
  }, [])
  const registerLane = useCallback((id: string, active: boolean) => {
    setLanes((l) => (l[id] === active ? l : { ...l, [id]: active }))
  }, [])
  const announce = useCallback((msg: BotMessage | null, ms = 0) => {
    if (overrideTimer.current) window.clearTimeout(overrideTimer.current)
    setOverride(msg)
    if (msg && ms > 0) overrideTimer.current = window.setTimeout(() => setOverride(null), ms)
  }, [])

  const laneActive = Object.values(lanes).some(Boolean)
  const value = useMemo(
    () => ({ visible, setVisible, paused, togglePaused, reducedMotion, laneActive, registerLane, override, announce }),
    [visible, setVisible, paused, togglePaused, reducedMotion, laneActive, registerLane, override, announce],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useBot() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useBot must be used inside BotProvider')
  return c
}
