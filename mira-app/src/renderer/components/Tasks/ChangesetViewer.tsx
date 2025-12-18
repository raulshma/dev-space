/**
 * Changeset Viewer Component
 *
 * Displays files changed by the agent from activity changesets.
 * Shows a summary of added/modified/deleted files with expandable diff view.
 */

import { useState, useMemo } from 'react'
import { Button } from 'renderer/components/ui/button'
import { Badge } from 'renderer/components/ui/badge'
import { ScrollArea } from 'renderer/components/ui/scroll-area'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from 'renderer/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from 'renderer/components/ui/dialog'
import {
  IconChevronDown,
  IconChevronRight,
  IconFilePlus,
  IconFileCode,
  IconFileX,
  IconArrowRight,
  IconCopy,
  IconGitCommit,
  IconFiles,
} from '@tabler/icons-react'
import {
  parseUnidiff,
  extractChangedFiles,
  type DiffFile,
  type DiffLine,
} from 'renderer/lib/parse-unidiff'

interface ChangesetViewerProps {
  /** The unidiff patch string */
  unidiffPatch?: string
  /** Base commit ID */
  baseCommitId?: string
  /** Suggested commit message */
  suggestedCommitMessage?: string
  /** Compact mode for inline display */
  compact?: boolean
}

export function ChangesetViewer({
  unidiffPatch,
  baseCommitId,
  suggestedCommitMessage,
  compact = false,
}: ChangesetViewerProps): React.JSX.Element | null {
  const [selectedFile, setSelectedFile] = useState<DiffFile | null>(null)
  const [copied, setCopied] = useState(false)

  const parsedDiff = useMemo(() => {
    if (!unidiffPatch) return null
    return parseUnidiff(unidiffPatch)
  }, [unidiffPatch])

  const changedFiles = useMemo(() => {
    if (!unidiffPatch) return null
    return extractChangedFiles(unidiffPatch)
  }, [unidiffPatch])

  const handleCopyDiff = async (): Promise<void> => {
    if (!unidiffPatch) return
    try {
      await navigator.clipboard.writeText(unidiffPatch)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy diff:', error)
    }
  }

  // No changes to display
  if (!parsedDiff || parsedDiff.files.length === 0) {
    if (!suggestedCommitMessage && !baseCommitId) {
      return null
    }
    // Show just metadata if no actual diff
    return (
      <div className="text-xs space-y-1">
        {suggestedCommitMessage && (
          <div className="flex items-center gap-2">
            <IconGitCommit className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Commit:</span>
            <span className="truncate">{suggestedCommitMessage}</span>
          </div>
        )}
      </div>
    )
  }

  const totalFiles = parsedDiff.files.length
  const { added, modified, deleted, renamed } = changedFiles ?? {
    added: [],
    modified: [],
    deleted: [],
    renamed: [],
  }

  if (compact) {
    return (
      <CompactChangesetView
        added={added}
        deleted={deleted}
        modified={modified}
        parsedDiff={parsedDiff}
        renamed={renamed}
        suggestedCommitMessage={suggestedCommitMessage}
      />
    )
  }

  return (
    <div className="rounded-md border bg-muted/30">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <IconFiles className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium">Files Changed</span>
          <Badge className="text-xs" variant="secondary">
            {totalFiles}
          </Badge>
          <span className="text-xs text-muted-foreground">
            <span className="text-green-500">+{parsedDiff.totalAdditions}</span>
            {' / '}
            <span className="text-red-500">-{parsedDiff.totalDeletions}</span>
          </span>
        </div>
        <Button onClick={handleCopyDiff} size="sm" variant="ghost">
          <IconCopy className="mr-1 h-3 w-3" />
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>

      {/* File List */}
      <div className="p-2 space-y-1">
        {/* Added files */}
        {added.length > 0 && (
          <FileGroup
            files={added}
            icon={<IconFilePlus className="h-3.5 w-3.5 text-green-500" />}
            label="Added"
            onSelectFile={path => {
              const file = parsedDiff.files.find(f => f.newPath === path)
              if (file) setSelectedFile(file)
            }}
          />
        )}

        {/* Modified files */}
        {modified.length > 0 && (
          <FileGroup
            files={modified}
            icon={<IconFileCode className="h-3.5 w-3.5 text-blue-500" />}
            label="Modified"
            onSelectFile={path => {
              const file = parsedDiff.files.find(f => f.newPath === path)
              if (file) setSelectedFile(file)
            }}
          />
        )}

        {/* Deleted files */}
        {deleted.length > 0 && (
          <FileGroup
            files={deleted}
            icon={<IconFileX className="h-3.5 w-3.5 text-red-500" />}
            label="Deleted"
            onSelectFile={path => {
              const file = parsedDiff.files.find(f => f.oldPath === path)
              if (file) setSelectedFile(file)
            }}
          />
        )}

        {/* Renamed files */}
        {renamed.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-1">
              <IconArrowRight className="h-3.5 w-3.5 text-yellow-500" />
              <span>Renamed ({renamed.length})</span>
            </div>
            {renamed.map(r => (
              <button
                className="w-full text-left px-2 py-1 text-xs font-mono rounded hover:bg-muted/50 truncate"
                key={r.from}
                onClick={() => {
                  const file = parsedDiff.files.find(f => f.oldPath === r.from)
                  if (file) setSelectedFile(file)
                }}
                type="button"
              >
                <span className="text-muted-foreground">{r.from}</span>
                <IconArrowRight className="inline h-3 w-3 mx-1 text-yellow-500" />
                <span>{r.to}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Commit message */}
      {suggestedCommitMessage && (
        <div className="border-t px-3 py-2">
          <div className="flex items-start gap-2 text-xs">
            <IconGitCommit className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
            <div>
              <span className="text-muted-foreground">Commit message: </span>
              <span>{suggestedCommitMessage}</span>
            </div>
          </div>
        </div>
      )}

      {/* File Diff Dialog */}
      <FileDiffDialog
        file={selectedFile}
        onClose={() => setSelectedFile(null)}
      />
    </div>
  )
}

/**
 * Compact view for inline display in activity items
 */
function CompactChangesetView({
  added,
  modified,
  deleted,
  renamed,
  parsedDiff,
  suggestedCommitMessage,
}: {
  added: string[]
  modified: string[]
  deleted: string[]
  renamed: Array<{ from: string; to: string }>
  parsedDiff: ReturnType<typeof parseUnidiff>
  source?: string
  baseCommitId?: string
  suggestedCommitMessage?: string
}): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedFile, setSelectedFile] = useState<DiffFile | null>(null)

  const totalFiles = parsedDiff.files.length

  return (
    <div className="mt-2">
      <Collapsible onOpenChange={setIsExpanded} open={isExpanded}>
        <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
          {isExpanded ? (
            <IconChevronDown className="h-3 w-3" />
          ) : (
            <IconChevronRight className="h-3 w-3" />
          )}
          <IconFiles className="h-3.5 w-3.5" />
          <span>
            {totalFiles} file{totalFiles !== 1 ? 's' : ''} changed
          </span>
          <span className="text-green-500">+{parsedDiff.totalAdditions}</span>
          <span className="text-red-500">-{parsedDiff.totalDeletions}</span>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-2 pl-5 space-y-2">
          {/* File summary badges */}
          <div className="flex flex-wrap gap-1.5">
            {added.length > 0 && (
              <Badge
                className="text-xs bg-green-500/20 text-green-500 border-green-500/30"
                variant="outline"
              >
                <IconFilePlus className="h-3 w-3 mr-1" />
                {added.length} added
              </Badge>
            )}
            {modified.length > 0 && (
              <Badge
                className="text-xs bg-blue-500/20 text-blue-500 border-blue-500/30"
                variant="outline"
              >
                <IconFileCode className="h-3 w-3 mr-1" />
                {modified.length} modified
              </Badge>
            )}
            {deleted.length > 0 && (
              <Badge
                className="text-xs bg-red-500/20 text-red-500 border-red-500/30"
                variant="outline"
              >
                <IconFileX className="h-3 w-3 mr-1" />
                {deleted.length} deleted
              </Badge>
            )}
            {renamed.length > 0 && (
              <Badge
                className="text-xs bg-yellow-500/20 text-yellow-500 border-yellow-500/30"
                variant="outline"
              >
                <IconArrowRight className="h-3 w-3 mr-1" />
                {renamed.length} renamed
              </Badge>
            )}
          </div>

          {/* File list */}
          <div className="space-y-0.5 max-h-48 overflow-y-auto">
            {parsedDiff.files.map(file => (
              <button
                className="w-full flex items-center gap-2 px-2 py-1 text-xs rounded hover:bg-muted/50 text-left"
                key={file.newPath || file.oldPath}
                onClick={() => setSelectedFile(file)}
                type="button"
              >
                {file.type === 'added' && (
                  <IconFilePlus className="h-3 w-3 text-green-500 shrink-0" />
                )}
                {file.type === 'modified' && (
                  <IconFileCode className="h-3 w-3 text-blue-500 shrink-0" />
                )}
                {file.type === 'deleted' && (
                  <IconFileX className="h-3 w-3 text-red-500 shrink-0" />
                )}
                {file.type === 'renamed' && (
                  <IconArrowRight className="h-3 w-3 text-yellow-500 shrink-0" />
                )}
                <span className="font-mono truncate">
                  {file.type === 'deleted' ? file.oldPath : file.newPath}
                </span>
                <span className="ml-auto text-muted-foreground shrink-0">
                  <span className="text-green-500">+{file.additions}</span>
                  {' / '}
                  <span className="text-red-500">-{file.deletions}</span>
                </span>
              </button>
            ))}
          </div>

          {/* Commit message */}
          {suggestedCommitMessage && (
            <div className="flex items-start gap-2 text-xs pt-1 border-t border-border/50">
              <IconGitCommit className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
              <span className="text-muted-foreground truncate">
                {suggestedCommitMessage}
              </span>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* File Diff Dialog */}
      <FileDiffDialog
        file={selectedFile}
        onClose={() => setSelectedFile(null)}
      />
    </div>
  )
}

/**
 * File group component for categorized file lists
 */
function FileGroup({
  label,
  icon,
  files,
  onSelectFile,
}: {
  label: string
  icon: React.ReactNode
  files: string[]
  onSelectFile: (path: string) => void
}): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <Collapsible onOpenChange={setIsExpanded} open={isExpanded}>
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-1 w-full">
        {isExpanded ? (
          <IconChevronDown className="h-3 w-3" />
        ) : (
          <IconChevronRight className="h-3 w-3" />
        )}
        {icon}
        <span>
          {label} ({files.length})
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 space-y-0.5">
        {files.map(file => (
          <button
            className="w-full text-left px-2 py-1 text-xs font-mono rounded hover:bg-muted/50 truncate block"
            key={file}
            onClick={() => onSelectFile(file)}
            type="button"
          >
            {file}
          </button>
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

/**
 * Dialog to show full file diff
 */
function FileDiffDialog({
  file,
  onClose,
}: {
  file: DiffFile | null
  onClose: () => void
}): React.JSX.Element | null {
  const [copied, setCopied] = useState(false)

  if (!file) return null

  const handleCopy = async (): Promise<void> => {
    const diffText = file.hunks
      .map(h => `${h.header}\n${h.lines.map(l => l.raw).join('\n')}`)
      .join('\n\n')
    try {
      await navigator.clipboard.writeText(diffText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const renderDiffLine = (line: DiffLine, index: number): React.ReactNode => {
    let className = 'text-muted-foreground'
    let bgClass = ''

    switch (line.type) {
      case 'addition':
        className = 'text-green-500'
        bgClass = 'bg-green-500/10'
        break
      case 'deletion':
        className = 'text-red-500'
        bgClass = 'bg-red-500/10'
        break
      case 'header':
        className = 'text-blue-500'
        bgClass = 'bg-blue-500/10'
        break
    }

    return (
      <div className={`flex ${bgClass}`} key={index}>
        <span className="w-12 text-right pr-2 text-muted-foreground/50 select-none shrink-0 border-r border-border/30">
          {line.oldLineNumber ?? ''}
        </span>
        <span className="w-12 text-right pr-2 text-muted-foreground/50 select-none shrink-0 border-r border-border/30">
          {line.newLineNumber ?? ''}
        </span>
        <span className={`flex-1 px-2 ${className}`}>{line.raw || ' '}</span>
      </div>
    )
  }

  return (
    <Dialog onOpenChange={open => !open && onClose()} open={!!file}>
      <DialogContent className="w-[75vw] max-w-[75vw] h-[70vh] max-h-[70vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 font-mono text-sm">
            {file.type === 'added' && (
              <IconFilePlus className="h-4 w-4 text-green-500" />
            )}
            {file.type === 'modified' && (
              <IconFileCode className="h-4 w-4 text-blue-500" />
            )}
            {file.type === 'deleted' && (
              <IconFileX className="h-4 w-4 text-red-500" />
            )}
            {file.type === 'renamed' && (
              <IconArrowRight className="h-4 w-4 text-yellow-500" />
            )}
            {file.type === 'deleted' ? file.oldPath : file.newPath}
            <Badge className="ml-2" variant="secondary">
              <span className="text-green-500">+{file.additions}</span>
              {' / '}
              <span className="text-red-500">-{file.deletions}</span>
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-end gap-2 py-2 border-b shrink-0">
          <Button onClick={handleCopy} size="sm" variant="ghost">
            <IconCopy className="mr-1 h-3 w-3" />
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="font-mono text-xs">
              {file.hunks.map(hunk => (
                <div className="mb-4" key={hunk.header}>
                  <div className="bg-blue-500/10 text-blue-500 px-2 py-1 sticky top-0">
                    {hunk.header}
                  </div>
                  {hunk.lines.map((line, lineIdx) =>
                    renderDiffLine(line, lineIdx)
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ChangesetViewer
