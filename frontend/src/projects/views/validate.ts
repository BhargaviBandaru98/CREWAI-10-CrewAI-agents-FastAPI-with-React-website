export const isUrl = (s: string) => {
  try {
    const u = new URL(s.trim())
    return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname && u.hostname.includes('.')
  } catch {
    return false
  }
}
export const words = (s: string) => (s.match(/\b\w[\w'-]*\b/g) ?? []).length
export type Errors = Record<string, string>
export const hasErrors = (e: Errors) => Object.keys(e).length > 0
