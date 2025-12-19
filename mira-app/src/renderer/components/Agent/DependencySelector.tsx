/**
 * Dependency Selector Component
 *
 * Multi-select dropdown for selecting task dependencies.
 * Shows task descriptions in dropdown and warns about cycle detection.
 *
 * Requirements: 5.1, 5.7
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from 'renderer/components/ui/popover'
import { Button } from 'renderer/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from 'renderer/components/ui/command'
import { Badge } from 'renderer/components/ui/badge'
import { Alert, AlertDescription } from 'renderer/components/ui/alert'
import { Checkbox } from 'renderer/components/ui/checkbox'
import {
  IconChevronDown,
  IconAlertTriangle,
  IconLink,
  IconX,
} from '@tabler/icons-react'
import { cn } from 'renderer/lib/utils'
import type { AgentTask } from 'shared/ai-types'

export interface DependencySelectorProps {
  /** Current task ID (to exclude from selection) */
  currentTaskId?: string
  /** Available tasks to select as dependencies */
  availableTasks: AgentTask[]
  /** Currently selected dependency task IDs */
  selectedDependencies: string[]
  /** Callback when dependencies change */
  onDependenciesChange: (dependencies: string[]) => void
  /** Whether the selector is disabled */
  disabled?: boolean
  /** Placeholder text when no dependencies selected */
  placeholder?: string
  /** Optional className for styling */
  className?: string
  /** Callback to check if adding a dependency would create a cycle */
  onCheckCycle?: (taskId: string) => Promise<boolean>
}

/**
 * Truncate text with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 3)}...`
}

export function DependencySelector({
  currentTaskId,
  availableTasks,
  selectedDependencies,
  onDependenciesChange,
  disabled = false,
  placeholder = 'Select dependencies...',
  className,
  onCheckCycle,
}: DependencySelectorProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [cycleWarning, setCycleWarning] = useState<string | null>(null)
  const [checkingCycle, setCheckingCycle] = useState<string | null>(null)

  // Filter out current task from available tasks
  const selectableTasks = useMemo(() => {
    return availableTasks.filter(task => task.id !== currentTaskId)
  }, [availableTasks, currentTaskId])

  // Get selected task objects for display
  const selectedTasks = useMemo(() => {
    return selectableTasks.filter(task =>
      selectedDependencies.includes(task.id)
    )
  }, [selectableTasks, selectedDependencies])

  // Clear cycle warning when popover closes
  useEffect(() => {
    if (!open) {
      setCycleWarning(null)
    }
  }, [open])

  const handleToggleDependency = useCallback(
    async (taskId: string) => {
      const isSelected = selectedDependencies.includes(taskId)

      if (isSelected) {
        // Remove dependency
        onDependenciesChange(selectedDependencies.filter(id => id !== taskId))
        setCycleWarning(null)
      } else {
        // Check for cycle before adding
        if (onCheckCycle) {
          setCheckingCycle(taskId)
          try {
            const wouldCreateCycle = await onCheckCycle(taskId)
            if (wouldCreateCycle) {
              const task = selectableTasks.find(t => t.id === taskId)
              setCycleWarning(
                `Adding "${truncateText(task?.description || taskId, 30)}" would create a circular dependency`
              )
              return
            }
          } catch (error) {
            console.error('Failed to check cycle:', error)
          } finally {
            setCheckingCycle(null)
          }
        }

        // Add dependency
        onDependenciesChange([...selectedDependencies, taskId])
        setCycleWarning(null)
      }
    },
    [selectedDependencies, onDependenciesChange, onCheckCycle, selectableTasks]
  )

  const handleRemoveDependency = useCallback(
    (taskId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      onDependenciesChange(selectedDependencies.filter(id => id !== taskId))
    },
    [selectedDependencies, onDependenciesChange]
  )

  const handleClearAll = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDependenciesChange([])
    },
    [onDependenciesChange]
  )

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            className={cn(
              'w-full justify-between h-auto min-h-9 py-1.5',
              className
            )}
            disabled={disabled}
            variant="outline"
          >
            <div className="flex flex-wrap gap-1 items-center flex-1 min-w-0">
              {selectedTasks.length === 0 ? (
                <span className="text-muted-foreground text-sm">
                  {placeholder}
                </span>
              ) : (
                <>
                  {selectedTasks.slice(0, 2).map(task => (
                    <Badge
                      className="max-w-[120px] truncate gap-1"
                      key={task.id}
                      variant="secondary"
                    >
                      <span className="truncate">
                        {truncateText(task.description, 20)}
                      </span>
                      <button
                        className="hover:bg-muted-foreground/20 rounded-full p-0.5"
                        onClick={e => handleRemoveDependency(task.id, e)}
                        type="button"
                      >
                        <IconX className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                  {selectedTasks.length > 2 && (
                    <Badge variant="outline">+{selectedTasks.length - 2}</Badge>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              {selectedTasks.length > 0 && (
                <button
                  className="hover:bg-muted rounded p-0.5"
                  onClick={handleClearAll}
                  type="button"
                >
                  <IconX className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
              <IconChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </Button>
        }
      />
      <PopoverContent align="start" className="w-80 p-0">
        <Command>
          <CommandInput placeholder="Search tasks..." />
          <CommandList>
            <CommandEmpty>No tasks found.</CommandEmpty>
            {cycleWarning && (
              <div className="p-2">
                <Alert variant="destructive">
                  <IconAlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {cycleWarning}
                  </AlertDescription>
                </Alert>
              </div>
            )}
            <CommandGroup>
              {selectableTasks.map(task => {
                const isSelected = selectedDependencies.includes(task.id)
                const isChecking = checkingCycle === task.id

                return (
                  <CommandItem
                    className="flex items-center gap-2 cursor-pointer"
                    disabled={isChecking}
                    key={task.id}
                    onSelect={() => handleToggleDependency(task.id)}
                    value={task.description}
                  >
                    <Checkbox
                      checked={isSelected}
                      className="pointer-events-none"
                    />
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-sm truncate">
                        {truncateText(task.description, 40)}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {task.status} • {task.agentType}
                      </span>
                    </div>
                    {isChecking && (
                      <span className="text-xs text-muted-foreground">
                        Checking...
                      </span>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Compact version of DependencySelector for inline use
 */
export interface CompactDependencySelectorProps {
  /** Currently selected dependency count */
  dependencyCount: number
  /** Callback when clicked to open full selector */
  onClick?: () => void
  /** Whether the selector is disabled */
  disabled?: boolean
  /** Optional className for styling */
  className?: string
}

export function CompactDependencySelector({
  dependencyCount,
  onClick,
  disabled = false,
  className,
}: CompactDependencySelectorProps): React.JSX.Element {
  return (
    <Button
      className={cn('gap-1.5', className)}
      disabled={disabled}
      onClick={onClick}
      size="sm"
      variant="outline"
    >
      <IconLink className="h-3.5 w-3.5" />
      <span>
        {dependencyCount === 0
          ? 'No dependencies'
          : `${dependencyCount} ${dependencyCount === 1 ? 'dependency' : 'dependencies'}`}
      </span>
    </Button>
  )
}
