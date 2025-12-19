/**
 * Task Backlog List Component
 *
 * Displays agent tasks in a list with:
 * - Status, description, and creation time
 * - Drag-and-drop reordering
 * - Move to implement, edit, cancel actions
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { useState, useCallback } from 'react'
import { Card, CardContent } from 'renderer/components/ui/card'
import { Button } from 'renderer/components/ui/button'
import { Badge } from 'renderer/components/ui/badge'
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
  IconEdit,
  IconGripVertical,
  IconRocket,
  IconGitBranch,
  IconClock,
  IconCheck,
  IconX,
  IconLoader2,
  IconAlertTriangle,
  IconArchive,
} from '@tabler/icons-react'
import {
  useTaskList,
  useAgentTaskStore,
} from 'renderer/stores/agent-task-store'
import {
  useStartAgentTask,
  usePauseAgentTask,
  useResumeAgentTask,
  useStopAgentTask,
  useDeleteAgentTask,
  useReorderTasks,
} from 'renderer/hooks/use-agent-tasks'
import type { AgentTask, TaskStatus } from 'shared/ai-types'

interface TaskBacklogListProps {
  onTaskSelect?: (taskId: string) => void
  onEditTask?: (task: AgentTask) => void
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
  awaiting_approval: {
    label: 'Awaiting Approval',
    variant: 'secondary',
    icon: <IconClock className="h-3 w-3" />,
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

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export function TaskBacklogList({
  onTaskSelect,
  onEditTask,
}: TaskBacklogListProps): React.JSX.Element {
  const tasks = useTaskList()
  const { setSelectedTask, selectedTaskId } = useAgentTaskStore()

  const startTask = useStartAgentTask()
  const pauseTask = usePauseAgentTask()
  const resumeTask = useResumeAgentTask()
  const stopTask = useStopAgentTask()
  const deleteTask = useDeleteAgentTask()
  const reorderTasks = useReorderTasks()

  const [deleteConfirmTask, setDeleteConfirmTask] = useState<AgentTask | null>(
    null
  )
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)

  const handleTaskClick = useCallback(
    (task: AgentTask) => {
      setSelectedTask(task.id)
      onTaskSelect?.(task.id)
    },
    [setSelectedTask, onTaskSelect]
  )

  const handleStartTask = useCallback(
    async (taskId: string) => {
      try {
        await startTask.mutateAsync(taskId)
      } catch (error) {
        console.error('Failed to start task:', error)
      }
    },
    [startTask]
  )

  const handlePauseTask = useCallback(
    async (taskId: string) => {
      try {
        await pauseTask.mutateAsync(taskId)
      } catch (error) {
        console.error('Failed to pause task:', error)
      }
    },
    [pauseTask]
  )

  const handleResumeTask = useCallback(
    async (taskId: string) => {
      try {
        await resumeTask.mutateAsync(taskId)
      } catch (error) {
        console.error('Failed to resume task:', error)
      }
    },
    [resumeTask]
  )

  const handleStopTask = useCallback(
    async (taskId: string) => {
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
      } catch (error) {
        console.error('Failed to delete task:', error)
      }
    },
    [deleteTask]
  )

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', taskId)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, targetTaskId: string) => {
      e.preventDefault()
      const sourceTaskId = e.dataTransfer.getData('text/plain')

      if (sourceTaskId === targetTaskId) {
        setDraggedTaskId(null)
        return
      }

      // Reorder tasks
      const currentOrder = tasks.map(t => t.id)
      const sourceIndex = currentOrder.indexOf(sourceTaskId)
      const targetIndex = currentOrder.indexOf(targetTaskId)

      if (sourceIndex === -1 || targetIndex === -1) {
        setDraggedTaskId(null)
        return
      }

      // Remove source and insert at target position
      const newOrder = [...currentOrder]
      newOrder.splice(sourceIndex, 1)
      newOrder.splice(targetIndex, 0, sourceTaskId)

      reorderTasks.mutate(newOrder)
      setDraggedTaskId(null)
    },
    [tasks, reorderTasks]
  )

  const handleDragEnd = useCallback(() => {
    setDraggedTaskId(null)
  }, [])

  const canStart = (task: AgentTask): boolean =>
    task.status === 'pending' || task.status === 'queued'

  const canPause = (task: AgentTask): boolean => task.status === 'running'

  const canResume = (task: AgentTask): boolean => task.status === 'paused'

  const canStop = (task: AgentTask): boolean =>
    task.status === 'running' || task.status === 'paused'

  const canEdit = (task: AgentTask): boolean =>
    task.status === 'pending' || task.status === 'queued'

  const canDelete = (task: AgentTask): boolean =>
    task.status !== 'running' && task.status !== 'paused'

  if (tasks.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center p-8">
        <IconRocket className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium">No tasks yet</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Create a new task to get started with the coding agent
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {tasks.map(task => {
          const statusConfig = STATUS_CONFIG[task.status]
          const isSelected = selectedTaskId === task.id
          const isDragging = draggedTaskId === task.id

          return (
            <Card
              className={`cursor-pointer transition-all ${
                isSelected ? 'ring-2 ring-primary' : ''
              } ${isDragging ? 'opacity-50' : ''}`}
              draggable={canEdit(task)}
              key={task.id}
              onClick={() => handleTaskClick(task)}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDragStart={e => handleDragStart(e, task.id)}
              onDrop={e => handleDrop(e, task.id)}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  {/* Drag handle */}
                  {canEdit(task) && (
                    <div className="mt-1 cursor-grab text-muted-foreground hover:text-foreground">
                      <IconGripVertical className="h-4 w-4" />
                    </div>
                  )}

                  {/* Agent type icon */}
                  <div className="mt-1">
                    {task.agentType === 'autonomous' ? (
                      <IconRocket className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <IconGitBranch className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>

                  {/* Task info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="gap-1" variant={statusConfig.variant}>
                        {statusConfig.icon}
                        {statusConfig.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(task.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm line-clamp-2">{task.description}</p>
                    <p className="text-xs text-muted-foreground mt-1 truncate font-mono">
                      {task.targetDirectory}
                    </p>
                    {task.error && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-destructive">
                        <IconAlertTriangle className="h-3 w-3" />
                        <span className="truncate">{task.error}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {/* Quick action buttons */}
                    {canStart(task) && (
                      <Button
                        disabled={startTask.isPending}
                        onClick={e => {
                          e.stopPropagation()
                          handleStartTask(task.id)
                        }}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <IconPlayerPlay className="h-4 w-4" />
                      </Button>
                    )}
                    {canPause(task) && (
                      <Button
                        disabled={pauseTask.isPending}
                        onClick={e => {
                          e.stopPropagation()
                          handlePauseTask(task.id)
                        }}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <IconPlayerPause className="h-4 w-4" />
                      </Button>
                    )}
                    {canResume(task) && (
                      <Button
                        disabled={resumeTask.isPending}
                        onClick={e => {
                          e.stopPropagation()
                          handleResumeTask(task.id)
                        }}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <IconPlayerPlay className="h-4 w-4" />
                      </Button>
                    )}
                    {canStop(task) && (
                      <Button
                        disabled={stopTask.isPending}
                        onClick={e => {
                          e.stopPropagation()
                          handleStopTask(task.id)
                        }}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <IconPlayerStop className="h-4 w-4" />
                      </Button>
                    )}

                    {/* More actions dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-7 w-7"
                        onClick={e => e.stopPropagation()}
                      >
                        <IconDotsVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canEdit(task) && (
                          <DropdownMenuItem
                            onClick={e => {
                              e.stopPropagation()
                              onEditTask?.(task)
                            }}
                          >
                            <IconEdit className="mr-2 h-4 w-4" />
                            Edit Task
                          </DropdownMenuItem>
                        )}
                        {canStart(task) && (
                          <DropdownMenuItem
                            onClick={e => {
                              e.stopPropagation()
                              handleStartTask(task.id)
                            }}
                          >
                            <IconPlayerPlay className="mr-2 h-4 w-4" />
                            Start Task
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
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Delete confirmation dialog */}
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
