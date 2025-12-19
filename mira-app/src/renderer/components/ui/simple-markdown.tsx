import { memo, useMemo } from 'react'

interface SimpleMarkdownProps {
  content: string
  className?: string
}

/**
 * Lightweight markdown renderer for agent messages.
 * Supports: bold, italic, inline code, code blocks, links, and line breaks.
 * Memoized for performance.
 */
export const SimpleMarkdown = memo(function SimpleMarkdown({
  content,
  className = '',
}: SimpleMarkdownProps) {
  const rendered = useMemo(() => parseMarkdown(content), [content])

  return (
    <div className={`simple-markdown overflow-hidden break-words ${className}`}>
      {rendered}
    </div>
  )
})

function parseMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  const result: React.ReactNode[] = []
  let inCodeBlock = false
  let codeBlockContent: string[] = []
  let codeBlockLang = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Code block start/end
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true
        codeBlockLang = line.slice(3).trim()
        codeBlockContent = []
      } else {
        result.push(
          <pre
            className="bg-muted/50 rounded-md p-3 my-2 overflow-x-auto text-xs font-mono"
            key={`code-${i}`}
          >
            <code>{codeBlockContent.join('\n')}</code>
          </pre>
        )
        inCodeBlock = false
        codeBlockContent = []
        codeBlockLang = ''
      }
      continue
    }

    if (inCodeBlock) {
      codeBlockContent.push(line)
      continue
    }

    // Empty line = paragraph break
    if (line.trim() === '') {
      result.push(<br key={`br-${i}`} />)
      continue
    }

    // Parse inline elements
    result.push(
      <p className="mb-1 last:mb-0 break-words" key={`p-${i}`}>
        {parseInline(line)}
      </p>
    )
  }

  // Handle unclosed code block
  if (inCodeBlock && codeBlockContent.length > 0) {
    result.push(
      <pre
        className="bg-muted/50 rounded-md p-3 my-2 overflow-x-auto text-xs font-mono"
        key="code-unclosed"
      >
        <code>{codeBlockContent.join('\n')}</code>
      </pre>
    )
  }

  return result
}

function parseInline(text: string): React.ReactNode[] {
  const result: React.ReactNode[] = []
  // Pattern: **bold**, *italic*, `code`, [text](url)
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  match = pattern.exec(text)
  while (match !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index))
    }

    const token = match[0]
    const key = `inline-${match.index}`

    if (token.startsWith('**') && token.endsWith('**')) {
      // Bold
      result.push(<strong key={key}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('*') && token.endsWith('*')) {
      // Italic
      result.push(<em key={key}>{token.slice(1, -1)}</em>)
    } else if (token.startsWith('`') && token.endsWith('`')) {
      // Inline code
      result.push(
        <code
          className="bg-muted/50 px-1 py-0.5 rounded text-xs font-mono"
          key={key}
        >
          {token.slice(1, -1)}
        </code>
      )
    } else if (token.startsWith('[')) {
      // Link [text](url)
      const linkMatch = token.match(/\[([^\]]+)\]\(([^)]+)\)/)
      if (linkMatch) {
        result.push(
          <a
            className="text-blue-500 hover:underline"
            href={linkMatch[2]}
            key={key}
            rel="noopener noreferrer"
            target="_blank"
          >
            {linkMatch[1]}
          </a>
        )
      }
    }

    lastIndex = match.index + token.length
    match = pattern.exec(text)
  }

  // Add remaining text
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex))
  }

  return result.length > 0 ? result : [text]
}
