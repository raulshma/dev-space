/**
 * Tasks Screen
 *
 * Dedicated page for workspace task management with:
 * - Full task list with filtering and sorting
 * - Task execution monitoring
 * - Task creation and management
 * - Output streaming and history
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 9.2, 10.1, 11.1
 */

import { useState, useCallback } from 'react'
import { useAppStore } from 'renderer/stores/app-store'
import { useAgentTaskStore } from 'renderer/stores/agent-task-store'
import { useAgentTasks } from 'renderer/hooks/use-agent-tasks'
import { ErrorBoundary } from 'renderer/components/ErrorBoundary'
import { TasksHeader } from 'renderer/components/Tasks/TasksHeader'
import { TasksFilters } from 'renderer/components/Tasks/TasksFilters'
import { TasksTable } from 'renderer/components/Tasks/TasksTable'
import { TaskExecutionPanel } from 'renderer/components/Tasks/TaskExecutionPanel'
import { TaskCreationDialog } from 'renderer/components/Agent/TaskCreationDialog'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from 'renderer/components/ui/resizable'
import type { TaskStatus, AgentType } from 'shared/ai-types'

export interface TasksFilter {
  status?: TaskStatus | 'all'
  agentType?: AgentType | 'all'
  searchQuery?: string
  sortBy?: 'createdAt' | 'status' | 'priority'
  sortOrder?: 'asc' | 'desc'
}

function TasksScreenContent(): React.JSX.Element {
  const setActiveView = useAppStore(state => state.setActiveView)
  const activeProjectId = useAppStore(state => state.activeProjectId)
  const { selectedTaskId, setSelectedTask } = useAgentTaskStore()

  // Filter state
  const [filters, setFilters] = useState<TasksFilter>({
    status: 'all',
    agentType: 'all',
    searchQuery: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  })

  // Dialog state
  const [showTaskCreation, setShowTaskCreation] = useState(false)

  // Load tasks
  useAgentTasks()

  const handleBack = useCallback(() => {
    // If we came from a workspace, go back to it; otherwise go to dashboard
    if (activeProjectId) {
      setActiveView('workspace')
    } else {
      setActiveView('dashboard')
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
      <TasksHeader onBack={handleBack} onCreateTask={handleOpenTaskCreation} />

      <TasksFilters filters={filters} onFilterChange={handleFilterChange} />

      <ResizablePanelGroup
        autoSaveId="tasks-screen-layout"
        className="flex-1"
        direction="horizontal"
      >
        <ResizablePanel
          defaultSize={selectedTaskId ? 50 : 100}
          id="tasks-list-panel"
          minSize={30}
        >
          <TasksTable
            filters={filters}
            onTaskSelect={handleTaskSelect}
            selectedTaskId={selectedTaskId}
          />
        </ResizablePanel>

        {selectedTaskId && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel
              defaultSize={50}
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
