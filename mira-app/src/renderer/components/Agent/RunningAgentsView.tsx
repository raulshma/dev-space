/**
 * Running Agents View Component
 *
 * Global view showing all running agent tasks across all projects.
 * Displays task cards with stop functionality and project navigation.
 * Auto-refreshes every 2 seconds.
 * Requirements: 2.1, 2.6
 */

import { useEffect, useState, useCallback, memo } from 'react'
import { useAppStore } from 'renderer/stores/app-store'
import {
  useRunningTasksStore,
  useRunningTasks,
  useRunningTasksLoading,
  useRunningTasksError,
} from 'renderer/stores/running-tasks-store'
import { RunningTaskCard } from './RunningTaskCard'
import { Button } from 'renderer/components/ui/button'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from 'renderer/components/ui/empty'
import {
  IconArrowLeft,
  IconRefresh,
  IconRobot,
  IconLoader2,
  IconAlertCircle,
} from '@tabler/icons-react'
import { ScrollArea } from 'renderer/components/ui/scroll-area'

interface RunningAgentsViewProps {
  onBack?: () => void
  compact?: boolean
}

export const RunningAgentsView = memo(function RunningAgentsView({
  onBack,
  compact = false,
}: RunningAgentsViewProps): React.JSX.Element {
  const tasks = useRunningTasks() ?? []
  const isLoading = useRunningTasksLoading()
  const error = useRunningTasksError()
  const { refreshTasks, stopTask, startPolling, stopPolling } =
    useRunningTasksStore()

  const setActiveProject = useAppStore(state => state.setActiveProject)

  // Track which task is being stopped
  const [stoppingTaskId, setStoppingTaskId] = useState<string | null>(null)

  // Start polling on mount, stop on unmount
  useEffect(() => {
    startPolling(2000)
    return () => {
      stopPolling()
    }
  }, [startPolling, stopPolling])

  const handleStop = useCallback(
    async (taskId: string) => {
      setStoppingTaskId(taskId)
      try {
        await stopTask(taskId)
      } finally {
        setStoppingTaskId(null)
      }
    },
    [stopTask]
  )

  const handleViewProject = useCallback(
    (projectPath: string) => {
      // Find project by path and navigate to it
      window.api.projects.list({}).then(response => {
        const project = response.projects.find(p => p.path === projectPath)
        if (project) {
          setActiveProject(project.id)
        }
      })
    },
    [setActiveProject]
  )

  const handleRefresh = useCallback(() => {
    refreshTasks()
  }, [refreshTasks])

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack()
    } else {
      // Default: go back to dashboard
      setActiveProject(null)
    }
  }, [onBack, setActiveProject])

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header - only show in non-compact mode */}
      {!compact && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <Button
              className="h-8 w-8 p-0"
              onClick={handleBack}
              size="sm"
              variant="ghost"
            >
              <IconArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <IconRobot className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">Running Agents</h1>
              {tasks.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  ({tasks.length})
                </span>
              )}
            </div>
          </div>
          <Button
            className="h-8 px-2"
            disabled={isLoading}
            onClick={handleRefresh}
            size="sm"
            variant="ghost"
          >
            {isLoading ? (
              <IconLoader2 className="h-4 w-4 animate-spin" />
            ) : (
              <IconRefresh className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className={compact ? 'p-2' : 'p-4'}>
          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-md bg-destructive/10 text-destructive text-sm">
              <IconAlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {tasks.length === 0 ? (
            <Empty className={compact ? 'min-h-[200px]' : 'min-h-[400px]'}>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <IconRobot className="h-5 w-5" />
                </EmptyMedia>
                <EmptyTitle>No Running Agents</EmptyTitle>
                {!compact && (
                  <EmptyDescription>
                    There are no agent tasks currently running. Start a task
                    from a project's task board to see it here.
                  </EmptyDescription>
                )}
              </EmptyHeader>
            </Empty>
          ) : (
            <div
              className={
                compact
                  ? 'flex flex-col gap-2'
                  : 'grid gap-3 md:grid-cols-2 lg:grid-cols-3'
              }
            >
              {tasks.map(task => (
                <RunningTaskCard
                  compact={compact}
                  isStoppingTask={stoppingTaskId === task.taskId}
                  key={task.taskId}
                  onStop={handleStop}
                  onViewProject={handleViewProject}
                  task={task}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
})
