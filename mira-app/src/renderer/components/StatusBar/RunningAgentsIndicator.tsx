/**
 * Running Agents Indicator
 *
 * Shows running agent task count in the status bar with a badge.
 * Clicking navigates to the Running Agents view.
 * Requirements: 2.1
 */

import { memo, useCallback } from 'react'
import { Button } from 'renderer/components/ui/button'
import { Badge } from 'renderer/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from 'renderer/components/ui/tooltip'
import { IconRobot } from '@tabler/icons-react'
import { useRunningTasksCount } from 'renderer/stores/running-tasks-store'
import { useAppStore } from 'renderer/stores/app-store'

export const RunningAgentsIndicator = memo(function RunningAgentsIndicator() {
  const count = useRunningTasksCount()
  const setActiveView = useAppStore(state => state.setActiveView)

  const handleClick = useCallback(() => {
    setActiveView('running-agents')
  }, [setActiveView])

  const hasRunningTasks = count > 0

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            className="h-5 gap-1 px-1.5"
            size="sm"
            variant="ghost"
            onClick={handleClick}
          >
            <IconRobot
              className={`h-3.5 w-3.5 ${hasRunningTasks ? 'text-green-500' : 'text-muted-foreground'}`}
            />
            {hasRunningTasks && (
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
      <TooltipContent>
        {hasRunningTasks
          ? `${count} running agent${count > 1 ? 's' : ''} - Click to view`
          : 'No running agents'}
      </TooltipContent>
    </Tooltip>
  )
})
