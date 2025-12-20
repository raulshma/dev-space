/**
 * Tasks Filters Component
 *
 * Filter bar for the tasks page with status, type, branch, and search filters
 * Requirements: 4.4 (branch filter)
 */

import { memo, useMemo } from 'react'
import { Input } from 'renderer/components/ui/input'
import { Button } from 'renderer/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'renderer/components/ui/select'
import {
  IconSearch,
  IconFilter,
  IconSortAscending,
  IconSortDescending,
  IconX,
  IconGitBranch,
} from '@tabler/icons-react'
import { useTaskList } from 'renderer/stores/agent-task-store'
import type { TasksFilter } from 'renderer/screens/tasks'

interface TasksFiltersProps {
  filters: TasksFilter
  onFilterChange: (filters: Partial<TasksFilter>) => void
}

export const TasksFilters = memo(function TasksFilters({
  filters,
  onFilterChange,
}: TasksFiltersProps): React.JSX.Element {
  const tasks = useTaskList()

  // Get unique branches from tasks
  const availableBranches = useMemo(() => {
    const branches = new Set<string>()
    for (const task of tasks) {
      if (task.branchName) {
        branches.add(task.branchName)
      }
    }
    return Array.from(branches).sort()
  }, [tasks])

  const hasActiveFilters =
    filters.status !== 'all' ||
    filters.agentType !== 'all' ||
    filters.branch !== 'all' ||
    (filters.searchQuery && filters.searchQuery.length > 0)

  const handleClearFilters = () => {
    onFilterChange({
      status: 'all',
      agentType: 'all',
      searchQuery: '',
      branch: 'all',
    })
  }

  return (
    <div className="bg-card border-b border-border px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9 h-9"
            onChange={e => onFilterChange({ searchQuery: e.target.value })}
            placeholder="Search tasks..."
            value={filters.searchQuery || ''}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 ml-auto sm:ml-0">
          {/* Status filter */}
          <div className="flex items-center gap-2">
            <Select
              onValueChange={value =>
                onFilterChange({ status: value as TasksFilter['status'] })
              }
              value={filters.status || 'all'}
            >
              <SelectTrigger className="w-[120px] sm:w-[140px] h-9">
                <div className="flex items-center gap-2">
                  <IconFilter className="h-4 w-4 text-muted-foreground shrink-0 sm:hidden" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="stopped">Stopped</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Agent type filter */}
          <Select
            onValueChange={value =>
              onFilterChange({ agentType: value as TasksFilter['agentType'] })
            }
            value={filters.agentType || 'all'}
          >
            <SelectTrigger className="w-[120px] sm:w-[150px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="autonomous">Autonomous</SelectItem>
              <SelectItem value="feature">Feature</SelectItem>
            </SelectContent>
          </Select>

          {/* Branch filter */}
          {availableBranches.length > 0 && (
            <Select
              onValueChange={value =>
                onFilterChange({ branch: value as TasksFilter['branch'] })
              }
              value={filters.branch || 'all'}
            >
              <SelectTrigger className="w-[140px] sm:w-[180px] h-9">
                <div className="flex items-center gap-2">
                  <IconGitBranch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {availableBranches.map(branch => (
                  <SelectItem key={branch} value={branch}>
                    <span className="font-mono text-xs truncate max-w-[140px]">
                      {branch}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Sort */}
          <Select
            onValueChange={value =>
              onFilterChange({ sortBy: value as TasksFilter['sortBy'] })
            }
            value={filters.sortBy || 'createdAt'}
          >
            <SelectTrigger className="w-[120px] sm:w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">Created Date</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort order toggle */}
          <Button
            className="h-9 w-9 shrink-0"
            onClick={() =>
              onFilterChange({
                sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc',
              })
            }
            size="icon"
            variant="outline"
          >
            {filters.sortOrder === 'asc' ? (
              <IconSortAscending className="h-4 w-4" />
            ) : (
              <IconSortDescending className="h-4 w-4" />
            )}
          </Button>

          {/* Clear filters */}
          {hasActiveFilters && (
            <Button
              className="h-9"
              onClick={handleClearFilters}
              size="sm"
              variant="ghost"
            >
              <IconX className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
})
