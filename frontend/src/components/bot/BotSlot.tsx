import CrewBot from './CrewBot'
import BotBubble from './BotBubble'
import { useBot, type BotPoint, type BotState } from '../../context/BotContext'

/**
 * CrewBot for phones and tablets: a small reserved row inside the page flow
 * (never floating over content). Hidden on large screens, where the rail bot is used.
 */
export default function BotSlot({ text, state = 'idle', point = 'right', className = '' }: { text: string; state?: BotState; point?: BotPoint; className?: string }) {
  const { visible, override } = useBot()
  if (!visible) return null
  const msg = override ?? { text, state, point }
  return (
    <div className={`flex items-center gap-3 lg:hidden ${className}`}>
      <div className="shrink-0">
        <CrewBot size={52} state={msg.state ?? state} point={msg.point ?? point} />
      </div>
      <BotBubble text={msg.text} tail="left" className="max-w-xs" />
    </div>
  )
}
