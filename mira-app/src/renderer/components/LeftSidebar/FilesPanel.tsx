import { useState, useCallback, useEffect, memo } from 'react'
import {
  IconChevronRight,
  IconFolder,
  IconFolderOpen,
  IconFile,
  IconRefresh,
  IconFolderPlus,
} from '@tabler/icons-react'
import { Button } from 'renderer/components/ui/button'
import { Spinner } from 'renderer/components/ui/spinner'
import {
  Empty,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from 'renderer/components/ui/empty'

interface FilesPanelProps {
  projectId: string
  projectPath: string
}

interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

// File extensions to icon color mapping
const getFileColor = (name: string): string => {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'text-blue-500'
    case 'js':
    case 'jsx':
      return 'text-yellow-500'
    case 'json':
      return 'text-amber-600'
    case 'md':
      return 'text-gray-500'
    case 'css':
    case 'scss':
      return 'text-pink-500'
    case 'html':
      return 'text-orange-500'
    case 'py':
      return 'text-green-500'
    default:
      return 'text-muted-foreground'
  }
}

interface FileTreeItemProps {
  node: FileNode
  depth: number
  expandedPaths: Set<string>
  onToggle: (path: string) => void
  onFileClick: (path: string) => void
}

const FileTreeItem = memo(function FileTreeItem({
  node,
  depth,
  expandedPaths,
  onToggle,
  onFileClick,
}: FileTreeItemProps) {
  const isExpanded = expandedPaths.has(node.path)
  const paddingLeft = depth * 12 + 8

  if (node.isDirectory) {
    return (
      <div>
        <button
          className="flex w-full items-center gap-1 py-1 text-left text-sm hover:bg-muted/50 focus:bg-muted/50 focus:outline-none"
          onClick={() => onToggle(node.path)}
          style={{ paddingLeft }}
        >
          <IconChevronRight
            className={`h-3 w-3 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          />
          {isExpanded ? (
            <IconFolderOpen className="h-4 w-4 text-amber-500 shrink-0" />
          ) : (
            <IconFolder className="h-4 w-4 text-amber-500 shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {isExpanded && node.children && (
          <div>
            {node.children.map(child => (
              <FileTreeItem
                depth={depth + 1}
                expandedPaths={expandedPaths}
                key={child.path}
                node={child}
                onFileClick={onFileClick}
                onToggle={onToggle}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <button
      className="flex w-full items-center gap-1 py-1 text-left text-sm hover:bg-muted/50 focus:bg-muted/50 focus:outline-none"
      onClick={() => onFileClick(node.path)}
      style={{ paddingLeft: paddingLeft + 16 }}
    >
      <IconFile className={`h-4 w-4 shrink-0 ${getFileColor(node.name)}`} />
      <span className="truncate">{node.name}</span>
    </button>
  )
})

export const FilesPanel = memo(function FilesPanel({
  projectId: _projectId,
  projectPath,
}: FilesPanelProps) {
  const [files, setFiles] = useState<FileNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())

  const loadFiles = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      // For now, we'll show a placeholder since file listing needs a dedicated IPC handler
      // This would typically call window.api.files.list({ path: projectPath })
      setFiles([])
      setIsLoading(false)
    } catch {
      setError('Failed to load files')
      setIsLoading(false)
    }
  }, [projectPath])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  const handleToggle = useCallback((path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  const handleFileClick = useCallback((filePath: string) => {
    // Open file in default editor or show in terminal
    window.api.shell.openPath({ path: filePath }).catch(console.error)
  }, [])

  const handleOpenInExplorer = useCallback(() => {
    window.api.shell.openPath({ path: projectPath }).catch(console.error)
  }, [projectPath])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Spinner className="h-5 w-5" />
      </div>
    )
  }

  if (error) {
    return <div className="p-4 text-sm text-destructive">{error}</div>
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-sm font-medium">Explorer</span>
        <div className="flex items-center gap-1">
          <Button
            className="h-6 w-6 p-0"
            onClick={loadFiles}
            size="sm"
            title="Refresh"
            variant="ghost"
          >
            <IconRefresh className="h-3 w-3" />
          </Button>
          <Button
            className="h-6 w-6 p-0"
            onClick={handleOpenInExplorer}
            size="sm"
            title="Open in File Explorer"
            variant="ghost"
          >
            <IconFolderPlus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Project root */}
      <div className="px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <IconFolder className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium truncate">
            {projectPath.split(/[/\\]/).pop()}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {projectPath}
        </p>
      </div>

      {/* File tree or placeholder */}
      <div className="flex-1 overflow-y-auto">
        {files.length > 0 ? (
          files.map(node => (
            <FileTreeItem
              depth={0}
              expandedPaths={expandedPaths}
              key={node.path}
              node={node}
              onFileClick={handleFileClick}
              onToggle={handleToggle}
            />
          ))
        ) : (
          <Empty className="p-4">
            <EmptyMedia variant="icon">
              <IconFolder className="h-8 w-8" />
            </EmptyMedia>
            <EmptyTitle>File Explorer</EmptyTitle>
            <EmptyDescription>
              Click below to open this project in your system file explorer.
            </EmptyDescription>
            <Button
              className="mt-3"
              onClick={handleOpenInExplorer}
              size="sm"
              variant="outline"
            >
              Open in Explorer
            </Button>
          </Empty>
        )}
      </div>
    </div>
  )
})
