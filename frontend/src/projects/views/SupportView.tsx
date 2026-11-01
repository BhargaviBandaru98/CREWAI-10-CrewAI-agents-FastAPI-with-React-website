import { useState, type FormEvent } from 'react'
import { ArrowRight, MessageSquare, ShieldAlert, Users } from 'lucide-react'
import { postJson } from '../../api/client'
import { useAgentRun } from '../../hooks/useAgentRun'
import { useRunAnnouncer } from '../../hooks/useRunAnnouncer'
import Field from '../../components/ui/Field'
import Badge, { type Tone } from '../../components/ui/Badge'
import { CopyButton } from '../../components/ui/Actions'
import { InputCard, OutputCard, ProjectGrid, ResultBlock } from '../../components/project/Panels'
import { hasErrors, type Errors } from './validate'
import type { ViewProps } from './types'

interface Result {
  ticket_id: string; customer_name: string; category: string; category_reason: string; route: string; priority: string; handled_by: string
  resolution: { customer_reply: string; internal_next_steps: string[]; escalate_to_human: boolean }
}

const SAMPLES = [
  { label: 'Double charge', name: 'Priya Sharma', issue: 'I was charged twice for my Pro subscription this month. Please refund the duplicate charge.' },
  { label: 'Locked out', name: 'Arjun', issue: 'I forgot my password and the reset email never arrives. I cannot log in at all.' },
  { label: 'Feature idea', name: 'Meera', issue: 'It would be great if you could add a dark mode to the mobile app.' },
]
const PRIORITY_TONE: Record<string, Tone> = { high: 'bad', medium: 'warn', low: 'ok' }
const label = (s: string) => s.replace(/_/g, ' ')

export default function SupportView({ project, onRun }: ViewProps) {
  const run = useAgentRun<Result>()
  useRunAnnouncer(run.status, 'Ticket routed and reply drafted!')
  const [name, setName] = useState('')
  const [issue, setIssue] = useState('')
  const [email, setEmail] = useState('')
  const [ticketId, setTicketId] = useState('')
  const [errors, setErrors] = useState<Errors>({})

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    const errs: Errors = {}
    if (!name.trim()) errs.name = "Enter the customer's name."
    if (name.length > 100) errs.name = 'At most 100 characters.'
    if (issue.trim().length < 10) errs.issue = 'Describe the issue (at least 10 characters).'
    if (issue.length > 4000) errs.issue = 'At most 4000 characters.'
    if (email && !/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = 'This does not look like an email address.'
    if (ticketId.length > 50) errs.ticket = 'At most 50 characters.'
    setErrors(errs)
    if (hasErrors(errs)) return
    const body: Record<string, string> = { customer_name: name.trim(), issue_description: issue.trim() }
    if (email.trim()) body.customer_email = email.trim()
    if (ticketId.trim()) body.ticket_id = ticketId.trim()
    const res = await run.run((signal) => postJson<Result>(project.endpoint, body, signal))
    if (res) onRun(res.steps, `route: ${res.result.route}`)
  }

  return (
    <ProjectGrid
      input={
        <InputCard tip="Write the issue the way the customer would." onSubmit={submit} submitLabel="Route this ticket" busy={run.status === 'loading'}>
          <div>
            <p className="mb-2 text-xs font-semibold text-muted">Try an example ticket:</p>
            <div className="flex flex-wrap gap-2">{SAMPLES.map((s) => (
              <button key={s.label} type="button" className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-2 transition hover:border-[var(--accent)] hover:text-ink"
                onClick={() => { setName(s.name); setIssue(s.issue); setErrors({}) }}>{s.label}</button>
            ))}</div>
          </div>
          <Field label="Customer name" htmlFor="cname" required error={errors.name}>
            <input id="cname" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya Sharma" aria-invalid={!!errors.name} />
          </Field>
          <Field label="Issue description" htmlFor="issue" required error={errors.issue} counter={{ value: issue.length, max: 4000 }}>
            <textarea id="issue" rows={6} className="field" value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="What is the customer's problem?" aria-invalid={!!errors.issue} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer email" htmlFor="cemail" error={errors.email}>
              <input id="cemail" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
            </Field>
            <Field label="Ticket ID" htmlFor="tid" error={errors.ticket} hint="Generated if empty">
              <input id="tid" className="field" value={ticketId} onChange={(e) => setTicketId(e.target.value)} placeholder="T-1234" />
            </Field>
          </div>
        </InputCard>
      }
      output={
        <OutputCard project={project} status={run.status} data={run.data} error={run.error} elapsed={run.elapsed} eta="5-15 seconds" onCancel={run.cancel} onRetry={() => submit()}
          emptyTitle="Your routed ticket will appear here" emptyItems={['The category and why it was chosen', 'Which path the router took and the priority', 'A customer reply, ready to send', 'Internal next steps for the team']}>
          {(d) => {
            const r = d.result
            return (
              <>
                <div className="rounded-2xl border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-ink">{r.ticket_id}</span>
                    <Badge tone={PRIORITY_TONE[r.priority] ?? 'muted'}>{r.priority} priority</Badge>
                    {r.resolution.escalate_to_human && <Badge tone="bad"><ShieldAlert size={12} /> Escalate to a human</Badge>}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-xl border border-line bg-surface-2 px-3 py-1.5"><span className="text-xs text-muted">category </span><b className="text-ink">{label(r.category)}</b></span>
                    <ArrowRight size={15} className="text-muted" />
                    <span className="rounded-xl px-3 py-1.5 text-white" style={{ background: 'var(--accent)' }}><span className="text-xs opacity-80">route </span><b>{label(r.route)}</b></span>
                    <ArrowRight size={15} className="text-muted" />
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 py-1.5"><Users size={14} className="text-[var(--accent)]" /><b className="text-ink">{r.handled_by}</b></span>
                  </div>
                  <p className="mt-3 text-sm text-ink-2"><span className="font-semibold text-ink">Why: </span>{r.category_reason}</p>
                </div>
                <ResultBlock title={`Reply to ${r.customer_name}`} icon={<MessageSquare size={16} />} actions={<CopyButton text={r.resolution.customer_reply} label="Copy reply" />}>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-ink-2">{r.resolution.customer_reply}</p>
                </ResultBlock>
                <ResultBlock title="Internal next steps">
                  <ul className="space-y-2">{r.resolution.internal_next_steps.map((s, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-ink-2"><span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border border-line-strong" />{s}</li>
                  ))}</ul>
                </ResultBlock>
              </>
            )
          }}
        </OutputCard>
      }
    />
  )
}
