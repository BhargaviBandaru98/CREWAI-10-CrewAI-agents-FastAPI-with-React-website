import { useState, type FormEvent } from 'react'
import { BadgeCheck, FilePen, History, Link2, Loader2, PencilLine, RotateCcw, ThumbsUp } from 'lucide-react'
import { postJson, type AgentResponse } from '../../api/client'
import { useAgentRun } from '../../hooks/useAgentRun'
import { useRunAnnouncer } from '../../hooks/useRunAnnouncer'
import { useBot } from '../../context/BotContext'
import Field from '../../components/ui/Field'
import Markdown from '../../components/ui/Markdown'
import Badge from '../../components/ui/Badge'
import { CopyButton } from '../../components/ui/Actions'
import { InputCard, OutputCard, ProjectGrid, ResultBlock } from '../../components/project/Panels'
import { hasErrors, type Errors } from './validate'
import type { ViewProps } from './types'

interface Result {
  flow_id: string; topic: string; audience: string; revision_count: number; revisions_left: number; report: string
  research: { key_findings: string[]; statistics: string[]; sources: { title: string; url: string }[] }
  feedback_history: string[]; next_step: string
}

export default function ReportApprovalView({ project, onRun }: ViewProps) {
  const start = useAgentRun<Result>()
  const review = useAgentRun<Result>()
  const { announce } = useBot()
  const [doc, setDoc] = useState<AgentResponse<Result> | null>(null)
  const [topic, setTopic] = useState('')
  const [audience, setAudience] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [pendingAction, setPendingAction] = useState<'approved' | 'revise' | null>(null)
  const busy = start.status === 'loading' || review.status === 'loading'
  useRunAnnouncer(start.status, 'Draft ready. Your turn to review!')

  const begin = async (e?: FormEvent) => {
    e?.preventDefault()
    const errs: Errors = {}
    if (topic.trim().length < 3) errs.topic = 'Enter a topic (at least 3 characters).'
    if (topic.length > 200) errs.topic = 'At most 200 characters.'
    if (audience.trim().length < 2) errs.audience = 'Who is the report for? (at least 2 characters)'
    if (audience.length > 150) errs.audience = 'At most 150 characters.'
    setErrors(errs)
    if (hasErrors(errs)) return
    const res = await start.run((signal) => postJson<Result>(project.endpoint, { topic: topic.trim(), audience: audience.trim() }, signal))
    if (res) { setDoc(res); onRun(res.steps, 'paused for your review') }
  }

  const decide = async (decision: 'approved' | 'revise') => {
    if (!doc) return
    if (decision === 'revise' && notes.trim().length < 5) { setErrors({ notes: 'Tell the reviser what to change (at least 5 characters).' }); return }
    setErrors({})
    setPendingAction(decision)
    announce({ text: decision === 'approved' ? 'Publishing your report...' : 'Sending your notes to the Revision Crew...', state: 'think' })
    const body: Record<string, string> = { flow_id: doc.result.flow_id, decision }
    if (decision === 'revise') body.notes = notes.trim()
    const res = await review.run((signal) => postJson<Result>(project.endpoint, body, signal))
    setPendingAction(null)
    if (res) {
      setDoc(res)
      setNotes('')
      onRun(res.steps, res.status === 'completed' ? 'approved and published' : `revision ${res.result.revision_count}, waiting for review`)
      announce(res.status === 'completed' ? { text: 'Approved and published! 🎉', state: 'celebrate' } : { text: 'Revised! Take another look.', state: 'explain' }, 7000)
    } else announce({ text: "Hmm, that didn't work. Check the message.", state: 'react' }, 7000)
  }

  const restart = () => { setDoc(null); start.reset(); review.reset(); setNotes(''); onRun(null) }
  const pending = doc?.status === 'pending_review'
  const r = doc?.result

  const leftPanel = !doc ? (
    <InputCard tip="Step 1 of 2: the AI researches and drafts. Then you review." onSubmit={begin} submitLabel="Draft my report" busy={busy}
      onSample={() => { setTopic('Using AI chatbots for customer support in small businesses'); setAudience('small business owners'); setErrors({}) }}>
      <Field label="Topic" htmlFor="rtopic" required error={errors.topic} counter={{ value: topic.length, max: 200 }}>
        <input id="rtopic" className="field" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Impact of AI on healthcare jobs" aria-invalid={!!errors.topic} />
      </Field>
      <Field label="Audience" htmlFor="raud" required error={errors.audience} hint="Who will read the report? It shapes the tone.">
        <input id="raud" className="field" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. hospital managers" aria-invalid={!!errors.audience} />
      </Field>
    </InputCard>
  ) : (
    <div className="glass rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        {pending ? <Badge tone="warn"><FilePen size={12} /> Waiting for your review</Badge> : <Badge tone="ok"><BadgeCheck size={12} /> Approved & published</Badge>}
        <Badge tone="muted">Revisions: {r!.revision_count} / {r!.revision_count + r!.revisions_left}</Badge>
      </div>
      <h2 className="mt-3 text-lg font-semibold text-ink">{pending ? 'Step 2: your decision' : 'Done!'}</h2>
      <p className="mt-1 text-sm text-muted">{pending ? 'Read the draft on the right. Approve it to publish, or say what to change.' : 'The report you approved is published as final.md.'}</p>
      <p className="mt-2 font-mono text-[11px] text-muted">flow_id {r!.flow_id}</p>

      {pending && (
        <div className="mt-5 space-y-4">
          <Field label="What should change?" htmlFor="rnotes" error={errors.notes} hint={r!.revisions_left > 0 ? `${r!.revisions_left} revision(s) left.` : 'No revisions left: please approve.'} counter={{ value: notes.length, max: 3000 }}>
            <textarea id="rnotes" rows={4} className="field" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={busy || r!.revisions_left === 0}
              placeholder="e.g. Add a short section on costs, and use simpler language." aria-invalid={!!errors.notes} />
          </Field>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" className="btn btn-ghost" disabled={busy || r!.revisions_left === 0} onClick={() => decide('revise')}>
              {pendingAction === 'revise' ? <Loader2 size={16} className="animate-spin-slow" /> : <PencilLine size={16} />} Request changes
            </button>
            <button type="button" className="btn btn-accent" disabled={busy} onClick={() => decide('approved')}>
              {pendingAction === 'approved' ? <Loader2 size={16} className="animate-spin-slow" /> : <ThumbsUp size={16} />} Approve & publish
            </button>
          </div>
          {review.status === 'loading' && <p className="text-center text-xs text-muted">Working... {review.elapsed}s</p>}
        </div>
      )}
      {review.status === 'error' && review.error && (
        <div className="mt-4 rounded-xl border p-3 text-sm" style={{ borderColor: 'color-mix(in srgb, var(--red) 40%, transparent)' }} role="alert">
          <p className="font-semibold text-bad">{review.error.message}</p>
          {review.error.details.map((x) => <p key={x} className="text-xs text-ink-2">{x}</p>)}
          {review.error.status === 404 && <p className="mt-1 text-xs text-muted">The paused report is no longer on the server (it may have restarted). Start a new one.</p>}
        </div>
      )}
      {r!.feedback_history.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted"><History size={13} /> Review history</h3>
          <ol className="space-y-1.5 border-l border-line pl-4 text-sm text-ink-2">{r!.feedback_history.map((h, i) => <li key={i}>{h}</li>)}</ol>
        </div>
      )}
      <button type="button" onClick={restart} className="btn btn-ghost mt-5 w-full !py-2 !text-xs" disabled={busy}><RotateCcw size={14} /> Start a new report</button>
    </div>
  )

  return (
    <ProjectGrid
      input={leftPanel}
      output={
        <OutputCard project={project} status={start.status === 'loading' ? 'loading' : doc ? 'success' : start.status} data={doc} error={start.error} elapsed={start.elapsed}
          eta="20-60 seconds" onCancel={start.cancel} onRetry={() => begin()}
          emptyTitle="Your draft report will appear here" emptyItems={['A researched draft (500-800 words)', 'The research brief: findings, statistics, sources', 'Approve it, or request changes (up to 3 times)', 'final.md once you approve']}>
          {(d) => (
            <div className={review.status === 'loading' ? 'pointer-events-none opacity-50 transition' : 'transition'}>
              <ResultBlock title={d.status === 'completed' ? 'Published report' : `Draft${d.result.revision_count ? ` (revision ${d.result.revision_count})` : ''}`} actions={<CopyButton text={d.result.report} label="Copy" />}>
                <Markdown>{d.result.report}</Markdown>
              </ResultBlock>
              <details className="mt-4 rounded-2xl border border-line bg-surface p-4">
                <summary className="cursor-pointer text-sm font-semibold text-ink">Research brief ({d.result.research.key_findings.length} findings, {d.result.research.sources.length} sources)</summary>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-2">{d.result.research.key_findings.map((k) => <li key={k}>{k}</li>)}</ul>
                {d.result.research.statistics.length > 0 && <><p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted">Statistics</p><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-2">{d.result.research.statistics.map((k) => <li key={k}>{k}</li>)}</ul></>}
                <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted">Sources (verified)</p>
                {d.result.research.sources.length ? (
                  <ul className="mt-1 space-y-1 text-sm">{d.result.research.sources.map((s) => <li key={s.url}><Link2 size={12} className="mr-1 inline text-muted" /><a className="text-cyan underline" href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a></li>)}</ul>
                ) : <p className="mt-1 text-sm text-muted">No verified sources: live search returned nothing usable, so the findings need checking before you publish.</p>}
              </details>
            </div>
          )}
        </OutputCard>
      }
    />
  )
}
