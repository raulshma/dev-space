/**
 * Kanban Card Component
 *
 * Individual task card for the kanban board with drag support.
 * Uses native HTML5 drag-and-drop for performance.
 */

import { useCallback, memo } from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from 'renderer/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'renderer/components/ui/dropdown-menu'
import {
  IconDotsVertical,
  IconPlayerPlay,
  IconPlayerPause,
  IconPlayerStop,
  IconTrash,
  IconRocket,
  IconGitBranch,
  IconClock,
  IconLoader2,
  IconAlertTriangle,
  IconRefresh,
  IconGripVertical,
} from '@tabler/icons-react'
import { VALID_DROP_TARGETS } from 'renderer/hooks/use-kanban-dnd'
import type { AgentTask, TaskStatus } from 'shared/ai-types'

interface KanbanCardProps {
  task: AgentTask
  status: TaskStatus
  isSelected: boolean
  isDragging: boolean
  onSelect: (taskId: string) => void
  onStart: (taskId: string) => void
  onPause: (taskId: string) => void
  onResume: (taskId: string) => void
  onStop: (taskId: string) => void
  onDelete: (task: AgentTask) => void
  onDragStart: (taskId: string, status: TaskStatus) => void
  onDragEnd: () => void
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: 'border-l-muted-foreground',
  queued: 'border-l-blue-500',
  running: 'border-l-green-500',
  paused: 'border-l-yellow-500',
  completed: 'border-l-emerald-500',
  failed: 'border-l-red-500',
  stopped: 'border-l-gray-500',
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 0) return `${diffDays}d ago`
  if (diffHours > 0) return `${diffHours}h ago`
  if (diffMins > 0) return `${diffMins}m ago`
  return 'Just now'
}

export const KanbanCard = memo(function KanbanCard({
  task,
  status,
  isSelected,
  isDragging,
  onSelect,
  onStart,
  onPause,
  onResume,
  onStop,
  onDelete,
  onDragStart,
  onDragEnd,
}: KanbanCardProps): React.JSX.Element {
  const canStart = task.status === 'pending' || task.status === 'queued'
  const canPause = task.status === 'running'
  const canResume = task.status === 'paused'
  const canStop = task.status === 'running' || task.status === 'paused'
  const canDelete = task.status !== 'running' && task.status !== 'paused'

  // Check if this task can be dragged (has valid drop targets)
  const canDrag = VALID_DROP_TARGETS[task.status]?.length > 0

  const handleClick = useCallback(() => {
    onSelect(task.id)
  }, [task.id, onSelect])

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (!canDrag) {
        e.preventDefault()
        return
      }
      // Set drag data
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', task.id)
      // Notify parent
      onDragStart(task.id, status)
    },
    [task.id, status, canDrag, onDragStart]
  )

  const handleDragEnd = useCallback(() => {
    onDragEnd()
  }, [onDragEnd])

  return (
    <Card
      className={`
        border-l-4 transition-all
        ${STATUS_COLORS[task.status]}
        ${isSelected ? 'ring-2 ring-primary' : 'hover:ring-2 hover:ring-primary/20'}
        ${isDragging ? 'opacity-50 scale-95 ring-2 ring-primary' : ''}
        ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
      `}
      draggable={canDrag}
      onClick={handleClick}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      size="sm"
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <IconGripVertical
              className={`h-4 w-4 shrink-0 ${canDrag ? 'text-muted-foreground/50 cursor-grab' : 'text-muted-foreground/20'}`}
            />
            {task.agentType === 'autonomous' ? (
              <IconRocket className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <IconGitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <CardTitle className="truncate text-sm">
              {task.description}
            </CardTitle>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="shrink-0 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none hover:bg-accent h-6 w-6"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <IconDotsVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canStart && (
                <DropdownMenuItem
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation()
                    onStart(task.id)
                  }}
                >
                  <IconPlayerPlay className="mr-2 h-4 w-4" />
                  Start
                </DropdownMenuItem>
              )}
              {canPause && (
                <DropdownMenuItem
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation()
                    onPause(task.id)
                  }}
                >
                  <IconPlayerPause className="mr-2 h-4 w-4" />
                  Pause
                </DropdownMenuItem>
              )}
              {canResume && (
                <DropdownMenuItem
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation()
                    onResume(task.id)
                  }}
                >
                  <IconPlayerPlay className="mr-2 h-4 w-4" />
                  Resume
                </DropdownMenuItem>
              )}
              {canStop && (
                <DropdownMenuItem
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation()
                    onStop(task.id)
                  }}
                >
                  <IconPlayerStop className="mr-2 h-4 w-4" />
                  Stop
                </DropdownMenuItem>
              )}
              {task.status === 'failed' && (
                <DropdownMenuItem
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation()
                    onStart(task.id)
                  }}
                >
                  <IconRefresh className="mr-2 h-4 w-4" />
                  Retry
                </DropdownMenuItem>
              )}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation()
                      onDelete(task)
                    }}
                  >
                    <IconTrash className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="py-0">
        <p className="text-xs text-muted-foreground font-mono truncate">
          {task.targetDirectory}
        </p>
        {task.error && (
          <div className="flex items-center gap-1 mt-2 text-xs text-destructive">
            <IconAlertTriangle className="h-3 w-3 shrink-0" />
            <span className="truncate">{task.error}</span>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <IconClock className="h-3 w-3" />
          {formatRelativeTime(task.createdAt)}
        </div>
        {task.status === 'running' && (
          <div className="ml-auto flex items-center gap-1 text-green-500">
            <IconLoader2 className="h-3 w-3 animate-spin" />
            Running
          </div>
        )}
      </CardFooter>
    </Card>
  )
})
