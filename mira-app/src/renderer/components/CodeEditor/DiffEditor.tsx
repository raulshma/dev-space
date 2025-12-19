import { memo, useCallback, useRef } from 'react'
import {
  DiffEditor as MonacoDiffEditor,
  type Monaco,
} from '@monaco-editor/react'
import type { editor } from 'monaco-editor'

interface DiffEditorProps {
  original: string
  modified: string
  language: string
  className?: string
}

export const DiffEditor = memo(function DiffEditor({
  original,
  modified,
  language,
  className = '',
}: DiffEditorProps) {
  const editorRef = useRef<editor.IStandaloneDiffEditor | null>(null)

  const handleEditorDidMount = useCallback(
    (editor: editor.IStandaloneDiffEditor) => {
      editorRef.current = editor
    },
    []
  )

  const handleBeforeMount = useCallback((monaco: Monaco) => {
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
        // Diff editor colors - line backgrounds
        'diffEditor.insertedLineBackground': '#22c55e25',
        'diffEditor.removedLineBackground': '#ef444425',
        // Diff editor colors - inline text highlights
        'diffEditor.insertedTextBackground': '#22c55e40',
        'diffEditor.removedTextBackground': '#ef444440',
        // Diff editor gutter/margin colors
        'diffEditorGutter.insertedLineBackground': '#22c55e30',
        'diffEditorGutter.removedLineBackground': '#ef444430',
        // Overview ruler (scrollbar decorations)
        'diffEditorOverview.insertedForeground': '#22c55e80',
        'diffEditorOverview.removedForeground': '#ef444480',
        // Diff editor border
        'diffEditor.border': '#27272a',
        // Diagonal fill for unchanged regions
        'diffEditor.diagonalFill': '#27272a50',
      },
    })
  }, [])

  return (
    <div className={`h-full w-full ${className}`}>
      <MonacoDiffEditor
        beforeMount={handleBeforeMount}
        height="100%"
        language={language}
        loading={
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Loading diff editor...
          </div>
        }
        modified={modified}
        onMount={handleEditorDidMount}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 13,
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          renderSideBySide: true,
          enableSplitViewResizing: true,
          automaticLayout: true,
          scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
          padding: { top: 8, bottom: 8 },
          renderLineHighlight: 'line',
          folding: true,
          renderOverviewRuler: true,
          ignoreTrimWhitespace: false,
          renderIndicators: true,
          renderMarginRevertIcon: false,
          diffWordWrap: 'off',
        }}
        original={original}
        theme="mira-dark"
        width="100%"
      />
    </div>
  )
})
