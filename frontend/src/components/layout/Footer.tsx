import { Link } from 'react-router-dom'
import Logo from './Logo'
import { PROJECTS } from '../../projects'

export default function Footer() {
  const crews = PROJECTS.filter((p) => p.type === 'Crew')
  const flows = PROJECTS.filter((p) => p.type === 'Flow')
  return (
    <footer className="relative border-t border-line bg-bg-2">
      <div className="mx-auto grid max-w-[1500px] gap-10 px-6 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="font-display text-lg font-bold text-ink">CREW<span className="text-gradient">AI</span></span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
            Ten AI projects built with CrewAI Crews and Flows. Use them, then watch how the agents work behind the scenes.
          </p>
          <p className="mt-4 text-xs text-muted">Built with CrewAI · FastAPI · Gemini · React</p>
        </div>
        <FooterCol title="Crews" items={crews.map((p) => ({ to: `/projects/${p.slug}`, label: p.name }))} />
        <FooterCol title="Flows" items={flows.map((p) => ({ to: `/projects/${p.slug}`, label: p.name }))} />
        <div>
          <h4 className="text-sm font-semibold text-ink">Developers</h4>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><a className="text-muted transition hover:text-ink" href="/docs" target="_blank" rel="noopener">Interactive API docs</a></li>
            <li><a className="text-muted transition hover:text-ink" href="/health" target="_blank" rel="noopener">API health</a></li>
            <li><a className="text-muted transition hover:text-ink" href="/#how">How the platform works</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-5 text-center text-xs text-muted">
        © {new Date().getFullYear()} CREWAI · AI output can be wrong: always review important results.
      </div>
    </footer>
  )
}

function FooterCol({ title, items }: { title: string; items: { to: string; label: string }[] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-ink">{title}</h4>
      <ul className="mt-4 space-y-2.5 text-sm">
        {items.map((i) => (
          <li key={i.to}><Link to={i.to} className="text-muted transition hover:text-ink">{i.label}</Link></li>
        ))}
      </ul>
    </div>
  )
}
