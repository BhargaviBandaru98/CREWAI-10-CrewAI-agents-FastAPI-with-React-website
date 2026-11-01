/**
 * Central API client. In production the site is served by the same FastAPI app,
 * so relative paths are used. Set VITE_API_BASE_URL to call a backend on another domain.
 */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export interface AgentResponse<R = unknown> {
  agent: string
  project: string
  status: 'completed' | 'pending_review'
  run_id: string
  duration_seconds: number
  steps: string[]
  result: R
  files: Record<string, string>
}

export class ApiError extends Error {
  status: number
  details: string[]
  constructor(status: number, message: string, details: string[] = []) {
    super(message)
    this.status = status
    this.details = details
  }
}

const FIELD_LABELS: Record<string, string> = {
  competitors: 'Competitor websites',
  company_website: 'Company website',
  issue_description: 'Issue description',
  customer_name: 'Customer name',
  product_description: 'Your product',
  ideal_customer_profile: 'Ideal customer',
  job_description: 'Job description',
  docs_url: 'Docs URL',
}

function humanizeLoc(loc: unknown[]): string {
  const parts = loc.filter((p) => p !== 'body')
  if (!parts.length) return ''
  const name = String(parts[0])
  const label = FIELD_LABELS[name] ?? name.replace(/_/g, ' ')
  return parts.length > 1 && typeof parts[1] === 'number' ? `${label} #${(parts[1] as number) + 1}` : label
}

async function parseError(res: Response): Promise<ApiError> {
  let body: any = null
  try {
    body = await res.json()
  } catch {
    /* not JSON */
  }
  const detail = body?.detail
  if (Array.isArray(detail)) {
    const details = detail.map((d: any) => {
      const where = Array.isArray(d.loc) ? humanizeLoc(d.loc) : ''
      const msg = String(d.msg ?? '').replace(/^Value error, /, '')
      return where ? `${where}: ${msg}` : msg
    })
    return new ApiError(res.status, 'Please check your input', details)
  }
  if (typeof detail === 'string') return new ApiError(res.status, detail)
  const fallback: Record<number, string> = {
    404: 'Not found',
    413: 'The file is too large',
    502: 'The AI agents could not finish this request',
    503: 'The server is busy right now. Please try again in a minute.',
  }
  return new ApiError(res.status, fallback[res.status] ?? `Request failed (${res.status})`)
}

async function send<R>(path: string, init: RequestInit): Promise<AgentResponse<R>> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, init)
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError(0, 'Could not reach the CREWAI server. Check your connection, or the server may be starting up (this can take up to a minute on the free plan).')
  }
  if (!res.ok) throw await parseError(res)
  return (await res.json()) as AgentResponse<R>
}

export function postJson<R>(path: string, body: unknown, signal?: AbortSignal) {
  return send<R>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
}

export function postForm<R>(path: string, form: FormData, signal?: AbortSignal) {
  return send<R>(path, { method: 'POST', body: form, signal })
}

export interface Health {
  status: string
  gemini_key_set: boolean
  model: string
}

export async function getHealth(signal?: AbortSignal): Promise<Health> {
  const res = await fetch(`${API_BASE}/health`, { signal })
  if (!res.ok) throw new Error('unhealthy')
  return res.json()
}
