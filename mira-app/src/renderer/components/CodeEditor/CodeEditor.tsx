import { memo, useCallback, useRef } from 'react'
import Editor, { type OnMount, type Monaco } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'

interface CodeEditorProps {
  content: string
  language: string
  fileName: string
  lineNumbers?: boolean
  className?: string
  readOnly?: boolean
  onChange?: (content: string) => void
}

// Map common language identifiers to Monaco language IDs
const getMonacoLanguage = (language: string): string => {
  const languageMap: Record<string, string> = {
    typescript: 'typescript',
    javascript: 'javascript',
    typescriptreact: 'typescript',
    javascriptreact: 'javascript',
    python: 'python',
    json: 'json',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    markdown: 'markdown',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    sql: 'sql',
    shell: 'shell',
    bash: 'shell',
    sh: 'shell',
    rust: 'rust',
    go: 'go',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    csharp: 'csharp',
    php: 'php',
    ruby: 'ruby',
    swift: 'swift',
    kotlin: 'kotlin',
    dockerfile: 'dockerfile',
    graphql: 'graphql',
    plaintext: 'plaintext',
  }
  return languageMap[language.toLowerCase()] || 'plaintext'
}

export const CodeEditor = memo(function CodeEditor({
  content,
  language,
  fileName: _fileName,
  lineNumbers = true,
  className = '',
  readOnly = false,
  onChange,
}: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  const handleEditorDidMount: OnMount = useCallback((editor, _monaco) => {
    editorRef.current = editor
    editor.focus()
  }, [])

  const handleBeforeMount = useCallback((monaco: Monaco) => {
    // Define custom dark theme matching the app's color scheme
    monaco.editor.defineTheme('mira-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'c084fc' },
        { token: 'string', foreground: '4ade80' },
        { token: 'number', foreground: 'fb923c' },
        { token: 'type', foreground: '2dd4bf' },
        { token: 'function', foreground: '60a5fa' },
        { token: 'variable', foreground: 'e5e7eb' },
        { token: 'operator', foreground: '22d3ee' },
        { token: 'delimiter', foreground: '9ca3af' },
      ],
      colors: {
        'editor.background': '#0a0a0a',
        'editor.foreground': '#e5e7eb',
        'editor.lineHighlightBackground': '#1f1f1f',
        'editor.selectionBackground': '#3b82f640',
        'editorCursor.foreground': '#e5e7eb',
        'editorLineNumber.foreground': '#4b5563',
        'editorLineNumber.activeForeground': '#9ca3af',
        'editor.inactiveSelectionBackground': '#3b82f620',
        'editorIndentGuide.background': '#27272a',
        'editorIndentGuide.activeBackground': '#3f3f46',
      },
    })
  }, [])

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        onChange?.(value)
      }
    },
    [onChange]
  )

  const monacoLanguage = getMonacoLanguage(language)

  return (
    <div className={`h-full w-full ${className}`}>
      <Editor
        beforeMount={handleBeforeMount}
        defaultValue={content}
        height="100%"
        language={monacoLanguage}
        loading={
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Loading editor...
          </div>
        }
        onChange={handleChange}
        onMount={handleEditorDidMount}
        options={{
          readOnly,
          minimap: { enabled: false },
          lineNumbers: lineNumbers ? 'on' : 'off',
          scrollBeyondLastLine: false,
          fontSize: 13,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          tabSize: 2,
          insertSpaces: true,
          wordWrap: 'off',
          automaticLayout: true,
          scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
          padding: { top: 8, bottom: 8 },
          renderLineHighlight: 'line',
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          contextmenu: true,
          folding: true,
          foldingHighlight: true,
          bracketPairColorization: { enabled: true },
          guides: {
            bracketPairs: true,
            indentation: true,
          },
        }}
        theme="mira-dark"
        value={content}
        width="100%"
      />
    </div>
  )
})
