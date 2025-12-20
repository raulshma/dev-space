/**
 * MainContent Component
 *
 * The main content area with editor and terminal.
 */

import { memo, useRef, useEffect } from 'react'
import { useProject } from 'renderer/hooks/use-projects'
import { useWorkspaceTerminals } from 'renderer/hooks/use-workspace-terminals'
import { Terminal } from 'renderer/components/Terminal/Terminal'
import { PinnedProcessIndicator } from 'renderer/components/Terminal/PinnedProcessIndicator'
import { CodeEditorPanel } from 'renderer/components/CodeEditor'
import { useEditorStore } from 'renderer/stores/editor-store'
import { useAppStore } from 'renderer/stores/app-store'
import { SectionNav } from 'renderer/components/Shell/SectionNav'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
  type GroupImperativeHandle,
} from 'renderer/components/ui/resizable'

interface MainContentProps {
  projectId: string | null
  restoredCenterLayout?: { [panelId: string]: number }
  onCenterLayoutChange?: (layout: { [panelId: string]: number }) => void
  centerPanelGroupRef?: React.RefObject<GroupImperativeHandle | null>
  isSessionReady?: boolean
}

export const MainContent = memo(function MainContent({
  projectId,
  restoredCenterLayout,
  onCenterLayoutChange,
  centerPanelGroupRef,
  isSessionReady,
}: MainContentProps) {
  const { data: project, isLoading: projectLoading } = useProject(projectId)
  const hasOpenFiles = useEditorStore(state => state.openFiles.length > 0)
  const setActiveView = useAppStore(state => state.setActiveView)
  const appliedLayoutRef = useRef<string | null>(null)

  // Terminal management
  const { isRestoring: isRestoringTerminals } = useWorkspaceTerminals({
    projectId: projectId || '',
    project,
    projectLoading,
  })

  // Apply layout imperatively when defaultLayout changes
  useEffect(() => {
    if (!hasOpenFiles || !restoredCenterLayout) return

    const layoutKey = JSON.stringify(restoredCenterLayout)
    if (appliedLayoutRef.current === layoutKey) return

    const applyLayout = () => {
      if (centerPanelGroupRef?.current) {
        try {
          centerPanelGroupRef.current.setLayout(restoredCenterLayout)
          appliedLayoutRef.current = layoutKey
          return true
        } catch {
          return false
        }
      }
      return false
    }

    if (applyLayout()) return

    const delays = [50, 100, 150, 200, 300]
    let index = 0
    let timeoutId: number | undefined

    const tryApply = () => {
      if (applyLayout() || index >= delays.length) return
      timeoutId = window.setTimeout(tryApply, delays[index++])
    }

    timeoutId = window.setTimeout(tryApply, delays[index++])

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [hasOpenFiles, restoredCenterLayout])

  // Reset when files are closed
  useEffect(() => {
    if (!hasOpenFiles) {
      appliedLayoutRef.current = null
    }
  }, [hasOpenFiles])

  // No project selected - show welcome
  if (!projectId) {
    return (
      <main className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Welcome to Mira
          </h2>
          <p className="text-muted-foreground">
            Select a project from the sidebar to get started
          </p>
        </div>
      </main>
    )
  }

  // Loading state
  if (projectLoading || !isSessionReady) {
    return (
      <main className="h-full flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading workspace...</p>
      </main>
    )
  }

  // Project not found
  if (!project) {
    return (
      <main className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Project not found</p>
        </div>
      </main>
    )
  }

  // Main content wrapper with SectionNav
  const renderWorkspaceContent = () => {
    if (!hasOpenFiles) {
      return (
        <div className="flex-1 min-h-0 relative">
          <Terminal
            isRestoring={isRestoringTerminals}
            projectId={projectId}
            projectPath={project.path}
          />
        </div>
      )
    }

    return (
      <div className="flex-1 min-h-0 relative">
        <ResizablePanelGroup
          className="h-full"
          defaultLayout={restoredCenterLayout}
          onLayoutChange={onCenterLayoutChange}
          orientation="vertical"
          ref={centerPanelGroupRef}
        >
          <ResizablePanel defaultSize={60} id="center-editor" minSize={20}>
            <CodeEditorPanel />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={40} id="center-terminal" minSize={15}>
            <Terminal
              isRestoring={isRestoringTerminals}
              projectId={projectId}
              projectPath={project.path}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    )
  }

  return (
    <main className="h-full flex flex-col overflow-hidden bg-background">
      <SectionNav
        activeView="workspace"
        onViewChange={view => setActiveView(view)}
        subtitle={project.path}
        title={project.name}
      />
      {renderWorkspaceContent()}
      <PinnedProcessIndicator />
    </main>
  )
})
