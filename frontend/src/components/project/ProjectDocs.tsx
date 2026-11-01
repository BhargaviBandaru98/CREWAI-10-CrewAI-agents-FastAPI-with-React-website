import { useState, type ReactNode } from 'react'
import { BookOpen, CodeXml } from 'lucide-react'
import type { Project } from '../../projects/types'
import Segmented from '../ui/Segmented'

/** "How it works" documentation, written for each project: a simple guide and technical details. */
export default function ProjectDocs({ p }: { p: Project }) {
  const [tab, setTab] = useState<'simple' | 'tech'>('simple')
  const d = p.docs
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Segmented ariaLabel="Documentation view" value={tab} onChange={setTab} options={[
          { value: 'simple', label: <span className="inline-flex items-center gap-1.5"><BookOpen size={14} /> Simple guide</span> },
          { value: 'tech', label: <span className="inline-flex items-center gap-1.5"><CodeXml size={14} /> Technical details</span> },
        ]} />
        <span className="font-mono text-xs text-muted">POST {p.endpoint}</span>
      </div>

      {tab === 'simple' ? (
        <div key="simple" className="reveal grid gap-4 md:grid-cols-2">
          <DocBlock title="What is this project?"><p>{d.what}</p></DocBlock>
          <DocBlock title="Why was it built?"><p>{d.why}</p></DocBlock>
          <DocBlock title="What can you do with it?"><List items={d.canDo} /></DocBlock>
          <DocBlock title="What inputs to give">
            <dl className="space-y-2">{d.inputs.map((i) => <div key={i.name}><dt className="font-semibold text-ink">{i.name}</dt><dd>{i.text}</dd></div>)}</dl>
          </DocBlock>
          <DocBlock title="What you get back"><List items={d.outputs} /></DocBlock>
          <DocBlock title="What happens behind the scenes">
            <ol className="space-y-2">{d.backendSimple.map((s, i) => (
              <li key={s} className="flex gap-2.5"><span className="font-mono text-xs font-bold text-[var(--accent)]">{i + 1}.</span><span>{s}</span></li>
            ))}</ol>
          </DocBlock>
        </div>
      ) : (
        <div key="tech" className="reveal grid gap-4 md:grid-cols-[1.5fr_1fr]">
          <DocBlock title="How the backend processes a request">
            <ul className="space-y-2.5">{d.technical.map((t) => <li key={t} className="flex gap-2.5"><span className="text-cyan">▸</span><span>{t}</span></li>)}</ul>
          </DocBlock>
          <div className="space-y-4">
            <DocBlock title="Key components">
              <div className="flex flex-wrap gap-2">{d.tech.map((t) => <span key={t} className="rounded-lg border border-line bg-surface-2 px-2.5 py-1 font-mono text-xs text-ink-2">{t}</span>)}</div>
            </DocBlock>
            <DocBlock title="Endpoint">
              <p className="font-mono text-xs text-ink">POST {p.endpoint}</p>
              <p className="mt-2 text-xs">Request and response schemas are listed in the interactive <a className="text-cyan underline" href="/docs" target="_blank" rel="noopener">API docs</a>. Every response has: status, run_id, duration_seconds, steps, result, files.</p>
            </DocBlock>
          </div>
        </div>
      )}
    </div>
  )
}

function DocBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="glass rounded-3xl p-5 text-sm leading-relaxed text-ink-2">
      <h3 className="mb-3 text-base font-semibold text-ink">{title}</h3>
      {children}
    </section>
  )
}

function List({ items }: { items: string[] }) {
  return <ul className="space-y-1.5">{items.map((i) => <li key={i} className="flex gap-2"><span className="text-[var(--accent)]">✦</span>{i}</li>)}</ul>
}
