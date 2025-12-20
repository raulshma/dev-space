import { memo } from 'react'
import {
  IconFiles,
  IconGitBranch,
  IconScript,
  IconCommand,
} from '@tabler/icons-react'
import { cn } from 'renderer/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from 'renderer/components/ui/tooltip'
import { useSetting, SETTING_KEYS } from 'renderer/hooks/use-settings'
import { getBackgroundStyle } from 'renderer/lib/background-presets'

export type SidebarTab = 'files' | 'git' | 'scripts' | 'commands'

interface ActivityBarProps {
  activeTab: SidebarTab
  onTabChange: (tab: SidebarTab) => void
}

const tabs: { id: SidebarTab; icon: typeof IconFiles; label: string }[] = [
  { id: 'files', icon: IconFiles, label: 'Explorer' },
  { id: 'git', icon: IconGitBranch, label: 'Source Control' },
  { id: 'scripts', icon: IconScript, label: 'Scripts' },
  { id: 'commands', icon: IconCommand, label: 'Commands' },
]

export const ActivityBar = memo(function ActivityBar({
  activeTab,
  onTabChange,
}: ActivityBarProps) {
  const { data: iconBg } = useSetting(SETTING_KEYS.SIDEBAR_ICON_BG)
  const iconStyle = getBackgroundStyle(iconBg || 'none')

  return (
    <div className="flex flex-col items-center w-12 bg-card border-r border-border py-2 gap-1">
      {tabs.map(tab => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        return (
          <Tooltip key={tab.id}>
            <TooltipTrigger
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-md transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary border-l-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
              onClick={() => onTabChange(tab.id)}
              style={iconStyle}
            >
              <Icon className="h-5 w-5" />
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{tab.label}</p>
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
})
