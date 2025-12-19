/**
 * PrimarySidebar Component
 *
 * The main sidebar that shows different panels based on the active tab.
 */

import { memo } from 'react'
import type { ActivityBarTab } from './ActivityBar'
import { ProjectsPanel } from './ProjectsPanel'
import { FilesPanel } from 'renderer/components/LeftSidebar/FilesPanel'
import { GitPanel } from 'renderer/components/LeftSidebar/GitPanel'
import { ProjectScripts } from 'renderer/components/ProjectScripts'
import { CommandLibrary } from 'renderer/components/CommandLibrary'
import { TasksSidebarPanel } from './TasksSidebarPanel'
import { AgentsSidebarPanel } from './AgentsSidebarPanel'

interface PrimarySidebarProps {
  activeTab: ActivityBarTab
  projectId: string | null
  projectPath: string | null
}

export const PrimarySidebar = memo(function PrimarySidebar({
  activeTab,
  projectId,
  projectPath,
}: PrimarySidebarProps) {
  const renderPanel = () => {
    switch (activeTab) {
      case 'projects':
        return <ProjectsPanel />

      case 'files':
        if (!projectId || !projectPath) {
          return (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-4 text-center">
              Open a project to view files
            </div>
          )
        }
        return <FilesPanel projectId={projectId} projectPath={projectPath} />

      case 'git':
        if (!projectId || !projectPath) {
          return (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-4 text-center">
              Open a project to view source control
            </div>
          )
        }
        return <GitPanel projectId={projectId} projectPath={projectPath} />

      case 'scripts':
        if (!projectId || !projectPath) {
          return (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-4 text-center">
              Open a project to view scripts
            </div>
          )
        }
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
        if (!projectId) {
          return (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-4 text-center">
              Open a project to view commands
            </div>
          )
        }
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

      case 'tasks':
        return <TasksSidebarPanel projectId={projectId} />

      case 'agents':
        return <AgentsSidebarPanel />

      default:
        return null
    }
  }

  return (
    <div className="h-full bg-card border-r border-border overflow-hidden">
      {renderPanel()}
    </div>
  )
})
