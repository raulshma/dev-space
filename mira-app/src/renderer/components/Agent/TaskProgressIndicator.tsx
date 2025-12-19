/**
 * Task Progress Indicator Component
 *
 * Shows the current planning task being executed and
 * progress through the task list.
 *
 * Requirements: 3.9
 */

import { useMemo } from 'react'
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
} from 'renderer/components/ui/progress'
import { Badge } from 'renderer/components/ui/badge'
import { cn } from 'renderer/lib/utils'
import {
  IconCircleCheck,
  IconCircleDashed,
  IconLoader2,
  IconCircleX,
  IconListCheck,
} from '@tabler/icons-react'
import type { PlanTask, PlanSpec } from 'shared/ai-types'

interface TaskProgressIndicatorProps {
  planSpec: PlanSpec | null | undefined
  className?: string
  showTaskList?: boolean
  compact?: boolean
}

/**
 * Get icon for task status
 */
function getTaskStatusIcon(
  status: PlanTask['status']
): React.ReactNode {
  switch (status) {
    case 'completed':
      return <IconCircleCheck className="h-4 w-4 text-green-500" />
    case 'in_progress':
      return <IconLoader2 className="h-4 w-4 text-primary animate-spin" />
    case 'failed':
      return <IconCircleX className="h-4 w-4 text-destructive" />
    case 'pending':
    default:
      return <IconCircleDashed className="h-4 w-4 text-muted-foreground" />
  }
}

/**
 * Get badge variant for task status
 */
function getTaskStatusVariant(
  status: PlanTask['status']
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'completed':
      return 'default'
    case 'in_progress':
      return 'secondary'
    case 'failed':
      return 'destructive'
    case 'pending':
    default:
      return 'outline'
  }
}

export function TaskProgressIndicator({
  planSpec,
  className,
  showTaskList = true,
  compact = false,
}: TaskProgressIndicatorProps): React.JSX.Element | null {
  const tasks = planSpec?.tasks ?? []

  const { completedCount, inProgressCount, failedCount, progress, currentTask } =
    useMemo(() => {
      const completed = tasks.filter(t => t.status === 'completed').length
      const inProgress = tasks.filter(t => t.status === 'in_progress').length
      const failed = tasks.filter(t => t.status === 'failed').length
      const total = tasks.length
      const progressValue = total > 0 ? (completed / total) * 100 : 0
      const current = tasks.find(t => t.status === 'in_progress')

      return {
        completedCount: completed,
        inProgressCount: inProgress,
        failedCount: failed,
        progress: progressValue,
        currentTask: current,
      }
    }, [tasks])

  if (!planSpec || tasks.length === 0) {
    return null
  }

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <IconListCheck className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <Progress value={progress}>
            <ProgressTrack className="h-1.5">
              <ProgressIndicator />
            </ProgressTrack>
          </Progress>
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {completedCount}/{tasks.length}
        </span>
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Progress header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconListCheck className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Plan Progress</span>
        </div>
        <div className="flex items-center gap-2">
          {failedCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {failedCount} failed
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {completedCount} of {tasks.length} tasks
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <Progress value={progress}>
        <ProgressTrack className="h-2">
          <ProgressIndicator />
        </ProgressTrack>
      </Progress>

      {/* Current task indicator */}
      {currentTask && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2">
          <IconLoader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">
              Currently executing: {currentTask.id}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {currentTask.description}
            </p>
          </div>
        </div>
      )}

      {/* Task list */}
      {showTaskList && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {tasks.map(task => (
            <div
              key={task.id}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs',
                task.status === 'in_progress' && 'bg-primary/5',
                task.status === 'completed' && 'opacity-60',
                task.status === 'failed' && 'bg-destructive/5'
              )}
            >
              {getTaskStatusIcon(task.status)}
              <span className="font-mono text-muted-foreground shrink-0">
                {task.id}
              </span>
              <span className="flex-1 truncate">{task.description}</span>
              {task.phase && (
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {task.phase}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Inline version showing just the current task
 */
export function InlineTaskProgress({
  planSpec,
  className,
}: Pick<TaskProgressIndicatorProps, 'planSpec' | 'className'>): React.JSX.Element | null {
  const tasks = planSpec?.tasks ?? []
  const currentTask = tasks.find(t => t.status === 'in_progress')
  const completedCount = tasks.filter(t => t.status === 'completed').length

  if (!planSpec || tasks.length === 0) {
    return null
  }

  return (
    <div className={cn('flex items-center gap-2 text-xs', className)}>
      {currentTask ? (
        <>
          <IconLoader2 className="h-3 w-3 text-primary animate-spin" />
          <span className="text-muted-foreground">
            Task {currentTask.id}:
          </span>
          <span className="truncate max-w-[200px]">
            {currentTask.description}
          </span>
        </>
      ) : (
        <>
          <IconCircleCheck className="h-3 w-3 text-green-500" />
          <span className="text-muted-foreground">
            {completedCount}/{tasks.length} tasks completed
          </span>
        </>
      )}
    </div>
  )
}
