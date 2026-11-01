import { useEffect } from 'react'
import { useBot } from '../context/BotContext'
import type { RunStatus } from './useAgentRun'

/** CrewBot reacts to the request: thinking while it runs, celebrating on success. */
export function useRunAnnouncer(status: RunStatus, success = "And here's your result!") {
  const { announce } = useBot()
  useEffect(() => {
    if (status === 'loading') announce({ text: 'Your input is on its way! The agents are working...', state: 'think' })
    else if (status === 'success') announce({ text: success, state: 'celebrate' }, 7000)
    else if (status === 'error') announce({ text: "Hmm, that didn't work. Check the message.", state: 'react' }, 7000)
    else announce(null)
  }, [status, announce, success])
  useEffect(() => () => announce(null), [announce])
}
