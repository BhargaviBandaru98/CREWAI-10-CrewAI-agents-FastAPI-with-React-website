import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import RailBot from '../bot/RailBot'
import { useBot } from '../../context/BotContext'

/**
 * Page shell. On large screens a fixed-width rail column is reserved on the left for CrewBot,
 * so the mascot never overlaps text, inputs or buttons.
 */
export default function Layout({ children }: { children: ReactNode }) {
  const { visible } = useBot()
  const { pathname, hash } = useLocation()

  // scroll to the hash target, or to the top on page change
  useEffect(() => {
    if (hash) {
      const t = window.setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 60)
      return () => window.clearTimeout(t)
    }
    window.scrollTo({ top: 0 })
  }, [pathname, hash])

  return (
    <div className="relative min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-surface-solid focus:px-4 focus:py-2">Skip to content</a>
      <Navbar />
      <div className={visible ? 'lg:grid lg:grid-cols-[176px_minmax(0,1fr)]' : ''}>
        {visible && (
          <aside className="relative hidden border-r border-line lg:block" style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--violet) 6%, var(--bg)), var(--bg))" }} aria-label="CrewBot rail">
            <div className="sticky top-16 h-[calc(100vh-4rem)]">
              <RailBot />
            </div>
          </aside>
        )}
        <main id="main" key={pathname} className="reveal min-w-0">
          {children}
        </main>
      </div>
      <Footer />
    </div>
  )
}
