import { useRef, useState } from 'react'
import { FileUp, X, FileText } from 'lucide-react'

interface Props {
  id: string
  accept: string[]
  multiple?: boolean
  maxFiles?: number
  maxMB?: number
  files: File[]
  onChange: (files: File[]) => void
  label?: string
}

/** Drag-and-drop / click-to-browse upload with type and size checks. */
export default function FileDrop({ id, accept, multiple, maxFiles = 1, maxMB = 5, files, onChange, label }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [err, setErr] = useState('')

  const add = (list: FileList | null) => {
    if (!list) return
    setErr('')
    const next = multiple ? [...files] : []
    for (const f of Array.from(list)) {
      const ext = '.' + (f.name.split('.').pop() ?? '').toLowerCase()
      if (!accept.includes(ext)) { setErr(`"${f.name}" is not allowed. Use ${accept.join(', ')}`); continue }
      if (f.size > maxMB * 1024 * 1024) { setErr(`"${f.name}" is larger than ${maxMB} MB`); continue }
      if (f.size === 0) { setErr(`"${f.name}" is empty`); continue }
      if (next.some((n) => n.name === f.name)) { setErr(`"${f.name}" is already added`); continue }
      if (next.length >= maxFiles) { setErr(`Maximum ${maxFiles} file${maxFiles > 1 ? 's' : ''}`); break }
      next.push(f)
    }
    onChange(next)
    if (input.current) input.current.value = ''
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files) }}
        className={`group flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-6 text-center transition ${over ? 'border-[var(--accent,var(--violet))] bg-surface-2' : 'border-line-strong bg-surface hover:border-[var(--accent,var(--violet))]'}`}
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2 text-[var(--accent,var(--violet))] transition group-hover:scale-110">
          <FileUp size={20} />
        </span>
        <span className="text-sm font-medium text-ink">{label ?? (multiple ? 'Drop files here or click to browse' : 'Drop a file here or click to browse')}</span>
        <span className="text-xs text-muted">{accept.join(', ')} · up to {maxMB} MB{multiple ? ` · max ${maxFiles} files` : ''}</span>
      </button>
      <input ref={input} id={id} type="file" className="sr-only" accept={accept.join(',')} multiple={multiple} onChange={(e) => add(e.target.files)} />
      {err && <p className="mt-2 text-xs font-medium text-bad">{err}</p>}
      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((f) => (
            <li key={f.name} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2 text-sm">
              <FileText size={16} className="shrink-0 text-[var(--accent,var(--violet))]" />
              <span className="min-w-0 flex-1 truncate text-ink">{f.name}</span>
              <span className="font-mono text-[11px] text-muted">{(f.size / 1024).toFixed(1)} KB</span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onChange(files.filter((x) => x !== f))} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-bad">
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
