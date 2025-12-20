/**
 * PrimarySidebar Component
 *
 * The main sidebar that shows different panels based on the active tab.
 * Uses absolute positioning for all panels to prevent layout shifts.
 */

import { memo, useState, useEffect } from 'react'
import type { ActivityBarTab } from './ActivityBar'
import { ProjectsPanel } from './ProjectsPanel'
import { FilesPanel } from 'renderer/components/LeftSidebar/FilesPanel'
import { GitPanel } from 'renderer/components/LeftSidebar/GitPanel'
import { ProjectScripts } from 'renderer/components/ProjectScripts'
import { CommandLibrary } from 'renderer/components/CommandLibrary'
import { TasksSidebarPanel } from './TasksSidebarPanel'
import { AgentsSidebarPanel } from './AgentsSidebarPanel'
import { cn } from 'renderer/lib/utils'

interface PrimarySidebarProps {
  activeTab: ActivityBarTab
  projectId: string | null
  projectPath: string | null
}

// Panel wrapper component that handles absolute positioning and visibility
const PanelWrapper = memo(function PanelWrapper({
  isActive,
  isMounted,
  children,
}: {
  isActive: boolean
  isMounted: boolean
  children: React.ReactNode
}) {
  if (!isMounted) return null

  return (
    <div
      className={cn(
        'absolute inset-0 flex flex-col overflow-hidden bg-card',
        isActive
          ? 'visible opacity-100 z-10'
          : 'invisible opacity-0 z-0 pointer-events-none'
      )}
    >
      {children}
    </div>
  )
})

export const PrimarySidebar = memo(function PrimarySidebar({
  activeTab,
  projectId,
  projectPath,
}: PrimarySidebarProps) {
  // Track which tabs have been visited to lazily mount components
  const [visitedTabs, setVisitedTabs] = useState<Set<ActivityBarTab>>(
    () => new Set([activeTab])
  )

  useEffect(() => {
    setVisitedTabs(prev => {
      if (prev.has(activeTab)) return prev
      const next = new Set(prev)
      next.add(activeTab)
      return next
    })
  }, [activeTab])

  // Helper to check if panel should be mounted
  const isMounted = (tab: ActivityBarTab) => visitedTabs.has(tab)
  const isActive = (tab: ActivityBarTab) => activeTab === tab

  // Empty state component
  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-4 text-center">
      {message}
    </div>
  )

  return (
    <div className="h-full w-full overflow-hidden relative bg-card">
      {/* Projects Panel */}
      <PanelWrapper
        isActive={isActive('projects')}
        isMounted={isMounted('projects')}
      >
        <ProjectsPanel />
      </PanelWrapper>

      {/* Files Panel */}
      <PanelWrapper isActive={isActive('files')} isMounted={isMounted('files')}>
        {projectId && projectPath ? (
          <FilesPanel projectId={projectId} projectPath={projectPath} />
        ) : (
          <EmptyState message="Open a project to view files" />
        )}
      </PanelWrapper>

      {/* Git Panel */}
      <PanelWrapper isActive={isActive('git')} isMounted={isMounted('git')}>
        {projectId && projectPath ? (
          <GitPanel projectId={projectId} projectPath={projectPath} />
        ) : (
          <EmptyState message="Open a project to view source control" />
        )}
      </PanelWrapper>

      {/* Scripts Panel */}
      <PanelWrapper
        isActive={isActive('scripts')}
        isMounted={isMounted('scripts')}
      >
        {projectId && projectPath ? (
          <div className="flex flex-col h-full overflow-hidden w-full">
            <div className="flex items-center px-3 py-2 border-b border-border">
              <span className="text-sm font-medium">Scripts</span>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              <ProjectScripts projectId={projectId} projectPath={projectPath} />
            </div>
          </div>
        ) : (
          <EmptyState message="Open a project to view scripts" />
        )}
      </PanelWrapper>

      {/* Commands Panel */}
      <PanelWrapper
        isActive={isActive('commands')}
        isMounted={isMounted('commands')}
      >
        {projectId ? (
          <div className="flex flex-col h-full overflow-hidden w-full">
            <div className="flex items-center px-3 py-2 border-b border-border">
              <span className="text-sm font-medium">Commands</span>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              <CommandLibrary projectId={projectId} />
            </div>
          </div>
        ) : (
          <EmptyState message="Open a project to view commands" />
        )}
      </PanelWrapper>

      {/* Tasks Panel */}
      <PanelWrapper isActive={isActive('tasks')} isMounted={isMounted('tasks')}>
        <TasksSidebarPanel projectId={projectId} />
      </PanelWrapper>

      {/* Agents Panel */}
      <PanelWrapper
        isActive={isActive('agents')}
        isMounted={isMounted('agents')}
      >
        <AgentsSidebarPanel />
      </PanelWrapper>
    </div>
  )
})
