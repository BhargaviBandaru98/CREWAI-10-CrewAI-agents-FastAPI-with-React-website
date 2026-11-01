import { useState, type FormEvent } from 'react'
import { Mail, Route, UserCheck, UserX } from 'lucide-react'
import { postForm } from '../../api/client'
import { useAgentRun } from '../../hooks/useAgentRun'
import { useRunAnnouncer } from '../../hooks/useRunAnnouncer'
import Field from '../../components/ui/Field'
import FileDrop from '../../components/ui/FileDrop'
import Badge from '../../components/ui/Badge'
import ScoreRing from '../../components/ui/ScoreRing'
import { CopyButton } from '../../components/ui/Actions'
import { InputCard, OutputCard, ProjectGrid } from '../../components/project/Panels'
import { JOB_DESCRIPTION, RESUME_STRONG, RESUME_WEAK } from '../samples'
import { hasErrors, type Errors } from './validate'
import type { ViewProps } from './types'

interface Candidate {
  file_name: string; candidate_name: string; score: number; decision: 'shortlist' | 'reject'; reasoning: string
  matched_skills: string[]; missing_skills: string[]
  summary: { strengths: string[]; gaps: string[]; interview_focus: string[]; recommendation: string } | null
  rejection_email: { subject: string; body: string } | null
  steps: string[]
}
interface Result { total: number; shortlisted: number; rejected: number; threshold: number; candidates: Candidate[]; errors: string[] }

export default function ResumeView({ project, onRun }: ViewProps) {
  const run = useAgentRun<Result>()
  useRunAnnouncer(run.status, 'Candidates scored and ranked!')
  const [jd, setJd] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [pasted, setPasted] = useState('')
  const [threshold, setThreshold] = useState(7)
  const [errors, setErrors] = useState<Errors>({})
  const [traced, setTraced] = useState<string | null>(null)

  const trace = (c: Candidate) => { setTraced(c.file_name); onRun(c.steps, `candidate: ${c.candidate_name}`) }

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    const errs: Errors = {}
    if (jd.trim().length < 30) errs.jd = 'Paste the job description (at least 30 characters).'
    if (jd.length > 8000) errs.jd = 'At most 8000 characters.'
    if (!files.length && !pasted.trim()) errs.files = 'Upload at least one resume or paste one below.'
    if (files.length + (pasted.trim() ? 1 : 0) > 10) errs.files = 'Maximum 10 resumes per run.'
    setErrors(errs)
    if (hasErrors(errs)) return
    const form = new FormData()
    form.append('job_description', jd.trim())
    files.forEach((f) => form.append('resumes', f))
    if (pasted.trim()) form.append('resume_text', pasted.trim())
    form.append('threshold', String(threshold))
    const res = await run.run((signal) => postForm<Result>(project.endpoint, form, signal))
    if (res && res.result.candidates[0]) trace(res.result.candidates[0])
  }

  const sample = () => {
    setJd(JOB_DESCRIPTION)
    setFiles([new File([RESUME_STRONG], 'ananya_reddy.txt', { type: 'text/plain' }), new File([RESUME_WEAK], 'rohit_kumar.txt', { type: 'text/plain' })])
    setPasted('')
    setErrors({})
  }

  return (
    <ProjectGrid
      input={
        <InputCard tip="Each resume is scored separately against the same job." onSubmit={submit} submitLabel="Screen resumes" busy={run.status === 'loading'} onSample={sample} sampleLabel="Use 2 sample resumes">
          <Field label="Job description" htmlFor="jd" required error={errors.jd} hint="Include must-have and nice-to-have skills." counter={{ value: jd.length, max: 8000 }}>
            <textarea id="jd" rows={6} className="field" value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Backend Python Developer (2+ years). Must have: Python, FastAPI..." aria-invalid={!!errors.jd} />
          </Field>
          <Field label="Resumes" htmlFor="resumes" required error={errors.files} hint="PDFs must contain real text (scanned images cannot be read).">
            <FileDrop id="resumes" accept={['.pdf', '.txt', '.md']} multiple maxFiles={10} files={files} onChange={setFiles} label="Drop resumes here or click to browse" />
          </Field>
          <Field label="Or paste one resume" htmlFor="pasted">
            <textarea id="pasted" rows={4} className="field" value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Paste resume text here" />
          </Field>
          <Field label={`Shortlist threshold: ${threshold} / 10`} htmlFor="thr" required hint="Candidates scoring at or above this are shortlisted.">
            <input id="thr" type="range" min={1} max={10} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
          </Field>
        </InputCard>
      }
      output={
        <OutputCard project={project} status={run.status} data={run.data} error={run.error} elapsed={run.elapsed} eta="5-20 seconds per resume" onCancel={run.cancel} onRetry={() => submit()}
          emptyTitle="Your ranked candidates will appear here" emptyItems={['A 0-10 score for each resume, with reasons', 'Matched and missing skills', 'A summary for shortlisted candidates', 'A polite email for the others, plus results.csv']}>
          {(d) => (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Count label="Screened" value={d.result.total} />
                <Count label="Shortlisted" value={d.result.shortlisted} color="var(--green)" />
                <Count label="Rejected" value={d.result.rejected} color="var(--red)" />
              </div>
              {d.result.errors.length > 0 && (
                <div className="rounded-xl border border-line bg-surface p-3 text-xs text-bad">{d.result.errors.map((e) => <p key={e}>Skipped {e}</p>)}</div>
              )}
              <div className="space-y-3">
                {d.result.candidates.map((c) => (
                  <article key={c.file_name} className="rounded-2xl border border-line bg-surface p-4">
                    <div className="flex flex-wrap items-start gap-4">
                      <ScoreRing value={c.score} max={10} size={78} label="Score" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-ink">{c.candidate_name}</h3>
                          {c.decision === 'shortlist' ? <Badge tone="ok"><UserCheck size={12} /> Shortlisted</Badge> : <Badge tone="bad"><UserX size={12} /> Not shortlisted</Badge>}
                        </div>
                        <p className="font-mono text-[11px] text-muted">{c.file_name}</p>
                        <p className="mt-2 text-sm text-ink-2">{c.reasoning}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {c.matched_skills.map((s) => <Badge key={`m${s}`} tone="ok">✓ {s}</Badge>)}
                      {c.missing_skills.map((s) => <Badge key={`x${s}`} tone="muted">✗ {s}</Badge>)}
                    </div>
                    {c.summary && (
                      <details className="mt-3 rounded-xl border border-line bg-surface-2 p-3">
                        <summary className="cursor-pointer text-sm font-semibold text-ink">Candidate summary</summary>
                        <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
                          <MiniList title="Strengths" items={c.summary.strengths} />
                          <MiniList title="Gaps" items={c.summary.gaps} />
                          <MiniList title="Interview focus" items={c.summary.interview_focus} />
                          <div><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Recommendation</p><p className="text-ink-2">{c.summary.recommendation}</p></div>
                        </div>
                      </details>
                    )}
                    {c.rejection_email && (
                      <details className="mt-3 rounded-xl border border-line bg-surface-2 p-3">
                        <summary className="cursor-pointer text-sm font-semibold text-ink"><Mail size={14} className="mr-1 inline" /> Rejection email draft</summary>
                        <div className="mt-2 flex justify-end"><CopyButton text={`Subject: ${c.rejection_email.subject}\n\n${c.rejection_email.body}`} /></div>
                        <p className="mt-1 text-sm font-semibold text-ink">{c.rejection_email.subject}</p>
                        <p className="mt-1 whitespace-pre-line text-sm text-ink-2">{c.rejection_email.body}</p>
                      </details>
                    )}
                    <button type="button" onClick={() => trace(c)} className={`mt-3 inline-flex items-center gap-1.5 text-xs font-semibold ${traced === c.file_name ? 'text-ok' : 'text-cyan hover:underline'}`}>
                      <Route size={13} /> {traced === c.file_name ? 'Shown in the workflow below' : "Show this candidate's path in the workflow"}
                    </button>
                  </article>
                ))}
              </div>
            </>
          )}
        </OutputCard>
      }
    />
  )
}

function Count({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3 text-center">
      <div className="font-display text-2xl font-bold" style={{ color: color ?? 'var(--text)' }}>{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
    </div>
  )
}
function MiniList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">{title}</p>
      <ul className="list-disc space-y-0.5 pl-4 text-ink-2">{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </div>
  )
}
