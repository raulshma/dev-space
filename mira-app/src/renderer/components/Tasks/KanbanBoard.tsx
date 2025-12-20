/**
 * Kanban Board Component
 *
 * Jira-like kanban board for task management with columns per status.
 * Supports drag-and-drop to change task status.
 */

import { useMemo, useCallback, useState } from 'react'
import { ScrollArea, ScrollBar } from 'renderer/components/ui/scroll-area'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from 'renderer/components/ui/alert-dialog'
import { IconRocket } from '@tabler/icons-react'
import { useTaskList } from 'renderer/stores/agent-task-store'
import {
  useStartAgentTask,
  usePauseAgentTask,
  useResumeAgentTask,
  useStopAgentTask,
  useDeleteAgentTask,
  useUpdateAgentTask,
} from 'renderer/hooks/use-agent-tasks'
import { useKanbanDnd, isValidTransition } from 'renderer/hooks/use-kanban-dnd'
import { KanbanColumn } from './KanbanColumn'
import type { AgentTask, TaskStatus } from 'shared/ai-types'
import type { TasksFilter } from 'renderer/screens/tasks'

interface KanbanBoardProps {
  filters: TasksFilter
  selectedTaskId: string | null
  onTaskSelect: (taskId: string | null) => void
}

// Define the column order for the kanban board (archived is hidden by default)
const KANBAN_COLUMNS: TaskStatus[] = [
  'pending',
  'queued',
  'running',
  'paused',
  'awaiting_approval',
  'completed',
  'failed',
  'stopped',
]

// Simplified columns for a cleaner view (can be toggled)
const SIMPLIFIED_COLUMNS: TaskStatus[] = ['pending', 'running', 'completed']

export function KanbanBoard({
  filters,
  selectedTaskId,
  onTaskSelect,
}: KanbanBoardProps): React.JSX.Element {
  const tasks = useTaskList()
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<AgentTask | null>(
    null
  )
  const [archiveConfirmTask, setArchiveConfirmTask] =
    useState<AgentTask | null>(null)

  const startTask = useStartAgentTask()
  const pauseTask = usePauseAgentTask()
  const resumeTask = useResumeAgentTask()
  const stopTask = useStopAgentTask()
  const deleteTask = useDeleteAgentTask()
  const updateTask = useUpdateAgentTask()

  // Drag and drop state
  const {
    dragState,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    isDropTarget,
  } = useKanbanDnd()

  // Filter tasks based on filters
  const filteredTasks = useMemo(() => {
    let result = [...tasks]

    // Agent type filter
    if (filters.agentType && filters.agentType !== 'all') {
      result = result.filter(t => t.agentType === filters.agentType)
    }

    // Branch filter
    if (filters.branch && filters.branch !== 'all') {
      result = result.filter(t => t.branchName === filters.branch)
    }

    // Search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      result = result.filter(
        t =>
          t.description.toLowerCase().includes(query) ||
          t.targetDirectory.toLowerCase().includes(query) ||
          t.branchName?.toLowerCase().includes(query)
      )
    }

    return result
  }, [tasks, filters])

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, AgentTask[]> = {
      pending: [],
      queued: [],
      running: [],
      paused: [],
      awaiting_approval: [],
      review: [],
      completed: [],
      failed: [],
      stopped: [],
      archived: [],
    }

    for (const task of filteredTasks) {
      grouped[task.status].push(task)
    }

    // Sort each group by priority (higher first), then by createdAt
    for (const status of Object.keys(grouped) as TaskStatus[]) {
      grouped[status].sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority
        return b.createdAt.getTime() - a.createdAt.getTime()
      })
    }

    return grouped
  }, [filteredTasks])

  // Determine which columns to show based on filter
  const visibleColumns = useMemo(() => {
    if (filters.status && filters.status !== 'all') {
      // Show archived column only when explicitly filtered
      if (filters.status === 'archived') {
        return ['archived'] as TaskStatus[]
      }
      return [filters.status]
    }
    // Show all columns that have tasks, plus always show pending, running, completed
    // Archived is hidden by default unless explicitly filtered
    const columnsWithTasks = KANBAN_COLUMNS.filter(
      status =>
        tasksByStatus[status].length > 0 || SIMPLIFIED_COLUMNS.includes(status)
    )
    return columnsWithTasks
  }, [filters.status, tasksByStatus])

  const handleStart = useCallback(
    async (taskId: string) => {
      try {
        await startTask.mutateAsync(taskId)
      } catch (error) {
        console.error('Failed to start task:', error)
      }
    },
    [startTask]
  )

  const handlePause = useCallback(
    async (taskId: string) => {
      try {
        await pauseTask.mutateAsync(taskId)
      } catch (error) {
        console.error('Failed to pause task:', error)
      }
    },
    [pauseTask]
  )

  const handleResume = useCallback(
    async (taskId: string) => {
      try {
        await resumeTask.mutateAsync(taskId)
      } catch (error) {
        console.error('Failed to resume task:', error)
      }
    },
    [resumeTask]
  )

  const handleStop = useCallback(
    async (taskId: string) => {
      try {
        await stopTask.mutateAsync(taskId)
      } catch (error) {
        console.error('Failed to stop task:', error)
      }
    },
    [stopTask]
  )

  const handleDelete = useCallback(
    async (taskId: string) => {
      try {
        await deleteTask.mutateAsync(taskId)
        setDeleteConfirmTask(null)
        if (selectedTaskId === taskId) {
          onTaskSelect(null)
        }
      } catch (error) {
        console.error('Failed to delete task:', error)
      }
    },
    [deleteTask, selectedTaskId, onTaskSelect]
  )

  const handleTaskSelect = useCallback(
    (taskId: string) => {
      onTaskSelect(taskId)
    },
    [onTaskSelect]
  )

  const handleArchive = useCallback(
    async (taskId: string) => {
      try {
        await updateTask.mutateAsync({
          taskId,
          updates: { status: 'archived' },
        })
        setArchiveConfirmTask(null)
        if (selectedTaskId === taskId) {
          onTaskSelect(null)
        }
      } catch (error) {
        console.error('Failed to archive task:', error)
      }
    },
    [updateTask, selectedTaskId, onTaskSelect]
  )

  // Handle status change via drag-and-drop
  const handleStatusChange = useCallback(
    async (taskId: string, newStatus: TaskStatus) => {
      try {
        await updateTask.mutateAsync({
          taskId,
          updates: { status: newStatus },
        })
      } catch (error) {
        console.error('Failed to update task status:', error)
      }
    },
    [updateTask]
  )

  // Handle drop on a column
  const handleColumnDrop = useCallback(
    (e: React.DragEvent, status: TaskStatus) => {
      const { taskId, sourceStatus } = dragState

      // Validate the transition
      if (taskId && sourceStatus && isValidTransition(sourceStatus, status)) {
        handleStatusChange(taskId, status)
      }

      handleDrop(e, status)
    },
    [dragState, handleDrop, handleStatusChange]
  )

  if (tasks.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center p-8">
        <IconRocket className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium">No tasks yet</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Create your first task to get started with the coding agent
        </p>
      </div>
    )
  }

  return (
    <>
      <ScrollArea className="h-full w-full">
        <div className="flex gap-4 p-4 h-full min-h-[calc(100vh-180px)] min-w-max">
          {visibleColumns.map(status => (
            <KanbanColumn
              canDrop={
                dragState.sourceStatus
                  ? isValidTransition(dragState.sourceStatus, status)
                  : false
              }
              draggingTaskId={dragState.taskId}
              isDropTarget={isDropTarget(status)}
              key={status}
              onArchive={setArchiveConfirmTask}
              onDelete={setDeleteConfirmTask}
              onDragEnd={handleDragEnd}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDragStart={handleDragStart}
              onDrop={handleColumnDrop}
              onPause={handlePause}
              onResume={handleResume}
              onStart={handleStart}
              onStop={handleStop}
              onTaskSelect={handleTaskSelect}
              selectedTaskId={selectedTaskId}
              status={status}
              tasks={tasksByStatus[status]}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <AlertDialog
        onOpenChange={(open: boolean) => !open && setDeleteConfirmTask(null)}
        open={!!deleteConfirmTask}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteConfirmTask && handleDelete(deleteConfirmTask.id)
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        onOpenChange={(open: boolean) => !open && setArchiveConfirmTask(null)}
        open={!!archiveConfirmTask}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive this task? You can view archived
              tasks by filtering by status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                archiveConfirmTask && handleArchive(archiveConfirmTask.id)
              }
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
