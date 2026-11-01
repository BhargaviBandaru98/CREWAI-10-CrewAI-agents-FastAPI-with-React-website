import { useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Compass, GitBranch, Layers, MousePointerClick, Rocket, Sparkles, Users, Workflow } from 'lucide-react'
import { PROJECTS } from '../projects'
import type { Project } from '../projects/types'
import HeroVisual from '../components/HeroVisual'
import WorkflowExplorer from '../components/workflow/WorkflowExplorer'
import BotSlot from '../components/bot/BotSlot'
import Segmented from '../components/ui/Segmented'
import { useReveal } from '../hooks/useReveal'

const AGENT_COUNT = 28 // specialist agent roles defined across the 10 projects (excl. the auto-created manager)

export default function Home() {
  const root = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState<'all' | 'Crew' | 'Flow'>('all')
  const shown = useMemo(() => PROJECTS.filter((p) => filter === 'all' || p.type === filter), [filter])
  useReveal(root, [filter])

  return (
    <div ref={root} className="relative">
      <Hero />
      <Marquee />
      <Intro />

      {/* ---------- projects ---------- */}
      <section id="projects" className="relative scroll-mt-20 px-4 py-24 sm:px-8"
        data-bot-stop data-bot-text="Pick any project card. Each one is a different AI team." data-bot-state="point" data-bot-point="right">
        <div className="mx-auto max-w-6xl">
          <SectionHead eyebrow="The projects" title={<>Ten AI teams, <span className="text-gradient">ready to work</span></>}
            text="Every card is a real project running on the server. Pick one, give it your input and get a real AI-generated result." />
          <BotSlot text="Pick any project. Each one is a different AI team!" state="point" className="mb-6" />
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4" data-reveal>
            <Segmented ariaLabel="Filter projects" value={filter} onChange={setFilter} options={[
              { value: 'all', label: 'All 10' },
              { value: 'Crew', label: 'Crews (4)' },
              { value: 'Flow', label: 'Flows (6)' },
            ]} />
            <p className="text-sm text-muted">
              <b className="text-ink">Crews</b> = agents collaborate freely · <b className="text-ink">Flows</b> = a fixed path written in code
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((p) => <ProjectCard key={p.slug} p={p} />)}
          </div>
        </div>
      </section>

      <HowItWorks />
      <CrewsAndFlows />
      <FinalCta />
    </div>
  )
}

/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-28 sm:px-8 sm:pt-32"
      data-bot-stop data-bot-text="Hey! Welcome to CREWAI. I'm CrewBot, your guide." data-bot-state="wave">
      <div className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden />
      <div className="animate-drift pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full blur-3xl" style={{ background: 'color-mix(in srgb, var(--violet) 28%, transparent)' }} aria-hidden />
      <div className="animate-drift pointer-events-none absolute -right-24 top-40 h-80 w-80 rounded-full blur-3xl" style={{ background: 'color-mix(in srgb, var(--cyan) 20%, transparent)', animationDelay: '-6s' }} aria-hidden />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <span className="reveal inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-2">
            <Sparkles size={13} className="text-cyan" /> 10 AI projects · CrewAI Crews &amp; Flows
          </span>
          <h1 className="reveal mt-6 text-4xl font-bold leading-[1.05] text-ink sm:text-5xl xl:text-6xl" style={{ animationDelay: '80ms' }}>
            AI agent teams that do real work, <span className="text-gradient">and show you how.</span>
          </h1>
          <p className="reveal mt-6 max-w-xl text-lg leading-relaxed text-ink-2" style={{ animationDelay: '160ms' }}>
            Write blog posts, screen resumes, triage bugs, qualify leads and more. Each project is a team of AI agents. Give it your input,
            get a real result, then follow the workflow step by step to see exactly what happened.
          </p>
          <div className="reveal mt-8 flex flex-wrap gap-3" style={{ animationDelay: '240ms' }}>
            <a href="#projects" className="btn btn-primary">Explore the projects <ArrowRight size={17} /></a>
            <a href="#how" className="btn btn-ghost">How it works</a>
          </div>
          <BotSlot text="Hey! Welcome to CREWAI. I'm CrewBot." state="wave" className="mt-8" />
          <dl className="reveal mt-10 grid max-w-md grid-cols-3 gap-4" style={{ animationDelay: '320ms' }}>
            {[
              ['10', 'projects'],
              [String(AGENT_COUNT), 'AI agents'],
              ['4 + 6', 'crews + flows'],
            ].map(([n, l]) => (
              <div key={l} className="glass rounded-2xl px-3 py-3 text-center">
                <dt className="sr-only">{l}</dt>
                <dd className="font-display text-2xl font-bold text-ink">{n}</dd>
                <dd className="text-xs text-muted">{l}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="reveal" style={{ animationDelay: '200ms' }}>
          <HeroVisual />
        </div>
      </div>
    </section>
  )
}

function Marquee() {
  const row1 = PROJECTS.map((p) => p.name)
  const row2 = ['@start()', '@listen()', '@router()', 'or_()', 'and_()', '@human_feedback', 'Process.sequential', 'Process.hierarchical', 'async_execution', 'output_pydantic', 'ScrapeWebsiteTool', 'DuckDuckGoSearch']
  const Row = ({ items, reverse }: { items: string[]; reverse?: boolean }) => (
    <div className="flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
      <div className="animate-marquee flex shrink-0 gap-3 pr-3" style={{ animationDirection: reverse ? 'reverse' : 'normal' }}>
        {[...items, ...items].map((t, i) => (
          <span key={i} className={`whitespace-nowrap rounded-full border border-line px-4 py-2 text-sm ${reverse ? 'font-mono text-muted' : 'font-display font-semibold text-ink-2'} bg-surface`}>
            {reverse ? t : <><span className="text-gradient">✦</span> {t}</>}
          </span>
        ))}
      </div>
    </div>
  )
  return (
    <section className="space-y-3 py-6" aria-label="Projects and concepts">
      <Row items={row1} />
      <Row items={row2} reverse />
    </section>
  )
}

function Intro() {
  const pillars = [
    { icon: Compass, title: 'Discover', text: 'Browse ten AI projects, each solving one everyday problem: writing, research, hiring, sales, support and more.' },
    { icon: MousePointerClick, title: 'Use', text: 'Every project has its own simple form. Your input goes to the real backend, and real AI agents produce the result.' },
    { icon: BookOpen, title: 'Understand', text: 'Below every result is an interactive workflow. Click through it to see which agents ran and what each one did.' },
  ]
  return (
    <section className="px-4 py-20 sm:px-8"
      data-bot-stop data-bot-text="CREWAI is a playground of AI teams. Use them, then see how they think." data-bot-state="explain">
      <div className="mx-auto max-w-6xl">
        <SectionHead eyebrow="What is CREWAI" title={<>Use AI teams. <span className="text-gradient">Understand them too.</span></>}
          text="Most AI tools are a black box. CREWAI shows the team behind every answer." />
        <BotSlot text="Use the AI teams, then see how they think." state="explain" className="mb-6" />
        <div className="grid gap-5 md:grid-cols-3">
          {pillars.map((p, i) => (
            <div key={p.title} data-reveal className="glass group rounded-3xl p-6 transition hover:-translate-y-1 hover:shadow-[var(--glow)]">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 text-violet-2 transition group-hover:scale-110 group-hover:text-cyan">
                <p.icon size={22} />
              </span>
              <div className="mt-5 font-mono text-xs text-muted">0{i + 1}</div>
              <h3 className="mt-1 text-xl font-semibold text-ink">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{p.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ProjectCard({ p }: { p: Project }) {
  const style = { '--accent': p.accent } as CSSProperties
  const onMove = (e: MouseEvent<HTMLAnchorElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
  }
  return (
    <Link to={`/projects/${p.slug}`} style={style} onMouseMove={onMove} data-reveal
      className="glass group relative flex flex-col overflow-hidden rounded-3xl p-6 transition duration-300 hover:-translate-y-1.5 hover:border-[color-mix(in_srgb,var(--accent)_55%,transparent)] hover:shadow-[0_24px_60px_-24px_var(--accent)]">
      <span className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100"
        style={{ background: 'radial-gradient(420px circle at var(--mx,50%) var(--my,0%), color-mix(in srgb, var(--accent) 16%, transparent), transparent 60%)' }} aria-hidden />
      <div className="relative flex items-start justify-between gap-3">
        <span className="grid h-13 w-13 place-items-center rounded-2xl text-white transition duration-300 group-hover:rotate-[-6deg] group-hover:scale-110"
          style={{ width: 52, height: 52, background: `linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 45%, var(--violet)))`, boxShadow: '0 10px 30px -10px var(--accent)' }}>
          <p.icon size={24} />
        </span>
        <span className="flex flex-col items-end gap-1">
          <span className="rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-ink-2">
            {p.type === 'Crew' ? <Users size={11} className="mr-1 inline" /> : <Workflow size={11} className="mr-1 inline" />}{p.type}
          </span>
          <span className="text-[11px] text-muted">{p.pattern}</span>
        </span>
      </div>
      <h3 className="relative mt-5 text-xl font-semibold text-ink">{p.name}</h3>
      <p className="relative mt-2 text-sm leading-relaxed text-ink-2">{p.short}</p>
      <dl className="relative mt-4 space-y-2 text-[13px]">
        <div><dt className="inline font-semibold text-ink">Solves: </dt><dd className="inline text-muted">{p.problem}</dd></div>
        <div><dt className="inline font-semibold text-ink">Does: </dt><dd className="inline text-muted">{p.primary}</dd></div>
      </dl>
      <div className="relative mt-4 flex flex-wrap gap-1.5">
        {p.chips.map((c) => (
          <span key={c} className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)' }}>{c}</span>
        ))}
      </div>
      <span className="relative mt-auto flex items-center gap-1.5 pt-6 text-sm font-semibold text-ink">
        Try it now <ArrowRight size={16} className="transition group-hover:translate-x-1.5" style={{ color: 'var(--accent)' }} />
      </span>
    </Link>
  )
}

function HowItWorks() {
  const steps = [
    { icon: Compass, title: 'Pick a project', text: 'Choose the AI team that fits your task, from blog writing to lead scoring.' },
    { icon: MousePointerClick, title: 'Give your input', text: 'Fill in a short form or upload a file. The page checks your input first.' },
    { icon: Users, title: 'Agents get to work', text: 'Your request reaches the FastAPI server. CrewAI agents research, write, score and review.' },
    { icon: GitBranch, title: 'See result + workflow', text: 'You get the real result, plus a workflow that highlights the exact path your request took.' },
  ]
  return (
    <section id="how" className="scroll-mt-20 px-4 py-24 sm:px-8"
      data-bot-stop data-bot-text="Here's what happens when you press Run. Follow the path!" data-bot-state="point" data-bot-point="right">
      <div className="mx-auto max-w-6xl">
        <SectionHead eyebrow="How it works" title={<>From your input to <span className="text-gradient">a real AI result</span></>}
          text="The same four stages happen in every project. What changes is the team of agents in the middle." />
        <BotSlot text="Follow the path: this is what happens when you press Run." state="point" className="mb-6" />
        <ol className="relative grid gap-5 md:grid-cols-4">
          <div className="absolute left-0 right-0 top-10 hidden h-[2px] md:block" aria-hidden
            style={{ background: 'linear-gradient(90deg, transparent, var(--violet), var(--cyan), transparent)', opacity: 0.6 }} />
          {steps.map((s, i) => (
            <li key={s.title} data-reveal className="relative">
              <div className="relative mx-auto mb-5 grid h-20 w-20 place-items-center rounded-3xl glass-strong md:mx-0" style={{ boxShadow: 'var(--glow)' }}>
                <s.icon size={28} className="text-cyan" />
                <span className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-violet font-mono text-xs font-bold text-white">{i + 1}</span>
              </div>
              <h3 className="text-lg font-semibold text-ink">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function CrewsAndFlows() {
  const flows = PROJECTS.filter((p) => p.type === 'Flow')
  const [slug, setSlug] = useState('support-ticket-desk')
  const project = PROJECTS.find((p) => p.slug === slug)!
  return (
    <section id="flows" className="scroll-mt-20 px-4 py-24 sm:px-8"
      data-bot-stop data-bot-text="Crews collaborate. Flows follow a path. Let me show you!" data-bot-state="explain">
      <div className="mx-auto max-w-6xl">
        <SectionHead eyebrow="Crews & Flows" title={<>Two ways for agents to <span className="text-gradient">work together</span></>}
          text="CREWAI uses both CrewAI building blocks. Knowing the difference helps you understand every project." />
        <div className="mb-10 grid gap-5 md:grid-cols-2">
          <div data-reveal className="glass rounded-3xl p-6">
            <div className="flex items-center gap-3"><Users className="text-violet-2" /><h3 className="text-xl font-semibold text-ink">Crew</h3></div>
            <p className="mt-3 text-sm leading-relaxed text-ink-2">A <b className="text-ink">team of agents</b>, each with a role, goal and tools. They work through tasks in order (sequential), at the same time (parallel), or under a manager agent (hierarchical). Great for open-ended work like research and writing.</p>
            <p className="mt-3 font-mono text-xs text-muted">Blog Post Studio · Competitor Radar · Meeting Notes · Sales Report</p>
          </div>
          <div data-reveal className="glass rounded-3xl p-6">
            <div className="flex items-center gap-3"><Layers className="text-cyan" /><h3 className="text-xl font-semibold text-ink">Flow</h3></div>
            <p className="mt-3 text-sm leading-relaxed text-ink-2">A <b className="text-ink">path written in code</b> with steps (@start, @listen), decisions (@router), joins (or_, and_) and even human approval. It can run whole Crews inside its steps. Great when results must be predictable.</p>
            <p className="mt-3 font-mono text-xs text-muted">Support · Resumes · Issues · Content · Leads · Approval</p>
          </div>
        </div>

        <div data-reveal className="xl:-mx-12">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-sm font-semibold text-ink">Explore a flow:</span>
            {flows.map((f) => (
              <button key={f.slug} onClick={() => setSlug(f.slug)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${slug === f.slug ? 'border-transparent text-white' : 'border-line bg-surface text-muted hover:text-ink'}`}
                style={slug === f.slug ? { background: f.accent } : undefined}>
                {f.name}
              </button>
            ))}
          </div>
          <WorkflowExplorer key={slug} project={project} compact />
          <div className="mt-4 text-right">
            <Link to={`/projects/${project.slug}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-cyan hover:underline">
              Open {project.name} <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="px-4 pb-28 pt-10 sm:px-8"
      data-bot-stop data-bot-text="Ready? Pick a project and let the agents work!" data-bot-state="celebrate">
      <div data-reveal className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] p-10 text-center sm:p-14"
        style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--violet) 85%, black), color-mix(in srgb, var(--cyan) 60%, var(--violet)))' }}>
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" aria-hidden />
        <Rocket className="relative mx-auto text-white" size={34} />
        <h2 className="relative mt-4 text-3xl font-bold text-white sm:text-4xl">Your AI team is waiting</h2>
        <p className="relative mx-auto mt-3 max-w-xl text-white/85">Pick a project, give it a real task and watch the workflow light up with the path your request took.</p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <a href="#projects" className="btn bg-white text-[#1b1446] hover:-translate-y-0.5">Explore the projects <ArrowRight size={17} /></a>
          <Link to="/projects/support-ticket-desk" className="btn border border-white/40 text-white hover:bg-white/10">Try the quickest one</Link>
        </div>
        <BotSlot text="Ready? Let the agents work!" state="celebrate" className="relative mt-8 justify-center [&_*]:text-left" />
      </div>
    </section>
  )
}

function SectionHead({ eyebrow, title, text }: { eyebrow: string; title: ReactNode; text: string }) {
  return (
    <div className="mb-10 max-w-3xl" data-reveal>
      <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-cyan">{eyebrow}</span>
      <h2 className="mt-3 text-3xl font-bold leading-tight text-ink sm:text-4xl">{title}</h2>
      <p className="mt-4 text-base leading-relaxed text-ink-2">{text}</p>
    </div>
  )
}
