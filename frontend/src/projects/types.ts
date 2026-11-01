import type { LucideIcon } from 'lucide-react'

export type NodeKind = 'input' | 'api' | 'agent' | 'manager' | 'llm' | 'router' | 'tool' | 'human' | 'code' | 'output'

export interface FlowNode {
  id: string
  label: string
  /** small caption under the label, e.g. the decorator or tool */
  sub?: string
  kind: NodeKind
  /** CrewBot's one-line speech bubble for this step */
  say: string
  simple: string
  technical: string
  /** prefixes of backend `steps` strings that prove this node ran; omit for always-run nodes */
  match?: string[]
}

export interface FlowStage {
  nodes: FlowNode[]
  /** how the nodes in this column relate */
  group?: { label: string; type: 'branch' | 'parallel' | 'delegate' }
}

export interface Workflow {
  stages: FlowStage[]
  /** a loop edge, e.g. revise -> review */
  loop?: { from: string; to: string; label: string }
}

export interface ProjectDocs {
  what: string
  why: string
  canDo: string[]
  inputs: { name: string; text: string }[]
  outputs: string[]
  backendSimple: string[]
  technical: string[]
  tech: string[]
  useCases: string[]
}

export interface Project {
  slug: string
  endpoint: string
  name: string
  tagline: string
  /** one or two lines for the card */
  short: string
  problem: string
  primary: string
  type: 'Crew' | 'Flow'
  pattern: string
  accent: string
  icon: LucideIcon
  /** short keyword chips */
  chips: string[]
  benefits: string[]
  howToUse: string[]
  /** CrewBot's greeting on this project's page */
  hello: string
  docs: ProjectDocs
  workflow: Workflow
}
