/**
 * Tasks Header Component
 *
 * Header for the tasks page with navigation and actions
 */

import { memo } from 'react'
import { Button } from 'renderer/components/ui/button'
import { Badge } from 'renderer/components/ui/badge'
import {
  IconArrowLeft,
  IconPlus,
  IconRocket,
  IconLoader2,
} from '@tabler/icons-react'
import { useTaskList, useCurrentTask } from 'renderer/stores/agent-task-store'

interface TasksHeaderProps {
  onBack: () => void
  onCreateTask: () => void
}

export const TasksHeader = memo(function TasksHeader({
  onBack,
  onCreateTask,
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
