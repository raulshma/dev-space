/**
 * Tasks Screen
 *
 * Dedicated page for workspace task management with:
 * - Kanban board view (default) for visual task management
 * - Table view for detailed task list
 * - Task execution monitoring with tabbed interface
 * - Task creation and management
 * - Output streaming and history
 * - Auto-mode toggle for continuous task execution
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 9.2, 10.1, 11.1, 1.6
 */

import { useState, useCallback, useRef } from 'react'
import { useAppStore } from 'renderer/stores/app-store'
import { useAgentTaskStore } from 'renderer/stores/agent-task-store'
import { useAgentTasks, useTaskStatusSubscription } from 'renderer/hooks/use-agent-tasks'
import { useProject } from 'renderer/hooks/use-projects'
import { ErrorBoundary } from 'renderer/components/ErrorBoundary'
import {
  TasksHeader,
  type TasksViewMode,
} from 'renderer/components/Tasks/TasksHeader'
import { TasksFilters } from 'renderer/components/Tasks/TasksFilters'
import { TasksTable } from 'renderer/components/Tasks/TasksTable'
import { KanbanBoard } from 'renderer/components/Tasks/KanbanBoard'
import { TaskDetailsRow } from 'renderer/components/Tasks/TaskDetailsRow'
import { TaskCreationDialog } from 'renderer/components/Agent/TaskCreationDialog'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from 'renderer/components/ui/resizable'
import type { TaskStatus, AgentType } from 'shared/ai-types'

const TASK_DETAILS_SIZE_KEY = 'mira:task-details-row-size'
const DEFAULT_DETAILS_SIZE = 50

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
  const { openTaskTabs, openTaskTab } = useAgentTaskStore()

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

  // Save panel size when layout changes - only persist, don't update state
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

  // Load tasks
  useAgentTasks()

  // Subscribe to real-time task status updates for instant header updates
  useTaskStatusSubscription()

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
      if (taskId) {
        openTaskTab(taskId)
      }
    },
    [openTaskTab]
  )

  const handleTaskCreated = useCallback(
    (taskId: string) => {
      openTaskTab(taskId)
      setShowTaskCreation(false)
    },
    [openTaskTab]
  )

  const handleOpenTaskCreation = useCallback(() => {
    setShowTaskCreation(true)
  }, [])

  const handleFilterChange = useCallback((newFilters: Partial<TasksFilter>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  const hasOpenTabs = openTaskTabs.length > 0

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
        orientation="vertical"
      >
        <ResizablePanel
          defaultSize={hasOpenTabs ? 100 - detailsSizeRef.current : 100}
          id="tasks-list-panel"
          minSize={20}
        >
          <div className="h-full overflow-auto">
            {viewMode === 'kanban' ? (
              <KanbanBoard
                filters={filters}
                onTaskSelect={handleTaskSelect}
                selectedTaskId={null}
              />
            ) : (
              <TasksTable
                filters={filters}
                onTaskSelect={handleTaskSelect}
                selectedTaskId={null}
              />
            )}
          </div>
        </ResizablePanel>

        {hasOpenTabs && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel
              defaultSize={detailsSizeRef.current}
              id="task-details-row"
              minSize={20}
            >
              <TaskDetailsRow className="h-full" />
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
