import { useEffect, type RefObject } from 'react'

/**
 * Fades/slides in every [data-reveal] element inside `scope` when it scrolls into view.
 * Uses CSS transitions (not GSAP), so content is never left hidden when animations are paused.
 */
export function useReveal(scope: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    const root = scope.current
    if (!root) return
    const items = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]:not(.in)'))
    if (!('IntersectionObserver' in window)) { items.forEach((i) => i.classList.add('in')); return }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
      })
    }, { rootMargin: '0px 0px -8% 0px' })
    items.forEach((i, idx) => { i.style.transitionDelay = `${(idx % 4) * 70}ms`; io.observe(i) })
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
