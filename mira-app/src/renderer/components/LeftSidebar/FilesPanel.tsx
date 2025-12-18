import { useState, useCallback, useEffect, memo } from 'react'
import {
  IconChevronRight,
  IconFolder,
  IconFolderOpen,
  IconFile,
  IconRefresh,
  IconFolderPlus,
  IconFileCode,
  IconFileText,
  IconPhoto,
  IconJson,
  IconMarkdown,
  IconBrandTypescript,
  IconBrandJavascript,
  IconBrandPython,
  IconBrandCss3,
  IconBrandHtml5,
} from '@tabler/icons-react'
import { Button } from 'renderer/components/ui/button'
import { Spinner } from 'renderer/components/ui/spinner'
import type { FileNode } from 'shared/ipc-types'

interface FilesPanelProps {
  projectId: string
  projectPath: string
}

// Get icon component based on file extension
const getFileIcon = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'ts':
    case 'tsx':
      return IconBrandTypescript
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return IconBrandJavascript
    case 'py':
      return IconBrandPython
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return IconBrandCss3
    case 'html':
    case 'htm':
      return IconBrandHtml5
    case 'json':
      return IconJson
    case 'md':
    case 'mdx':
      return IconMarkdown
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
    case 'ico':
      return IconPhoto
    case 'txt':
    case 'log':
      return IconFileText
    default:
      return IconFileCode
  }
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
    case 'mjs':
    case 'cjs':
      return 'text-yellow-500'
    case 'json':
      return 'text-amber-600'
    case 'md':
    case 'mdx':
      return 'text-gray-400'
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return 'text-pink-500'
    case 'html':
    case 'htm':
      return 'text-orange-500'
    case 'py':
      return 'text-green-500'
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return 'text-purple-500'
    default:
      return 'text-muted-foreground'
  }
}

interface FileTreeItemProps {
  node: FileNode
  depth: number
  expandedPaths: Set<string>
  selectedPath: string | null
  onToggle: (path: string) => void
  onFileClick: (path: string) => void
  onLoadChildren: (path: string) => Promise<void>
}

const FileTreeItem = memo(function FileTreeItem({
  node,
  depth,
  expandedPaths,
  selectedPath,
  onToggle,
  onFileClick,
  onLoadChildren,
}: FileTreeItemProps) {
  const isExpanded = expandedPaths.has(node.path)
  const isSelected = selectedPath === node.path
  const paddingLeft = depth * 12 + 8

  const handleClick = useCallback(async () => {
    if (node.isDirectory) {
      onToggle(node.path)
      // Load children if expanding and no children loaded yet
      if (!isExpanded && (!node.children || node.children.length === 0)) {
        await onLoadChildren(node.path)
      }
    } else {
      onFileClick(node.path)
    }
  }, [node, isExpanded, onToggle, onFileClick, onLoadChildren])

  if (node.isDirectory) {
    return (
      <div>
        <button
          className={`flex w-full items-center gap-1 py-0.5 text-left text-sm hover:bg-muted/50 focus:outline-none ${
            isSelected ? 'bg-primary/10' : ''
          }`}
          onClick={handleClick}
          style={{ paddingLeft }}
          type="button"
        >
          <IconChevronRight
            className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
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
                onLoadChildren={onLoadChildren}
                onToggle={onToggle}
                selectedPath={selectedPath}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  const FileIcon = getFileIcon(node.name)

  return (
    <button
      className={`flex w-full items-center gap-1 py-0.5 text-left text-sm hover:bg-muted/50 focus:outline-none ${
        isSelected ? 'bg-primary/10' : ''
      }`}
      onClick={handleClick}
      style={{ paddingLeft: paddingLeft + 16 }}
      type="button"
    >
      <FileIcon className={`h-4 w-4 shrink-0 ${getFileColor(node.name)}`} />
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
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  const loadFiles = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await window.api.files.list({
        path: projectPath,
        maxDepth: 2,
      })
      setFiles(response.files)
    } catch (err) {
      console.error('Failed to load files:', err)
      setError('Failed to load files')
    } finally {
      setIsLoading(false)
    }
  }, [projectPath])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  const loadChildren = useCallback(
    async (dirPath: string) => {
      try {
        const response = await window.api.files.listShallow({ path: dirPath })
        // Update the tree with new children
        setFiles(prevFiles => {
          const updateNode = (nodes: FileNode[]): FileNode[] => {
            return nodes.map(node => {
              if (node.path === dirPath) {
                return { ...node, children: response.files }
              }
              if (node.children) {
                return { ...node, children: updateNode(node.children) }
              }
              return node
            })
          }
          return updateNode(prevFiles)
        })
      } catch (err) {
        console.error('Failed to load directory:', err)
      }
    },
    []
  )

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
    setSelectedPath(filePath)
    // Open file in built-in editor via store
    import('renderer/stores/editor-store').then(({ useEditorStore }) => {
      useEditorStore.getState().openFile(filePath)
    })
  }, [])

  const handleOpenInExplorer = useCallback(() => {
    window.api.shell.openPath({ path: projectPath }).catch(console.error)
  }, [projectPath])

  if (isLoading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-sm font-medium">Explorer</span>
        </div>
        <div className="flex items-center justify-center flex-1">
          <Spinner className="h-5 w-5" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-sm font-medium">Explorer</span>
        </div>
        <div className="p-4 text-sm text-destructive">{error}</div>
      </div>
    )
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

      {/* Project root header */}
      <div className="px-3 py-1.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <IconFolder className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider truncate">
            {projectPath.split(/[/\\]/).pop()}
          </span>
        </div>
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {files.length > 0 ? (
          files.map(node => (
            <FileTreeItem
              depth={0}
              expandedPaths={expandedPaths}
              key={node.path}
              node={node}
              onFileClick={handleFileClick}
              onLoadChildren={loadChildren}
              onToggle={handleToggle}
              selectedPath={selectedPath}
            />
          ))
        ) : (
          <div className="px-3 py-2 text-sm text-muted-foreground">
            No files found
          </div>
        )}
      </div>
    </div>
  )
})
