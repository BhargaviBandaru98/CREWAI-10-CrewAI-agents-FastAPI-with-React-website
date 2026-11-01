import type { ReactNode } from 'react'

interface Option<T extends string> { value: T; label: ReactNode }

/** Pill-style tab switcher. */
export default function Segmented<T extends string>({ value, onChange, options, size = 'md', ariaLabel }: { value: T; onChange: (v: T) => void; options: Option<T>[]; size?: 'sm' | 'md'; ariaLabel: string }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="inline-flex flex-wrap gap-1 rounded-2xl border border-line bg-surface p-1">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`rounded-xl font-semibold transition ${size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'} ${active ? 'bg-[var(--accent,var(--violet))] text-white shadow' : 'text-muted hover:bg-surface-2 hover:text-ink'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
