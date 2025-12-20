/**
 * Task Details Row Component
 *
 * Bottom row showing task details with tabbed interface for multiple open tasks.
 * Replaces the side panel approach with a horizontal row below the task list.
 */

import { memo, useCallback } from 'react'
import { Button } from 'renderer/components/ui/button'
import { ScrollArea, ScrollBar } from 'renderer/components/ui/scroll-area'
import {
  IconX,
  IconLoader2,
  IconCheck,
  IconAlertTriangle,
  IconClock,
  IconPlayerPause,
  IconPlayerStop,
  IconArchive,
} from '@tabler/icons-react'
import {
  useOpenTaskTabs,
  useActiveTaskTab,
  useTaskTabActions,
  useTask,
} from 'renderer/stores/agent-task-store'
import { TaskExecutionPanel } from './TaskExecutionPanel'
import { cn } from 'renderer/lib/utils'
import type { TaskStatus } from 'shared/ai-types'

const STATUS_ICONS: Record<TaskStatus, React.ReactNode> = {
  pending: <IconClock className="h-3 w-3 text-muted-foreground" />,
  queued: <IconClock className="h-3 w-3 text-blue-500" />,
  running: <IconLoader2 className="h-3 w-3 text-green-500 animate-spin" />,
  paused: <IconPlayerPause className="h-3 w-3 text-yellow-500" />,
  awaiting_approval: <IconClock className="h-3 w-3 text-yellow-500" />,
  review: <IconCheck className="h-3 w-3 text-amber-500" />,
  completed: <IconCheck className="h-3 w-3 text-green-500" />,
  failed: <IconAlertTriangle className="h-3 w-3 text-destructive" />,
  stopped: <IconPlayerStop className="h-3 w-3 text-muted-foreground" />,
  archived: <IconArchive className="h-3 w-3 text-slate-500" />,
}

interface TaskTabProps {
  taskId: string
  isActive: boolean
  onSelect: () => void
  onClose: () => void
}

const TaskTab = memo(function TaskTab({
  taskId,
  isActive,
  onSelect,
  onClose,
}: TaskTabProps) {
  const task = useTask(taskId)

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onClose()
    },
    [onClose]
  )

  if (!task) return null

  const truncatedDescription =
    task.description.length > 30
      ? `${task.description.slice(0, 30)}...`
      : task.description

  return (
    <div
      aria-selected={isActive}
      className={cn(
        'group flex items-center gap-1.5 px-3 py-1.5 cursor-pointer border-b-2 transition-colors min-w-0 max-w-[200px]',
        isActive
          ? 'border-primary bg-background text-foreground'
          : 'border-transparent hover:bg-muted/50 text-muted-foreground hover:text-foreground'
      )}
      onClick={onSelect}
      role="tab"
    >
      {STATUS_ICONS[task.status]}
      <span className="truncate text-xs font-medium">
        {truncatedDescription}
      </span>
      <Button
        className={cn(
          'h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity',
          isActive && 'opacity-100'
        )}
        onClick={handleClose}
        size="icon"
        variant="ghost"
      >
        <IconX className="h-3 w-3" />
      </Button>
    </div>
  )
})

interface TaskDetailsRowProps {
  className?: string
}

export const TaskDetailsRow = memo(function TaskDetailsRow({
  className,
}: TaskDetailsRowProps) {
  const openTabs = useOpenTaskTabs()
  const activeTab = useActiveTaskTab()
  const { setActiveTaskTab, closeTaskTab, closeAllTaskTabs } =
    useTaskTabActions()

  const handleCloseTab = useCallback(
    (taskId: string) => {
      closeTaskTab(taskId)
    },
    [closeTaskTab]
  )

  if (openTabs.length === 0) {
    return null
  }

  return (
    <div className={cn('flex flex-col border-t bg-background', className)}>
      {/* Tab bar */}
      <div className="flex items-center border-b bg-muted/30">
        <ScrollArea className="flex-1">
          <div className="flex items-center">
            {openTabs.map(taskId => (
              <TaskTab
                isActive={taskId === activeTab}
                key={taskId}
                onClose={() => handleCloseTab(taskId)}
                onSelect={() => setActiveTaskTab(taskId)}
                taskId={taskId}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        {openTabs.length > 1 && (
          <Button
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={closeAllTaskTabs}
            size="sm"
            variant="ghost"
          >
            Close All
          </Button>
        )}
      </div>

      {/* Active tab content */}
      {activeTab && (
        <div className="flex-1 min-h-0">
          <TaskExecutionPanel
            onClose={() => closeTaskTab(activeTab)}
            taskId={activeTab}
          />
        </div>
      )}
    </div>
  )
})
