import type { Project } from '../types'

export interface ViewProps {
  project: Project
  /** report the steps of the latest response (or null) so the workflow can show "Your run" */
  onRun: (steps: string[] | null, label?: string) => void
}
