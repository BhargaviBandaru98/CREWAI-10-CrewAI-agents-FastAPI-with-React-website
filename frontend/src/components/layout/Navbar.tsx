import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Bot, EyeOff, Menu, Moon, Pause, Play, Sun, X } from 'lucide-react'
import Logo from './Logo'
import { useTheme } from '../../context/ThemeContext'
import { useBot } from '../../context/BotContext'
import { getHealth } from '../../api/client'

type ApiState = 'checking' | 'online' | 'nokey' | 'offline'

function ApiStatus() {
  const [state, setState] = useState<ApiState>('checking')
  useEffect(() => {
    const ctl = new AbortController()
    const check = () => getHealth(ctl.signal).then((h) => setState(h.gemini_key_set ? 'online' : 'nokey')).catch(() => !ctl.signal.aborted && setState('offline'))
    check()
    const t = window.setInterval(check, 60000)
    return () => { ctl.abort(); window.clearInterval(t) }
  }, [])
  const map: Record<ApiState, [string, string]> = {
    checking: ['var(--muted)', 'Checking API...'],
    online: ['var(--green)', 'API online'],
    nokey: ['var(--amber)', 'API key missing'],
    offline: ['var(--red)', 'API offline'],
  }
  const [color, text] = map[state]
  return (
    <span className="hidden items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted xl:inline-flex" title={state === 'offline' ? 'The backend is not reachable (it may be waking up)' : text}>
      <span className="relative flex h-2 w-2">
        {state === 'online' && <span className="absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: color, animation: 'pulse-ring 1.6s ease-out infinite' }} />}
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
      </span>
      {text}
    </span>
  )
}

export default function Navbar() {
  const { theme, toggle } = useTheme()
  const { visible, setVisible, paused, togglePaused, reducedMotion } = useBot()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const loc = useLocation()

  useEffect(() => setOpen(false), [loc.pathname, loc.hash])
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  const links = [
    { to: '/#projects', label: 'Projects' },
    { to: '/#how', label: 'How it works' },
    { to: '/#flows', label: 'Crews & Flows' },
  ]

  const iconBtn = 'grid h-9 w-9 place-items-center rounded-xl border border-line bg-surface text-ink-2 transition hover:border-line-strong hover:text-ink'

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled || open ? 'shadow-lg' : ''}`}
      style={{
        // Mostly solid so page text never shows through; the blur keeps a frosted-glass edge.
        background: scrolled || open ? 'color-mix(in srgb, var(--bg) 86%, transparent)' : 'transparent',
        backdropFilter: scrolled || open ? 'blur(18px) saturate(160%)' : 'none',
        WebkitBackdropFilter: scrolled || open ? 'blur(18px) saturate(160%)' : 'none',
        borderBottom: scrolled || open ? '1px solid var(--border)' : '1px solid transparent',
      }}
    >
      <nav className="mx-auto flex h-16 max-w-[1500px] items-center gap-4 px-4 sm:px-6" aria-label="Main">
        <Link to="/" className="flex items-center gap-2.5" aria-label="CREWAI home">
          <Logo />
          <span className="font-display text-lg font-bold tracking-tight text-ink">
            CREW<span className="text-gradient">AI</span>
          </span>
        </Link>

        <div className="ml-6 hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a key={l.to} href={l.to} className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface hover:text-ink">
              {l.label}
            </a>
          ))}
          <a href="/docs" target="_blank" rel="noopener" className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface hover:text-ink">API docs</a>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ApiStatus />
          {visible && !reducedMotion && (
            <button className={iconBtn} onClick={togglePaused} aria-label={paused ? 'Resume animations' : 'Pause animations'} title={paused ? 'Resume animations' : 'Pause animations'}>
              {paused ? <Play size={16} /> : <Pause size={16} />}
            </button>
          )}
          <button className={iconBtn} onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide CrewBot' : 'Show CrewBot'} title={visible ? 'Hide CrewBot' : 'Show CrewBot'}>
            {visible ? <EyeOff size={16} /> : <Bot size={16} />}
          </button>
          <button className={iconBtn} onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title="Toggle theme">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <NavLink to="/#projects" className="btn btn-primary hidden !py-2 !text-sm sm:inline-flex">Try a project</NavLink>
          <button className={`${iconBtn} md:hidden`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Menu">
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>
      {open && (
        <div className="reveal border-t border-line px-4 pb-4 md:hidden">
          {links.map((l) => (
            <a key={l.to} href={l.to} className="block rounded-lg px-3 py-3 text-sm font-medium text-ink-2 hover:bg-surface">{l.label}</a>
          ))}
          <a href="/docs" target="_blank" rel="noopener" className="block rounded-lg px-3 py-3 text-sm font-medium text-ink-2 hover:bg-surface">API docs</a>
        </div>
      )}
    </header>
  )
}
