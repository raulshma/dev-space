import { memo } from 'react'
import { IconX, IconLayout, IconRocket } from '@tabler/icons-react'
import { useAppStore } from 'renderer/stores/app-store'
import { Button } from 'renderer/components/ui/button'
import { cn } from 'renderer/lib/utils'

interface SectionNavProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  activeView?: 'workspace' | 'tasks'
  onViewChange?: (view: 'workspace' | 'tasks') => void
}

export const SectionNav = memo(function SectionNav({
  title,
  subtitle,
  actions,
  activeView,
  onViewChange,
}: SectionNavProps) {
  const setActiveProject = useAppStore(state => state.setActiveProject)

  return (
    <nav className="h-12 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <Button
          className="h-8 w-8 shrink-0"
          onClick={() => setActiveProject(null)}
          size="icon"
          title="Close Workspace"
          variant="ghost"
        >
          <IconX className="h-4 w-4" />
        </Button>

        <div className="h-4 w-px bg-border shrink-0" />

        <div className="flex items-center gap-1 shrink-0 overflow-x-auto no-scrollbar">
          <Button
            className={cn(
              'h-8 px-3 text-xs gap-2',
              activeView === 'workspace' &&
                'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20'
            )}
            onClick={() => onViewChange?.('workspace')}
            variant="ghost"
          >
            <IconLayout className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Editor</span>
          </Button>
          <Button
            className={cn(
              'h-8 px-3 text-xs gap-2',
              activeView === 'tasks' &&
                'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20'
            )}
            onClick={() => onViewChange?.('tasks')}
            variant="ghost"
          >
            <IconRocket className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Tasks</span>
          </Button>
        </div>

        <div className="h-4 w-px bg-border shrink-0 md:block hidden" />

        <div className="flex flex-col min-w-0 md:flex hidden">
          <h2 className="text-xs font-semibold truncate leading-none mb-0.5">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[10px] text-muted-foreground truncate leading-none">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 ml-4 overflow-x-auto no-scrollbar py-1">
        {actions}
      </div>
    </nav>
  )
})
