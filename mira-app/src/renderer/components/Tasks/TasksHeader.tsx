/**
 * Tasks Header Component
 *
 * Header for the tasks page with navigation and actions
 */

import { memo } from 'react'
import { Button } from 'renderer/components/ui/button'
import { Badge } from 'renderer/components/ui/badge'
import { ButtonGroup } from 'renderer/components/ui/button-group'
import {
  IconArrowLeft,
  IconPlus,
  IconRocket,
  IconLoader2,
  IconLayoutKanban,
  IconTable,
  IconFolderOpen,
} from '@tabler/icons-react'
import { useTaskList, useCurrentTask } from 'renderer/stores/agent-task-store'

export type TasksViewMode = 'table' | 'kanban'

interface TasksHeaderProps {
  onBack: () => void
  onCreateTask: () => void
  onGoToWorkspace?: () => void
  viewMode?: TasksViewMode
  onViewModeChange?: (mode: TasksViewMode) => void
}

export const TasksHeader = memo(function TasksHeader({
  onBack,
  onCreateTask,
  onGoToWorkspace,
  viewMode = 'kanban',
  onViewModeChange,
}: TasksHeaderProps): React.JSX.Element {
  const tasks = useTaskList()
  const currentTask = useCurrentTask()

  const pendingCount = tasks.filter(t => t.status === 'pending').length
  const runningCount = tasks.filter(
    t => t.status === 'running' || t.status === 'paused'
  ).length
  const completedCount = tasks.filter(t => t.status === 'completed').length

  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button onClick={onBack} size="sm" variant="ghost">
            <IconArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          {onGoToWorkspace && (
            <Button onClick={onGoToWorkspace} size="sm" variant="outline">
              <IconFolderOpen className="h-4 w-4 mr-2" />
              Go to Workspace
            </Button>
          )}
          <div className="flex items-center gap-3">
            <IconRocket className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                Workspace Tasks
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage and monitor agent task execution
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Task stats */}
          <div className="flex items-center gap-2">
            {runningCount > 0 && (
              <Badge className="gap-1" variant="default">
                <IconLoader2 className="h-3 w-3 animate-spin" />
                {runningCount} Running
              </Badge>
            )}
            {pendingCount > 0 && (
              <Badge variant="secondary">{pendingCount} Pending</Badge>
            )}
            <Badge variant="outline">{completedCount} Completed</Badge>
            <Badge variant="outline">{tasks.length} Total</Badge>
          </div>

          {/* View mode toggle */}
          {onViewModeChange && (
            <ButtonGroup>
              <Button
                aria-label="Kanban view"
                onClick={() => onViewModeChange('kanban')}
                size="sm"
                variant={viewMode === 'kanban' ? 'default' : 'outline'}
              >
                <IconLayoutKanban className="h-4 w-4" />
              </Button>
              <Button
                aria-label="Table view"
                onClick={() => onViewModeChange('table')}
                size="sm"
                variant={viewMode === 'table' ? 'default' : 'outline'}
              >
                <IconTable className="h-4 w-4" />
              </Button>
            </ButtonGroup>
          )}

          <Button onClick={onCreateTask}>
            <IconPlus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>

      {/* Current task indicator */}
      {currentTask && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <IconLoader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-muted-foreground">Currently executing:</span>
          <span className="font-medium truncate max-w-md">
            {currentTask.description}
          </span>
        </div>
      )}
    </header>
  )
})
