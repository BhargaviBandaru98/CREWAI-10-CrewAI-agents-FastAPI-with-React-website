import type { ReactNode } from 'react'

/** Glass card with an optional title row and actions. */
export default function Card({ title, icon, actions, children, className = '' }: { title?: ReactNode; icon?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`glass rounded-3xl p-5 sm:p-6 ${className}`}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && (
            <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
              {icon && <span className="text-[var(--accent,var(--violet))]">{icon}</span>}
              {title}
            </h3>
          )}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}
