import { useState, type FormEvent } from 'react'
import { FileText, Link2, NotebookText } from 'lucide-react'
import { postJson } from '../../api/client'
import { useAgentRun } from '../../hooks/useAgentRun'
import { useRunAnnouncer } from '../../hooks/useRunAnnouncer'
import Field from '../../components/ui/Field'
import Markdown from '../../components/ui/Markdown'
import Badge from '../../components/ui/Badge'
import Segmented from '../../components/ui/Segmented'
import { CopyButton } from '../../components/ui/Actions'
import { InputCard, OutputCard, ProjectGrid, ResultBlock } from '../../components/project/Panels'
import { hasErrors, type Errors } from './validate'
import type { ViewProps } from './types'

interface Result { topic: string; title: string; word_count: number; blog_post: string; research_notes: string; sources: string[] }

export default function BlogPostView({ project, onRun }: ViewProps) {
  const run = useAgentRun<Result>()
  useRunAnnouncer(run.status, 'Your blog post is ready!')
  const [topic, setTopic] = useState('')
  const [audience, setAudience] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [tab, setTab] = useState<'post' | 'notes' | 'sources'>('post')

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    const errs: Errors = {}
    if (topic.trim().length < 3) errs.topic = 'Please enter a topic of at least 3 characters.'
    if (topic.length > 200) errs.topic = 'The topic can be at most 200 characters.'
    if (audience.length > 150) errs.audience = 'At most 150 characters.'
    setErrors(errs)
    if (hasErrors(errs)) return
    const body: Record<string, string> = { topic: topic.trim() }
    if (audience.trim()) body.target_audience = audience.trim()
    const res = await run.run((signal) => postJson<Result>(project.endpoint, body, signal))
    if (res) { onRun(res.steps); setTab('post') }
  }

  return (
    <ProjectGrid
      input={
        <InputCard tip="One topic is enough. The agents do the research." onSubmit={submit} submitLabel="Write my blog post" busy={run.status === 'loading'}
          onSample={() => { setTopic('AI in farming'); setAudience('small farm owners'); setErrors({}) }}>
          <Field label="Topic" htmlFor="topic" required error={errors.topic} hint='e.g. "AI in farming" or "Benefits of solar panels for homes"' counter={{ value: topic.length, max: 200 }}>
            <input id="topic" className="field" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What should the post be about?" aria-invalid={!!errors.topic} maxLength={220} />
          </Field>
          <Field label="Target audience" htmlFor="audience" error={errors.audience} hint="Who will read it? Leave empty for general readers.">
            <input id="audience" className="field" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. small farm owners, students, developers" aria-invalid={!!errors.audience} />
          </Field>
        </InputCard>
      }
      output={
        <OutputCard project={project} status={run.status} data={run.data} error={run.error} elapsed={run.elapsed} eta="10-40 seconds" onCancel={run.cancel} onRetry={() => submit()}
          emptyTitle="Your blog post will appear here" emptyItems={['A title and a ~600-word post in Markdown', 'The research notes the agents wrote', 'The real web sources that were found', 'A blog_post.md download']}>
          {(d) => (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">{d.result.word_count} words</Badge>
                <Badge tone={d.result.sources.length ? 'ok' : 'warn'}>{d.result.sources.length} web sources</Badge>
                <span className="ml-auto"><CopyButton text={d.result.blog_post} label="Copy post" /></span>
              </div>
              <Segmented size="sm" ariaLabel="Result view" value={tab} onChange={setTab} options={[
                { value: 'post', label: <span className="inline-flex items-center gap-1"><FileText size={13} /> Blog post</span> },
                { value: 'notes', label: <span className="inline-flex items-center gap-1"><NotebookText size={13} /> Research notes</span> },
                { value: 'sources', label: <span className="inline-flex items-center gap-1"><Link2 size={13} /> Sources</span> },
              ]} />
              {tab === 'post' && <div className="rounded-2xl border border-line bg-surface p-5"><Markdown>{d.result.blog_post}</Markdown></div>}
              {tab === 'notes' && <ResultBlock title="What the Researcher found"><Markdown>{d.result.research_notes || '_No notes returned._'}</Markdown></ResultBlock>}
              {tab === 'sources' && (
                <ResultBlock title="Sources returned by the search tool">
                  {d.result.sources.length ? (
                    <ul className="space-y-1.5 text-sm">{d.result.sources.map((s) => <li key={s}><a className="break-all text-cyan underline" href={`https://${s}`} target="_blank" rel="noopener noreferrer">{s}</a></li>)}</ul>
                  ) : (
                    <p className="text-sm text-muted">Live web search returned no results for this run, so the post is based on general knowledge. The agents were told not to invent sources or statistics.</p>
                  )}
                </ResultBlock>
              )}
            </>
          )}
        </OutputCard>
      }
    />
  )
}
