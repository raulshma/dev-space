/**
 * Tasks Table Component
 *
 * Full-featured task list with sorting, filtering, and actions
 */

import { useMemo, useCallback, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'renderer/components/ui/table'
import { Button } from 'renderer/components/ui/button'
import { Badge } from 'renderer/components/ui/badge'
import { ScrollArea } from 'renderer/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'renderer/components/ui/dropdown-menu'
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
import {
  IconDotsVertical,
  IconPlayerPlay,
  IconPlayerPause,
  IconPlayerStop,
  IconTrash,
  IconRocket,
  IconGitBranch,
  IconClock,
  IconCheck,
  IconX,
  IconLoader2,
  IconAlertTriangle,
  IconRefresh,
  IconArchive,
} from '@tabler/icons-react'
import { useTaskList } from 'renderer/stores/agent-task-store'
import {
  useStartAgentTask,
  usePauseAgentTask,
  useResumeAgentTask,
  useStopAgentTask,
  useDeleteAgentTask,
} from 'renderer/hooks/use-agent-tasks'
import type { AgentTask, TaskStatus } from 'shared/ai-types'
import type { TasksFilter } from 'renderer/screens/tasks'

interface TasksTableProps {
  filters: TasksFilter
  selectedTaskId: string | null
  onTaskSelect: (taskId: string | null) => void
}

const STATUS_CONFIG: Record<
  TaskStatus,
  {
    label: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
    icon: React.ReactNode
  }
> = {
  pending: {
    label: 'Pending',
    variant: 'outline',
    icon: <IconClock className="h-3 w-3" />,
  },
  queued: {
    label: 'Queued',
    variant: 'secondary',
    icon: <IconClock className="h-3 w-3" />,
  },
  running: {
    label: 'Running',
    variant: 'default',
    icon: <IconLoader2 className="h-3 w-3 animate-spin" />,
  },
  paused: {
    label: 'Paused',
    variant: 'secondary',
    icon: <IconPlayerPause className="h-3 w-3" />,
  },
  completed: {
    label: 'Completed',
    variant: 'secondary',
    icon: <IconCheck className="h-3 w-3" />,
  },
  failed: {
    label: 'Failed',
    variant: 'destructive',
    icon: <IconX className="h-3 w-3" />,
  },
  stopped: {
    label: 'Stopped',
    variant: 'outline',
    icon: <IconPlayerStop className="h-3 w-3" />,
  },
  archived: {
    label: 'Archived',
    variant: 'outline',
    icon: <IconArchive className="h-3 w-3" />,
  },
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(start: Date, end?: Date): string {
  const endTime = end || new Date()
  const diffMs = endTime.getTime() - start.getTime()
  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

export function TasksTable({
  filters,
  selectedTaskId,
  onTaskSelect,
}: TasksTableProps): React.JSX.Element {
  const tasks = useTaskList()
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<AgentTask | null>(
    null
  )

  const startTask = useStartAgentTask()
  const pauseTask = usePauseAgentTask()
  const resumeTask = useResumeAgentTask()
  const stopTask = useStopAgentTask()
  const deleteTask = useDeleteAgentTask()

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    let result = [...tasks]

    // Status filter
    if (filters.status && filters.status !== 'all') {
      result = result.filter(t => t.status === filters.status)
    }

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
          (t.branchName && t.branchName.toLowerCase().includes(query))
      )
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0
      switch (filters.sortBy) {
        case 'status':
          comparison = a.status.localeCompare(b.status)
          break
        case 'priority':
          comparison = b.priority - a.priority
          break
        default:
          comparison = b.createdAt.getTime() - a.createdAt.getTime()
      }
      return filters.sortOrder === 'asc' ? -comparison : comparison
    })

    return result
  }, [tasks, filters])

  const handleStartTask = useCallback(
    async (taskId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        await startTask.mutateAsync(taskId)
      } catch (error) {
        console.error('Failed to start task:', error)
      }
    },
    [startTask]
  )

  const handlePauseTask = useCallback(
    async (taskId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        await pauseTask.mutateAsync(taskId)
      } catch (error) {
        console.error('Failed to pause task:', error)
      }
    },
    [pauseTask]
  )

  const handleResumeTask = useCallback(
    async (taskId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        await resumeTask.mutateAsync(taskId)
      } catch (error) {
        console.error('Failed to resume task:', error)
      }
    },
    [resumeTask]
  )

  const handleStopTask = useCallback(
    async (taskId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        await stopTask.mutateAsync(taskId)
      } catch (error) {
        console.error('Failed to stop task:', error)
      }
    },
    [stopTask]
  )

  const handleDeleteTask = useCallback(
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

  const canStart = (task: AgentTask): boolean =>
    task.status === 'pending' || task.status === 'queued'
  const canPause = (task: AgentTask): boolean => task.status === 'running'
  const canResume = (task: AgentTask): boolean => task.status === 'paused'
  const canStop = (task: AgentTask): boolean =>
    task.status === 'running' || task.status === 'paused'
  const canDelete = (task: AgentTask): boolean =>
    task.status !== 'running' && task.status !== 'paused'

  if (filteredTasks.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center p-8">
        <IconRocket className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium">No tasks found</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          {tasks.length === 0
            ? 'Create your first task to get started with the coding agent'
            : 'Try adjusting your filters to see more tasks'}
        </p>
      </div>
    )
  }

  return (
    <>
      <ScrollArea className="h-full">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[80px]">Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[200px]">Directory</TableHead>
              <TableHead className="w-[120px]">Created</TableHead>
              <TableHead className="w-[100px]">Duration</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTasks.map(task => {
              const statusConfig = STATUS_CONFIG[task.status]
              const isSelected = selectedTaskId === task.id

              return (
                <TableRow
                  className={`cursor-pointer ${isSelected ? 'bg-accent' : ''}`}
                  key={task.id}
                  onClick={() => onTaskSelect(task.id)}
                >
                  <TableCell>
                    <Badge className="gap-1" variant={statusConfig.variant}>
                      {statusConfig.icon}
                      {statusConfig.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {task.agentType === 'autonomous' ? (
                        <IconRocket className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <IconGitBranch className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-xs capitalize">
                        {task.agentType}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-md">
                      <p className="truncate font-medium">{task.description}</p>
                      {task.error && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-destructive">
                          <IconAlertTriangle className="h-3 w-3" />
                          <span className="truncate">{task.error}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-mono text-muted-foreground truncate block max-w-[180px]">
                      {task.targetDirectory}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(task.createdAt)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {task.startedAt && (
                      <span className="text-xs text-muted-foreground">
                        {formatDuration(task.startedAt, task.completedAt)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {canStart(task) && (
                        <Button
                          disabled={startTask.isPending}
                          onClick={e => handleStartTask(task.id, e)}
                          size="icon-sm"
                          variant="ghost"
                        >
                          <IconPlayerPlay className="h-4 w-4" />
                        </Button>
                      )}
                      {canPause(task) && (
                        <Button
                          disabled={pauseTask.isPending}
                          onClick={e => handlePauseTask(task.id, e)}
                          size="icon-sm"
                          variant="ghost"
                        >
                          <IconPlayerPause className="h-4 w-4" />
                        </Button>
                      )}
                      {canResume(task) && (
                        <Button
                          disabled={resumeTask.isPending}
                          onClick={e => handleResumeTask(task.id, e)}
                          size="icon-sm"
                          variant="ghost"
                        >
                          <IconPlayerPlay className="h-4 w-4" />
                        </Button>
                      )}
                      {canStop(task) && (
                        <Button
                          disabled={stopTask.isPending}
                          onClick={e => handleStopTask(task.id, e)}
                          size="icon-sm"
                          variant="ghost"
                        >
                          <IconPlayerStop className="h-4 w-4" />
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-7 w-7"
                          onClick={e => e.stopPropagation()}
                        >
                          <IconDotsVertical className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canStart(task) && (
                            <DropdownMenuItem
                              onClick={e => {
                                e.stopPropagation()
                                startTask.mutate(task.id)
                              }}
                            >
                              <IconPlayerPlay className="mr-2 h-4 w-4" />
                              Start Task
                            </DropdownMenuItem>
                          )}
                          {task.status === 'failed' && (
                            <DropdownMenuItem
                              onClick={e => {
                                e.stopPropagation()
                                startTask.mutate(task.id)
                              }}
                            >
                              <IconRefresh className="mr-2 h-4 w-4" />
                              Retry Task
                            </DropdownMenuItem>
                          )}
                          {canDelete(task) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={e => {
                                  e.stopPropagation()
                                  setDeleteConfirmTask(task)
                                }}
                              >
                                <IconTrash className="mr-2 h-4 w-4" />
                                Delete Task
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </ScrollArea>

      <AlertDialog
        onOpenChange={open => !open && setDeleteConfirmTask(null)}
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
                deleteConfirmTask && handleDeleteTask(deleteConfirmTask.id)
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
