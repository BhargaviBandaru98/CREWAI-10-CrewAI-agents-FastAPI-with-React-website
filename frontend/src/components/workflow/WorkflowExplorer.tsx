import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { gsap } from 'gsap'
import {
  Bot, ChevronLeft, ChevronRight, CircleCheck, CodeXml, GitBranch, Hand, Info, MousePointerClick, Play, RotateCcw, Sparkles, Square, Users, Wrench,
} from 'lucide-react'
import type { FlowNode, NodeKind, Project } from '../../projects/types'
import CrewBot from '../bot/CrewBot'
import BotBubble from '../bot/BotBubble'
import { useBot, type BotState } from '../../context/BotContext'

export const KIND_META: Record<NodeKind, { label: string; icon: typeof Bot; color: string }> = {
  input: { label: 'Input', icon: MousePointerClick, color: 'var(--cyan)' },
  api: { label: 'API', icon: CodeXml, color: 'var(--cyan)' },
  agent: { label: 'AI agent', icon: Bot, color: 'var(--violet-2)' },
  manager: { label: 'Manager agent', icon: Users, color: 'var(--pink)' },
  llm: { label: 'Direct LLM call', icon: Sparkles, color: 'var(--violet-2)' },
  router: { label: 'Router', icon: GitBranch, color: 'var(--amber)' },
  tool: { label: 'Tool', icon: Wrench, color: 'var(--cyan)' },
  human: { label: 'Human step', icon: Hand, color: 'var(--pink)' },
  code: { label: 'Python step', icon: CodeXml, color: 'var(--muted)' },
  output: { label: 'Output', icon: CircleCheck, color: 'var(--green)' },
}

type NodeStatus = 'active' | 'done' | 'pending' | 'ran' | 'skipped'
type Mode = 'learn' | 'run'

interface Props {
  project: Project
  /** `steps` from the API response; enables the "Your run" view */
  runSteps?: string[] | null
  runLabel?: string
  /** compact = homepage showcase */
  compact?: boolean
}

interface Edge { d: string; lit: boolean; loop?: boolean }

const H_NODE_W = 120
const H_GAP = 20

export default function WorkflowExplorer({ project, runSteps, runLabel, compact = false }: Props) {
  const laneId = useId()
  const { visible: botVisible, registerLane, paused } = useBot()
  const { workflow } = project
  const flat = useMemo(() => workflow.stages.flatMap((s) => s.nodes), [workflow])
  const stageOf = useMemo(() => {
    const m: Record<string, number> = {}
    workflow.stages.forEach((s, i) => s.nodes.forEach((n) => (m[n.id] = i)))
    return m
  }, [workflow])

  const [mode, setMode] = useState<Mode>('learn')
  const [sel, setSel] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [botState, setBotState] = useState<BotState>('wave')
  const [layout, setLayout] = useState<'h' | 'v'>('h')
  const [edges, setEdges] = useState<Edge[]>([])
  const [botPos, setBotPos] = useState({ x: 0, y: 0 })
  const [size, setSize] = useState({ w: 0, h: 0 })

  const root = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLDivElement>(null)
  const nodeEls = useRef<Record<string, HTMLButtonElement | null>>({})
  const botWrap = useRef<HTMLDivElement>(null)

  // ---------- which nodes really ran (from the API's `steps`) ----------
  const ranInfo = useMemo(() => {
    const info: Record<string, string[]> = {}
    if (!runSteps) return info
    for (const n of flat) {
      if (!n.match) { info[n.id] = []; continue }
      const hits = runSteps.filter((s) => n.match!.some((m) => s.startsWith(m)))
      if (hits.length) info[n.id] = hits
    }
    return info
  }, [runSteps, flat])
  const hasRun = !!runSteps && runSteps.length > 0

  useEffect(() => {
    if (hasRun) { setMode('run'); setSel(0) }
    else setMode('learn')
  }, [hasRun, runSteps])

  const order: FlowNode[] = useMemo(() => (mode === 'run' ? flat.filter((n) => ranInfo[n.id]) : flat), [mode, flat, ranInfo])
  const current = order[Math.min(sel, order.length - 1)] ?? flat[0]

  const statusOf = useCallback((n: FlowNode): NodeStatus => {
    if (mode === 'run') return n.id === current.id ? 'active' : ranInfo[n.id] ? 'ran' : 'skipped'
    const i = flat.indexOf(n)
    const ci = flat.indexOf(current)
    if (i === ci) return 'active'
    // in learn mode, nodes in an earlier stage count as done
    return stageOf[n.id] < stageOf[current.id] ? 'done' : 'pending'
  }, [mode, current, ranInfo, flat, stageOf])

  // ---------- layout + edges ----------
  const measure = useCallback(() => {
    const c = canvas.current
    const r = root.current
    if (!c || !r) return
    const need = workflow.stages.length * (H_NODE_W + H_GAP) + 64 // + card padding
    const nextLayout = r.clientWidth >= need ? 'h' : 'v'
    if (nextLayout !== layout) { setLayout(nextLayout); return }
    const base = c.getBoundingClientRect()
    const box = (id: string) => {
      const el = nodeEls.current[id]
      if (!el) return null
      const b = el.getBoundingClientRect()
      return { x: b.left - base.left, y: b.top - base.top, w: b.width, h: b.height }
    }
    const lit = (a: FlowNode, b: FlowNode) => {
      if (mode === 'run') return !!ranInfo[a.id] && !!ranInfo[b.id]
      return stageOf[b.id] <= stageOf[current.id]
    }
    const out: Edge[] = []
    for (let i = 0; i < workflow.stages.length - 1; i++) {
      for (const a of workflow.stages[i].nodes) for (const b of workflow.stages[i + 1].nodes) {
        const A = box(a.id), B = box(b.id)
        if (!A || !B) continue
        let d: string
        if (layout === 'h') {
          const x1 = A.x + A.w, y1 = A.y + A.h / 2, x2 = B.x, y2 = B.y + B.h / 2
          const dx = (x2 - x1) * 0.5
          d = `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`
        } else {
          const x1 = A.x + A.w / 2, y1 = A.y + A.h, x2 = B.x + B.w / 2, y2 = B.y
          const dy = (y2 - y1) * 0.5
          d = `M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2}`
        }
        out.push({ d, lit: lit(a, b) })
      }
    }
    if (workflow.loop) {
      const A = box(workflow.loop.from), B = box(workflow.loop.to)
      if (A && B) {
        let d: string
        if (layout === 'h') {
          const x1 = A.x + A.w / 2, y1 = A.y + A.h, x2 = B.x + B.w / 2, y2 = B.y + B.h
          const low = Math.max(y1, y2) + 34
          d = `M${x1},${y1} C${x1},${low} ${x2},${low} ${x2},${y2}`
        } else {
          const x1 = A.x + A.w, y1 = A.y + A.h / 2, x2 = B.x + B.w, y2 = B.y + B.h / 2
          const right = Math.max(x1, x2) + 26
          d = `M${x1},${y1} C${right},${y1} ${right},${y2} ${x2},${y2}`
        }
        const loopNode = flat.find((n) => n.id === workflow.loop!.from)!
        out.push({ d, lit: mode === 'run' ? !!ranInfo[loopNode.id] : stageOf[current.id] >= stageOf[loopNode.id], loop: true })
      }
    }
    setEdges(out)
    setSize({ w: c.scrollWidth, h: c.scrollHeight })
    // bot target beside the selected node
    const s = box(current.id)
    if (s) setBotPos(layout === 'h' ? { x: s.x + s.w / 2, y: 0 } : { x: 0, y: s.y + s.h / 2 })
  }, [workflow, layout, mode, ranInfo, stageOf, current, flat])

  useLayoutEffect(() => { measure() }, [measure])
  useEffect(() => {
    const ro = new ResizeObserver(() => measure())
    if (root.current) ro.observe(root.current)
    return () => ro.disconnect()
  }, [measure])

  // ---------- CrewBot travels in its lane ----------
  useEffect(() => {
    const el = botWrap.current
    if (!el) return
    const target = layout === 'h' ? { x: botPos.x, y: 0 } : { x: 0, y: botPos.y }
    const last = current.id === flat[flat.length - 1].id
    setBotState('move')
    const tw = gsap.to(el, {
      ...target,
      duration: paused ? 0 : 0.75,
      ease: 'power3.inOut',
      onComplete: () => setBotState(last ? 'celebrate' : current.kind === 'router' ? 'think' : 'point'),
    })
    return () => { tw.kill() }
  }, [botPos, layout, current, flat, paused])

  // ---------- hand-over with the rail bot ----------
  useEffect(() => {
    const el = root.current
    if (!el || !botVisible) return
    const io = new IntersectionObserver(([e]) => registerLane(laneId, e.isIntersecting && e.intersectionRatio > 0.3), { threshold: [0, 0.3, 0.6] })
    io.observe(el)
    return () => { io.disconnect(); registerLane(laneId, false) }
  }, [botVisible, laneId, registerLane])

  // ---------- play tour ----------
  useEffect(() => {
    if (!playing) return
    if (sel >= order.length - 1) { setPlaying(false); return }
    const t = window.setTimeout(() => setSel((s) => s + 1), 2600)
    return () => window.clearTimeout(t)
  }, [playing, sel, order.length])

  const go = (i: number) => { setPlaying(false); setSel(Math.max(0, Math.min(order.length - 1, i))) }
  const selectNode = (n: FlowNode) => {
    const i = order.findIndex((o) => o.id === n.id)
    if (i >= 0) go(i)
  }

  const accentStyle = { '--accent': project.accent } as CSSProperties
  const meta = KIND_META[current.kind]
  const curStatus = mode === 'run' ? 'ran' : 'learn'

  return (
    <div ref={root} style={accentStyle} className="w-full" onKeyDown={(e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); go(sel + 1) }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); go(sel - 1) }
    }}>
      {/* ---- toolbar ---- */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-2xl border border-line bg-surface p-1" role="tablist" aria-label="Workflow view">
          <button role="tab" aria-selected={mode === 'learn'} onClick={() => { setMode('learn'); setSel(0); setPlaying(false) }}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${mode === 'learn' ? 'bg-[var(--accent)] text-white' : 'text-muted hover:text-ink'}`}>
            How it works
          </button>
          <button role="tab" aria-selected={mode === 'run'} disabled={!hasRun} onClick={() => { setMode('run'); setSel(0); setPlaying(false) }}
            title={hasRun ? 'Highlight the path your request took' : 'Run the project first'}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${mode === 'run' ? 'bg-[var(--accent)] text-white' : 'text-muted hover:text-ink'}`}>
            Your run {hasRun ? '' : '(run it first)'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost !p-2" onClick={() => go(sel - 1)} disabled={sel === 0} aria-label="Previous step"><ChevronLeft size={16} /></button>
          <span className="min-w-[64px] text-center font-mono text-xs text-muted">{Math.min(sel + 1, order.length)} / {order.length}</span>
          <button className="btn btn-ghost !p-2" onClick={() => go(sel + 1)} disabled={sel >= order.length - 1} aria-label="Next step"><ChevronRight size={16} /></button>
          <button className="btn btn-ghost !px-3 !py-2 !text-xs" onClick={() => { if (sel >= order.length - 1) setSel(0); setPlaying((p) => !p) }}>
            {playing ? <><Square size={13} /> Stop</> : <><Play size={13} /> Play tour</>}
          </button>
          <button className="btn btn-ghost !p-2" onClick={() => go(0)} aria-label="Back to first step"><RotateCcw size={15} /></button>
        </div>
      </div>

      <p className="mb-3 flex items-start gap-2 text-xs text-muted">
        <Info size={14} className="mt-px shrink-0" />
        {mode === 'learn'
          ? 'Educational walkthrough of how this project works in the backend. It is not a live trace. Click any step, or use Next / Play tour.'
          : `Your run: highlighted from the "steps" list the API returned for your request${runLabel ? ` (${runLabel})` : ''}. Faded steps did not run.`}
      </p>

      {/* ---- diagram ---- */}
      <div className={`glass relative overflow-hidden rounded-3xl bg-grid ${compact ? 'p-4' : 'p-4 sm:p-6'}`}>
        <div className={layout === 'h' ? '' : 'grid grid-cols-[56px_minmax(0,1fr)] gap-2'}>
          {/* CrewBot lane: reserved space, never over the nodes */}
          {botVisible && (
            <div className={layout === 'h' ? 'relative h-[112px]' : 'relative'} aria-hidden>
              <div className={layout === 'h' ? 'absolute inset-x-0 bottom-3 h-px bg-line' : 'absolute inset-y-0 left-1/2 w-px bg-line'} />
              <div ref={botWrap} className="absolute left-0 top-0" style={{ willChange: 'transform' }}>
                <div className={layout === 'h' ? 'relative -translate-x-1/2' : 'relative -translate-y-1/2'}>
                  {layout === 'h' ? (
                    <div className="relative">
                      <CrewBot size={68} state={botState} point="down" />
                      <div className={`absolute bottom-9 ${botPos.x > size.w * 0.62 ? 'right-full mr-1' : 'left-full ml-1'}`}>
                        <BotBubble text={current.say} tail={botPos.x > size.w * 0.62 ? 'right' : 'left'} className="w-max max-w-[190px]" />
                      </div>
                    </div>
                  ) : (
                    <CrewBot size={48} state={botState} point="right" />
                  )}
                </div>
              </div>
            </div>
          )}

          <div ref={canvas} className="relative">
            <svg className="pointer-events-none absolute left-0 top-0" width={size.w} height={size.h} aria-hidden style={{ overflow: 'visible' }}>
              {edges.map((e, i) => (
                <g key={i}>
                  <path d={e.d} fill="none" stroke="var(--border-strong)" strokeWidth={e.loop ? 1.5 : 2} strokeDasharray={e.loop ? '4 5' : undefined} />
                  {e.lit && <path d={e.d} fill="none" stroke="var(--accent)" strokeWidth={2.4} className="flow-dash" style={{ filter: 'drop-shadow(0 0 4px var(--accent))' }} />}
                </g>
              ))}
            </svg>

            <div className={layout === 'h' ? 'relative flex items-center' : 'relative flex flex-col gap-7'} style={layout === 'h' ? { gap: H_GAP } : undefined}>
              {workflow.stages.map((stage, si) => (
                <div key={si} className={layout === 'h' ? 'flex flex-col justify-center gap-3' : 'flex flex-col gap-2'}>
                  {stage.group && (
                    <span className="mx-auto rounded-full border border-dashed border-line-strong px-2 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted">
                      {stage.group.label}
                    </span>
                  )}
                  <div className={layout === 'h' ? 'flex flex-col gap-3' : `mx-auto grid w-full gap-2 ${stage.nodes.length === 3 ? 'max-w-xl grid-cols-3' : stage.nodes.length === 2 ? 'max-w-md grid-cols-2' : 'max-w-[260px] grid-cols-1'}`}>
                    {stage.nodes.map((n) => (
                      <NodeCard key={n.id} node={n} status={statusOf(n)} horizontal={layout === 'h'}
                        refFn={(el) => { nodeEls.current[n.id] = el }}
                        onClick={() => selectNode(n)} disabled={mode === 'run' && !ranInfo[n.id]} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {workflow.loop && (
              <p className={`text-center text-[10px] font-semibold uppercase tracking-wider text-muted ${layout === 'h' ? 'mt-10' : 'mt-3'}`}>
                ↺ {workflow.loop.label}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ---- detail panel ---- */}
      <div key={`${mode}-${current.id}`} className="reveal mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="glass rounded-3xl p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${meta.color} 16%, transparent)`, color: meta.color }}>
              <meta.icon size={18} />
            </span>
            <div>
              <div className="font-mono text-sm font-semibold text-ink">{current.label}</div>
              <div className="text-[11px] text-muted">{meta.label}{current.sub ? ` · ${current.sub}` : ''}</div>
            </div>
          </div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">In simple words</h4>
          <p className="text-sm leading-relaxed text-ink-2">{current.simple}</p>
          {curStatus === 'ran' && ranInfo[current.id] && (
            <div className="mt-4 rounded-2xl border border-line bg-surface p-3 text-xs">
              <div className="mb-1 font-semibold text-ok">✓ This step ran for your request</div>
              {ranInfo[current.id].length > 0 && (
                <div className="font-mono text-muted">Backend reported: {Array.from(new Set(ranInfo[current.id])).map((s) => `"${s}"`).join(', ')}</div>
              )}
            </div>
          )}
        </div>
        <div className="glass rounded-3xl p-5">
          <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-cyan"><CodeXml size={13} /> Technical</h4>
          <p className="text-sm leading-relaxed text-ink-2">{current.technical}</p>
        </div>
      </div>
    </div>
  )
}

function NodeCard({ node, status, horizontal, onClick, refFn, disabled }: { node: FlowNode; status: NodeStatus; horizontal: boolean; onClick: () => void; refFn: (el: HTMLButtonElement | null) => void; disabled?: boolean }) {
  const meta = KIND_META[node.kind]
  const styles: Record<NodeStatus, string> = {
    active: 'border-[var(--accent)] bg-surface-2 accent-ring',
    done: 'border-[color-mix(in_srgb,var(--green)_45%,transparent)] bg-surface',
    ran: 'border-[color-mix(in_srgb,var(--green)_45%,transparent)] bg-surface',
    pending: 'border-line bg-surface opacity-80',
    skipped: 'border-dashed border-line opacity-35',
  }
  return (
    <button
      ref={refFn}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={status === 'active' ? 'step' : undefined}
      aria-label={`${node.label}: ${meta.label}${status === 'skipped' ? ' (did not run)' : ''}`}
      className={`group relative rounded-2xl border text-left backdrop-blur transition duration-300 hover:-translate-y-0.5 disabled:hover:translate-y-0 ${styles[status]} ${horizontal ? 'w-[120px] p-2.5' : 'w-full p-2.5'}`}
    >
      {status === 'active' && <span className="absolute -inset-px rounded-2xl" style={{ animation: 'pulse-ring 1.8s ease-out infinite', border: '1px solid var(--accent)' }} aria-hidden />}
      {(status === 'done' || status === 'ran') && (
        <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ok text-white shadow"><CircleCheck size={12} /></span>
      )}
      <span className="mb-1.5 flex items-center gap-1.5">
        <meta.icon size={14} style={{ color: meta.color }} className="shrink-0" />
        <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted">{meta.label}</span>
      </span>
      <span className={`block font-mono font-semibold leading-tight text-ink ${horizontal ? 'text-[11px]' : 'text-[11px]'}`}>{node.label.replace(/_/g, '_\u200b')}</span>
      {node.sub && <span className="mt-0.5 block truncate text-[10.5px] text-muted">{node.sub}</span>}
    </button>
  )
}
