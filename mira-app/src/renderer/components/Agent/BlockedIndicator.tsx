/**
 * Blocked Indicator Component
 *
 * Badge showing "Blocked" status with tooltip listing blocking tasks.
 * Different style for failed dependencies.
 *
 * Requirements: 5.2, 5.5, 5.6
 */

import { useMemo } from 'react'
import { Badge } from 'renderer/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from 'renderer/components/ui/tooltip'
import { IconLock, IconAlertTriangle, IconCircleX } from '@tabler/icons-react'
import { cn } from 'renderer/lib/utils'
import type { AgentTask } from 'shared/ai-types'

export interface BlockedIndicatorProps {
  /** Whether the task is blocked */
  isBlocked: boolean
  /** IDs of tasks that are blocking this task */
  blockingTaskIds: string[]
  /** IDs of dependencies that have failed */
  failedDependencyIds: string[]
  /** Map of task IDs to task objects for displaying descriptions */
  taskMap?: Map<string, AgentTask>
  /** Optional className for styling */
  className?: string
  /** Size variant */
  size?: 'sm' | 'default'
  /** Whether to show as inline badge or icon only */
  variant?: 'badge' | 'icon'
}

/**
 * Truncate text with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 3)}...`
}

export function BlockedIndicator({
  isBlocked,
  blockingTaskIds,
  failedDependencyIds,
  taskMap,
  className,
  size = 'default',
  variant = 'badge',
}: BlockedIndicatorProps): React.JSX.Element | null {
  const hasFailedDependencies = failedDependencyIds.length > 0

  // Get task descriptions for tooltip
  const blockingTaskDescriptions = useMemo(() => {
    if (!taskMap) return blockingTaskIds
    return blockingTaskIds.map(id => {
      const task = taskMap.get(id)
      return task ? truncateText(task.description, 40) : id
    })
  }, [blockingTaskIds, taskMap])

  const failedTaskDescriptions = useMemo(() => {
    if (!taskMap) return failedDependencyIds
    return failedDependencyIds.map(id => {
      const task = taskMap.get(id)
      return task ? truncateText(task.description, 40) : id
    })
  }, [failedDependencyIds, taskMap])

  // Build tooltip content
  const tooltipContent = useMemo(() => {
    const lines: React.ReactNode[] = []

    if (failedTaskDescriptions.length > 0) {
      lines.push(
        <div className="mb-1" key="failed-header">
          <span className="font-medium text-destructive">
            Failed dependencies:
          </span>
        </div>
      )
      failedTaskDescriptions.forEach((desc, i) => {
        lines.push(
          <div
            className="flex items-center gap-1 text-destructive"
            key={`failed-${failedDependencyIds[i]}`}
          >
            <IconCircleX className="h-3 w-3 shrink-0" />
            <span>{desc}</span>
          </div>
        )
      })
    }

    // Filter out failed dependencies from blocking tasks
    const pendingBlockingTasks = blockingTaskDescriptions.filter(
      (_, i) => !failedDependencyIds.includes(blockingTaskIds[i])
    )

    if (pendingBlockingTasks.length > 0) {
      if (lines.length > 0) {
        lines.push(
          <div className="my-1 border-t border-border/50" key="separator" />
        )
      }
      lines.push(
        <div className="mb-1" key="blocking-header">
          <span className="font-medium">Waiting for:</span>
        </div>
      )
      // Get the original task IDs for pending blocking tasks
      const pendingBlockingTaskIds = blockingTaskIds.filter(
        id => !failedDependencyIds.includes(id)
      )
      pendingBlockingTasks.forEach((desc, i) => {
        lines.push(
          <div
            className="flex items-center gap-1"
            key={`blocking-${pendingBlockingTaskIds[i]}`}
          >
            <IconLock className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span>{desc}</span>
          </div>
        )
      })
    }

    return lines
  }, [
    blockingTaskDescriptions,
    failedTaskDescriptions,
    blockingTaskIds,
    failedDependencyIds,
  ])

  // Don't render if not blocked
  if (!isBlocked) return null

  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'

  // Icon-only variant
  if (variant === 'icon') {
    return (
      <Tooltip>
        <TooltipTrigger
          className={cn(
            'inline-flex items-center justify-center',
            hasFailedDependencies ? 'text-destructive' : 'text-yellow-500',
            className
          )}
        >
          {hasFailedDependencies ? (
            <IconAlertTriangle className={iconSize} />
          ) : (
            <IconLock className={iconSize} />
          )}
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-0.5 text-xs">{tooltipContent}</div>
        </TooltipContent>
      </Tooltip>
    )
  }

  // Badge variant
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            className={cn(
              'gap-1 cursor-help',
              size === 'sm' && 'text-[0.5625rem] h-4 px-1.5',
              className
            )}
            variant={hasFailedDependencies ? 'destructive' : 'outline'}
          >
            {hasFailedDependencies ? (
              <IconAlertTriangle className={iconSize} />
            ) : (
              <IconLock className={iconSize} />
            )}
            <span>
              {hasFailedDependencies ? 'Dependency Failed' : 'Blocked'}
            </span>
          </Badge>
        }
      />
      <TooltipContent className="max-w-xs">
        <div className="space-y-0.5 text-xs">{tooltipContent}</div>
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * Inline blocked indicator for compact display
 */
export interface InlineBlockedIndicatorProps {
  /** Whether the task is blocked */
  isBlocked: boolean
  /** Whether any dependencies have failed */
  hasFailedDependencies?: boolean
  /** Optional className for styling */
  className?: string
}

export function InlineBlockedIndicator({
  isBlocked,
  hasFailedDependencies = false,
  className,
}: InlineBlockedIndicatorProps): React.JSX.Element | null {
  if (!isBlocked) return null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs',
        hasFailedDependencies
          ? 'text-destructive'
          : 'text-yellow-500 dark:text-yellow-400',
        className
      )}
    >
      {hasFailedDependencies ? (
        <IconAlertTriangle className="h-3 w-3" />
      ) : (
        <IconLock className="h-3 w-3" />
      )}
    </span>
  )
}
