/**
 * TasksContent Component
 *
 * Full tasks view for the main content area.
 */

import { useState, useCallback, useRef, memo } from 'react'
import { useAppStore } from 'renderer/stores/app-store'
import { useAgentTaskStore } from 'renderer/stores/agent-task-store'
import { useAgentTasks } from 'renderer/hooks/use-agent-tasks'
import { useProject } from 'renderer/hooks/use-projects'
import {
  TasksHeader,
  type TasksViewMode,
} from 'renderer/components/Tasks/TasksHeader'
import { TasksFilters } from 'renderer/components/Tasks/TasksFilters'
import { TasksTable } from 'renderer/components/Tasks/TasksTable'
import { KanbanBoard } from 'renderer/components/Tasks/KanbanBoard'
import { TaskExecutionPanel } from 'renderer/components/Tasks/TaskExecutionPanel'
import { TaskCreationDialog } from 'renderer/components/Agent/TaskCreationDialog'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from 'renderer/components/ui/resizable'
import type { TaskStatus, AgentType } from 'shared/ai-types'

const TASK_PANEL_SIZE_KEY = 'mira:task-detail-panel-size'
const DEFAULT_PANEL_SIZE = 50

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
  const { selectedTaskId, setSelectedTask } = useAgentTaskStore()

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

  // Panel size persistence
  const detailPanelSizeRef = useRef<number>(DEFAULT_PANEL_SIZE)
  const initializedRef = useRef(false)
  if (!initializedRef.current) {
    initializedRef.current = true
    const saved = localStorage.getItem(TASK_PANEL_SIZE_KEY)
    if (saved) {
      const size = Number.parseFloat(saved)
      if (!Number.isNaN(size) && size >= 20 && size <= 80) {
        detailPanelSizeRef.current = size
      }
    }
  }

  const handleLayoutChange = useCallback(
    (layout: { [panelId: string]: number }) => {
      const panelSize = layout['task-execution-panel']
      if (typeof panelSize === 'number' && panelSize > 0) {
        detailPanelSizeRef.current = panelSize
        localStorage.setItem(TASK_PANEL_SIZE_KEY, String(panelSize))
      }
    },
    []
  )

  // Load tasks
  useAgentTasks()

  const handleBack = useCallback(() => {
    setActiveView('workspace')
  }, [setActiveView])

  const handleTaskCreated = useCallback(
    (taskId: string) => {
      setSelectedTask(taskId)
      setShowTaskCreation(false)
    },
    [setSelectedTask]
  )

  const handleFilterChange = useCallback((newFilters: Partial<TasksFilter>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  const handleTaskSelect = useCallback(
    (taskId: string | null) => {
      setSelectedTask(taskId)
    },
    [setSelectedTask]
  )

  const handleGoToWorkspace = useCallback(() => {
    setActiveView('workspace')
  }, [setActiveView])

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <TasksHeader
        onCreateTask={() => setShowTaskCreation(true)}
        onGoToWorkspace={activeProjectId ? handleGoToWorkspace : undefined}
        onViewModeChange={setViewMode}
        projectPath={project?.path}
        viewMode={viewMode}
      />

      {/* Filters */}
      <TasksFilters filters={filters} onFilterChange={handleFilterChange} />

      {/* Content */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup
          className="h-full"
          onLayoutChange={handleLayoutChange}
          orientation="horizontal"
        >
          {/* Task list/board */}
          <ResizablePanel
            defaultSize={
              selectedTaskId ? 100 - detailPanelSizeRef.current : 100
            }
            id="task-list-panel"
            minSize={30}
          >
            <div className="h-full overflow-auto p-4">
              {viewMode === 'kanban' ? (
                <KanbanBoard
                  filters={filters}
                  onTaskSelect={handleTaskSelect}
                  selectedTaskId={selectedTaskId}
                />
              ) : (
                <TasksTable
                  filters={filters}
                  onTaskSelect={handleTaskSelect}
                  selectedTaskId={selectedTaskId}
                />
              )}
            </div>
          </ResizablePanel>

          {/* Task detail panel */}
          {selectedTaskId && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel
                defaultSize={detailPanelSizeRef.current}
                id="task-execution-panel"
                minSize={25}
              >
                <TaskExecutionPanel
                  onClose={() => setSelectedTask(null)}
                  taskId={selectedTaskId}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

      {/* Task creation dialog */}
      <TaskCreationDialog
        defaultDirectory={project?.path}
        onOpenChange={setShowTaskCreation}
        onTaskCreated={handleTaskCreated}
        open={showTaskCreation}
      />
    </div>
  )
})
