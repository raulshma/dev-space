/**
 * AppShell Component
 *
 * VS Code-like shell layout with:
 * - Activity bar (far left icons)
 * - Primary sidebar (left panel)
 * - Main content area (center)
 * - Secondary sidebar (right panel)
 * - Status bar (bottom)
 *
 * Performance optimized with lazy loading for heavy components.
 */

import { useCallback, useRef, useEffect, Suspense, lazy, memo } from 'react'
import { useWorkspaceSession } from 'renderer/hooks/use-workspace-session'
import { useAppStore } from 'renderer/stores/app-store'
import { useShellStore, type ShellTab } from 'renderer/stores/shell-store'
import { ActivityBar, type ActivityBarTab } from './ActivityBar'
import { TopNav } from './TopNav'
import { PrimarySidebar } from './PrimarySidebar'
import { MainContent } from './MainContent'
import { TasksContent } from './TasksContent'
import { StatusBar } from 'renderer/components/StatusBar'
import { ErrorToast } from 'renderer/components/ErrorToast'
import { useProject } from 'renderer/hooks/use-projects'
import { Spinner } from 'renderer/components/ui/spinner'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
  type GroupImperativeHandle,
  type PanelImperativeHandle,
} from 'renderer/components/ui/resizable'

// Lazy load heavy overlay components that aren't needed immediately
const CommandPalette = lazy(() =>
  import('renderer/components/CommandPalette').then(m => ({
    default: m.CommandPalette,
  }))
)
const SettingsPanel = lazy(() =>
  import('renderer/components/Settings').then(m => ({
    default: m.SettingsPanel,
  }))
)
const SecondarySidebar = lazy(() =>
  import('./SecondarySidebar').then(m => ({ default: m.SecondarySidebar }))
)

// Fallback for lazy-loaded components
const LazyFallback = memo(() => null)

export function AppShell(): React.JSX.Element {
  const activeProjectId = useAppStore(state => state.activeProjectId)
  const settingsPanelOpen = useAppStore(state => state.settingsPanelOpen)
  const closeSettingsPanel = useAppStore(state => state.closeSettingsPanel)
  const openSettingsPanel = useAppStore(state => state.openSettingsPanel)
  const sidebarCollapsed = useAppStore(state => state.sidebarCollapsed)
  const devToolsPanelCollapsed = useAppStore(
    state => state.devToolsPanelCollapsed
  )
  const zenMode = useAppStore(state => state.zenMode)
  const toggleSidebar = useAppStore(state => state.toggleSidebar)
  const toggleDevToolsPanel = useAppStore(state => state.toggleDevToolsPanel)
  const toggleZenMode = useAppStore(state => state.toggleZenMode)
  const activeView = useAppStore(state => state.activeView)

  const activeTab = useShellStore(state => state.activeTab)
  const setActiveTab = useShellStore(state => state.setActiveTab)

  const { data: project, isLoading: projectLoading } = useProject(activeProjectId)

  // Panel refs for collapse/expand
  const panelGroupRef = useRef<GroupImperativeHandle | null>(null)
  const leftPanelRef = useRef<PanelImperativeHandle | null>(null)
  const rightPanelRef = useRef<PanelImperativeHandle | null>(null)
  const centerPanelGroupRef = useRef<GroupImperativeHandle | null>(null)

  // Session management
  const {
    isReady: isSessionReady,
    lastLayoutRef,
    lastCenterLayoutRef,
    lastExpandedSizesRef,
    restoredLayout,
    restoredCenterLayout,
    scheduleSave,
  } = useWorkspaceSession({
    projectId: activeProjectId || '',
    project,
    projectLoading,
    panelGroupRef,
    centerPanelGroupRef,
  })

  const handleLayoutChange = useCallback(
    (layout: any) => {
      lastLayoutRef.current = layout

      // Support both array and object layout formats
      let leftSize: number | undefined
      let rightSize: number | undefined

      if (Array.isArray(layout)) {
        if (layout.length >= 3) {
          leftSize = layout[0]
          rightSize = layout[2]
        } else if (layout.length === 2) {
          // If only 2 panels, it might be [left, center] or [center, right]
          // But in AppShell it's usually [left, center, right]
          // If it's 2, we can't be sure without more info, but let's assume [left, center]
          leftSize = layout[0]
        }
      } else if (layout && typeof layout === 'object') {
        leftSize = layout['primary-sidebar']
        rightSize = layout['secondary-sidebar']
      }

      const {
        sidebarCollapsed: currentSidebarCollapsed,
        devToolsPanelCollapsed: currentDevToolsCollapsed,
        setSidebarCollapsed,
        setDevToolsPanelCollapsed,
      } = useAppStore.getState()

      if (typeof leftSize === 'number') {
        if (leftSize > 0) {
          lastExpandedSizesRef.current.left = leftSize
          if (currentSidebarCollapsed) setSidebarCollapsed(false)
        } else if (leftSize === 0) {
          if (!currentSidebarCollapsed) setSidebarCollapsed(true)
        }
      }

      if (typeof rightSize === 'number') {
        if (rightSize > 0) {
          lastExpandedSizesRef.current.right = rightSize
          if (currentDevToolsCollapsed) setDevToolsPanelCollapsed(false)
        } else if (rightSize === 0) {
          if (!currentDevToolsCollapsed) setDevToolsPanelCollapsed(true)
        }
      }

      scheduleSave()
    },
    [scheduleSave, lastLayoutRef, lastExpandedSizesRef]
  )

  // Sync panel collapse state with app store
  useEffect(() => {
    const panelGroup = panelGroupRef.current
    if (!panelGroup || !isSessionReady) return

    const shouldCollapseLeft = zenMode || sidebarCollapsed
    const shouldCollapseRight = zenMode || devToolsPanelCollapsed

    // Calculate target sizes
    const leftSize = shouldCollapseLeft
      ? 0
      : (lastExpandedSizesRef.current.left || 20)
    const rightSize = shouldCollapseRight
      ? 0
      : (lastExpandedSizesRef.current.right || 20)
    const centerSize = 100 - leftSize - rightSize

    // Use layoutHint to determine format without calling getLayout (which can throw)
    const layoutHint = lastLayoutRef.current || restoredLayout
    
    try {
      if (Array.isArray(layoutHint)) {
        panelGroup.setLayout([leftSize, centerSize, rightSize] as any)
      } else {
        // Fallback to object format or check if we should try getLayout safely
        panelGroup.setLayout({
          'primary-sidebar': leftSize,
          'main-content': centerSize,
          'secondary-sidebar': rightSize,
        } as any)
      }
    } catch (err) {
      // If setLayout fails or throws, the component is likely still mounting
      console.debug('AppShell: Layout sync postponed (panel group not ready)', err)
    }
  }, [sidebarCollapsed, devToolsPanelCollapsed, zenMode, isSessionReady])

  const handleTabChange = useCallback(
    (tab: ActivityBarTab) => {
      setActiveTab(tab as ShellTab)
    },
    [setActiveTab]
  )

  if (activeProjectId && project && !isSessionReady) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  const isLeftPanelVisible = !zenMode && !sidebarCollapsed
  const isRightPanelVisible = !zenMode && !devToolsPanelCollapsed

  // Determine what to show in main content
  const renderMainContent = () => {
    if (activeView === 'tasks') {
      return <TasksContent />
    }
    return (
      <MainContent
        centerPanelGroupRef={centerPanelGroupRef}
        isSessionReady={isSessionReady}
        onCenterLayoutChange={(layout: any) => {
          lastCenterLayoutRef.current = layout
          scheduleSave()
        }}
        projectId={activeProjectId}
        restoredCenterLayout={restoredCenterLayout}
      />
    )
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
          defaultLayout={restoredLayout}
          id="app-shell-layout"
          key={activeProjectId || 'none'}
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

          {/* Secondary sidebar - lazy loaded */}
          <ResizablePanel
            className="bg-card overflow-hidden"
            collapsedSize={0}
            collapsible
            defaultSize={20}
            id="secondary-sidebar"
            minSize={15}
            ref={rightPanelRef}
          >
            {isRightPanelVisible && (
              <Suspense fallback={<LazyFallback />}>
                <SecondarySidebar />
              </Suspense>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Status bar */}
      <StatusBar />

      {/* Overlays - lazy loaded */}
      <Suspense fallback={<LazyFallback />}>
        <CommandPalette />
      </Suspense>
      <Suspense fallback={<LazyFallback />}>
        <SettingsPanel
          isOpen={settingsPanelOpen}
          onClose={closeSettingsPanel}
        />
      </Suspense>
      <ErrorToast />
    </div>
  )
}
