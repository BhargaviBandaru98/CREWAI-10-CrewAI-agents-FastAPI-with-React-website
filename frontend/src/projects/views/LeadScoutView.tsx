import { useState, type FormEvent } from 'react'
import { Building2, Flame, Mail, Snowflake, ThermometerSun, TriangleAlert } from 'lucide-react'
import { postJson } from '../../api/client'
import { useAgentRun } from '../../hooks/useAgentRun'
import { useRunAnnouncer } from '../../hooks/useRunAnnouncer'
import Field from '../../components/ui/Field'
import Badge from '../../components/ui/Badge'
import ScoreRing from '../../components/ui/ScoreRing'
import { CopyButton } from '../../components/ui/Actions'
import { InputCard, OutputCard, ProjectGrid, ResultBlock } from '../../components/project/Panels'
import { hasErrors, isUrl, type Errors } from './validate'
import type { ViewProps } from './types'

interface Result {
  lead: string; website_read: boolean
  company_profile: { company_name: string; industry: string; what_they_do: string; estimated_size: string; target_customers: string; buying_signals: string[]; likely_needs: string[] }
  score: number; tier: 'hot' | 'warm' | 'cold'; score_reasoning: string; fit_signals: string[]; concerns: string[]; action: string
  outreach_email: { subject: string; body: string } | null
}
const TIER = {
  hot: { icon: Flame, color: 'var(--red)', text: 'Hot lead' },
  warm: { icon: ThermometerSun, color: 'var(--amber)', text: 'Warm lead' },
  cold: { icon: Snowflake, color: 'var(--cyan)', text: 'Cold lead' },
}

export default function LeadScoutView({ project, onRun }: ViewProps) {
  const run = useAgentRun<Result>()
  useRunAnnouncer(run.status, 'Lead scored. Here is the verdict!')
  const [f, setF] = useState({ name: '', company_website: '', email: '', notes: '', product_description: '', ideal_customer_profile: '' })
  const [errors, setErrors] = useState<Errors>({})
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    const errs: Errors = {}
    if (!f.name.trim()) errs.name = "Enter the lead's name."
    if (!isUrl(f.company_website)) errs.company_website = 'Enter the company website, starting with https://'
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email.trim())) errs.email = 'This does not look like an email address.'
    if (f.product_description.trim().length < 10) errs.product_description = 'Describe your product (at least 10 characters).'
    if (f.ideal_customer_profile.trim().length < 10) errs.ideal_customer_profile = 'Describe your ideal customer (at least 10 characters).'
    for (const k of ['notes', 'product_description', 'ideal_customer_profile'] as const) if (f[k].length > 2000) errs[k] = 'At most 2000 characters.'
    setErrors(errs)
    if (hasErrors(errs)) return
    const body = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim()]).filter(([k, v]) => v || ['name', 'company_website', 'product_description', 'ideal_customer_profile'].includes(k as string)))
    const res = await run.run((signal) => postJson<Result>(project.endpoint, body, signal))
    if (res) onRun(res.steps, `tier: ${res.result.tier}`)
  }

  const sample = () => {
    setF({
      name: 'Joao Moura', company_website: 'https://github.com/crewAIInc', email: 'joao@example.com',
      notes: 'Filled the demo form: wants to monitor and debug their multi-agent workflows in production.',
      product_description: 'AgentScope: an observability platform that traces, debugs and monitors LLM agents and multi-agent workflows in production.',
      ideal_customer_profile: 'Software companies and open-source teams building LLM agent frameworks or AI agent products, with engineering teams that run agents in production.',
    })
    setErrors({})
  }

  return (
    <ProjectGrid
      input={
        <InputCard tip="The score compares the lead with YOUR product and ideal customer." onSubmit={submit} submitLabel="Qualify this lead" busy={run.status === 'loading'} onSample={sample}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Lead name" htmlFor="lname" required error={errors.name}><input id="lname" className="field" value={f.name} onChange={set('name')} placeholder="e.g. Rahul Verma" aria-invalid={!!errors.name} /></Field>
            <Field label="Email" htmlFor="lemail" error={errors.email}><input id="lemail" type="email" className="field" value={f.email} onChange={set('email')} placeholder="rahul@company.com" /></Field>
          </div>
          <Field label="Company website" htmlFor="lsite" required error={errors.company_website} hint="An agent reads this page to learn about the company.">
            <input id="lsite" type="url" className="field" value={f.company_website} onChange={set('company_website')} placeholder="https://company.com" aria-invalid={!!errors.company_website} />
          </Field>
          <Field label="Notes about the lead" htmlFor="lnotes" error={errors.notes} hint="e.g. what they asked on your form">
            <textarea id="lnotes" rows={2} className="field" value={f.notes} onChange={set('notes')} placeholder="Asked about pricing for a team of 20" />
          </Field>
          <Field label="Your product" htmlFor="lprod" required error={errors.product_description}>
            <textarea id="lprod" rows={3} className="field" value={f.product_description} onChange={set('product_description')} placeholder="What do you sell, and what problem does it solve?" aria-invalid={!!errors.product_description} />
          </Field>
          <Field label="Your ideal customer" htmlFor="licp" required error={errors.ideal_customer_profile}>
            <textarea id="licp" rows={3} className="field" value={f.ideal_customer_profile} onChange={set('ideal_customer_profile')} placeholder="Industry, company size, needs..." aria-invalid={!!errors.ideal_customer_profile} />
          </Field>
        </InputCard>
      }
      output={
        <OutputCard project={project} status={run.status} data={run.data} error={run.error} elapsed={run.elapsed} eta="5-30 seconds" onCancel={run.cancel} onRetry={() => submit()}
          emptyTitle="Your lead verdict will appear here" emptyItems={['A company profile from their website', 'A 0-100 fit score: hot, warm or cold', 'The reasons, fit signals and concerns', 'An email draft for hot leads + leads.csv']}>
          {(d) => {
            const r = d.result
            const t = TIER[r.tier]
            return (
              <>
                <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-line bg-surface p-4">
                  <ScoreRing value={r.score} max={100} color={t.color} label="Fit score" />
                  <div className="min-w-0 flex-1">
                    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold" style={{ color: t.color, background: `color-mix(in srgb, ${t.color} 15%, transparent)` }}><t.icon size={16} /> {t.text}</span>
                    <p className="mt-2 text-sm text-ink"><b>Action:</b> {r.action}</p>
                    <p className="mt-1 text-sm text-ink-2">{r.score_reasoning}</p>
                  </div>
                </div>
                {!r.website_read && (
                  <p className="flex items-start gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-warn"><TriangleAlert size={14} className="mt-px shrink-0" /> The website could not be read, so the profile is based only on the details you gave.</p>
                )}
                <ResultBlock title={r.company_profile.company_name} icon={<Building2 size={16} />}>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <Item k="Industry" v={r.company_profile.industry} />
                    <Item k="Size" v={r.company_profile.estimated_size} />
                    <Item k="What they do" v={r.company_profile.what_they_do} wide />
                    <Item k="Their customers" v={r.company_profile.target_customers} wide />
                  </dl>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Chips title="Fit signals" items={r.fit_signals} tone="ok" />
                    <Chips title="Concerns" items={r.concerns} tone="warn" />
                  </div>
                </ResultBlock>
                {r.outreach_email && (
                  <ResultBlock title="Outreach email draft" icon={<Mail size={16} />} actions={<CopyButton text={`Subject: ${r.outreach_email.subject}\n\n${r.outreach_email.body}`} />}>
                    <p className="text-sm font-semibold text-ink">{r.outreach_email.subject}</p>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-2">{r.outreach_email.body}</p>
                  </ResultBlock>
                )}
              </>
            )
          }}
        </OutputCard>
      }
    />
  )
}

function Item({ k, v, wide }: { k: string; v: string; wide?: boolean }) {
  return <div className={wide ? 'sm:col-span-2' : ''}><dt className="text-xs uppercase tracking-wider text-muted">{k}</dt><dd className="text-ink-2">{v}</dd></div>
}
function Chips({ title, items, tone }: { title: string; items: string[]; tone: 'ok' | 'warn' }) {
  return (
    <div>
      <p className="mb-1.5 text-xs uppercase tracking-wider text-muted">{title}</p>
      {items.length ? <div className="flex flex-wrap gap-1.5">{items.map((i) => <Badge key={i} tone={tone} className="!font-medium">{i}</Badge>)}</div> : <p className="text-xs text-muted">None</p>}
    </div>
  )
}
