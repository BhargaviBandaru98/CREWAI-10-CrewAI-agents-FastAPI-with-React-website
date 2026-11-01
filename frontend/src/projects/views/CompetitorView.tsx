import { useState, type FormEvent } from 'react'
import { CircleCheck, CircleX, Globe } from 'lucide-react'
import { postJson } from '../../api/client'
import { useAgentRun } from '../../hooks/useAgentRun'
import { useRunAnnouncer } from '../../hooks/useRunAnnouncer'
import Field from '../../components/ui/Field'
import Markdown from '../../components/ui/Markdown'
import { CopyButton } from '../../components/ui/Actions'
import { InputCard, OutputCard, ProjectGrid, ResultBlock } from '../../components/project/Panels'
import { hasErrors, isUrl, type Errors } from './validate'
import type { ViewProps } from './types'

interface Result { competitors: string[]; websites_read: Record<string, boolean>; sources_used: string[]; report: string }

export default function CompetitorView({ project, onRun }: ViewProps) {
  const run = useAgentRun<Result>()
  useRunAnnouncer(run.status, 'Your competitor report is ready!')
  const [urls, setUrls] = useState(['', '', ''])
  const [company, setCompany] = useState('')
  const [errors, setErrors] = useState<Errors>({})

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    const errs: Errors = {}
    urls.forEach((u, i) => { if (!isUrl(u)) errs[`u${i}`] = 'Enter a full website address starting with https://' })
    const norm = urls.map((u) => u.trim().toLowerCase().replace(/\/$/, ''))
    if (!hasErrors(errs) && new Set(norm).size < 3) errs.u2 = 'Please enter three different websites.'
    if (company.length > 300) errs.company = 'At most 300 characters.'
    setErrors(errs)
    if (hasErrors(errs)) return
    const body: Record<string, unknown> = { competitors: urls.map((u) => u.trim()) }
    if (company.trim()) body.your_company = company.trim()
    const res = await run.run((signal) => postJson<Result>(project.endpoint, body, signal))
    if (res) onRun(res.steps)
  }

  return (
    <ProjectGrid
      input={
        <InputCard tip="Exactly three competitor websites." onSubmit={submit} submitLabel="Analyze competitors" busy={run.status === 'loading'}
          onSample={() => { setUrls(['https://www.notion.so', 'https://clickup.com', 'https://asana.com']); setCompany('A simple project management app for student teams'); setErrors({}) }}>
          {urls.map((u, i) => (
            <Field key={i} label={`Competitor ${i + 1}`} htmlFor={`u${i}`} required error={errors[`u${i}`]}>
              <div className="relative">
                <Globe size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input id={`u${i}`} type="url" inputMode="url" className="field !pl-10" value={u} placeholder="https://competitor.com" aria-invalid={!!errors[`u${i}`]}
                  onChange={(e) => setUrls(urls.map((x, j) => (j === i ? e.target.value : x)))} />
              </div>
            </Field>
          ))}
          <Field label="Your company" htmlFor="company" error={errors.company} hint="Describe your product to get recommendations tailored to you." counter={{ value: company.length, max: 300 }}>
            <textarea id="company" rows={3} className="field" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. A simple project management app for student teams" />
          </Field>
          <p className="rounded-xl border border-line bg-surface px-3 py-2 text-xs text-muted">This is the biggest crew (a manager and 4 specialists, about 30 AI calls), so it can take 1-3 minutes.</p>
        </InputCard>
      }
      output={
        <OutputCard project={project} status={run.status} data={run.data} error={run.error} elapsed={run.elapsed} eta="1-3 minutes" onCancel={run.cancel} onRetry={() => submit()}
          emptyTitle="Your competitor report will appear here" emptyItems={['Executive summary and comparison table', 'A SWOT table for each competitor', 'Recent news and recommendations', 'Which websites were really read']}>
          {(d) => (
            <>
              <ResultBlock title="Websites the agents could read">
                <ul className="grid gap-2 sm:grid-cols-3">
                  {Object.entries(d.result.websites_read).map(([url, ok]) => (
                    <li key={url} className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs">
                      {ok ? <CircleCheck size={15} className="shrink-0 text-ok" /> : <CircleX size={15} className="shrink-0 text-bad" />}
                      <span className="truncate text-ink" title={url}>{url.replace(/^https?:\/\/(www\.)?/, '')}</span>
                    </li>
                  ))}
                </ul>
                {Object.values(d.result.websites_read).some((v) => !v) && (
                  <p className="mt-2 text-xs text-muted">Some sites could not be read (they may block automated visits). The report marks missing data instead of guessing.</p>
                )}
                {d.result.sources_used.length > 0 && <p className="mt-2 text-xs text-muted">{d.result.sources_used.length} pages / search results were used.</p>}
              </ResultBlock>
              <ResultBlock title="Competitor report" actions={<CopyButton text={d.result.report} label="Copy report" />}>
                <Markdown>{d.result.report}</Markdown>
              </ResultBlock>
            </>
          )}
        </OutputCard>
      }
    />
  )
}
