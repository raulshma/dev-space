import { useState, useCallback, memo } from 'react'
import { ActivityBar, type SidebarTab } from './ActivityBar'
import { FilesPanel } from './FilesPanel'
import { GitPanel } from './GitPanel'
import { ProjectScripts } from 'renderer/components/ProjectScripts'
import { CommandLibrary } from 'renderer/components/CommandLibrary'

interface LeftSidebarProps {
  projectId: string
  projectPath: string
}

export const LeftSidebar = memo(function LeftSidebar({
  projectId,
  projectPath,
}: LeftSidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('git')

  const handleTabChange = useCallback((tab: SidebarTab) => {
    setActiveTab(tab)
  }, [])

  const renderPanel = () => {
    switch (activeTab) {
      case 'files':
        return <FilesPanel projectId={projectId} projectPath={projectPath} />
      case 'git':
        return <GitPanel projectId={projectId} projectPath={projectPath} />
      case 'scripts':
        return (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center px-3 py-2 border-b border-border">
              <span className="text-sm font-medium">Scripts</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ProjectScripts projectId={projectId} projectPath={projectPath} />
            </div>
          </div>
        )
      case 'commands':
        return (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center px-3 py-2 border-b border-border">
              <span className="text-sm font-medium">Commands</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <CommandLibrary projectId={projectId} />
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex h-full">
      <ActivityBar activeTab={activeTab} onTabChange={handleTabChange} />
      <div className="flex-1 min-w-0 overflow-hidden">{renderPanel()}</div>
    </div>
  )
})
