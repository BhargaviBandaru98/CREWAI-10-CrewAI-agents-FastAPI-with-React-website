import { useState, type FormEvent } from 'react'
import { Bot, Bug, CircleCheck, CircleX, HelpCircle, Lightbulb, Tag } from 'lucide-react'
import { postJson } from '../../api/client'
import { useAgentRun } from '../../hooks/useAgentRun'
import { useRunAnnouncer } from '../../hooks/useRunAnnouncer'
import Field from '../../components/ui/Field'
import Markdown from '../../components/ui/Markdown'
import Badge from '../../components/ui/Badge'
import { CopyButton } from '../../components/ui/Actions'
import { InputCard, OutputCard, ProjectGrid, ResultBlock } from '../../components/project/Panels'
import { hasErrors, isUrl, type Errors } from './validate'
import type { ViewProps } from './types'

interface Result { issue_type: 'bug' | 'feature' | 'question'; classification_reason: string; labels: string[]; comment: string; analysis: Record<string, unknown>; docs_read: boolean | null }

const SAMPLES = [
  { label: 'A bug', title: 'App crashes when uploading a PNG larger than 5 MB', body: 'Steps: open the editor, click Upload, choose a 6 MB PNG. The spinner shows for 3 seconds, then the whole app closes. Smaller images work fine. Version 2.3.1 on Windows 11.', docs: '' },
  { label: 'A feature request', title: 'Please add export to PDF', body: 'It would be really useful if I could export my reports as PDF to share with my manager. Right now I take screenshots.', docs: '' },
  { label: 'A question', title: 'How do I install this and run my first crew?', body: 'I am new to CrewAI. What command installs it and how do I create a new project?', docs: 'https://github.com/crewAIInc/crewAI' },
]
const TYPE_META = {
  bug: { icon: Bug, text: 'Bug', color: 'var(--red)' },
  feature: { icon: Lightbulb, text: 'Feature request', color: 'var(--amber)' },
  question: { icon: HelpCircle, text: 'Question', color: 'var(--cyan)' },
}

export default function IssueTriageView({ project, onRun }: ViewProps) {
  const run = useAgentRun<Result>()
  useRunAnnouncer(run.status, 'Labeled, with a reply ready!')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [docs, setDocs] = useState('')
  const [errors, setErrors] = useState<Errors>({})

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    const errs: Errors = {}
    if (title.trim().length < 3) errs.title = 'Enter the issue title (at least 3 characters).'
    if (title.length > 300) errs.title = 'At most 300 characters.'
    if (body.trim().length < 10) errs.body = 'Describe the issue (at least 10 characters).'
    if (body.length > 8000) errs.body = 'At most 8000 characters.'
    if (docs.trim() && !isUrl(docs)) errs.docs = 'Enter a full URL starting with https://'
    setErrors(errs)
    if (hasErrors(errs)) return
    const payload: Record<string, string> = { title: title.trim(), body: body.trim() }
    if (docs.trim()) payload.docs_url = docs.trim()
    const res = await run.run((signal) => postJson<Result>(project.endpoint, payload, signal))
    if (res) onRun(res.steps, `type: ${res.result.issue_type}`)
  }

  return (
    <ProjectGrid
      input={
        <InputCard tip="Paste an issue exactly as a user wrote it." onSubmit={submit} submitLabel="Triage this issue" busy={run.status === 'loading'}>
          <div>
            <p className="mb-2 text-xs font-semibold text-muted">Try an example:</p>
            <div className="flex flex-wrap gap-2">{SAMPLES.map((s) => (
              <button key={s.label} type="button" className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-2 transition hover:border-[var(--accent)] hover:text-ink"
                onClick={() => { setTitle(s.title); setBody(s.body); setDocs(s.docs); setErrors({}) }}>{s.label}</button>
            ))}</div>
          </div>
          <Field label="Issue title" htmlFor="ititle" required error={errors.title}>
            <input id="ititle" className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Login button does nothing on Safari" aria-invalid={!!errors.title} />
          </Field>
          <Field label="Issue description" htmlFor="ibody" required error={errors.body} counter={{ value: body.length, max: 8000 }}>
            <textarea id="ibody" rows={7} className="field" value={body} onChange={(e) => setBody(e.target.value)} placeholder="What happened? What did you expect? Steps, version, device..." aria-invalid={!!errors.body} />
          </Field>
          <Field label="Docs URL" htmlFor="idocs" error={errors.docs} hint="Used only for questions: the Answer Crew reads this page.">
            <input id="idocs" type="url" className="field" value={docs} onChange={(e) => setDocs(e.target.value)} placeholder="https://docs.yourproject.com/getting-started" />
          </Field>
        </InputCard>
      }
      output={
        <OutputCard project={project} status={run.status} data={run.data} error={run.error} elapsed={run.elapsed} eta="5-60 seconds" onCancel={run.cancel} onRetry={() => submit()}
          emptyTitle="Your triage result will appear here" emptyItems={['Bug, feature or question, and why', 'Labels such as "severity: high"', 'A reply comment, ready to post', 'The specialist crew\'s full analysis']}>
          {(d) => {
            const t = TYPE_META[d.result.issue_type]
            return (
              <>
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl" style={{ color: t.color, background: `color-mix(in srgb, ${t.color} 15%, transparent)` }}><t.icon size={24} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-wider text-muted">Classified as</p>
                    <p className="text-lg font-semibold text-ink">{t.text}</p>
                  </div>
                  <p className="w-full text-sm text-ink-2">{d.result.classification_reason}</p>
                </div>
                <ResultBlock title="Labels" icon={<Tag size={16} />}>
                  <div className="flex flex-wrap gap-2">{d.result.labels.map((l) => <Badge key={l} tone={l.startsWith('severity: critical') || l.startsWith('severity: high') || l === 'bug' ? 'bad' : l.startsWith('priority') || l === 'enhancement' ? 'warn' : 'cyan'}>{l}</Badge>)}</div>
                  {d.result.docs_read !== null && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                      {d.result.docs_read ? <><CircleCheck size={13} className="text-ok" /> The docs page was read for this answer.</> : <><CircleX size={13} className="text-bad" /> The docs page could not be read, so the answer is from general knowledge.</>}
                    </p>
                  )}
                </ResultBlock>
                <section className="overflow-hidden rounded-2xl border border-line">
                  <header className="flex items-center gap-2 border-b border-line bg-surface-2 px-4 py-2.5 text-xs">
                    <span className="grid h-6 w-6 place-items-center rounded-full text-white" style={{ background: 'var(--accent)' }}><Bot size={13} /></span>
                    <b className="text-ink">triage-bot</b><span className="text-muted">commented · reply preview</span>
                    <span className="ml-auto"><CopyButton text={d.result.comment} label="Copy comment" /></span>
                  </header>
                  <div className="bg-surface p-4"><Markdown>{d.result.comment}</Markdown></div>
                </section>
              </>
            )
          }}
        </OutputCard>
      }
    />
  )
}
