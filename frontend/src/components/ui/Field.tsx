import type { ReactNode } from 'react'

interface Props {
  label: string
  htmlFor: string
  hint?: ReactNode
  error?: string
  required?: boolean
  counter?: { value: number; max: number }
  children: ReactNode
}

/** Label + control + hint/error, consistently styled. */
export default function Field({ label, htmlFor, hint, error, required, counter, children }: Props) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
          {label}
          {required ? <span className="ml-1 text-[var(--accent,var(--violet))]">*</span> : <span className="ml-1.5 text-xs font-normal text-muted">optional</span>}
        </label>
        {counter && (
          <span className={`font-mono text-[11px] ${counter.value > counter.max ? 'text-bad' : 'text-muted'}`}>
            {counter.value}/{counter.max}
          </span>
        )}
      </div>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs font-medium text-bad">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  )
}
