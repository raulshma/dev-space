/**
 * Interrupted Tasks Notification Component
 *
 * Shows a notification banner when interrupted tasks are detected on app startup.
 * Provides quick actions to resume all or review interrupted tasks.
 */

import { useState, useEffect } from 'react'
import { Alert, AlertDescription, AlertTitle } from 'renderer/components/ui/alert'
import { Button } from 'renderer/components/ui/button'
import { Badge } from 'renderer/components/ui/badge'
import {
  IconAlertCircle,
  IconRefresh,
  IconX,
  IconPlayerPlay,
} from '@tabler/icons-react'
import { useAgentTaskStore } from 'renderer/stores/agent-task-store'
import type { AgentTask } from 'shared/ai-types'

interface InterruptedTasksNotificationProps {
  /** Called when user clicks "Resume All" */
  onResumeAll?: (taskIds: string[]) => void
  /** Called when user clicks "Review Tasks" */
  onReviewTasks?: () => void
  /** Called when notification is dismissed */
  onDismiss?: () => void
}

export function InterruptedTasksNotification({
  onResumeAll,
  onReviewTasks,
  onDismiss,
}: InterruptedTasksNotificationProps): React.JSX.Element | null {
  const tasksMap = useAgentTaskStore(state => state.tasks)
  const [dismissed, setDismissed] = useState(false)

  // Convert Map to array and find interrupted tasks
  const interruptedTasks = Array.from(tasksMap.values()).filter(
    (task: AgentTask) =>
      task.status === 'stopped' &&
      task.parameters?.sessionId &&
      task.error?.includes('interrupted by application shutdown')
  )

  const hasInterruptedTasks = interruptedTasks.length > 0

  // Auto-dismiss if no interrupted tasks
  useEffect(() => {
    if (!hasInterruptedTasks) {
      setDismissed(true)
    }
  }, [hasInterruptedTasks])

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.()
  }

  const handleResumeAll = () => {
    const taskIds = interruptedTasks.map((t: AgentTask) => t.id)
    onResumeAll?.(taskIds)
    handleDismiss()
  }

  const handleReviewTasks = () => {
    onReviewTasks?.()
    handleDismiss()
  }

  // Don't show if dismissed or no interrupted tasks
  if (dismissed || !hasInterruptedTasks) {
    return null
  }

  return (
    <Alert className="border-blue-500/50 bg-blue-500/10 mb-4 mx-4 mt-4">
      <div className="flex items-start gap-3">
        <IconAlertCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <AlertTitle className="text-blue-500 mb-1">
            Interrupted Tasks Detected
          </AlertTitle>
          <AlertDescription className="text-sm text-muted-foreground mb-3">
            Found {interruptedTasks.length} task
            {interruptedTasks.length > 1 ? 's' : ''} that{' '}
            {interruptedTasks.length > 1 ? 'were' : 'was'} interrupted when the
            app was closed. {interruptedTasks.length > 1 ? 'They' : 'It'} can be
            resumed from where{' '}
            {interruptedTasks.length > 1 ? 'they' : 'it'} left off.
          </AlertDescription>

          {/* Show first few interrupted task names */}
          <div className="flex flex-wrap gap-2 mb-3">
            {interruptedTasks.slice(0, 3).map(task => (
              <Badge
                key={task.id}
                className="gap-1 bg-blue-500/20 text-blue-500 border-blue-500/30"
                variant="outline"
              >
                <IconRefresh className="h-3 w-3" />
                {task.description.length > 40
                  ? `${task.description.slice(0, 40)}...`
                  : task.description}
              </Badge>
            ))}
            {interruptedTasks.length > 3 && (
              <Badge variant="secondary">
                +{interruptedTasks.length - 3} more
              </Badge>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleResumeAll}
              size="sm"
              variant="default"
              className="gap-1"
            >
              <IconPlayerPlay className="h-3.5 w-3.5" />
              Resume All ({interruptedTasks.length})
            </Button>
            <Button onClick={handleReviewTasks} size="sm" variant="outline">
              Review Tasks
            </Button>
            <Button
              onClick={handleDismiss}
              size="sm"
              variant="ghost"
              className="gap-1"
            >
              <IconX className="h-3.5 w-3.5" />
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </Alert>
  )
}

/**
 * Hook to detect and return interrupted tasks
 */
export function useInterruptedTasks(): {
  interruptedTasks: AgentTask[]
  hasInterruptedTasks: boolean
} {
  const tasksMap = useAgentTaskStore(state => state.tasks)

  const interruptedTasks = Array.from(tasksMap.values()).filter(
    (task: AgentTask) =>
      task.status === 'stopped' &&
      task.parameters?.sessionId &&
      task.error?.includes('interrupted by application shutdown')
  )

  return {
    interruptedTasks,
    hasInterruptedTasks: interruptedTasks.length > 0,
  }
}
