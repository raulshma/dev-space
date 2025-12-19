/**
 * Running Task Card Component
 *
 * Displays a single running task with project info, auto-mode indicator,
 * stop button, and view project link.
 * Requirements: 2.2, 2.3, 2.4
 */

import { memo, useCallback } from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from 'renderer/components/ui/card'
import { Button } from 'renderer/components/ui/button'
import { Badge } from 'renderer/components/ui/badge'
import {
  IconPlayerStop,
  IconExternalLink,
  IconLoader2,
  IconRobot,
  IconFolder,
  IconClock,
} from '@tabler/icons-react'
import type { RunningTaskInfo } from 'shared/ipc-types'

interface RunningTaskCardProps {
  task: RunningTaskInfo
  onStop: (taskId: string) => void
  onViewProject: (projectPath: string) => void
  isStoppingTask?: boolean
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const taskDate = date instanceof Date ? date : new Date(date)
  const diffMs = now.getTime() - taskDate.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 0) return `${diffDays}d ago`
  if (diffHours > 0) return `${diffHours}h ago`
  if (diffMins > 0) return `${diffMins}m ago`
  return 'Just now'
}

export const RunningTaskCard = memo(function RunningTaskCard({
  task,
  onStop,
  onViewProject,
  isStoppingTask = false,
}: RunningTaskCardProps): React.JSX.Element {
  const handleStop = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onStop(task.taskId)
    },
    [task.taskId, onStop]
  )

  const handleViewProject = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onViewProject(task.projectPath)
    },
    [task.projectPath, onViewProject]
  )

  return (
    <Card className="border-l-4 border-l-green-500 transition-all hover:ring-2 hover:ring-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <IconLoader2 className="h-4 w-4 text-green-500 animate-spin shrink-0" />
            <CardTitle className="line-clamp-2 text-sm leading-tight">
              {task.description}
            </CardTitle>
          </div>
          {task.isAutoMode && (
            <Badge variant="secondary" className="shrink-0">
              <IconRobot className="h-3 w-3 mr-1" />
              Auto
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="py-0 space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <IconFolder className="h-3 w-3 shrink-0" />
          <span className="font-medium">{task.projectName}</span>
        </div>
        <p className="text-xs text-muted-foreground font-mono truncate">
          {task.projectPath}
        </p>
      </CardContent>

      <CardFooter className="pt-3 flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <IconClock className="h-3 w-3" />
          {formatRelativeTime(task.startedAt)}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleViewProject}
            className="h-7 px-2 text-xs"
          >
            <IconExternalLink className="h-3 w-3 mr-1" />
            View Project
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleStop}
            disabled={isStoppingTask}
            className="h-7 px-2 text-xs"
          >
            {isStoppingTask ? (
              <IconLoader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <IconPlayerStop className="h-3 w-3 mr-1" />
            )}
            Stop
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
})
