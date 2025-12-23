/**
 * Kanban Column Component
 *
 * A column in the kanban board representing a task status.
 * Handles drag-and-drop for status changes.
 */

import { useCallback, memo } from 'react'
import { ScrollArea } from 'renderer/components/ui/scroll-area'
import { Badge } from 'renderer/components/ui/badge'
import {
  IconClock,
  IconLoader2,
  IconPlayerPause,
  IconCheck,
  IconX,
  IconPlayerStop,
  IconList,
  IconArchive,
} from '@tabler/icons-react'
import { KanbanCard } from './KanbanCard'
import type { AgentTask, TaskStatus } from 'shared/ai-types'

interface KanbanColumnProps {
  status: TaskStatus
  tasks: AgentTask[]
  selectedTaskId: string | null
  draggingTaskId: string | null
  isDropTarget: boolean
  canDrop: boolean
  onTaskSelect: (taskId: string) => void
  onStart: (taskId: string) => void
  onPause: (taskId: string) => void
  onResume: (taskId: string) => void
  onStop: (taskId: string) => void
  onDelete: (task: AgentTask) => void
  onArchive: (task: AgentTask) => void
  onEditTask?: (task: AgentTask) => void
  onDragStart: (taskId: string, status: TaskStatus) => void
  onDragEnd: () => void
  onDragOver: (e: React.DragEvent, status: TaskStatus) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent, status: TaskStatus) => void
}

const COLUMN_CONFIG: Record<
  TaskStatus,
  {
    label: string
    icon: React.ReactNode
    headerClass: string
  }
> = {
  pending: {
    label: 'Backlog',
    icon: <IconClock className="h-4 w-4" />,
    headerClass: 'bg-muted/50',
  },
  queued: {
    label: 'Queued',
    icon: <IconList className="h-4 w-4" />,
    headerClass: 'bg-blue-500/10',
  },
  running: {
    label: 'In Progress',
    icon: <IconLoader2 className="h-4 w-4" />,
    headerClass: 'bg-green-500/10',
  },
  paused: {
    label: 'Paused',
    icon: <IconPlayerPause className="h-4 w-4" />,
    headerClass: 'bg-yellow-500/10',
  },
  awaiting_approval: {
    label: 'Awaiting Approval',
    icon: <IconClock className="h-4 w-4" />,
    headerClass: 'bg-yellow-500/10',
  },
  completed: {
    label: 'Done',
    icon: <IconCheck className="h-4 w-4" />,
    headerClass: 'bg-emerald-500/10',
  },
  failed: {
    label: 'Failed',
    icon: <IconX className="h-4 w-4" />,
    headerClass: 'bg-red-500/10',
  },
  stopped: {
    label: 'Stopped',
    icon: <IconPlayerStop className="h-4 w-4" />,
    headerClass: 'bg-gray-500/10',
  },
  archived: {
    label: 'Archived',
    icon: <IconArchive className="h-4 w-4" />,
    headerClass: 'bg-slate-500/10',
  },
  review: {
    label: 'Review',
    icon: <IconCheck className="h-4 w-4" />,
    headerClass: 'bg-amber-500/10',
  },
}

export const KanbanColumn = memo(function KanbanColumn({
  status,
  tasks,
  selectedTaskId,
  draggingTaskId,
  isDropTarget,
  canDrop,
  onTaskSelect,
  onStart,
  onPause,
  onResume,
  onStop,
  onDelete,
  onArchive,
  onEditTask,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: KanbanColumnProps): React.JSX.Element {
  const config = COLUMN_CONFIG[status]

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      onDragOver(e, status)
    },
    [onDragOver, status]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      onDrop(e, status)
    },
    [onDrop, status]
  )

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      // Only trigger if leaving the column entirely
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX
      const y = e.clientY
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        onDragLeave()
      }
    },
    [onDragLeave]
  )

  // Determine column styling based on drag state
  const getColumnClass = () => {
    const base =
      'flex flex-col h-full w-[280px] min-w-[280px] max-w-[280px] shrink-0 rounded-lg transition-all duration-200'
    if (isDropTarget && canDrop) {
      return `${base} bg-primary/10 ring-2 ring-primary ring-dashed`
    }
    if (isDropTarget && !canDrop) {
      return `${base} bg-destructive/10 ring-2 ring-destructive/50 ring-dashed`
    }
    return `${base} bg-muted/30`
  }

  return (
    <div
      aria-label={`${config.label} column`}
      className={getColumnClass()}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      role="region"
    >
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-t-lg ${config.headerClass}`}
      >
        {config.icon}
        <span className="font-medium text-sm">{config.label}</span>
        <Badge className="ml-auto text-xs" variant="secondary">
          {tasks.length}
        </Badge>
      </div>

      <ScrollArea className="flex-1 p-2">
        <div className="flex flex-col gap-2">
          {tasks.map(task => (
            <KanbanCard
              isDragging={draggingTaskId === task.id}
              isSelected={selectedTaskId === task.id}
              key={task.id}
              onArchive={onArchive}
              onDelete={onDelete}
              onDragEnd={onDragEnd}
              onDragStart={onDragStart}
              onEditTask={onEditTask}
              onPause={onPause}
              onResume={onResume}
              onSelect={onTaskSelect}
              onStart={onStart}
              onStop={onStop}
              status={status}
              task={task}
            />
          ))}
          {tasks.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-xs">
              {isDropTarget && canDrop ? 'Drop here' : 'No tasks'}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
})
