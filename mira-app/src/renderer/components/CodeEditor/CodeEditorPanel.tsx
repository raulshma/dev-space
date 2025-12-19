import { memo, useCallback, useEffect } from 'react'
import {
  IconX,
  IconFile,
  IconAlertCircle,
  IconDeviceFloppy,
  IconArrowBackUp,
  IconGitCompare,
} from '@tabler/icons-react'
import { CodeEditor } from './CodeEditor'
import { DiffEditor } from './DiffEditor'
import { Spinner } from 'renderer/components/ui/spinner'
import { Button } from 'renderer/components/ui/button'
import { useEditorStore } from 'renderer/stores/editor-store'

interface CodeEditorPanelProps {
  className?: string
}

export const CodeEditorPanel = memo(function CodeEditorPanel({
  className = '',
}: CodeEditorPanelProps) {
  const openFiles = useEditorStore(state => state.openFiles)
  const activeFilePath = useEditorStore(state => state.activeFilePath)
  const isLoading = useEditorStore(state => state.isLoading)
  const isSaving = useEditorStore(state => state.isSaving)
  const error = useEditorStore(state => state.error)
  const closeFile = useEditorStore(state => state.closeFile)
  const setActiveFile = useEditorStore(state => state.setActiveFile)
  const updateFileContent = useEditorStore(state => state.updateFileContent)
  const saveActiveFile = useEditorStore(state => state.saveActiveFile)
  const revertFile = useEditorStore(state => state.revertFile)

  const currentFile = openFiles.find(f => f.path === activeFilePath)

  // Keyboard shortcut for save (Ctrl/Cmd + S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        saveActiveFile()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [saveActiveFile])

  const handleCloseFile = useCallback(
    (filePath: string, e?: React.MouseEvent) => {
      e?.stopPropagation()
      const file = openFiles.find(f => f.path === filePath)
      if (file?.isDirty) {
        // Simple confirm for now - could be replaced with a modal
        if (!confirm('You have unsaved changes. Close anyway?')) {
          return
        }
      }
      closeFile(filePath)
    },
    [closeFile, openFiles]
  )

  const handleContentChange = useCallback(
    (content: string) => {
      if (activeFilePath) {
        updateFileContent(activeFilePath, content)
      }
    },
    [activeFilePath, updateFileContent]
  )

  const handleRevert = useCallback(() => {
    if (activeFilePath && currentFile?.isDirty) {
      if (confirm('Revert all changes to this file?')) {
        revertFile(activeFilePath)
      }
    }
  }, [activeFilePath, currentFile?.isDirty, revertFile])

  if (openFiles.length === 0 && !isLoading) {
    return (
      <div className={`flex flex-col h-full bg-background ${className}`}>
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <IconFile className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Select a file to edit</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-full bg-background ${className}`}>
      {/* Tab bar */}
      <div className="flex items-center border-b border-border bg-muted/30 overflow-x-auto">
        {openFiles.map(file => (
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border-r border-border hover:bg-muted/50 shrink-0 cursor-pointer ${
              activeFilePath === file.path ? 'bg-background' : ''
            }`}
            key={file.path}
            onClick={() => setActiveFile(file.path)}
            onKeyDown={e => e.key === 'Enter' && setActiveFile(file.path)}
            role="tab"
            tabIndex={0}
            title={file.path}
          >
            {file.isDiff ? (
              <IconGitCompare className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            ) : null}
            <span className="truncate max-w-32">
              {file.isDirty && <span className="text-primary mr-1">●</span>}
              {file.name}
            </span>
            <button
              className="p-0.5 rounded hover:bg-muted"
              onClick={e => handleCloseFile(file.path, e)}
              type="button"
            >
              <IconX className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      {/* File info bar with actions */}
      {currentFile && (
        <div className="flex items-center justify-between px-3 py-1 text-xs text-muted-foreground border-b border-border bg-muted/20">
          <span className="truncate flex-1">
            {currentFile.isDiff
              ? currentFile.path.replace('diff://', '').replace('?staged', '')
              : currentFile.path}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <span>{currentFile.language}</span>
            {currentFile.isDiff ? (
              <span className="text-amber-500">
                {currentFile.diffStaged ? 'Staged Changes' : 'Working Tree'}
              </span>
            ) : (
              <>
                <span>{formatFileSize(currentFile.size)}</span>
                {currentFile.isTruncated && (
                  <span className="flex items-center gap-1 text-yellow-500">
                    <IconAlertCircle className="h-3 w-3" />
                    Read-only (truncated)
                  </span>
                )}
                {currentFile.isDirty && !currentFile.isTruncated && (
                  <>
                    <Button
                      className="h-6 px-2 text-xs"
                      disabled={isSaving}
                      onClick={handleRevert}
                      size="sm"
                      title="Revert changes"
                      variant="ghost"
                    >
                      <IconArrowBackUp className="h-3 w-3 mr-1" />
                      Revert
                    </Button>
                    <Button
                      className="h-6 px-2 text-xs"
                      disabled={isSaving}
                      onClick={saveActiveFile}
                      size="sm"
                      title="Save (Ctrl+S)"
                      variant="default"
                    >
                      {isSaving ? (
                        <Spinner className="h-3 w-3 mr-1" />
                      ) : (
                        <IconDeviceFloppy className="h-3 w-3 mr-1" />
                      )}
                      Save
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Editor content */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Spinner className="h-6 w-6" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-destructive">
            <div className="text-center">
              <IconAlertCircle className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">{error}</p>
            </div>
          </div>
        ) : currentFile?.isDiff ? (
          <DiffEditor
            language={currentFile.language}
            modified={currentFile.diffModified || ''}
            original={currentFile.diffOriginal || ''}
          />
        ) : currentFile ? (
          <CodeEditor
            content={currentFile.content}
            fileName={currentFile.name}
            language={currentFile.language}
            onChange={handleContentChange}
            readOnly={currentFile.isTruncated}
          />
        ) : null}
      </div>
    </div>
  )
})

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
