import { useState, type FormEvent } from 'react'
import { Heart, Mail, MessageCircle, Repeat2, Sparkles, ThumbsUp } from 'lucide-react'
import { postForm } from '../../api/client'
import { useAgentRun } from '../../hooks/useAgentRun'
import { useRunAnnouncer } from '../../hooks/useRunAnnouncer'
import Field from '../../components/ui/Field'
import FileDrop from '../../components/ui/FileDrop'
import Segmented from '../../components/ui/Segmented'
import { CopyButton } from '../../components/ui/Actions'
import { InputCard, OutputCard, ProjectGrid, ResultBlock } from '../../components/project/Panels'
import { ARTICLE } from '../samples'
import { hasErrors, isUrl, words, type Errors } from './validate'
import type { ViewProps } from './types'

interface Result {
  source: string
  key_points: { title: string; main_message: string; key_points: string[]; target_audience: string }
  linkedin_post: { hook: string; body: string; call_to_action: string; hashtags: string[] }
  twitter_thread: string[]
  newsletter: { subject_line: string; intro: string; bullets: string[]; closing: string }
}

export default function ContentRemixView({ project, onRun }: ViewProps) {
  const run = useAgentRun<Result>()
  useRunAnnouncer(run.status, 'Three formats, ready to post!')
  const [mode, setMode] = useState<'url' | 'text' | 'file'>('text')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [errors, setErrors] = useState<Errors>({})
  const [tab, setTab] = useState<'linkedin' | 'twitter' | 'newsletter'>('linkedin')

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    const errs: Errors = {}
    if (mode === 'url' && !isUrl(url)) errs.url = 'Enter a full article URL starting with https://'
    if (mode === 'text' && words(text) < 80) errs.text = `The article needs at least ~80 words (you have ${words(text)}).`
    if (mode === 'file' && !files.length) errs.file = 'Upload a .txt or .md file.'
    setErrors(errs)
    if (hasErrors(errs)) return
    const form = new FormData()
    if (mode === 'url') form.append('article_url', url.trim())
    if (mode === 'text') form.append('article_text', text.trim())
    if (mode === 'file') form.append('article_file', files[0])
    const res = await run.run((signal) => postForm<Result>(project.endpoint, form, signal))
    if (res) { onRun(res.steps); setTab('linkedin') }
  }

  const liText = (r: Result) => `${r.linkedin_post.hook}\n\n${r.linkedin_post.body}\n\n${r.linkedin_post.call_to_action}\n\n${r.linkedin_post.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}`
  const nlText = (r: Result) => `Subject: ${r.newsletter.subject_line}\n\n${r.newsletter.intro}\n\n${r.newsletter.bullets.map((b) => `- ${b}`).join('\n')}\n\n${r.newsletter.closing}`

  return (
    <ProjectGrid
      input={
        <InputCard tip="Choose where the article comes from." onSubmit={submit} submitLabel="Remix my content" busy={run.status === 'loading'}
          onSample={() => { setMode('text'); setText(ARTICLE); setErrors({}) }} sampleLabel="Use a sample article">
          <Segmented ariaLabel="Article source" size="sm" value={mode} onChange={(v) => { setMode(v); setErrors({}) }} options={[{ value: 'url', label: 'Article URL' }, { value: 'text', label: 'Paste text' }, { value: 'file', label: 'Upload file' }]} />
          {mode === 'url' && (
            <Field label="Article URL" htmlFor="aurl" required error={errors.url} hint="A public page with the article text (some sites block automated reading).">
              <input id="aurl" type="url" className="field" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://blog.example.com/my-article" aria-invalid={!!errors.url} />
            </Field>
          )}
          {mode === 'text' && (
            <Field label="Article text" htmlFor="atext" required error={errors.text} hint={`${words(text)} words`}>
              <textarea id="atext" rows={12} className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the full article here..." aria-invalid={!!errors.text} />
            </Field>
          )}
          {mode === 'file' && (
            <Field label="Article file" htmlFor="afile" required error={errors.file}>
              <FileDrop id="afile" accept={['.txt', '.md']} files={files} onChange={setFiles} />
            </Field>
          )}
        </InputCard>
      }
      output={
        <OutputCard project={project} status={run.status} data={run.data} error={run.error} elapsed={run.elapsed} eta="5-20 seconds" onCancel={run.cancel} onRetry={() => submit()}
          emptyTitle="Your content pack will appear here" emptyItems={['The key points of your article', 'A LinkedIn post with a hook', 'A 6-tweet thread', 'A newsletter section + 3 files to download']}>
          {(d) => {
            const r = d.result
            return (
              <>
                <ResultBlock title="Key points the AI extracted" icon={<Sparkles size={16} />}>
                  <p className="font-semibold text-ink">{r.key_points.title}</p>
                  <p className="mt-1 text-sm text-ink-2">{r.key_points.main_message}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">{r.key_points.key_points.map((k) => <li key={k}>{k}</li>)}</ul>
                  <p className="mt-2 text-xs text-muted">Audience: {r.key_points.target_audience}</p>
                </ResultBlock>
                <Segmented ariaLabel="Format" size="sm" value={tab} onChange={setTab} options={[{ value: 'linkedin', label: 'LinkedIn' }, { value: 'twitter', label: `Thread (${r.twitter_thread.length})` }, { value: 'newsletter', label: 'Newsletter' }]} />
                {tab === 'linkedin' && (
                  <article className="reveal rounded-2xl border border-line bg-surface-solid p-4">
                    <header className="mb-3 flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-full font-bold text-white" style={{ background: 'linear-gradient(135deg,#0A66C2,var(--accent))' }}>Y</span>
                      <div className="flex-1"><p className="text-sm font-semibold text-ink">You</p><p className="text-[11px] text-muted">LinkedIn post preview · now</p></div>
                      <CopyButton text={liText(r)} />
                    </header>
                    <p className="text-[15px] font-semibold leading-snug text-ink">{r.linkedin_post.hook}</p>
                    <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-2">{r.linkedin_post.body}</p>
                    <p className="mt-3 text-sm font-medium text-ink">{r.linkedin_post.call_to_action}</p>
                    <p className="mt-2 text-sm text-[#0A66C2]">{r.linkedin_post.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}</p>
                    <footer className="mt-4 flex gap-5 border-t border-line pt-3 text-xs text-muted"><span className="inline-flex items-center gap-1"><ThumbsUp size={13} /> Like</span><span className="inline-flex items-center gap-1"><MessageCircle size={13} /> Comment</span><span className="inline-flex items-center gap-1"><Repeat2 size={13} /> Repost</span></footer>
                  </article>
                )}
                {tab === 'twitter' && (
                  <ol className="reveal space-y-0">{r.twitter_thread.map((t, i) => (
                    <li key={i} className="relative flex gap-3 pb-4">
                      {i < r.twitter_thread.length - 1 && <span className="absolute left-5 top-11 bottom-0 w-px bg-line" aria-hidden />}
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink font-bold text-bg">Y</span>
                      <div className="min-w-0 flex-1 rounded-2xl border border-line bg-surface-solid p-3">
                        <div className="flex items-center gap-2 text-xs"><b className="text-ink">You</b><span className="text-muted">@you · {i + 1}/{r.twitter_thread.length}</span>
                          <span className={`ml-auto font-mono ${t.length > 280 ? 'text-bad' : 'text-muted'}`}>{t.length}/280</span></div>
                        <p className="mt-1 whitespace-pre-line text-sm text-ink">{t}</p>
                        <div className="mt-2 flex gap-5 text-xs text-muted"><MessageCircle size={13} /><Repeat2 size={13} /><Heart size={13} /></div>
                      </div>
                    </li>
                  ))}
                    <li className="flex justify-end"><CopyButton text={r.twitter_thread.join('\n\n')} label="Copy thread" /></li>
                  </ol>
                )}
                {tab === 'newsletter' && (
                  <article className="reveal overflow-hidden rounded-2xl border border-line bg-surface-solid">
                    <header className="flex items-center gap-2 border-b border-line bg-surface-2 px-4 py-2.5 text-xs">
                      <Mail size={14} className="text-[var(--accent)]" /><span className="text-muted">Subject:</span><b className="text-ink">{r.newsletter.subject_line}</b>
                      <span className="ml-auto"><CopyButton text={nlText(r)} /></span>
                    </header>
                    <div className="p-5 text-sm leading-relaxed text-ink-2">
                      <p>{r.newsletter.intro}</p>
                      <ul className="my-3 space-y-2">{r.newsletter.bullets.map((b) => <li key={b} className="flex gap-2"><span className="text-[var(--accent)]">●</span>{b}</li>)}</ul>
                      <p className="font-medium text-ink">{r.newsletter.closing}</p>
                    </div>
                  </article>
                )}
              </>
            )
          }}
        </OutputCard>
      }
    />
  )
}
