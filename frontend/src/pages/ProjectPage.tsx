import { lazy, Suspense, useState, type ComponentType, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { PROJECTS, projectBySlug } from '../projects'
import type { ViewProps } from '../projects/views/types'
import ProjectIntro from '../components/project/ProjectIntro'
import ProjectDocs from '../components/project/ProjectDocs'
import WorkflowExplorer from '../components/workflow/WorkflowExplorer'
import BotSlot from '../components/bot/BotSlot'
import NotFound from './NotFound'

const VIEWS: Record<string, ComponentType<ViewProps>> = {
  'blog-post-studio': lazy(() => import('../projects/views/BlogPostView')),
  'competitor-radar': lazy(() => import('../projects/views/CompetitorView')),
  'meeting-notes': lazy(() => import('../projects/views/MeetingNotesView')),
  'sales-report-analyst': lazy(() => import('../projects/views/SalesReportView')),
  'support-ticket-desk': lazy(() => import('../projects/views/SupportView')),
  'resume-screener': lazy(() => import('../projects/views/ResumeView')),
  'issue-triage': lazy(() => import('../projects/views/IssueTriageView')),
  'content-remixer': lazy(() => import('../projects/views/ContentRemixView')),
  'lead-scout': lazy(() => import('../projects/views/LeadScoutView')),
  'report-approval': lazy(() => import('../projects/views/ReportApprovalView')),
}

export default function ProjectPage() {
  const { slug = '' } = useParams()
  const project = projectBySlug(slug)
  const [run, setRun] = useState<{ steps: string[] | null; label?: string }>({ steps: null })
  if (!project) return <NotFound />
  const View = VIEWS[project.slug]
  const idx = PROJECTS.indexOf(project)
  const prev = PROJECTS[(idx + PROJECTS.length - 1) % PROJECTS.length]
  const next = PROJECTS[(idx + 1) % PROJECTS.length]

  return (
    <div style={{ '--accent': project.accent } as CSSProperties} key={project.slug}>
      <ProjectIntro p={project} />

      <section id="try" className="scroll-mt-20 px-4 py-10 sm:px-8"
        data-bot-stop data-bot-text="Fill in the form on the left. Your result appears on the right." data-bot-state="point" data-bot-point="right">
        <div className="mx-auto max-w-6xl">
          <SectionTitle eyebrow="Try it" title={`Use ${project.name}`} />
          <BotSlot text="Fill in the form, then press the button. Your result appears below it." state="point" point="down" className="mb-5" />
          <Suspense fallback={<div className="skeleton h-[480px] rounded-3xl" />}>
            <View project={project} onRun={(steps, label) => setRun({ steps, label })} />
          </Suspense>
        </div>
      </section>

      <section id="workflow" className="scroll-mt-20 px-4 py-14 sm:px-8"
        data-bot-stop data-bot-text="Let me walk you through the workflow!" data-bot-state="explain">
        <div className="mx-auto max-w-7xl">
          <SectionTitle eyebrow="Behind the scenes" title="How your request is processed"
            text={run.steps ? 'Switch between "How it works" and "Your run" to compare the full design with the path your request actually took.' : 'Click any step, or press Play tour. After you run the project, "Your run" highlights the path your request took.'} />
          <WorkflowExplorer project={project} runSteps={run.steps} runLabel={run.label} />
        </div>
      </section>

      <section id="docs" className="scroll-mt-20 px-4 py-14 sm:px-8"
        data-bot-stop data-bot-text="Want the details? Pick Simple or Technical." data-bot-state="explain">
        <div className="mx-auto max-w-6xl">
          <SectionTitle eyebrow="Documentation" title={`How ${project.name} works`} />
          <ProjectDocs p={project} />
        </div>
      </section>

      <nav className="px-4 pb-24 pt-6 sm:px-8" aria-label="More projects"
        data-bot-stop data-bot-text="Try another AI team next!" data-bot-state="celebrate">
        <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2">
          <Link to={`/projects/${prev.slug}`} className="glass group rounded-3xl p-5 transition hover:-translate-y-1">
            <span className="flex items-center gap-1.5 text-xs text-muted"><ArrowLeft size={14} /> Previous project</span>
            <span className="mt-1 block font-semibold text-ink">{prev.name}</span>
          </Link>
          <Link to={`/projects/${next.slug}`} className="glass group rounded-3xl p-5 text-right transition hover:-translate-y-1">
            <span className="flex items-center justify-end gap-1.5 text-xs text-muted">Next project <ArrowRight size={14} /></span>
            <span className="mt-1 block font-semibold text-ink">{next.name}</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="mb-6">
      <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">{eyebrow}</span>
      <h2 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">{title}</h2>
      {text && <p className="mt-2 max-w-3xl text-sm text-ink-2">{text}</p>}
    </div>
  )
}
