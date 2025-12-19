/**
 * Running Projects Indicator
 *
 * Shows running project count in the status bar with a popover
 * to view, manage, and see logs of running dev servers.
 */

import { memo, useState, useCallback } from 'react'
import { Button } from 'renderer/components/ui/button'
import { Badge } from 'renderer/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from 'renderer/components/ui/popover'
import { ScrollArea } from 'renderer/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from 'renderer/components/ui/tooltip'
import {
  IconPlayerPlay,
  IconPlayerStop,
  IconRefresh,
  IconTerminal2,
  IconX,
  IconLoader2,
  IconAlertCircle,
} from '@tabler/icons-react'
import {
  useRunningProjects,
  useRunningProjectsCount,
  useRunningProjectsManager,
} from 'renderer/hooks/use-running-projects'
import { LogsDialog } from './LogsDialog'
import type { RunningProjectStatus } from 'shared/models'

const StatusIcon = memo(function StatusIcon({
  status,
  className = 'h-3 w-3',
}: {
  status: RunningProjectStatus
  className?: string
}) {
  switch (status) {
    case 'running':
      return <IconPlayerPlay className={`${className} text-green-500`} />
    case 'starting':
      return (
        <IconLoader2 className={`${className} text-blue-500 animate-spin`} />
      )
    case 'stopping':
      return (
        <IconLoader2 className={`${className} text-yellow-500 animate-spin`} />
      )
    case 'stopped':
      return <IconPlayerStop className={`${className} text-muted-foreground`} />
    case 'error':
      return <IconAlertCircle className={`${className} text-destructive`} />
    default:
      return <IconTerminal2 className={`${className} text-muted-foreground`} />
  }
})

interface RunningProjectItemProps {
  projectId: string
  projectName: string
  devCommand: string
  status: RunningProjectStatus
  error?: string
  onStop: () => void
  onRestart: () => void
  onViewLogs: () => void
}

const RunningProjectItem = memo(function RunningProjectItem({
  projectName,
  devCommand,
  status,
  error,
  onStop,
  onRestart,
  onViewLogs,
}: RunningProjectItemProps) {
  const isActive = status === 'running' || status === 'starting'
  const isTransitioning = status === 'starting' || status === 'stopping'

  return (
    <div className="flex items-center gap-2 p-2 border-b border-border last:border-0 hover:bg-muted/50">
      <StatusIcon className="h-4 w-4 shrink-0" status={status} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{projectName}</p>
        <p className="text-xs text-muted-foreground truncate">{devCommand}</p>
        {error && (
          <p className="text-xs text-destructive truncate mt-0.5">{error}</p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                className="h-6 w-6"
                disabled={isTransitioning}
                onClick={onViewLogs}
                size="icon-sm"
                variant="ghost"
              >
                <IconTerminal2 className="h-3.5 w-3.5" />
              </Button>
            }
          />
          <TooltipContent>View Logs</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                className="h-6 w-6"
                disabled={isTransitioning}
                onClick={onRestart}
                size="icon-sm"
                variant="ghost"
              >
                <IconRefresh className="h-3.5 w-3.5" />
              </Button>
            }
          />
          <TooltipContent>Restart</TooltipContent>
        </Tooltip>

        {isActive && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  className="h-6 w-6"
                  disabled={isTransitioning}
                  onClick={onStop}
                  size="icon-sm"
                  variant="ghost"
                >
                  <IconX className="h-3.5 w-3.5 text-destructive" />
                </Button>
              }
            />
            <TooltipContent>Stop</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )
})

export const RunningProjectsIndicator = memo(
  function RunningProjectsIndicator() {
    const count = useRunningProjectsCount()
    const projects = useRunningProjects()
    const { stopProject, restartProject } = useRunningProjectsManager()
    const [logsDialogProject, setLogsDialogProject] = useState<{
      projectId: string
      projectName: string
    } | null>(null)

    const handleStop = useCallback(
      async (projectId: string) => {
        await stopProject(projectId)
      },
      [stopProject]
    )

    const handleRestart = useCallback(
      async (projectId: string) => {
        await restartProject(projectId)
      },
      [restartProject]
    )

    const handleViewLogs = useCallback(
      (projectId: string, projectName: string) => {
        setLogsDialogProject({ projectId, projectName })
      },
      []
    )

    const handleCloseLogsDialog = useCallback(() => {
      setLogsDialogProject(null)
    }, [])

    const hasRunningProjects = count > 0

    return (
      <>
        <Popover>
          <PopoverTrigger
            render={
              <Button className="h-5 gap-1 px-1.5" size="sm" variant="ghost">
                <IconTerminal2
                  className={`h-3.5 w-3.5 ${hasRunningProjects ? 'text-green-500' : 'text-muted-foreground'}`}
                />
                {hasRunningProjects && (
                  <Badge
                    className="h-4 min-w-4 px-1 text-[10px] bg-green-500/20 text-green-600 border-green-500/30"
                    variant="outline"
                  >
                    {count}
                  </Badge>
                )}
              </Button>
            }
          />
          <PopoverContent
            align="end"
            className="w-80 p-0"
            side="top"
            sideOffset={8}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-sm font-medium">Running Projects</span>
              <span className="text-xs text-muted-foreground">
                {count} active
              </span>
            </div>
            <ScrollArea className="max-h-64">
              {projects.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No running projects. Start a dev server from the Scripts
                  panel.
                </p>
              ) : (
                projects.map(project => (
                  <RunningProjectItem
                    devCommand={project.devCommand}
                    error={project.error}
                    key={project.projectId}
                    onRestart={() => handleRestart(project.projectId)}
                    onStop={() => handleStop(project.projectId)}
                    onViewLogs={() =>
                      handleViewLogs(project.projectId, project.projectName)
                    }
                    projectId={project.projectId}
                    projectName={project.projectName}
                    status={project.status}
                  />
                ))
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>

        {logsDialogProject && (
          <LogsDialog
            onOpenChange={open => !open && handleCloseLogsDialog()}
            open={!!logsDialogProject}
            projectId={logsDialogProject.projectId}
            projectName={logsDialogProject.projectName}
          />
        )}
      </>
    )
  }
)
