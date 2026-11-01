import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** Renders agent output (Markdown with tables) safely: raw HTML is not rendered. */
export default function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`prose-crew ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div className="table-wrap">
              <table>{children}</table>
            </div>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
