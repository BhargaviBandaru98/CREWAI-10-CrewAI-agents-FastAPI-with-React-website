import { useState } from 'react'
import { Check, Copy, Download } from 'lucide-react'

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className="btn btn-ghost !px-3 !py-1.5 !text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1600)
        } catch {
          /* clipboard blocked */
        }
      }}
    >
      {done ? <Check size={14} /> : <Copy size={14} />} {done ? 'Copied' : label}
    </button>
  )
}

export function DownloadButton({ filename, content }: { filename: string; content: string }) {
  const type = filename.endsWith('.csv') ? 'text/csv' : 'text/markdown'
  return (
    <button
      type="button"
      className="btn btn-ghost !px-3 !py-1.5 !text-xs"
      onClick={() => {
        const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }))
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }}
    >
      <Download size={14} /> {filename}
    </button>
  )
}
