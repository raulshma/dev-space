/**
 * SecondarySidebar Component
 *
 * Right sidebar for agent tasks and contextual panels.
 */

import { useState, useCallback, memo } from 'react'
import { IconRobot, IconPlus } from '@tabler/icons-react'
import { useAgentTaskStore } from 'renderer/stores/agent-task-store'
import { useAgentTasks } from 'renderer/hooks/use-agent-tasks'
import { useProject } from 'renderer/hooks/use-projects'
import { TaskBacklogList } from 'renderer/components/Agent/TaskBacklogList'
import { TaskDetailView } from 'renderer/components/Agent/TaskDetailView'
import { TaskCompletionView } from 'renderer/components/Agent/TaskCompletionView'
import { TaskCreationDialog } from 'renderer/components/Agent/TaskCreationDialog'
import { Button } from 'renderer/components/ui/button'
import { useAppStore } from 'renderer/stores/app-store'
import type { AgentTask } from 'shared/ai-types'

interface SecondarySidebarProps {
  projectId: string | null
}

export const SecondarySidebar = memo(function SecondarySidebar({
  projectId,
}: SecondarySidebarProps) {
  const [taskView, setTaskView] = useState<'list' | 'detail' | 'completion'>(
    'list'
  )
  const [showTaskCreation, setShowTaskCreation] = useState(false)
  const { selectedTaskId, setSelectedTask } = useAgentTaskStore()
  const setActiveView = useAppStore(state => state.setActiveView)

  // Get project data to access the path
  const { data: project } = useProject(projectId)

  // Load tasks
  useAgentTasks()

  const handleTaskSelect = useCallback(
    (taskId: string) => {
      setSelectedTask(taskId)
      setActiveView('tasks')
    },
    [setSelectedTask, setActiveView]
  )

  const handleTaskCreated = useCallback(
    (taskId: string) => {
      setSelectedTask(taskId)
      setTaskView('list')
    },
    [setSelectedTask]
  )

  const handleBackToTaskList = useCallback(() => {
    setTaskView('list')
    setSelectedTask(null)
  }, [setSelectedTask])

  const handleEditTask = useCallback(
    (task: AgentTask) => {
      setSelectedTask(task.id)
      setActiveView('tasks')
    },
    [setSelectedTask, setActiveView]
  )

  return (
    <aside className="h-full flex flex-col overflow-hidden bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-sm font-medium flex items-center gap-2">
          <IconRobot className="h-4 w-4" />
          Agent Tasks
        </span>
      </div>

      {/* Sub-header with actions */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        {taskView !== 'list' && (
          <Button
            className="text-xs h-6"
            onClick={handleBackToTaskList}
            size="sm"
            variant="ghost"
          >
            ← Back
          </Button>
        )}
        {taskView === 'list' && (
          <>
            <span className="text-xs text-muted-foreground">Recent Tasks</span>
            <div className="flex items-center gap-1">
              <Button
                className="text-xs h-6"
                onClick={() => setActiveView('tasks')}
                size="sm"
                variant="ghost"
              >
                View All
              </Button>
              <Button
                className="h-6 w-6"
                onClick={() => setShowTaskCreation(true)}
                size="icon-sm"
                title="New task"
                variant="ghost"
              >
                <IconPlus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {taskView === 'list' && (
          <TaskBacklogList
            onEditTask={handleEditTask}
            onTaskSelect={handleTaskSelect}
          />
        )}
        {taskView === 'detail' && selectedTaskId && (
          <TaskDetailView
            onBack={handleBackToTaskList}
            taskId={selectedTaskId}
          />
        )}
        {taskView === 'completion' && selectedTaskId && (
          <TaskCompletionView
            onBack={handleBackToTaskList}
            onViewOutput={() => setTaskView('detail')}
            taskId={selectedTaskId}
          />
        )}
      </div>

      {/* Task creation dialog */}
      <TaskCreationDialog
        defaultDirectory={project?.path}
        onOpenChange={setShowTaskCreation}
        onTaskCreated={handleTaskCreated}
        open={showTaskCreation}
      />
    </aside>
  )
})
