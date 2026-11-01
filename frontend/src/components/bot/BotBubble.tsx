interface Props {
  text: string
  /** where the bubble's tail points (towards the bot) */
  tail?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

/** CrewBot's speech bubble. Re-animates whenever the text changes. */
export default function BotBubble({ text, tail = 'top', className = '' }: Props) {
  const tailPos: Record<string, string> = {
    top: 'left-1/2 -top-1.5 -translate-x-1/2',
    bottom: 'left-1/2 -bottom-1.5 -translate-x-1/2',
    left: '-left-1.5 top-1/2 -translate-y-1/2',
    right: '-right-1.5 top-1/2 -translate-y-1/2',
  }
  return (
    <div key={text} role="status" aria-live="polite" className={`reveal relative rounded-2xl border border-line-strong bg-surface-solid px-3 py-2 text-[12.5px] leading-snug text-ink shadow-lg ${className}`}>
      <span className={`absolute h-3 w-3 rotate-45 border-l border-t border-line bg-surface-solid ${tailPos[tail]}`} aria-hidden />
      <span className="relative">{text}</span>
    </div>
  )
}
