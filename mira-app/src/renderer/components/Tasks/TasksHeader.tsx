import { memo } from 'react'
import { Badge } from 'renderer/components/ui/badge'
import { ButtonGroup } from 'renderer/components/ui/button-group'
import {
  IconPlus,
  IconLoader2,
  IconLayoutKanban,
  IconTable,
} from '@tabler/icons-react'
import { useTaskList, useCurrentTask } from 'renderer/stores/agent-task-store'
import { AutoModeToggle } from 'renderer/components/Agent/AutoModeToggle'
import { SectionNav } from 'renderer/components/Shell/SectionNav'
import { Button as UIButton } from 'renderer/components/ui/button'

export type TasksViewMode = 'table' | 'kanban'

interface TasksHeaderProps {
  onCreateTask: () => void
  onGoToWorkspace?: () => void
  viewMode?: TasksViewMode
  onViewModeChange?: (mode: TasksViewMode) => void
  /** Project path for auto-mode operations */
  projectPath?: string
}

export const TasksHeader = memo(function TasksHeader({
  onCreateTask,
  onGoToWorkspace,
  viewMode = 'kanban',
  onViewModeChange,
  projectPath,
}: TasksHeaderProps): React.JSX.Element {
  const tasks = useTaskList()
  const currentTask = useCurrentTask()

  const pendingCount = tasks.filter(t => t.status === 'pending').length
  const runningCount = tasks.filter(
    t => t.status === 'running' || t.status === 'paused'
  ).length
  const completedCount = tasks.filter(t => t.status === 'completed').length

  const actions = (
    <div className="flex items-center gap-2 shrink-0">
      {/* Auto-mode toggle - hide label on small screens */}
      {projectPath && <AutoModeToggle projectPath={projectPath} />}

      <div className="h-6 w-px bg-border shrink-0 hidden sm:block" />

      {/* Task stats - hide icons or labels on small screens */}
      <div className="flex items-center gap-1.5 shrink-0">
        {runningCount > 0 && (
          <Badge className="gap-1 px-1.5 h-7" variant="default">
            <IconLoader2 className="h-3 w-3 animate-spin" />
            <span className="hidden lg:inline">{runningCount} Running</span>
            <span className="lg:hidden">{runningCount}</span>
          </Badge>
        )}
        {pendingCount > 0 && (
          <Badge className="px-1.5 h-7" variant="secondary">
            <span className="hidden lg:inline">{pendingCount} Pending</span>
            <span className="lg:hidden">{pendingCount}P</span>
          </Badge>
        )}
        <Badge className="px-1.5 h-7 hidden sm:inline-flex" variant="outline">
          <span className="hidden lg:inline">{completedCount} Completed</span>
          <span className="lg:hidden">{completedCount}C</span>
        </Badge>
      </div>

      <div className="h-6 w-px bg-border shrink-0 hidden sm:block" />

      {/* View mode toggle */}
      {onViewModeChange && (
        <ButtonGroup className="shrink-0 h-8">
          <UIButton
            aria-label="Kanban view"
            className="h-8 px-2"
            onClick={() => onViewModeChange('kanban')}
            size="sm"
            variant={viewMode === 'kanban' ? 'default' : 'outline'}
          >
            <IconLayoutKanban className="h-4 w-4" />
          </UIButton>
          <UIButton
            aria-label="Table view"
            className="h-8 px-2"
            onClick={() => onViewModeChange('table')}
            size="sm"
            variant={viewMode === 'table' ? 'default' : 'outline'}
          >
            <IconTable className="h-4 w-4" />
          </UIButton>
        </ButtonGroup>
      )}

      <UIButton className="h-8 px-3 gap-2 shrink-0" onClick={onCreateTask} size="sm">
        <IconPlus className="h-4 w-4" />
        <span className="hidden sm:inline">New Task</span>
      </UIButton>
    </div>
  )

  return (
    <div className="flex flex-col">
      <SectionNav
        actions={actions}
        activeView="tasks"
        onViewChange={view => {
          if (view === 'workspace') onGoToWorkspace?.()
        }}
        subtitle={projectPath}
        title="Workspace Tasks"
      />
      
      {/* Current task indicator - simplified for section nav usage */}
      {currentTask && (
        <div className="px-4 py-1.5 bg-muted/30 border-b border-border flex items-center gap-2 text-[10px] shrink-0 overflow-hidden">
          <IconLoader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
          <span className="text-muted-foreground whitespace-nowrap">Executing:</span>
          <span className="font-medium truncate">
            {currentTask.description}
          </span>
        </div>
      )}
    </div>
  )
})
