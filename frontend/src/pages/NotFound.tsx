import { Link } from 'react-router-dom'
import CrewBot from '../components/bot/CrewBot'

export default function NotFound() {
  return (
    <section className="grid min-h-[70vh] place-items-center px-4 pt-24 text-center">
      <div>
        <div className="flex justify-center"><CrewBot size={110} state="look" /></div>
        <h1 className="mt-6 text-3xl font-bold text-ink">This page wandered off</h1>
        <p className="mt-2 text-ink-2">CrewBot looked everywhere but could not find it.</p>
        <Link to="/" className="btn btn-primary mt-6">Back to home</Link>
      </div>
    </section>
  )
}
