/** Circular score gauge, e.g. 8/10 or 72/100. */
export default function ScoreRing({ value, max, size = 92, color, label }: { value: number; max: number; size?: number; color?: string; label?: string }) {
  const r = 40
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, value / max))
  const col = color ?? (pct >= 0.7 ? 'var(--green)' : pct >= 0.4 ? 'var(--amber)' : 'var(--red)')
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${label ?? 'Score'} ${value} out of ${max}`}>
      <svg viewBox="0 0 100 100" width={size} height={size} className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border)" strokeWidth="9" />
        <circle
          cx="50" cy="50" r={r} fill="none" stroke={col} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)', filter: `drop-shadow(0 0 6px ${col})` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-display text-2xl font-bold leading-none text-ink">{value}</div>
          <div className="mt-0.5 font-mono text-[10px] text-muted">/ {max}</div>
        </div>
      </div>
    </div>
  )
}
