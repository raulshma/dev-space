/**
 * AppShell Component
 *
 * VS Code-like shell layout with:
 * - Activity bar (far left icons)
 * - Primary sidebar (left panel)
 * - Main content area (center)
 * - Secondary sidebar (right panel)
 * - Status bar (bottom)
 */

import { useCallback, useRef, useEffect } from 'react'
import { useAppStore } from 'renderer/stores/app-store'
import { useShellStore, type ShellTab } from 'renderer/stores/shell-store'
import { ActivityBar, type ActivityBarTab } from './ActivityBar'
import { TopNav } from './TopNav'
import { PrimarySidebar } from './PrimarySidebar'
import { SecondarySidebar } from './SecondarySidebar'
import { MainContent } from './MainContent'
import { TasksContent } from './TasksContent'
import { StatusBar } from 'renderer/components/StatusBar'
import { CommandPalette } from 'renderer/components/CommandPalette'
import { SettingsPanel } from 'renderer/components/Settings'
import { ErrorToast } from 'renderer/components/ErrorToast'
import { useProject } from 'renderer/hooks/use-projects'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
  type GroupImperativeHandle,
  type PanelImperativeHandle,
} from 'renderer/components/ui/resizable'

export function AppShell(): React.JSX.Element {
  const activeProjectId = useAppStore(state => state.activeProjectId)
  const settingsPanelOpen = useAppStore(state => state.settingsPanelOpen)
  const closeSettingsPanel = useAppStore(state => state.closeSettingsPanel)
  const openSettingsPanel = useAppStore(state => state.openSettingsPanel)
  const sidebarCollapsed = useAppStore(state => state.sidebarCollapsed)
  const devToolsPanelCollapsed = useAppStore(state => state.devToolsPanelCollapsed)
  const zenMode = useAppStore(state => state.zenMode)
  const toggleSidebar = useAppStore(state => state.toggleSidebar)
  const toggleDevToolsPanel = useAppStore(state => state.toggleDevToolsPanel)
  const toggleZenMode = useAppStore(state => state.toggleZenMode)
  const activeView = useAppStore(state => state.activeView)

  const activeTab = useShellStore(state => state.activeTab)
  const setActiveTab = useShellStore(state => state.setActiveTab)

  const { data: project } = useProject(activeProjectId)

  // Panel refs for collapse/expand
  const panelGroupRef = useRef<GroupImperativeHandle | null>(null)
  const leftPanelRef = useRef<PanelImperativeHandle | null>(null)
  const rightPanelRef = useRef<PanelImperativeHandle | null>(null)
  const lastExpandedSizesRef = useRef({ left: 20, right: 20 })

  // Track layout changes to save expanded sizes
  const handleLayoutChange = useCallback(
    (layout: { [panelId: string]: number }) => {
      const leftSize = layout['primary-sidebar']
      const rightSize = layout['secondary-sidebar']
      if (typeof leftSize === 'number' && leftSize > 0) {
        lastExpandedSizesRef.current.left = leftSize
      }
      if (typeof rightSize === 'number' && rightSize > 0) {
        lastExpandedSizesRef.current.right = rightSize
      }
    },
    []
  )

  // Sync panel collapse state with app store
  useEffect(() => {
    const shouldCollapseLeft = zenMode || sidebarCollapsed
    const shouldCollapseRight = zenMode || devToolsPanelCollapsed
    const panelGroup = panelGroupRef.current
    const leftPanel = leftPanelRef.current
    const rightPanel = rightPanelRef.current

    if (!panelGroup || !leftPanel || !rightPanel) return

    try {
      const isLeftCollapsed = leftPanel.isCollapsed()
      const isRightCollapsed = rightPanel.isCollapsed()

      // Get current layout to calculate new layout
      const currentLayout = panelGroup.getLayout()
      const currentLeft = currentLayout['primary-sidebar'] ?? 0
      const currentCenter = currentLayout['main-content'] ?? 60
      const currentRight = currentLayout['secondary-sidebar'] ?? 0

      // Save sizes before collapsing
      if (currentLeft > 0) lastExpandedSizesRef.current.left = currentLeft
      if (currentRight > 0) lastExpandedSizesRef.current.right = currentRight

      // Determine target sizes
      const targetLeft = shouldCollapseLeft
        ? 0
        : isLeftCollapsed
          ? lastExpandedSizesRef.current.left
          : currentLeft
      const targetRight = shouldCollapseRight
        ? 0
        : isRightCollapsed
          ? lastExpandedSizesRef.current.right
          : currentRight

      // Calculate center to fill remaining space
      const targetCenter = 100 - targetLeft - targetRight

      // Apply new layout using setLayout on the group
      panelGroup.setLayout({
        'primary-sidebar': targetLeft,
        'main-content': targetCenter,
        'secondary-sidebar': targetRight,
      })
    } catch {
      // Panel may not be ready
    }
  }, [sidebarCollapsed, devToolsPanelCollapsed, zenMode])

  const handleTabChange = useCallback(
    (tab: ActivityBarTab) => {
      setActiveTab(tab as ShellTab)
    },
    [setActiveTab]
  )

  const isLeftPanelVisible = !zenMode && !sidebarCollapsed
  const isRightPanelVisible = !zenMode && !devToolsPanelCollapsed

  // Determine what to show in main content
  const renderMainContent = () => {
    if (activeView === 'tasks') {
      return <TasksContent />
    }
    return <MainContent projectId={activeProjectId} />
  }

  return (
    <div className="h-screen w-full bg-background text-foreground flex flex-col">
      {/* Top navigation */}
      <TopNav
        leftSidebarCollapsed={sidebarCollapsed}
        onToggleLeftSidebar={toggleSidebar}
        onToggleRightSidebar={toggleDevToolsPanel}
        onToggleZenMode={toggleZenMode}
        projectId={activeProjectId}
        rightSidebarCollapsed={devToolsPanelCollapsed}
        zenMode={zenMode}
      />

      {/* Main layout */}
      <div className="flex-1 flex min-h-0">
        {/* Activity bar - always visible unless zen mode */}
        {!zenMode && (
          <ActivityBar
            activeTab={activeTab}
            hasActiveProject={!!activeProjectId}
            onOpenSettings={openSettingsPanel}
            onTabChange={handleTabChange}
          />
        )}

        {/* Resizable panels */}
        <ResizablePanelGroup
          className="flex-1"
          id="app-shell-layout"
          onLayoutChange={handleLayoutChange}
          orientation="horizontal"
          ref={panelGroupRef}
        >
          {/* Primary sidebar */}
          <ResizablePanel
            className="bg-card"
            collapsedSize={0}
            collapsible
            defaultSize={20}
            id="primary-sidebar"
            minSize={15}
            ref={leftPanelRef}
          >
            {isLeftPanelVisible && (
              <PrimarySidebar
                activeTab={activeTab}
                projectId={activeProjectId}
                projectPath={project?.path || null}
              />
            )}
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Main content */}
          <ResizablePanel defaultSize={60} id="main-content" minSize={30}>
            {renderMainContent()}
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Secondary sidebar */}
          <ResizablePanel
            className="bg-card"
            collapsedSize={0}
            collapsible
            defaultSize={20}
            id="secondary-sidebar"
            minSize={15}
            ref={rightPanelRef}
          >
            {isRightPanelVisible && <SecondarySidebar />}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Status bar */}
      <StatusBar />

      {/* Overlays */}
      <CommandPalette />
      <SettingsPanel isOpen={settingsPanelOpen} onClose={closeSettingsPanel} />
      <ErrorToast />
    </div>
  )
}
