import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, type AgentResponse } from '../api/client'

export type RunStatus = 'idle' | 'loading' | 'success' | 'error'

/** Runs one API call with loading / success / error state, an elapsed timer and cancel. */
export function useAgentRun<R>() {
  const [status, setStatus] = useState<RunStatus>('idle')
  const [data, setData] = useState<AgentResponse<R> | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const controller = useRef<AbortController | null>(null)
  const timer = useRef<number | null>(null)

  const stopTimer = () => {
    if (timer.current) window.clearInterval(timer.current)
    timer.current = null
  }

  const run = useCallback(async (call: (signal: AbortSignal) => Promise<AgentResponse<R>>) => {
    controller.current?.abort()
    const ctl = new AbortController()
    controller.current = ctl
    setStatus('loading')
    setError(null)
    setElapsed(0)
    const started = Date.now()
    stopTimer()
    timer.current = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500)
    try {
      const res = await call(ctl.signal)
      setData(res)
      setStatus('success')
      return res
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        setStatus(data ? 'success' : 'idle')
        return null
      }
      setError(e instanceof ApiError ? e : new ApiError(0, (e as Error).message || 'Something went wrong'))
      setStatus('error')
      return null
    } finally {
      stopTimer()
    }
  }, [data])

  const cancel = useCallback(() => controller.current?.abort(), [])
  const reset = useCallback(() => {
    controller.current?.abort()
    setStatus('idle')
    setData(null)
    setError(null)
  }, [])

  useEffect(() => () => { controller.current?.abort(); stopTimer() }, [])

  return { status, data, error, elapsed, run, cancel, reset, setData }
}
