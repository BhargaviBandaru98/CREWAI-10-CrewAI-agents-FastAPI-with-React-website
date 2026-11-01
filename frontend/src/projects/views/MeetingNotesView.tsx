import { useState, type FormEvent } from 'react'
import { ClipboardList, Gavel, ListChecks } from 'lucide-react'
import { postForm } from '../../api/client'
import { useAgentRun } from '../../hooks/useAgentRun'
import { useRunAnnouncer } from '../../hooks/useRunAnnouncer'
import Field from '../../components/ui/Field'
import FileDrop from '../../components/ui/FileDrop'
import Segmented from '../../components/ui/Segmented'
import Markdown from '../../components/ui/Markdown'
import { CopyButton } from '../../components/ui/Actions'
import { InputCard, OutputCard, ProjectGrid, ResultBlock } from '../../components/project/Panels'
import { TRANSCRIPT } from '../samples'
import { hasErrors, words, type Errors } from './validate'
import type { ViewProps } from './types'

interface ActionItem { task: string; owner: string; due_date: string }
interface Decision { decision: string; made_by: string; context: string }
interface Result { summary: string[]; action_items: ActionItem[]; decisions: Decision[]; notes_markdown: string }

export default function MeetingNotesView({ project, onRun }: ViewProps) {
  const run = useAgentRun<Result>()
  useRunAnnouncer(run.status, 'Every to-do found!')
  const [mode, setMode] = useState<'text' | 'file'>('text')
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [title, setTitle] = useState('')
  const [errors, setErrors] = useState<Errors>({})

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    const errs: Errors = {}
    if (mode === 'text' && words(text) < 30) errs.text = `Paste the transcript (at least 30 words; you have ${words(text)}).`
    if (mode === 'file' && !files.length) errs.file = 'Upload a .txt, .md or .vtt transcript.'
    if (title.length > 150) errs.title = 'At most 150 characters.'
    setErrors(errs)
    if (hasErrors(errs)) return
    const form = new FormData()
    if (mode === 'text') form.append('transcript_text', text.trim())
    else form.append('transcript_file', files[0])
    if (title.trim()) form.append('meeting_title', title.trim())
    const res = await run.run((signal) => postForm<Result>(project.endpoint, form, signal))
    if (res) onRun(res.steps)
  }

  const muted = (v: string) => /^(unassigned|not specified|team)$/i.test(v.trim())

  return (
    <ProjectGrid
      input={
        <InputCard tip="Paste the transcript or upload the file from your meeting tool." onSubmit={submit} submitLabel="Create meeting notes" busy={run.status === 'loading'}
          onSample={() => { setMode('text'); setText(TRANSCRIPT); setTitle('Product Sync - 28 Oct'); setErrors({}) }}>
          <Segmented ariaLabel="Transcript source" value={mode} onChange={(v) => { setMode(v); setErrors({}) }} size="sm" options={[{ value: 'text', label: 'Paste text' }, { value: 'file', label: 'Upload file' }]} />
          {mode === 'text' ? (
            <Field label="Transcript" htmlFor="transcript" required error={errors.text} hint={`${words(text)} words · who said what, e.g. "Anita: Let's ship on Friday."`}>
              <textarea id="transcript" rows={11} className="field font-mono !text-[13px]" value={text} onChange={(e) => setText(e.target.value)} placeholder={'Anita: Thanks everyone. First item is the launch date...\nRavi: Backend is ready if the fix ships this week.'} aria-invalid={!!errors.text} />
            </Field>
          ) : (
            <Field label="Transcript file" htmlFor="tfile" required error={errors.file}>
              <FileDrop id="tfile" accept={['.txt', '.md', '.vtt']} files={files} onChange={setFiles} />
            </Field>
          )}
          <Field label="Meeting title" htmlFor="mtitle" error={errors.title} hint="Used as the heading of your notes.">
            <input id="mtitle" className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekly product sync" />
          </Field>
        </InputCard>
      }
      output={
        <OutputCard project={project} status={run.status} data={run.data} error={run.error} elapsed={run.elapsed} eta="5-40 seconds" onCancel={run.cancel} onRetry={() => submit()}
          emptyTitle="Your meeting notes will appear here" emptyItems={['A 5-line summary', 'Every action item with owner and due date', 'The decisions that were made', 'notes.md to share with the team']}>
          {(d) => (
            <>
              <ResultBlock title="Summary" icon={<ClipboardList size={16} />}>
                <ol className="space-y-2">{d.result.summary.map((l, i) => (
                  <li key={i} className="flex gap-3 text-sm text-ink-2"><span className="font-mono text-xs font-bold text-[var(--accent)]">{i + 1}</span>{l}</li>
                ))}</ol>
              </ResultBlock>
              <ResultBlock title={`Action items (${d.result.action_items.length})`} icon={<ListChecks size={16} />}>
                {d.result.action_items.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[460px] text-left text-sm">
                      <thead><tr className="text-xs uppercase tracking-wider text-muted"><th className="pb-2 pr-3">Task</th><th className="pb-2 pr-3">Owner</th><th className="pb-2">Due</th></tr></thead>
                      <tbody>{d.result.action_items.map((a, i) => (
                        <tr key={i} className="border-t border-line align-top">
                          <td className="py-2.5 pr-3 text-ink">{a.task}</td>
                          <td className={`py-2.5 pr-3 font-medium ${muted(a.owner) ? 'text-muted' : 'text-[var(--accent)]'}`}>{a.owner}</td>
                          <td className={`py-2.5 ${muted(a.due_date) ? 'text-muted' : 'text-ink-2'}`}>{a.due_date}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : <p className="text-sm text-muted">No action items were found.</p>}
              </ResultBlock>
              <ResultBlock title={`Decisions (${d.result.decisions.length})`} icon={<Gavel size={16} />}>
                {d.result.decisions.length ? (
                  <ul className="space-y-2.5">{d.result.decisions.map((x, i) => (
                    <li key={i} className="rounded-xl border border-line bg-surface-2 p-3">
                      <p className="text-sm font-medium text-ink">{x.decision}</p>
                      <p className="mt-1 text-xs text-muted">Decided by {x.made_by} · {x.context}</p>
                    </li>
                  ))}</ul>
                ) : <p className="text-sm text-muted">No decisions were recorded.</p>}
              </ResultBlock>
              <details className="rounded-2xl border border-line bg-surface p-4">
                <summary className="cursor-pointer text-sm font-semibold text-ink">Formatted notes (notes.md)</summary>
                <div className="mt-3 flex justify-end"><CopyButton text={d.result.notes_markdown} label="Copy notes" /></div>
                <Markdown className="mt-2">{d.result.notes_markdown}</Markdown>
              </details>
            </>
          )}
        </OutputCard>
      }
    />
  )
}
