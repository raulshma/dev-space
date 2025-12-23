/**
 * Startup Resume Dialog Component
 *
 * Shows a dialog on app startup when interrupted tasks are detected.
 * Allows users to resume all, review, or dismiss interrupted tasks.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'renderer/components/ui/dialog'
import { Button } from 'renderer/components/ui/button'
import { Badge } from 'renderer/components/ui/badge'
import { ScrollArea } from 'renderer/components/ui/scroll-area'
import {
  IconAlertCircle,
  IconRefresh,
  IconX,
  IconPlayerPlay,
  IconEye,
  IconRocket,
  IconGitBranch,
} from '@tabler/icons-react'
import { useRestartAgentTask } from 'renderer/hooks/use-agent-tasks'
import { useSetting, SETTING_KEYS } from 'renderer/hooks/use-settings'
import { useInterruptedTasks } from './InterruptedTasksNotification'

interface StartupResumeDialogProps {
  /** Called when dialog is closed */
  onClose?: () => void
}

export function StartupResumeDialog({
  onClose,
}: StartupResumeDialogProps): React.JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [hasShown, setHasShown] = useState(false)

  // Get interrupted tasks and settings
  const { interruptedTasks, hasInterruptedTasks } = useInterruptedTasks()
  const { data: autoResumeEnabled } = useSetting(SETTING_KEYS.TASKS_AUTO_RESUME)
  const { data: promptBeforeAutoResume } = useSetting(
    SETTING_KEYS.TASKS_PROMPT_BEFORE_AUTO_RESUME
  )

  const restartTask = useRestartAgentTask()
  const [isResuming, setIsResuming] = useState(false)

  // Show dialog on mount if there are interrupted tasks and prompt is enabled
  useEffect(() => {
    if (
      hasInterruptedTasks &&
      !hasShown &&
      autoResumeEnabled === 'true' &&
      promptBeforeAutoResume === 'true'
    ) {
      setOpen(true)
      setHasShown(true)
    }
    // Auto-resume without prompt if enabled and prompt is disabled
    else if (
      hasInterruptedTasks &&
      !hasShown &&
      autoResumeEnabled === 'true' &&
      promptBeforeAutoResume === 'false'
    ) {
      setHasShown(true)
      handleResumeAll()
    }
  }, [
    hasInterruptedTasks,
    hasShown,
    autoResumeEnabled,
    promptBeforeAutoResume,
  ])

  const handleResumeAll = useCallback(async () => {
    setIsResuming(true)
    try {
      for (const task of interruptedTasks) {
        await restartTask.mutateAsync({ taskId: task.id, resumeSession: true })
      }
      setOpen(false)
      onClose?.()
    } catch (error) {
      console.error('Failed to resume tasks:', error)
    } finally {
      setIsResuming(false)
    }
  }, [interruptedTasks, restartTask, onClose])

  const handleReviewTasks = useCallback(() => {
    setOpen(false)
    onClose?.()
    // User will see the interrupted tasks in the notification banner
  }, [onClose])

  const handleDismiss = useCallback(() => {
    setOpen(false)
    onClose?.()
  }, [onClose])

  // Don't render if no interrupted tasks
  if (!hasInterruptedTasks) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full p-2 bg-blue-500/10">
              <IconAlertCircle className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <DialogTitle className="text-lg">
                Interrupted Tasks Detected
              </DialogTitle>
              <DialogDescription>
                Found {interruptedTasks.length} task
                {interruptedTasks.length > 1 ? 's' : ''} that{' '}
                {interruptedTasks.length > 1 ? 'were' : 'was'} interrupted when
                the app was closed
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Task list */}
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            These tasks can be resumed from where they left off with full
            context:
          </p>
          <ScrollArea className="max-h-[300px] rounded-md border bg-muted/30 p-3">
            <div className="space-y-2">
              {interruptedTasks.map(task => (
                <div
                  key={task.id}
                  className="flex items-start gap-3 rounded-md bg-background p-3 border"
                >
                  <div className="shrink-0 mt-0.5">
                    {task.agentType === 'autonomous' ? (
                      <IconRocket className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <IconGitBranch className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{task.description}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                      {task.targetDirectory}
                    </p>
                    {task.projectName && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] mt-1 h-4"
                      >
                        {task.projectName}
                      </Badge>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className="shrink-0 gap-1 text-[10px] bg-blue-500/10 text-blue-500 border-blue-500/30"
                  >
                    <IconRefresh className="h-2.5 w-2.5" />
                    Resumable
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="flex flex-1 items-center gap-2 text-xs text-muted-foreground">
            <IconEye className="h-3.5 w-3.5" />
            <span>
              Sessions will resume with full context and conversation history
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleDismiss}
              variant="ghost"
              size="sm"
              disabled={isResuming}
            >
              <IconX className="h-4 w-4 mr-1" />
              Dismiss
            </Button>
            <Button
              onClick={handleReviewTasks}
              variant="outline"
              size="sm"
              disabled={isResuming}
            >
              Review Tasks
            </Button>
            <Button
              onClick={handleResumeAll}
              size="sm"
              disabled={isResuming}
              className="gap-1"
            >
              {isResuming ? (
                <>
                  <IconRefresh className="h-4 w-4 animate-spin" />
                  Resuming...
                </>
              ) : (
                <>
                  <IconPlayerPlay className="h-4 w-4" />
                  Resume All ({interruptedTasks.length})
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
