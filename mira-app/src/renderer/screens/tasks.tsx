/**
 * Tasks Screen
 *
 * Dedicated page for workspace task management with:
 * - Kanban board view (default) for visual task management
 * - Table view for detailed task list
 * - Task execution monitoring
 * - Task creation and management
 * - Output streaming and history
 * - Auto-mode toggle for continuous task execution
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 9.2, 10.1, 11.1, 1.6
 */

import { useState, useCallback, useRef } from 'react'
import { useAppStore } from 'renderer/stores/app-store'
import { useAgentTaskStore } from 'renderer/stores/agent-task-store'
import { useAgentTasks } from 'renderer/hooks/use-agent-tasks'
import { useProject } from 'renderer/hooks/use-projects'
import { ErrorBoundary } from 'renderer/components/ErrorBoundary'
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

function TasksScreenContent(): React.JSX.Element {
  const setActiveView = useAppStore(state => state.setActiveView)
  const activeProjectId = useAppStore(state => state.activeProjectId)
  const previousView = useAppStore(state => state.previousView)
  const { selectedTaskId, setSelectedTask } = useAgentTaskStore()

  // Get project data to access the path
  const { data: project } = useProject(activeProjectId)

  // View mode state (kanban is default)
  const [viewMode, setViewMode] = useState<TasksViewMode>('kanban')

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

  // Panel size persistence - use ref to avoid re-renders during drag
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

  // Save panel size when layout changes - only persist, don't update state
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

  const setActiveProject = useAppStore(state => state.setActiveProject)

  const handleBack = useCallback(() => {
    // Go back to previous view, or fallback based on context
    if (previousView === 'workspace') {
      setActiveView('workspace')
    } else if (previousView === 'dashboard') {
      // Clear project context when going back to dashboard
      setActiveProject(null)
    } else if (activeProjectId) {
      // Default: if we have a project, go to workspace
      setActiveView('workspace')
    } else {
      setActiveProject(null)
    }
  }, [setActiveView, setActiveProject, activeProjectId, previousView])

  const handleGoToWorkspace = useCallback(() => {
    if (activeProjectId) {
      setActiveView('workspace')
    }
  }, [setActiveView, activeProjectId])

  const handleTaskSelect = useCallback(
    (taskId: string | null) => {
      setSelectedTask(taskId)
    },
    [setSelectedTask]
  )

  const handleTaskCreated = useCallback(
    (taskId: string) => {
      setSelectedTask(taskId)
      setShowTaskCreation(false)
    },
    [setSelectedTask]
  )

  const handleOpenTaskCreation = useCallback(() => {
    setShowTaskCreation(true)
  }, [])

  const handleFilterChange = useCallback((newFilters: Partial<TasksFilter>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  return (
    <div className="flex flex-col h-screen bg-background">
      <TasksHeader
        onCreateTask={handleOpenTaskCreation}
        onGoToWorkspace={activeProjectId ? handleGoToWorkspace : undefined}
        onViewModeChange={setViewMode}
        projectPath={project?.path}
        viewMode={viewMode}
      />

      <TasksFilters filters={filters} onFilterChange={handleFilterChange} />

      <ResizablePanelGroup
        className="flex-1"
        id="tasks-screen-layout"
        onLayoutChange={handleLayoutChange}
        orientation="horizontal"
      >
        <ResizablePanel
          defaultSize={selectedTaskId ? 100 - detailPanelSizeRef.current : 100}
          id="tasks-list-panel"
          minSize={30}
        >
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
        </ResizablePanel>

        {selectedTaskId && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel
              defaultSize={detailPanelSizeRef.current}
              id="task-execution-panel"
              minSize={30}
            >
              <TaskExecutionPanel
                onClose={() => handleTaskSelect(null)}
                taskId={selectedTaskId}
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      <TaskCreationDialog
        onOpenChange={setShowTaskCreation}
        onTaskCreated={handleTaskCreated}
        open={showTaskCreation}
      />
    </div>
  )
}

export function TasksScreen(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <TasksScreenContent />
    </ErrorBoundary>
  )
}
