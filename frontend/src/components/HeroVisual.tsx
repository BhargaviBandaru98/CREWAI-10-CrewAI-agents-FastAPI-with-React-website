import { Bot, GitBranch, Search, Sparkles, Users, Wrench } from 'lucide-react'

const ORBIT = [
  { icon: Search, label: 'Researcher', color: 'var(--cyan)' },
  { icon: Bot, label: 'Writer', color: 'var(--violet-2)' },
  { icon: GitBranch, label: '@router', color: 'var(--amber)' },
  { icon: Users, label: 'Manager', color: 'var(--pink)' },
  { icon: Wrench, label: 'Tools', color: 'var(--cyan)' },
  { icon: Sparkles, label: 'Gemini', color: 'var(--violet-2)' },
]

/** Animated "agent constellation": a hub with agents orbiting and data pulses on the links. */
export default function HeroVisual() {
  const R = 150
  const pts = ORBIT.map((_, i) => {
    const a = (i / ORBIT.length) * Math.PI * 2 - Math.PI / 2
    return { x: 200 + R * Math.cos(a), y: 200 + R * Math.sin(a) }
  })
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[460px]" aria-hidden>
      <div className="absolute inset-[12%] rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--violet) 35%, transparent), transparent 70%)' }} />
      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="hv-line" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--violet)" />
            <stop offset="1" stopColor="var(--cyan)" />
          </linearGradient>
        </defs>
        <circle cx="200" cy="200" r={R} fill="none" stroke="var(--border)" strokeDasharray="3 7" />
        <circle cx="200" cy="200" r={R - 62} fill="none" stroke="var(--border)" />
        {pts.map((p, i) => (
          <g key={i}>
            <line x1="200" y1="200" x2={p.x} y2={p.y} stroke="url(#hv-line)" strokeOpacity="0.45" strokeWidth="1.5" />
            <circle r="3.5" fill="var(--cyan)">
              <animateMotion dur={`${2.4 + (i % 3) * 0.5}s`} repeatCount="indefinite" path={`M200,200 L${p.x},${p.y}`} begin={`${i * 0.35}s`} />
              <animate attributeName="opacity" values="0;1;1;0" dur={`${2.4 + (i % 3) * 0.5}s`} repeatCount="indefinite" begin={`${i * 0.35}s`} />
            </circle>
            {/* ring links between neighbours */}
            <line x1={p.x} y1={p.y} x2={pts[(i + 1) % pts.length].x} y2={pts[(i + 1) % pts.length].y} stroke="var(--border-strong)" strokeWidth="1" className="flow-dash" />
          </g>
        ))}
      </svg>
      {/* hub */}
      <div className="absolute left-1/2 top-1/2 grid h-28 w-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[2rem] glass-strong" style={{ boxShadow: 'var(--glow)' }}>
        <div className="text-center">
          <div className="font-display text-xl font-bold text-ink">CREW<span className="text-gradient">AI</span></div>
          <div className="mt-0.5 font-mono text-[10px] text-muted">10 projects</div>
        </div>
      </div>
      {ORBIT.map((o, i) => (
        <div key={o.label} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${(pts[i].x / 400) * 100}%`, top: `${(pts[i].y / 400) * 100}%` }}>
          <div className="animate-float flex flex-col items-center gap-1.5" style={{ animationDelay: `${i * 0.6}s` }}>
            <span className="grid h-12 w-12 place-items-center rounded-2xl glass-strong" style={{ color: o.color, boxShadow: `0 0 24px -6px ${o.color}` }}>
              <o.icon size={21} />
            </span>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-ink-2">{o.label}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
