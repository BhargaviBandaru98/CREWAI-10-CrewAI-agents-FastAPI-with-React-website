import { useState, type FormEvent } from 'react'
import { BadgeCheck, ChartColumn, Lightbulb, TriangleAlert } from 'lucide-react'
import { postForm } from '../../api/client'
import { useAgentRun } from '../../hooks/useAgentRun'
import { useRunAnnouncer } from '../../hooks/useRunAnnouncer'
import Field from '../../components/ui/Field'
import FileDrop from '../../components/ui/FileDrop'
import Segmented from '../../components/ui/Segmented'
import Markdown from '../../components/ui/Markdown'
import Badge from '../../components/ui/Badge'
import { CopyButton } from '../../components/ui/Actions'
import { InputCard, OutputCard, ProjectGrid, ResultBlock } from '../../components/project/Panels'
import { SALES_CSV } from '../samples'
import { hasErrors, type Errors } from './validate'
import type { ViewProps } from './types'

interface Metric { name: string; value: number; unit: string }
interface Stats { row_count: number; date_range: string; total_revenue: number | null; key_metrics: Metric[]; top_segments: string[]; weakest_segments: string[]; trend: string }
interface Finding { title: string; detail: string; evidence: string }
interface Result {
  stats: Stats
  top_findings: Finding[]
  review: { report_markdown: string; corrections_made: string[]; all_numbers_verified: boolean }
  computed_stats: { breakdowns?: Record<string, { name: string; share_pct: number; [k: string]: string | number }[]>; revenue_column?: string | null; [k: string]: unknown }
}

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 })

export default function SalesReportView({ project, onRun }: ViewProps) {
  const run = useAgentRun<Result>()
  useRunAnnouncer(run.status, 'Numbers checked. Report ready!')
  const [mode, setMode] = useState<'file' | 'text'>('file')
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [title, setTitle] = useState('')
  const [errors, setErrors] = useState<Errors>({})

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    const errs: Errors = {}
    if (mode === 'text' && text.trim().split('\n').filter(Boolean).length < 2) errs.text = 'Paste a CSV with a header row and at least one data row.'
    if (mode === 'file' && !files.length) errs.file = 'Upload a .csv file.'
    if (title.length > 150) errs.title = 'At most 150 characters.'
    setErrors(errs)
    if (hasErrors(errs)) return
    const form = new FormData()
    if (mode === 'text') form.append('csv_text', text.trim())
    else form.append('csv_file', files[0])
    if (title.trim()) form.append('report_title', title.trim())
    const res = await run.run((signal) => postForm<Result>(project.endpoint, form, signal))
    if (res) onRun(res.steps)
  }

  return (
    <ProjectGrid
      input={
        <InputCard tip="Any sales CSV works: the tool finds revenue, dates and categories itself." onSubmit={submit} submitLabel="Analyze my data" busy={run.status === 'loading'}
          onSample={() => { setMode('text'); setText(SALES_CSV); setTitle('Q3 2026 Sales Report'); setErrors({}) }} sampleLabel="Use sample sales data">
          <Segmented ariaLabel="CSV source" value={mode} onChange={(v) => { setMode(v); setErrors({}) }} size="sm" options={[{ value: 'file', label: 'Upload CSV' }, { value: 'text', label: 'Paste CSV' }]} />
          {mode === 'file' ? (
            <Field label="Sales CSV" htmlFor="csv" required error={errors.file} hint="First row must be the column names, e.g. date, product, region, units, revenue.">
              <FileDrop id="csv" accept={['.csv']} files={files} onChange={setFiles} />
            </Field>
          ) : (
            <Field label="CSV text" htmlFor="csvtext" required error={errors.text} hint={`${text.trim() ? text.trim().split('\n').length - 1 : 0} data rows`}>
              <textarea id="csvtext" rows={10} className="field font-mono !text-[12px]" value={text} onChange={(e) => setText(e.target.value)} placeholder={'date,product,region,units,revenue\n2026-07-01,EcoBottle,North,12,5988'} aria-invalid={!!errors.text} />
            </Field>
          )}
          <Field label="Report title" htmlFor="rtitle" error={errors.title}>
            <input id="rtitle" className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekly Sales Report" />
          </Field>
        </InputCard>
      }
      output={
        <OutputCard project={project} status={run.status} data={run.data} error={run.error} elapsed={run.elapsed} eta="10-60 seconds" onCancel={run.cancel} onRetry={() => submit()}
          emptyTitle="Your sales report will appear here" emptyItems={['Key numbers computed with pandas', 'Top 3 findings with evidence', 'A report where every number was re-checked', 'Breakdown charts and report.md']}>
          {(d) => {
            const s = d.result.stats
            const bd = Object.entries(d.result.computed_stats.breakdowns ?? {}).slice(0, 2)
            return (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {d.result.review.all_numbers_verified
                    ? <Badge tone="ok"><BadgeCheck size={13} /> All numbers verified</Badge>
                    : <Badge tone="warn"><TriangleAlert size={13} /> Some numbers not verified</Badge>}
                  {d.result.review.corrections_made.length > 0 && <Badge tone="warn">{d.result.review.corrections_made.length} correction(s) made by the reviewer</Badge>}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Tile label="Rows" value={fmt(s.row_count)} />
                  <Tile label="Total revenue" value={s.total_revenue != null ? fmt(s.total_revenue) : 'n/a'} />
                  {s.key_metrics.slice(0, 2).map((m) => <Tile key={m.name} label={m.name} value={`${fmt(m.value)}${m.unit && !/usd|\$/i.test(m.unit) ? ` ${m.unit}` : ''}`} />)}
                </div>
                <p className="text-xs text-muted">Date range: {s.date_range}</p>
                <ResultBlock title="Top 3 findings" icon={<Lightbulb size={16} />}>
                  <div className="grid gap-3">{d.result.top_findings.map((f, i) => (
                    <div key={i} className="rounded-xl border border-line bg-surface-2 p-3.5">
                      <p className="font-semibold text-ink"><span className="mr-2 font-mono text-[var(--accent)]">{i + 1}.</span>{f.title}</p>
                      <p className="mt-1 text-sm text-ink-2">{f.detail}</p>
                      <p className="mt-2 rounded-lg bg-surface px-2.5 py-1.5 font-mono text-[11.5px] text-muted">Evidence: {f.evidence}</p>
                    </div>
                  ))}</div>
                </ResultBlock>
                {bd.length > 0 && (
                  <ResultBlock title="Breakdown (computed by pandas)" icon={<ChartColumn size={16} />}>
                    <div className="grid gap-5 sm:grid-cols-2">{bd.map(([col, rows]) => (
                      <div key={col}>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">by {col}</p>
                        <ul className="space-y-2">{rows.slice(0, 6).map((r) => (
                          <li key={r.name}>
                            <div className="flex justify-between text-xs"><span className="text-ink">{r.name}</span><span className="font-mono text-muted">{r.share_pct}%</span></div>
                            <div className="mt-1 h-2 rounded-full bg-surface-2"><div className="h-2 rounded-full" style={{ width: `${Math.max(2, r.share_pct)}%`, background: 'linear-gradient(90deg, var(--accent), var(--cyan))', transition: 'width 1s' }} /></div>
                          </li>
                        ))}</ul>
                      </div>
                    ))}</div>
                  </ResultBlock>
                )}
                <ResultBlock title="Verified report" actions={<CopyButton text={d.result.review.report_markdown} label="Copy report" />}>
                  <Markdown>{d.result.review.report_markdown}</Markdown>
                </ResultBlock>
                {d.result.review.corrections_made.length > 0 && (
                  <ResultBlock title="Corrections by the reviewer"><ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">{d.result.review.corrections_made.map((c) => <li key={c}>{c}</li>)}</ul></ResultBlock>
                )}
              </>
            )
          }}
        </OutputCard>
      }
    />
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <div className="truncate text-[11px] uppercase tracking-wider text-muted" title={label}>{label}</div>
      <div className="mt-1 truncate font-display text-xl font-bold text-ink" title={value}>{value}</div>
    </div>
  )
}
