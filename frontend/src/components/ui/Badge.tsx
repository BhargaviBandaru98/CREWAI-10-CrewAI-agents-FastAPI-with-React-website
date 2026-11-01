import type { ReactNode } from 'react'

export type Tone = 'violet' | 'cyan' | 'ok' | 'warn' | 'bad' | 'muted' | 'accent'
const TONES: Record<Tone, string> = {
  violet: 'var(--violet)',
  cyan: 'var(--cyan)',
  ok: 'var(--green)',
  warn: 'var(--amber)',
  bad: 'var(--red)',
  muted: 'var(--muted)',
  accent: 'var(--accent, var(--violet))',
}

export default function Badge({ children, tone = 'violet', className = '' }: { children: ReactNode; tone?: Tone; className?: string }) {
  const c = TONES[tone]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}
      style={{ color: c, background: `color-mix(in srgb, ${c} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${c} 30%, transparent)` }}
    >
      {children}
    </span>
  )
}
