import { blogPost, competitorRadar, meetingNotes, salesReport } from './crews'
import { contentRemixer, issueTriage, leadScout, reportApproval, resumeScreener, supportDesk } from './flows'
import type { Project } from './types'

/** All 10 projects, in the same order as the API routes /agent1 ... /agent10. */
export const PROJECTS: Project[] = [
  blogPost,
  competitorRadar,
  meetingNotes,
  salesReport,
  supportDesk,
  resumeScreener,
  issueTriage,
  contentRemixer,
  leadScout,
  reportApproval,
]

export const projectBySlug = (slug: string) => PROJECTS.find((p) => p.slug === slug)
