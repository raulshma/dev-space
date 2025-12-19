/**
 * Worktree Panel Component
 *
 * Displays a list of git worktrees for the current project with:
 * - Worktree path and branch information
 * - Task association display
 * - Delete button per worktree
 *
 * Requirements: 4.5, 4.6
 */

import { memo, useCallback, useState } from 'react'
import { Button } from 'renderer/components/ui/button'
import { Badge } from 'renderer/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from 'renderer/components/ui/card'
import { ScrollArea } from 'renderer/components/ui/scroll-area'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from 'renderer/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from 'renderer/components/ui/tooltip'
import {
  IconGitBranch,
  IconTrash,
  IconFolder,
  IconLink,
  IconLoader2,
  IconGitFork,
  IconRefresh,
} from '@tabler/icons-react'
import { useWorktrees } from 'renderer/hooks/use-worktrees'
import { useTaskList } from 'renderer/stores/agent-task-store'
import { cn } from 'renderer/lib/utils'
import type { WorktreeInfo } from 'shared/ipc-types'

export interface WorktreePanelProps {
  /** Project path to show worktrees for */
  projectPath: string | null
  /** Optional className for styling */
  className?: string
  /** Callback when a worktree is selected */
  onWorktreeSelect?: (worktree: WorktreeInfo) => void
  /** Callback when a task is clicked */
  onTaskClick?: (taskId: string) => void
}

/**
 * Truncate path for display
 */
function truncatePath(path: string, maxLength: number = 40): string {
  if (path.length <= maxLength) return path
  const parts = path.split(/[/\\]/)
  if (parts.length <= 2) return `...${path.slice(-maxLength + 3)}`
  return `.../${parts.slice(-2).join('/')}`
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60))
      return minutes <= 1 ? 'Just now' : `${minutes}m ago`
    }
    return `${hours}h ago`
  }
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

interface WorktreeItemProps {
  worktree: WorktreeInfo
  taskDescription?: string
  onDelete: (worktree: WorktreeInfo) => void
  onTaskClick?: (taskId: string) => void
  isDeleting: boolean
}

const WorktreeItem = memo(function WorktreeItem({
  worktree,
  taskDescription,
  onDelete,
  onTaskClick,
  isDeleting,
}: WorktreeItemProps): React.JSX.Element {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div className="shrink-0 mt-0.5">
        <IconGitFork className="h-5 w-5 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        {/* Branch name */}
        <div className="flex items-center gap-2">
          <IconGitBranch className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium text-sm">{worktree.branch}</span>
        </div>

        {/* Path */}
        <Tooltip>
          <TooltipTrigger
            render={
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-default">
                <IconFolder className="h-3 w-3" />
                <span className="truncate font-mono">
                  {truncatePath(worktree.path)}
                </span>
              </div>
            }
          />
          <TooltipContent className="max-w-md" side="bottom">
            <p className="font-mono text-xs break-all">{worktree.path}</p>
          </TooltipContent>
        </Tooltip>

        {/* Task association */}
        {worktree.taskId && (
          <div className="flex items-center gap-1.5">
            <IconLink className="h-3 w-3 text-muted-foreground" />
            {taskDescription ? (
              <button
                className="text-xs text-primary hover:underline truncate max-w-[200px]"
                onClick={() =>
                  worktree.taskId && onTaskClick?.(worktree.taskId)
                }
                type="button"
              >
                {taskDescription}
              </button>
            ) : (
              <span className="text-xs text-muted-foreground">
                Task: {worktree.taskId.slice(0, 8)}...
              </span>
            )}
          </div>
        )}

        {/* Created date */}
        <div className="text-xs text-muted-foreground">
          Created {formatDate(new Date(worktree.createdAt))}
        </div>
      </div>

      {/* Delete button */}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              className="shrink-0 text-muted-foreground hover:text-destructive"
              disabled={isDeleting}
              onClick={() => onDelete(worktree)}
              size="icon-sm"
              variant="ghost"
            >
              {isDeleting ? (
                <IconLoader2 className="h-4 w-4 animate-spin" />
              ) : (
                <IconTrash className="h-4 w-4" />
              )}
            </Button>
          }
        />
        <TooltipContent>Delete worktree</TooltipContent>
      </Tooltip>
    </div>
  )
})

export const WorktreePanel = memo(function WorktreePanel({
  projectPath,
  className,
  onTaskClick,
}: WorktreePanelProps): React.JSX.Element {
  const { worktrees, isLoading, error, deleteWorktree, refreshWorktrees } =
    useWorktrees(projectPath)
  const tasks = useTaskList()

  const [deleteConfirm, setDeleteConfirm] = useState<WorktreeInfo | null>(null)
  const [deletingPath, setDeletingPath] = useState<string | null>(null)

  // Get task description by ID
  const getTaskDescription = useCallback(
    (taskId: string | null): string | undefined => {
      if (!taskId) return undefined
      const task = tasks.find(t => t.id === taskId)
      return task?.description
    },
    [tasks]
  )

  const handleDeleteClick = useCallback((worktree: WorktreeInfo) => {
    setDeleteConfirm(worktree)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirm) return

    setDeletingPath(deleteConfirm.path)
    try {
      await deleteWorktree(deleteConfirm.path)
    } finally {
      setDeletingPath(null)
      setDeleteConfirm(null)
    }
  }, [deleteConfirm, deleteWorktree])

  const handleCancelDelete = useCallback(() => {
    setDeleteConfirm(null)
  }, [])

  if (!projectPath) {
    return (
      <Card className={cn('', className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <IconGitFork className="h-4 w-4" />
            Worktrees
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Select a project to view worktrees
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className={cn('', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <IconGitFork className="h-4 w-4" />
              Worktrees
              {worktrees.length > 0 && (
                <Badge className="ml-1" variant="secondary">
                  {worktrees.length}
                </Badge>
              )}
            </CardTitle>
            <Button
              disabled={isLoading}
              onClick={refreshWorktrees}
              size="icon-sm"
              variant="ghost"
            >
              <IconRefresh
                className={cn('h-4 w-4', isLoading && 'animate-spin')}
              />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {error && (
            <div className="text-sm text-destructive mb-3">{error}</div>
          )}

          {isLoading && worktrees.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <IconLoader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : worktrees.length === 0 ? (
            <div className="text-center py-6">
              <IconGitFork className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No worktrees found
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Create a task with a branch name to add worktrees
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2">
                {worktrees.map(worktree => (
                  <WorktreeItem
                    isDeleting={deletingPath === worktree.path}
                    key={worktree.path}
                    onDelete={handleDeleteClick}
                    onTaskClick={onTaskClick}
                    taskDescription={getTaskDescription(worktree.taskId)}
                    worktree={worktree}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog
        onOpenChange={open => !open && handleCancelDelete()}
        open={!!deleteConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Worktree</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this worktree? This will remove
              the worktree directory and its git tracking. Any uncommitted
              changes will be lost.
              {deleteConfirm?.taskId && (
                <span className="block mt-2 text-amber-600">
                  This worktree is associated with a task. The task will be
                  updated to remove the worktree association.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4 p-3 rounded-md bg-muted">
            <div className="flex items-center gap-2 text-sm">
              <IconGitBranch className="h-4 w-4 text-primary" />
              <span className="font-medium">{deleteConfirm?.branch}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-mono truncate">
              {deleteConfirm?.path}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
            >
              Delete Worktree
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
})

/**
 * Compact version of WorktreePanel for inline use
 */
export interface CompactWorktreePanelProps {
  /** Number of worktrees */
  worktreeCount: number
  /** Callback when clicked to open full panel */
  onClick?: () => void
  /** Optional className for styling */
  className?: string
}

export const CompactWorktreePanel = memo(function CompactWorktreePanel({
  worktreeCount,
  onClick,
  className,
}: CompactWorktreePanelProps): React.JSX.Element {
  return (
    <Button
      className={cn('gap-1.5', className)}
      onClick={onClick}
      size="sm"
      variant="outline"
    >
      <IconGitFork className="h-3.5 w-3.5" />
      <span>
        {worktreeCount === 0
          ? 'No worktrees'
          : `${worktreeCount} ${worktreeCount === 1 ? 'worktree' : 'worktrees'}`}
      </span>
    </Button>
  )
})
