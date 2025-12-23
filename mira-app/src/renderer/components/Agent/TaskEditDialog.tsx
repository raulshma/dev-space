/**
 * Task Edit Dialog Component
 *
 * Provides a dialog for editing existing agent tasks.
 * Only allows editing of task description for pending or queued tasks.
 */

import { useState, useCallback, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from 'renderer/components/ui/dialog'
import { Textarea } from 'renderer/components/ui/textarea'
import { Button } from 'renderer/components/ui/button'
import { Label } from 'renderer/components/ui/label'
import { Alert, AlertDescription } from 'renderer/components/ui/alert'
import {
  IconAlertTriangle,
  IconLoader2,
} from '@tabler/icons-react'
import { useUpdateAgentTask } from 'renderer/hooks/use-agent-tasks'
import type { AgentTask } from 'shared/ai-types'
import { UpdateAgentTaskInput } from 'shared/ai-types'

interface TaskEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: AgentTask | null
  onTaskUpdated?: (taskId: string) => void
}

export function TaskEditDialog({
  open,
  onOpenChange,
  task,
  onTaskUpdated,
}: TaskEditDialogProps): React.JSX.Element {
  const [description, setDescription] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const updateTask = useUpdateAgentTask()

  // Sync form with task when task changes
  useEffect(() => {
    if (task) {
      setDescription(task.description)
    }
  }, [task])

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setDescription('')
      setValidationError(null)
    }
  }, [open])

  const handleClose = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const validateForm = (): boolean => {
    if (!description.trim()) {
      setValidationError('Task description cannot be empty')
      return false
    }
    return true
  }

  const handleSave = async (): Promise<void> => {
    if (!task) return

    if (!validateForm()) {
      return
    }

    try {
      const updates: UpdateAgentTaskInput = {
        description: description.trim(),
      }

      await updateTask.mutateAsync({
        taskId: task.id,
        updates,
      })

      onTaskUpdated?.(task.id)
      handleClose()
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : 'Failed to update task'
      )
    }
  }

  const canEdit = task &&
    (task.status === 'pending' || task.status === 'queued')

  if (!canEdit && task) {
    return (
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cannot Edit Task</DialogTitle>
            <DialogDescription>
              Tasks can only be edited when they are in pending or queued status.
            </DialogDescription>
          </DialogHeader>

          <Alert variant="destructive">
            <IconAlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This task is currently in "{task.status}" status and cannot be edited.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button onClick={handleClose} variant="outline">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Update the description for this task. This task has not been started yet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Validation Error */}
          {validationError && (
            <Alert variant="destructive">
              <IconAlertTriangle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}

          {/* Task Metadata (read-only) */}
          {task && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <p className="capitalize">{task.status}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Agent Type</Label>
                  <p className="capitalize">{task.agentType}</p>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Target Directory
                </Label>
                <p className="font-mono text-xs truncate">{task.targetDirectory}</p>
              </div>
            </div>
          )}

          {/* Description Edit */}
          <div className="space-y-2">
            <Label htmlFor="task-description">Task Description</Label>
            <Textarea
              className="min-h-[120px] resize-y"
              id="task-description"
              onChange={e => {
                setDescription(e.target.value)
                setValidationError(null)
              }}
              placeholder="Describe what you want the agent to accomplish..."
              value={description}
            />
            <p className="text-xs text-muted-foreground">
              Be specific about the feature, bug fix, or task you want completed.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            disabled={updateTask.isPending}
            onClick={ handleClose }
            variant="outline"
          >
            Cancel
          </Button>
          <Button disabled={updateTask.isPending} onClick={handleSave}>
            {updateTask.isPending ? (
              <>
                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
