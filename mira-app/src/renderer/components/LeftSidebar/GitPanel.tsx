import { useState, useCallback, memo } from 'react'
import {
  IconChevronRight,
  IconGitBranch,
  IconGitCommit,
  IconGitMerge,
  IconArrowBackUp,
  IconPackage,
  IconRefresh,
  IconPlus,
  IconMinus,
  IconArrowUp,
  IconArrowDown,
  IconFile,
  IconFilePlus,
  IconFileX,
  IconFileOff,
  IconExternalLink,
  IconGitCompare,
} from '@tabler/icons-react'
import { useGitTelemetry } from 'renderer/hooks/use-git-telemetry'
import { useTerminalStore } from 'renderer/stores/terminal-store'
import { Button } from 'renderer/components/ui/button'
import { Separator } from 'renderer/components/ui/separator'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from 'renderer/components/ui/collapsible'
import {
  Empty,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from 'renderer/components/ui/empty'
import type { GitFileStatus } from 'shared/models'

interface GitPanelProps {
  projectId: string
  projectPath: string
}

interface GitOperation {
  id: string
  name: string
  command: string
  icon: typeof IconGitCommit
  description: string
  category: 'common' | 'stash' | 'branch' | 'reset'
}

const gitOperations: GitOperation[] = [
  // Common operations
  {
    id: 'status',
    name: 'Status',
    command: 'git status',
    icon: IconGitBranch,
    description: 'Show working tree status',
    category: 'common',
  },
  {
    id: 'pull',
    name: 'Pull',
    command: 'git pull',
    icon: IconArrowDown,
    description: 'Fetch and merge from remote',
    category: 'common',
  },
  {
    id: 'push',
    name: 'Push',
    command: 'git push',
    icon: IconArrowUp,
    description: 'Push commits to remote',
    category: 'common',
  },
  {
    id: 'fetch',
    name: 'Fetch',
    command: 'git fetch --all',
    icon: IconRefresh,
    description: 'Fetch all remotes',
    category: 'common',
  },
  {
    id: 'add-all',
    name: 'Stage All',
    command: 'git add -A',
    icon: IconPlus,
    description: 'Stage all changes',
    category: 'common',
  },
  {
    id: 'commit',
    name: 'Commit',
    command: 'git commit',
    icon: IconGitCommit,
    description: 'Commit staged changes',
    category: 'common',
  },

  // Stash operations
  {
    id: 'stash',
    name: 'Stash All',
    command: 'git stash',
    icon: IconPackage,
    description: 'Stash all changes',
    category: 'stash',
  },
  {
    id: 'stash-pop',
    name: 'Stash Pop',
    command: 'git stash pop',
    icon: IconArrowBackUp,
    description: 'Apply and remove latest stash',
    category: 'stash',
  },

  // Branch operations
  {
    id: 'branch-list',
    name: 'List Branches',
    command: 'git branch -a',
    icon: IconGitBranch,
    description: 'List all branches',
    category: 'branch',
  },
  {
    id: 'merge',
    name: 'Merge',
    command: 'git merge',
    icon: IconGitMerge,
    description: 'Merge branch (specify branch)',
    category: 'branch',
  },

  // Reset operations
  {
    id: 'reset-soft',
    name: 'Soft Reset',
    command: 'git reset --soft HEAD~1',
    icon: IconArrowBackUp,
    description: 'Undo last commit, keep changes staged',
    category: 'reset',
  },
  {
    id: 'unstage-all',
    name: 'Unstage All',
    command: 'git reset HEAD',
    icon: IconMinus,
    description: 'Unstage all files',
    category: 'reset',
  },
]

const categories = [
  { id: 'common', name: 'Quick Actions', defaultOpen: true },
  { id: 'stash', name: 'Stash', defaultOpen: false },
  { id: 'branch', name: 'Branch', defaultOpen: false },
  { id: 'reset', name: 'Reset', defaultOpen: false },
] as const

// Get icon for file status
const getStatusIcon = (status: GitFileStatus['status']) => {
  switch (status) {
    case 'added':
    case 'staged':
      return IconFilePlus
    case 'deleted':
      return IconFileX
    case 'untracked':
      return IconFileOff
    default:
      return IconFile
  }
}

// Get color for file status
const getStatusColor = (status: GitFileStatus['status'], staged: boolean) => {
  if (staged) return 'text-green-500'
  switch (status) {
    case 'added':
      return 'text-green-500'
    case 'deleted':
      return 'text-red-500'
    case 'untracked':
      return 'text-gray-400'
    case 'modified':
      return 'text-amber-500'
    default:
      return 'text-muted-foreground'
  }
}

// Get status label
const getStatusLabel = (status: GitFileStatus['status']) => {
  switch (status) {
    case 'added':
      return 'A'
    case 'deleted':
      return 'D'
    case 'modified':
      return 'M'
    case 'staged':
      return 'S'
    case 'untracked':
      return 'U'
    case 'renamed':
      return 'R'
    default:
      return '?'
  }
}

interface GitFileItemProps {
  file: GitFileStatus
  projectPath: string
  onOpenFile: (path: string) => void
  onViewDiff: (path: string) => void
}

const GitFileItem = memo(function GitFileItem({
  file,
  projectPath,
  onOpenFile,
  onViewDiff,
}: GitFileItemProps) {
  const StatusIcon = getStatusIcon(file.status)
  const statusColor = getStatusColor(file.status, file.staged)
  const fileName = file.path.split('/').pop() || file.path

  return (
    <div className="flex items-center gap-1 px-3 py-1 hover:bg-muted/50 group">
      <StatusIcon className={`h-4 w-4 shrink-0 ${statusColor}`} />
      <span
        className="flex-1 text-sm truncate cursor-pointer hover:underline"
        onClick={() => onOpenFile(`${projectPath}/${file.path}`)}
        title={file.path}
      >
        {fileName}
      </span>
      <span
        className={`text-xs font-mono px-1 rounded ${statusColor} bg-muted/50`}
        title={file.staged ? 'Staged' : file.status}
      >
        {getStatusLabel(file.status)}
      </span>
      <div className="hidden group-hover:flex items-center gap-0.5">
        <Button
          className="h-5 w-5 p-0"
          onClick={() => onOpenFile(`${projectPath}/${file.path}`)}
          size="sm"
          title="Open file"
          variant="ghost"
        >
          <IconExternalLink className="h-3 w-3" />
        </Button>
        {file.status !== 'untracked' && (
          <Button
            className="h-5 w-5 p-0"
            onClick={() => onViewDiff(file.path)}
            size="sm"
            title="View diff"
            variant="ghost"
          >
            <IconGitCompare className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  )
})

export const GitPanel = memo(function GitPanel({
  projectId,
  projectPath,
}: GitPanelProps) {
  const { data: telemetry, isLoading, refetch } = useGitTelemetry(projectPath)
  const focusedTerminalId = useTerminalStore(state => state.focusedTerminalId)
  const getTerminal = useTerminalStore(state => state.getTerminal)

  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >(() => Object.fromEntries(categories.map(c => [c.id, c.defaultOpen])))
  const [changesExpanded, setChangesExpanded] = useState(true)

  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }))
  }, [])

  const runGitCommand = useCallback(
    async (command: string): Promise<void> => {
      const terminal = focusedTerminalId ? getTerminal(focusedTerminalId) : null

      if (!terminal || terminal.projectId !== projectId) {
        alert('Please focus a terminal in this project first')
        return
      }

      try {
        await window.api.pty.write({
          ptyId: terminal.ptyId,
          data: `${command}\r`,
        })
      } catch (err) {
        console.error('Failed to run git command:', err)
        alert('Failed to run command. Please try again.')
      }
    },
    [focusedTerminalId, getTerminal, projectId]
  )

  const handleOpenFile = useCallback((filePath: string) => {
    window.api.shell.openPath({ path: filePath }).catch(console.error)
  }, [])

  const handleViewDiff = useCallback(
    (relativePath: string) => {
      runGitCommand(`git diff "${relativePath}"`)
    },
    [runGitCommand]
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!telemetry?.isGitRepo) {
    return (
      <Empty className="p-4">
        <EmptyMedia variant="icon">
          <IconGitBranch className="h-8 w-8" />
        </EmptyMedia>
        <EmptyTitle>Not a Git Repository</EmptyTitle>
        <EmptyDescription>
          Initialize a git repository to use source control features.
        </EmptyDescription>
        <Button
          className="mt-3"
          onClick={() => runGitCommand('git init')}
          size="sm"
          variant="outline"
        >
          Initialize Repository
        </Button>
      </Empty>
    )
  }

  const stagedFiles = telemetry.files?.filter(f => f.staged) || []
  const unstagedFiles = telemetry.files?.filter(f => !f.staged) || []
  const hasChanges = telemetry.files && telemetry.files.length > 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header with branch info */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <IconGitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">
            {telemetry.branch}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {telemetry.ahead > 0 && (
            <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-0.5">
              <IconArrowUp className="h-3 w-3" />
              {telemetry.ahead}
            </span>
          )}
          {telemetry.behind > 0 && (
            <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-0.5">
              <IconArrowDown className="h-3 w-3" />
              {telemetry.behind}
            </span>
          )}
          <Button
            className="h-6 w-6 p-0"
            onClick={() => refetch()}
            size="sm"
            title="Refresh"
            variant="ghost"
          >
            <IconRefresh className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Changed Files Section */}
        <Collapsible
          onOpenChange={setChangesExpanded}
          open={changesExpanded}
        >
          <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/50">
            <span>Changes</span>
            <div className="flex items-center gap-2">
              {hasChanges && (
                <span className="text-xs font-normal normal-case">
                  {telemetry.files?.length} file
                  {telemetry.files?.length !== 1 ? 's' : ''}
                </span>
              )}
              <IconChevronRight
                className={`h-3 w-3 transition-transform ${changesExpanded ? 'rotate-90' : ''}`}
              />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {hasChanges ? (
              <div className="pb-2">
                {/* Staged files */}
                {stagedFiles.length > 0 && (
                  <div>
                    <div className="px-3 py-1 text-xs text-green-600 dark:text-green-400 font-medium">
                      Staged ({stagedFiles.length})
                    </div>
                    {stagedFiles.map(file => (
                      <GitFileItem
                        file={file}
                        key={file.path}
                        onOpenFile={handleOpenFile}
                        onViewDiff={handleViewDiff}
                        projectPath={projectPath}
                      />
                    ))}
                  </div>
                )}
                {/* Unstaged files */}
                {unstagedFiles.length > 0 && (
                  <div>
                    <div className="px-3 py-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                      Changes ({unstagedFiles.length})
                    </div>
                    {unstagedFiles.map(file => (
                      <GitFileItem
                        file={file}
                        key={file.path}
                        onOpenFile={handleOpenFile}
                        onViewDiff={handleViewDiff}
                        projectPath={projectPath}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No changes
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Git operations */}
        {categories.map(category => (
          <Collapsible
            key={category.id}
            onOpenChange={() => toggleCategory(category.id)}
            open={expandedCategories[category.id]}
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/50">
              <span>{category.name}</span>
              <IconChevronRight
                className={`h-3 w-3 transition-transform ${expandedCategories[category.id] ? 'rotate-90' : ''}`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pb-1">
                {gitOperations
                  .filter(op => op.category === category.id)
                  .map(operation => {
                    const Icon = operation.icon
                    return (
                      <button
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-primary/5 focus:bg-primary/5 focus:outline-none group"
                        key={operation.id}
                        onClick={() => runGitCommand(operation.command)}
                        title={operation.description}
                        type="button"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
                        <span className="truncate">{operation.name}</span>
                      </button>
                    )
                  })}
              </div>
            </CollapsibleContent>
            <Separator />
          </Collapsible>
        ))}
      </div>
    </div>
  )
})
