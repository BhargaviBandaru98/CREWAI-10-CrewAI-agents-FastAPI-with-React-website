import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Lightbulb, ListChecks, Target } from 'lucide-react'
import type { Project } from '../../projects/types'
import Badge from '../ui/Badge'
import BotSlot from '../bot/BotSlot'

export default function ProjectIntro({ p }: { p: Project }) {
  return (
    <section className="relative px-4 pb-10 pt-24 sm:px-8" data-bot-stop data-bot-text={p.hello} data-bot-state="wave">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -top-24 left-1/4 h-80 w-80 rounded-full blur-3xl" style={{ background: 'color-mix(in srgb, var(--accent) 30%, transparent)' }} />
        <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_top,black,transparent_65%)]" />
      </div>
      <div className="mx-auto max-w-6xl">
        <Link to="/#projects" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-ink"><ArrowLeft size={15} /> All projects</Link>
        <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-start">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl text-white"
            style={{ background: 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 45%, var(--violet)))', boxShadow: '0 16px 40px -14px var(--accent)' }}>
            <p.icon size={30} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <Badge tone="accent">{p.type}</Badge>
              <Badge tone="muted">{p.pattern}</Badge>
            </div>
            <h1 className="mt-3 text-3xl font-bold text-ink sm:text-5xl">{p.name}</h1>
            <p className="mt-3 max-w-3xl text-lg text-ink-2">{p.tagline}</p>
          </div>
        </div>
        <BotSlot text={p.hello} state="wave" className="mt-6" />

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <InfoCard icon={<Target size={18} />} title="The problem">{p.problem}</InfoCard>
          <InfoCard icon={<Lightbulb size={18} />} title="What it does">{p.short}</InfoCard>
          <InfoCard icon={<CheckCircle2 size={18} />} title="How it helps you">
            <ul className="space-y-1.5">{p.benefits.map((b) => <li key={b} className="flex gap-2"><span className="text-[var(--accent)]">✓</span>{b}</li>)}</ul>
          </InfoCard>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <div className="glass rounded-3xl p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><ListChecks size={17} className="text-[var(--accent)]" /> How to use it</h3>
            <ol className="space-y-2.5">
              {p.howToUse.map((s, i) => (
                <li key={s} className="flex gap-3 text-sm text-ink-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full font-mono text-xs font-bold text-white" style={{ background: 'var(--accent)' }}>{i + 1}</span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="glass rounded-3xl p-5">
            <h3 className="mb-3 text-sm font-semibold text-ink">Real-world uses</h3>
            <div className="flex flex-wrap gap-2">
              {p.docs.useCases.map((u) => <span key={u} className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-2">{u}</span>)}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function InfoCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="glass rounded-3xl p-5">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"><span className="text-[var(--accent)]">{icon}</span>{title}</h3>
      <div className="text-sm leading-relaxed text-ink-2">{children}</div>
    </div>
  )
}
