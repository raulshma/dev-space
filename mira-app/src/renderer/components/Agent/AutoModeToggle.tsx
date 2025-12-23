/**
 * Auto-Mode Toggle Component
 *
 * Provides UI controls for enabling/disabling auto-mode with:
 * - Toggle switch for enabling/disabling auto-mode
 * - Concurrency limit slider (1-5)
 * - Running task count badge
 *
 * Requirements: 1.1, 1.3, 1.6, 12.4
 * Updated to use new useAutoMode hook from AI Agent Rework
 */

import { memo, useCallback, useState } from 'react'
import { Switch } from 'renderer/components/ui/switch'
import { Slider } from 'renderer/components/ui/slider'
import { Badge } from 'renderer/components/ui/badge'
import { Label } from 'renderer/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from 'renderer/components/ui/popover'
import { Button } from 'renderer/components/ui/button'
import {
  IconRobot,
  IconLoader2,
  IconSettings,
  IconPlayerPlay,
} from '@tabler/icons-react'
import { useAutoMode } from 'renderer/hooks/use-auto-mode'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from 'renderer/components/ui/tooltip'

interface AutoModeToggleProps {
  /** Project path for auto-mode operations */
  projectPath: string
  /** Optional compact mode for smaller displays */
  compact?: boolean
}

export const AutoModeToggle = memo(function AutoModeToggle({
  projectPath,
  compact = false,
}: AutoModeToggleProps): React.JSX.Element {
  const {
    isRunning,
    runningCount,
    maxConcurrency,
    isStarting,
    isStopping,
    start,
    stop,
    updateConfig,
  } = useAutoMode(projectPath)

  const isLoading = isStarting || isStopping
  const runningTaskCount = runningCount
  const concurrencyLimit = maxConcurrency

  const [pendingLimit, setPendingLimit] = useState<number | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Handle toggle change
  const handleToggle = useCallback(async () => {
    try {
      if (isRunning) {
        await stop()
      } else {
        await start({ maxConcurrency: concurrencyLimit })
      }
    } catch (err) {
      // Error is handled by the hook
      console.error('Auto-mode toggle error:', err)
    }
  }, [isRunning, start, stop, concurrencyLimit])

  // Handle concurrency limit change
  const handleConcurrencyChange = useCallback(
    async (value: number | readonly number[]) => {
      const newValue = Array.isArray(value) ? value[0] : value
      setPendingLimit(newValue)
      try {
        await updateConfig({ maxConcurrency: newValue })
      } catch (err) {
        console.error('Failed to set concurrency limit:', err)
      } finally {
        setPendingLimit(null)
      }
    },
    [updateConfig]
  )

  // Compact mode renders just the toggle with a badge
  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger
          className="flex items-center gap-2"
          onClick={handleToggle}
        >
          <Switch checked={isRunning} disabled={isLoading} size="sm" />
          {runningTaskCount > 0 && (
            <Badge className="h-5 min-w-5 px-1.5" variant="default">
              {runningTaskCount}
            </Badge>
          )}
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {isRunning ? 'Auto-mode enabled' : 'Enable auto-mode'}
            {isRunning && ` (${runningTaskCount}/${concurrencyLimit} running)`}
          </p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className="flex items-center gap-3">
      {/* Auto-mode toggle with label */}
      <div className="flex items-center gap-2">
        <IconRobot
          className={`h-4 w-4 ${isRunning ? 'text-primary' : 'text-muted-foreground'}`}
        />
        <Label
          className="text-sm font-medium cursor-pointer select-none"
          htmlFor="auto-mode-toggle"
        >
          Auto
        </Label>
        <Switch
          checked={isRunning}
          disabled={isLoading}
          id="auto-mode-toggle"
          onCheckedChange={handleToggle}
          size="sm"
        />
      </div>

      {/* Running task count badge */}
      {isRunning && (
        <Badge
          className="gap-1"
          variant={runningTaskCount > 0 ? 'default' : 'secondary'}
        >
          {runningTaskCount > 0 ? (
            <>
              <IconLoader2 className="h-3 w-3 animate-spin" />
              {runningTaskCount}/{concurrencyLimit}
            </>
          ) : (
            <>
              <IconPlayerPlay className="h-3 w-3" />
              Ready
            </>
          )}
        </Badge>
      )}

      {/* Settings popover for concurrency limit */}
      <Popover onOpenChange={setIsSettingsOpen} open={isSettingsOpen}>
        <PopoverTrigger
          render={
            <Button
              aria-label="Auto-mode settings"
              className="h-7 w-7"
              size="icon"
              variant="ghost"
            >
              <IconSettings className="h-4 w-4" />
            </Button>
          }
        />
        <PopoverContent align="end" className="w-64">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Concurrency Limit</Label>
                <span className="text-sm text-muted-foreground">
                  {pendingLimit ?? concurrencyLimit}
                </span>
              </div>
              <Slider
                max={5}
                min={1}
                onValueChange={handleConcurrencyChange}
                step={1}
                value={[pendingLimit ?? concurrencyLimit]}
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of tasks to run simultaneously
              </p>
            </div>

            <div className="text-xs text-muted-foreground border-t pt-3">
              <p>
                Auto-mode automatically starts pending tasks from your backlog
                up to the concurrency limit.
              </p>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
})
