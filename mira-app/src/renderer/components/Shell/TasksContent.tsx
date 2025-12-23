/**
 * TasksContent Component
 *
 * Full tasks view for the main content area.
 * Uses a vertical layout with task list/board on top and task details row at bottom.
 */

import { useState, useCallback, useRef, memo } from 'react'
import { useAppStore } from 'renderer/stores/app-store'
import { useAgentTaskStore } from 'renderer/stores/agent-task-store'
import { useAgentTasks } from 'renderer/hooks/use-agent-tasks'
import { useProject } from 'renderer/hooks/use-projects'
import { TasksHeader } from 'renderer/components/Tasks/TasksHeader'
import { TasksFilters } from 'renderer/components/Tasks/TasksFilters'
import { TasksTable } from 'renderer/components/Tasks/TasksTable'
import { KanbanBoard } from 'renderer/components/Tasks/KanbanBoard'
import { TaskDetailsRow } from 'renderer/components/Tasks/TaskDetailsRow'
import { TaskCreationDialog, TaskEditDialog } from 'renderer/components/Agent'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from 'renderer/components/ui/resizable'
import type { TaskStatus, AgentType, AgentTask } from 'shared/ai-types'

const TASK_DETAILS_SIZE_KEY = 'mira:task-details-row-size'
const DEFAULT_DETAILS_SIZE = 50
const EXPANDED_DETAILS_SIZE_KEY = 'mira:task-details-expanded'

export interface TasksFilter {
  status?: TaskStatus | 'all'
  agentType?: AgentType | 'all'
  searchQuery?: string
  sortBy?: 'createdAt' | 'status' | 'priority'
  sortOrder?: 'asc' | 'desc'
  branch?: string | 'all'
}

export const TasksContent = memo(function TasksContent(): React.JSX.Element {
  const setActiveView = useAppStore(state => state.setActiveView)
  const activeProjectId = useAppStore(state => state.activeProjectId)
  const viewMode = useAppStore(state => state.tasksViewMode)
  const setViewMode = useAppStore(state => state.setTasksViewMode)
  const { openTaskTabs, openTaskTab } = useAgentTaskStore()

  // Get project data
  const { data: project } = useProject(activeProjectId)

  // Filter state
  const [filters, setFilters] = useState<TasksFilter>({
    status: 'all',
    agentType: 'all',
    searchQuery: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    branch: 'all',
  })

  // Dialog state
  const [showTaskCreation, setShowTaskCreation] = useState(false)
  const [editingTask, setEditingTask] = useState<AgentTask | null>(null)

  // Task details expanded state (full window)
  const [isTaskDetailsExpanded, setIsTaskDetailsExpanded] = useState(() => {
    const saved = localStorage.getItem(EXPANDED_DETAILS_SIZE_KEY)
    return saved === 'true'
  })

  // Panel size persistence
  const detailsSizeRef = useRef<number>(DEFAULT_DETAILS_SIZE)
  const initializedRef = useRef(false)
  if (!initializedRef.current) {
    initializedRef.current = true
    const saved = localStorage.getItem(TASK_DETAILS_SIZE_KEY)
    if (saved) {
      const size = Number.parseFloat(saved)
      if (!Number.isNaN(size) && size >= 20 && size <= 80) {
        detailsSizeRef.current = size
      }
    }
  }

  const handleLayoutChange = useCallback(
    (layout: { [panelId: string]: number }) => {
      const panelSize = layout['task-details-row']
      if (typeof panelSize === 'number' && panelSize > 0) {
        detailsSizeRef.current = panelSize
        localStorage.setItem(TASK_DETAILS_SIZE_KEY, String(panelSize))
      }
    },
    []
  )

  // Load tasks for the active project
  useAgentTasks(activeProjectId ? { projectId: activeProjectId } : undefined)

  const handleTaskCreated = useCallback(
    (taskId: string) => {
      openTaskTab(taskId)
      setShowTaskCreation(false)
    },
    [openTaskTab]
  )

  const handleEditTask = useCallback(
    (task: AgentTask) => {
      setEditingTask(task)
    },
    []
  )

  const handleTaskUpdated = useCallback(() => {
    setEditingTask(null)
  }, [])

  const handleFilterChange = useCallback((newFilters: Partial<TasksFilter>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  const handleTaskSelect = useCallback(
    (taskId: string | null) => {
      if (taskId) {
        openTaskTab(taskId)
      }
    },
    [openTaskTab]
  )

  const handleGoToWorkspace = useCallback(() => {
    setActiveView('workspace')
  }, [setActiveView])

  const handleToggleTaskDetailsExpand = useCallback(() => {
    setIsTaskDetailsExpanded(prev => {
      const newValue = !prev
      localStorage.setItem(EXPANDED_DETAILS_SIZE_KEY, String(newValue))
      return newValue
    })
  }, [])

  const hasOpenTabs = openTaskTabs.length > 0

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <TasksHeader
        onCreateTask={() => setShowTaskCreation(true)}
        onGoToWorkspace={activeProjectId ? handleGoToWorkspace : undefined}
        onViewModeChange={setViewMode}
        projectPath={project?.path}
        viewMode={viewMode}
      />

      {/* When expanded, show only the task details */}
      {hasOpenTabs && isTaskDetailsExpanded ? (
        <div className="flex-1 overflow-hidden">
          <TaskDetailsRow
            className="h-full"
            isExpanded={isTaskDetailsExpanded}
            onToggleExpand={handleToggleTaskDetailsExpand}
          />
        </div>
      ) : (
        <>
          {/* Filters */}
          <TasksFilters filters={filters} onFilterChange={handleFilterChange} />

          {/* Content with vertical split */}
          <div className="flex-1 min-h-0">
            <ResizablePanelGroup
              className="h-full"
              onLayoutChange={handleLayoutChange}
              orientation="vertical"
            >
              {/* Task list/board */}
              <ResizablePanel
                defaultSize={hasOpenTabs ? 100 - detailsSizeRef.current : 100}
                id="task-list-panel"
                minSize={20}
              >
                <div className="h-full overflow-auto p-4">
                  {viewMode === 'kanban' ? (
                    <KanbanBoard
                      filters={filters}
                      onEditTask={handleEditTask}
                      onTaskSelect={handleTaskSelect}
                      selectedTaskId={null}
                    />
                  ) : (
                    <TasksTable
                      filters={filters}
                      onEditTask={handleEditTask}
                      onTaskSelect={handleTaskSelect}
                      selectedTaskId={null}
                    />
                  )}
                </div>
              </ResizablePanel>

              {/* Task details row */}
              {hasOpenTabs && (
                <>
                  <ResizableHandle withHandle />
                  <ResizablePanel
                    defaultSize={detailsSizeRef.current}
                    id="task-details-row"
                    minSize={20}
                  >
                    <TaskDetailsRow
                      className="h-full"
                      isExpanded={isTaskDetailsExpanded}
                      onToggleExpand={handleToggleTaskDetailsExpand}
                    />
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </div>
        </>
      )}

      {/* Task creation dialog */}
      <TaskCreationDialog
        defaultDirectory={project?.path}
        onOpenChange={setShowTaskCreation}
        onTaskCreated={handleTaskCreated}
        open={showTaskCreation}
        projectId={activeProjectId ?? undefined}
        projectName={project?.name}
      />

      {/* Task edit dialog */}
      <TaskEditDialog
        onOpenChange={open => !open && setEditingTask(null)}
        onTaskUpdated={handleTaskUpdated}
        open={!!editingTask}
        task={editingTask}
      />
    </div>
  )
})
