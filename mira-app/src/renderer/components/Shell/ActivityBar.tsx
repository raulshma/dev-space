/**
 * ActivityBar Component
 *
 * VS Code-like activity bar on the far left with icon buttons
 * for switching between different sidebar views.
 */

import { memo } from 'react'
import {
  IconFolder,
  IconFiles,
  IconGitBranch,
  IconScript,
  IconCommand,
  IconRocket,
  IconSettings,
  IconRobot,
} from '@tabler/icons-react'
import { cn } from 'renderer/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from 'renderer/components/ui/tooltip'

export type ActivityBarTab =
  | 'projects'
  | 'files'
  | 'git'
  | 'scripts'
  | 'commands'
  | 'tasks'
  | 'agents'

interface ActivityBarProps {
  activeTab: ActivityBarTab
  onTabChange: (tab: ActivityBarTab) => void
  hasActiveProject: boolean
  onOpenSettings: () => void
}

const topTabs: {
  id: ActivityBarTab
  icon: typeof IconFolder
  label: string
  requiresProject?: boolean
}[] = [
  { id: 'projects', icon: IconFolder, label: 'Projects' },
  { id: 'files', icon: IconFiles, label: 'Explorer', requiresProject: true },
  {
    id: 'git',
    icon: IconGitBranch,
    label: 'Source Control',
    requiresProject: true,
  },
  { id: 'scripts', icon: IconScript, label: 'Scripts', requiresProject: true },
  {
    id: 'commands',
    icon: IconCommand,
    label: 'Commands',
    requiresProject: true,
  },
  { id: 'tasks', icon: IconRocket, label: 'Tasks' },
  { id: 'agents', icon: IconRobot, label: 'Running Agents' },
]

export const ActivityBar = memo(function ActivityBar({
  activeTab,
  onTabChange,
  hasActiveProject,
  onOpenSettings,
}: ActivityBarProps) {
  return (
    <div className="flex flex-col items-center w-12 bg-card border-r border-border py-2 h-full">
      <div className="flex flex-col items-center gap-1 flex-1">
        {topTabs.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          const isDisabled = tab.requiresProject && !hasActiveProject

          return (
            <Tooltip key={tab.id}>
              <TooltipTrigger
                render={
                  <button
                    className={cn(
                      'flex items-center justify-center w-10 h-10 rounded-md transition-colors relative',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : isDisabled
                          ? 'text-muted-foreground/40 cursor-not-allowed'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                    disabled={isDisabled}
                    onClick={() => !isDisabled && onTabChange(tab.id)}
                    type="button"
                  >
                    {isActive && (
                      <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-primary rounded-r-full" />
                    )}
                    <Icon className="h-5 w-5" />
                  </button>
                }
              />
              <TooltipContent side="right">
                <p>
                  {tab.label}
                  {isDisabled && ' (Open a project first)'}
                </p>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>

      {/* Bottom section with settings */}
      <div className="flex flex-col items-center gap-1 mt-auto">
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                className="flex items-center justify-center w-10 h-10 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/50"
                onClick={onOpenSettings}
                type="button"
              >
                <IconSettings className="h-5 w-5" />
              </button>
            }
          />
          <TooltipContent side="right">
            <p>Settings (Mod+,)</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
})
