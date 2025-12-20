/**
 * TasksSidebarPanel Component
 *
 * Sidebar panel for viewing and managing agent tasks.
 */

import { useState, useCallback, memo } from 'react'
import { IconPlus, IconRocket } from '@tabler/icons-react'
import { useAgentTaskStore } from 'renderer/stores/agent-task-store'
import { useAgentTasks } from 'renderer/hooks/use-agent-tasks'
import { useProject } from 'renderer/hooks/use-projects'
import { TaskBacklogList } from 'renderer/components/Agent/TaskBacklogList'
import { TaskCreationDialog } from 'renderer/components/Agent/TaskCreationDialog'
import { Button } from 'renderer/components/ui/button'
import { useAppStore } from 'renderer/stores/app-store'
import type { AgentTask } from 'shared/ai-types'

interface TasksSidebarPanelProps {
  projectId: string | null
}

export const TasksSidebarPanel = memo(function TasksSidebarPanel({
  projectId,
}: TasksSidebarPanelProps) {
  const [showTaskCreation, setShowTaskCreation] = useState(false)
  const { setSelectedTask } = useAgentTaskStore()
  const setActiveView = useAppStore(state => state.setActiveView)

  // Get project data to access the path
  const { data: project } = useProject(projectId)

  // Load tasks for the active project
  useAgentTasks(projectId ? { projectId } : undefined)

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
    },
    [setSelectedTask]
  )

  const handleEditTask = useCallback(
    (task: AgentTask) => {
      setSelectedTask(task.id)
      setActiveView('tasks')
    },
    [setSelectedTask, setActiveView]
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-sm font-medium flex items-center gap-2">
          <IconRocket className="size-4" />
          Tasks
        </span>
        <div className="flex items-center gap-1">
          <Button
            className="h-7 text-xs"
            onClick={() => setActiveView('tasks')}
            size="sm"
            variant="ghost"
          >
            View All
          </Button>
          <Button
            className="size-6 p-0"
            onClick={() => setShowTaskCreation(true)}
            size="sm"
            title="New task"
            variant="ghost"
          >
            <IconPlus className="size-4" />
          </Button>
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 scrollbar-gutter-stable">
        <TaskBacklogList
          onEditTask={handleEditTask}
          onTaskSelect={handleTaskSelect}
        />
      </div>

      {/* Task creation dialog */}
      <TaskCreationDialog
        defaultDirectory={project?.path}
        onOpenChange={setShowTaskCreation}
        onTaskCreated={handleTaskCreated}
        open={showTaskCreation}
        projectId={projectId ?? undefined}
        projectName={project?.name}
      />
    </div>
  )
})
