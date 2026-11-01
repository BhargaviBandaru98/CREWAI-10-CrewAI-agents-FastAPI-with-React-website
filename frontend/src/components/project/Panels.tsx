import { useState, type FormEvent, type ReactNode } from 'react'
import { AlertTriangle, Braces, Clock, FileText, Loader2, RotateCcw, Send, Sparkles, X } from 'lucide-react'
import type { AgentResponse } from '../../api/client'
import type { ApiError } from '../../api/client'
import type { RunStatus } from '../../hooks/useAgentRun'
import type { Project } from '../../projects/types'
import CrewBot from '../bot/CrewBot'
import { DownloadButton } from '../ui/Actions'

/** Left column: the input form. */
export function InputCard({ title = 'Your input', tip, onSubmit, submitLabel, busy, onSample, sampleLabel = 'Fill with an example', children }: {
  title?: string
  tip?: string
  onSubmit: (e: FormEvent) => void
  submitLabel: string
  busy: boolean
  onSample?: () => void
  sampleLabel?: string
  children: ReactNode
}) {
  return (
    <form onSubmit={onSubmit} noValidate className="glass flex flex-col rounded-3xl p-5 sm:p-6" aria-busy={busy}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          {tip && <p className="mt-1 text-sm text-muted">{tip}</p>}
        </div>
        {onSample && (
          <button type="button" onClick={onSample} disabled={busy} className="btn btn-ghost !px-3 !py-1.5 !text-xs">
            <Sparkles size={13} /> {sampleLabel}
          </button>
        )}
      </div>
      <div className="space-y-5">{children}</div>
      <button type="submit" disabled={busy} className="btn btn-accent mt-6 w-full !py-3.5 text-base">
        {busy ? <><Loader2 size={18} className="animate-spin-slow" /> Agents are working...</> : <><Send size={17} /> {submitLabel}</>}
      </button>
      <p className="mt-3 text-center text-[11px] text-muted">Runs real AI agents on the server (Gemini free tier). Please don't submit private personal data.</p>
    </form>
  )
}

interface OutputProps<R> {
  project: Project
  status: RunStatus
  data: AgentResponse<R> | null
  error: ApiError | null
  elapsed: number
  eta: string
  onCancel: () => void
  onRetry?: () => void
  emptyTitle: string
  emptyItems: string[]
  children: (data: AgentResponse<R>) => ReactNode
}

/** Right column: empty, loading, error and success states. */
export function OutputCard<R>({ project, status, data, error, elapsed, eta, onCancel, onRetry, emptyTitle, emptyItems, children }: OutputProps<R>) {
  return (
    <div className="glass relative min-h-[420px] rounded-3xl p-5 sm:p-6" aria-live="polite">
      <h2 className="mb-5 text-lg font-semibold text-ink">Result</h2>
      {status === 'loading' ? (
        <LoadingPanel project={project} elapsed={elapsed} eta={eta} onCancel={onCancel} />
      ) : status === 'error' && error ? (
        <ErrorPanel error={error} onRetry={onRetry} />
      ) : data ? (
        <div className="reveal space-y-5">
          {children(data)}
          <ResultMeta data={data} />
        </div>
      ) : (
        <EmptyPanel title={emptyTitle} items={emptyItems} />
      )}
    </div>
  )
}

function EmptyPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="grid h-full min-h-[320px] place-items-center rounded-2xl border border-dashed border-line-strong p-6 text-center">
      <div>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-[var(--accent)]"><FileText size={24} /></div>
        <h3 className="mt-4 font-semibold text-ink">{title}</h3>
        <ul className="mx-auto mt-3 max-w-sm space-y-1.5 text-left text-sm text-muted">
          {items.map((i) => <li key={i} className="flex gap-2"><span className="text-[var(--accent)]">✦</span>{i}</li>)}
        </ul>
      </div>
    </div>
  )
}

function LoadingPanel({ project, elapsed, eta, onCancel }: { project: Project; elapsed: number; eta: string; onCancel: () => void }) {
  const agents = project.workflow.stages.flatMap((s) => s.nodes).filter((n) => n.kind !== 'input' && n.kind !== 'output')
  const mm = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
      <CrewBot size={92} state="think" />
      <h3 className="mt-4 text-lg font-semibold text-ink">Your AI team is working...</h3>
      <p className="mt-1 text-sm text-muted">This usually takes {eta}. Please keep this page open.</p>
      <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 font-mono text-sm text-ink-2">
        <Clock size={14} /> {mm}
      </div>
      <div className="mt-6 w-full max-w-md">
        <p className="mb-2 text-xs text-muted">Steps in this project (live progress is not tracked; see the workflow below):</p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {agents.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-[11px] text-ink-2">
              <span className="flex gap-0.5"><span className="typing-dot h-1 w-1 rounded-full bg-[var(--accent)]" /><span className="typing-dot h-1 w-1 rounded-full bg-[var(--accent)]" /><span className="typing-dot h-1 w-1 rounded-full bg-[var(--accent)]" /></span>
              {a.label}
            </span>
          ))}
        </div>
      </div>
      <button onClick={onCancel} className="btn btn-ghost mt-6 !py-2 !text-xs"><X size={14} /> Stop waiting</button>
      {elapsed > 75 && <p className="mt-3 max-w-sm text-xs text-muted">Taking longer than usual: the free AI model may be busy, and the server retries automatically.</p>}
    </div>
  )
}

function ErrorPanel({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  const hint = error.status === 422 ? 'Fix the highlighted input and try again.'
    : error.status === 502 ? 'The AI service may be busy or out of free quota. Wait a minute and try again.'
    : error.status === 503 ? 'Other runs are in progress. Try again shortly.'
    : error.status === 0 ? '' : ''
  return (
    <div className="reveal rounded-2xl border p-5" style={{ borderColor: 'color-mix(in srgb, var(--red) 40%, transparent)', background: 'color-mix(in srgb, var(--red) 8%, transparent)' }} role="alert">
      <div className="flex items-start gap-3">
        <CrewBot size={56} state="react" />
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-semibold text-bad"><AlertTriangle size={16} /> {error.status ? `Error ${error.status}` : 'Connection problem'}</h3>
          <p className="mt-1 break-words text-sm text-ink">{error.message}</p>
          {error.details.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">{error.details.map((d) => <li key={d}>{d}</li>)}</ul>
          )}
          {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
          {onRetry && <button onClick={onRetry} className="btn btn-ghost mt-4 !py-2 !text-xs"><RotateCcw size={14} /> Try again</button>}
        </div>
      </div>
    </div>
  )
}

function ResultMeta<R>({ data }: { data: AgentResponse<R> }) {
  const [raw, setRaw] = useState(false)
  const files = Object.entries(data.files ?? {}).filter(([, c]) => c)
  return (
    <div className="border-t border-line pt-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><Clock size={13} /> {data.duration_seconds}s</span>
        <span className="font-mono">run {data.run_id}</span>
        <span className="font-mono">{data.status}</span>
        <button onClick={() => setRaw((r) => !r)} className="ml-auto inline-flex items-center gap-1.5 font-semibold text-cyan hover:underline"><Braces size={13} /> {raw ? 'Hide' : 'View'} raw API response</button>
      </div>
      {files.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {files.map(([name, content]) => <DownloadButton key={name} filename={name} content={content} />)}
        </div>
      )}
      {raw && (
        <pre className="reveal mt-3 max-h-96 overflow-auto rounded-2xl border border-line bg-bg-2 p-4 font-mono text-[11.5px] leading-relaxed text-ink-2">{JSON.stringify(data, null, 2)}</pre>
      )}
    </div>
  )
}

/** Input on the left, result on the right (stacked on small screens). */
export function ProjectGrid({ input, output }: { input: ReactNode; output: ReactNode }) {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div>{input}</div>
      <div className="min-w-0">{output}</div>
    </div>
  )
}

/** Small labelled block inside a result. */
export function ResultBlock({ title, icon, actions, children, className = '' }: { title: string; icon?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-4 ${className}`}>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">{icon && <span className="text-[var(--accent)]">{icon}</span>}{title}</h3>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>
      {children}
    </section>
  )
}
