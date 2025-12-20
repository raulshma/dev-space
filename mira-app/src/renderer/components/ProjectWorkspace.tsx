/**
 * ProjectWorkspace Component
 *
 * Workspace view for an active project with session restoration.
 * Requirements: 3.2, 4.2, 4.3, 4.4, 16.1, 16.2, 16.3, 16.4, 5.1, 6.1, 7.1, 7.2, 7.3, 9.2
 */

import { useEffect, useCallback, useState, useRef, useMemo, memo } from 'react'
import { IconTag, IconPlus, IconX, IconSettings } from '@tabler/icons-react'
import { useProject } from 'renderer/hooks/use-projects'

import { useWorkspaceSession } from 'renderer/hooks/use-workspace-session'
import { useWorkspaceTerminals } from 'renderer/hooks/use-workspace-terminals'
import {
  useGitTelemetry,
  useGitTelemetryRefresh,
} from 'renderer/hooks/use-git-telemetry'
import {
  useTags,
  useAddTagToProject,
  useRemoveTagFromProject,
} from 'renderer/hooks/use-tags'
import { useAppStore } from 'renderer/stores/app-store'
import { Terminal } from 'renderer/components/Terminal/Terminal'
import { PinnedProcessIndicator } from 'renderer/components/Terminal/PinnedProcessIndicator'
import { LeftSidebar } from 'renderer/components/LeftSidebar'
import { CodeEditorPanel } from 'renderer/components/CodeEditor'
import { useEditorStore } from 'renderer/stores/editor-store'
import { Button } from 'renderer/components/ui/button'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
  type GroupImperativeHandle,
  type PanelImperativeHandle,
} from 'renderer/components/ui/resizable'
import type { Tag } from 'shared/models'

interface ProjectWorkspaceProps {
  projectId: string
}

// Memoized header component
interface WorkspaceHeaderProps {
  projectName: string
  projectPath: string
  projectTags: Tag[]
  gitTelemetry: {
    isGitRepo: boolean
    branch?: string
    ahead: number
    behind: number
    modified: number
  } | null
  availableTags: Tag[]
  zenMode: boolean
  sidebarCollapsed: boolean
  devToolsPanelCollapsed: boolean
  onBackToDashboard: () => void
  onToggleZenMode: () => void
  onToggleSidebar: () => void
  onToggleDevToolsPanel: () => void
  onOpenSettings: () => void
  onAddTag: (tagId: string) => void
  onRemoveTag: (tagId: string) => void
}

const WorkspaceHeader = memo(function WorkspaceHeader({
  projectName,
  projectPath,
  projectTags,
  gitTelemetry,
  availableTags,
  zenMode,
  sidebarCollapsed,
  devToolsPanelCollapsed,
  onBackToDashboard,
  onToggleZenMode,
  onToggleSidebar,
  onToggleDevToolsPanel,
  onOpenSettings,
  onAddTag,
  onRemoveTag,
}: WorkspaceHeaderProps) {
  const [showTagMenu, setShowTagMenu] = useState(false)

  const handleAddTag = useCallback(
    (tagId: string) => {
      onAddTag(tagId)
      setShowTagMenu(false)
    },
    [onAddTag]
  )

  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            className="text-muted-foreground hover:text-foreground"
            onClick={onBackToDashboard}
          >
            ← Back
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground">
                {projectName}
              </h1>
              {gitTelemetry?.isGitRepo && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded">
                    {gitTelemetry.branch || 'main'}
                  </span>
                  {gitTelemetry.ahead > 0 && (
                    <span className="text-green-600 dark:text-green-400">
                      ↑{gitTelemetry.ahead}
                    </span>
                  )}
                  {gitTelemetry.behind > 0 && (
                    <span className="text-red-600 dark:text-red-400">
                      ↓{gitTelemetry.behind}
                    </span>
                  )}
                  {gitTelemetry.modified > 0 && (
                    <span className="text-amber-600 dark:text-amber-400">
                      ●{gitTelemetry.modified}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-muted-foreground">{projectPath}</p>
              <div className="flex items-center gap-1 ml-2">
                {projectTags.map(tag => (
                  <span
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-sm bg-primary/20 text-primary"
                    key={tag.id}
                    style={
                      tag.color ? { backgroundColor: tag.color } : undefined
                    }
                  >
                    {tag.name}
                    <button
                      className="hover:text-destructive"
                      onClick={() => onRemoveTag(tag.id)}
                      title="Remove tag"
                    >
                      <IconX size={12} />
                    </button>
                  </span>
                ))}
                <div className="relative">
                  <button
                    className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded"
                    onClick={() => setShowTagMenu(prev => !prev)}
                    title="Add tag"
                  >
                    <IconPlus size={14} />
                  </button>
                  {showTagMenu && (
                    <>
                      <button
                        aria-label="Close tag menu"
                        className="fixed inset-0 z-10 cursor-default bg-transparent border-none"
                        onClick={() => setShowTagMenu(false)}
                        tabIndex={-1}
                        type="button"
                      />
                      <div className="absolute left-0 top-full mt-1 z-20 bg-popover border border-border rounded shadow-lg py-1 min-w-[120px]">
                        {availableTags.length > 0 ? (
                          availableTags.map(tag => (
                            <button
                              className="w-full text-left px-3 py-1.5 text-sm text-popover-foreground hover:bg-accent flex items-center gap-2"
                              key={tag.id}
                              onClick={() => handleAddTag(tag.id)}
                            >
                              <IconTag size={12} />
                              {tag.name}
                            </button>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground px-3 py-2">
                            No more tags available
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`px-3 py-1.5 rounded-sm text-sm transition-colors ${
              zenMode
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
            onClick={onToggleZenMode}
            title={
              zenMode
                ? 'Exit Zen Mode (Mod+Shift+Z)'
                : 'Enter Zen Mode (Mod+Shift+Z)'
            }
          >
            {zenMode ? '🧘 Zen' : '🧘'}
          </button>
          {!zenMode && (
            <>
              <button
                className="px-3 py-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-sm text-sm"
                onClick={onToggleSidebar}
                title="Toggle Sidebar (Mod+B)"
              >
                {sidebarCollapsed ? '☰' : '←'}
              </button>
              <button
                className="px-3 py-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-sm text-sm"
                onClick={onToggleDevToolsPanel}
                title="Toggle Dev Tools Panel"
              >
                {devToolsPanelCollapsed ? '🔧' : '→'}
              </button>
            </>
          )}
          <button
            className="p-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-sm"
            onClick={onOpenSettings}
            title="Settings (Mod+,)"
          >
            <IconSettings size={18} />
          </button>
        </div>
      </div>
    </header>
  )
})

// Dev tools panel component
interface DevToolsPanelProps {
  isVisible: boolean
  onTogglePanel: () => void
}

const DevToolsPanel = memo(function DevToolsPanel({
  isVisible,
  onTogglePanel,
}: DevToolsPanelProps) {
  const [activeTool, setActiveTool] = useState<
    'ports' | 'tasks' | 'jwt' | 'json' | null
  >(null)

  if (!isVisible) return null

  const tools = [
    {
      id: 'ports' as const,
      label: 'Port Killer',
      description: 'Find and kill processes by port',
      icon: '🔌',
    },
    {
      id: 'tasks' as const,
      label: 'Task Killer',
      description: 'View and kill running processes',
      icon: '⚙️',
    },
    {
      id: 'jwt' as const,
      label: 'JWT Decoder',
      description: 'Decode and inspect JWT tokens',
      icon: '🔑',
    },
    {
      id: 'json' as const,
      label: 'JSON Formatter',
      description: 'Format, validate, and minify JSON',
      icon: '{ }',
    },
  ]

  const selectedTool = tools.find(t => t.id === activeTool)

  return (
    <aside className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-sm font-medium">🔧 Developer Tools</span>
        <button
          className="text-muted-foreground hover:text-foreground"
          onClick={onTogglePanel}
          title="Hide Dev Tools Panel"
        >
          ✕
        </button>
      </div>

      {activeTool && selectedTool ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2">
            <Button
              className="text-xs"
              onClick={() => setActiveTool(null)}
              size="sm"
              variant="ghost"
            >
              ← Back
            </Button>
            <span className="text-sm font-medium">{selectedTool.label}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {activeTool === 'ports' && <PortKillerInline />}
            {activeTool === 'tasks' && <TaskKillerInline />}
            {activeTool === 'jwt' && <JWTDecoderInline />}
            {activeTool === 'json' && <JSONFormatterInline />}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {tools.map(tool => (
              <button
                className="w-full flex items-center gap-3 px-3 py-3 rounded-md hover:bg-muted/50 transition-colors text-left"
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                type="button"
              >
                <span className="text-lg">{tool.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{tool.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {tool.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
})

// Inline dev tool components (simplified versions for sidebar)
const PortKillerInline = memo(function PortKillerInline() {
  return (
    <div className="text-sm text-muted-foreground">
      <p>Port Killer tool - Find and kill processes by port number.</p>
      <p className="mt-2">Use the full dev tools panel for this feature.</p>
    </div>
  )
})

const TaskKillerInline = memo(function TaskKillerInline() {
  return (
    <div className="text-sm text-muted-foreground">
      <p>Task Killer tool - View and terminate running processes.</p>
      <p className="mt-2">Use the full dev tools panel for this feature.</p>
    </div>
  )
})

const JWTDecoderInline = memo(function JWTDecoderInline() {
  return (
    <div className="text-sm text-muted-foreground">
      <p>JWT Decoder tool - Decode and inspect JWT tokens.</p>
      <p className="mt-2">Use the full dev tools panel for this feature.</p>
    </div>
  )
})

const JSONFormatterInline = memo(function JSONFormatterInline() {
  return (
    <div className="text-sm text-muted-foreground">
      <p>JSON Formatter tool - Format, validate, and minify JSON.</p>
      <p className="mt-2">Use the full dev tools panel for this feature.</p>
    </div>
  )
})

// Center panel with editor and terminal
interface CenterPanelProps {
  projectId: string
  projectPath: string
  isRestoringTerminals: boolean
  panelGroupRef?: React.RefObject<GroupImperativeHandle | null>
  defaultLayout?: { [panelId: string]: number }
  onLayoutChange?: (layout: { [panelId: string]: number }) => void
}

const CenterPanel = memo(function CenterPanel({
  projectId,
  projectPath,
  isRestoringTerminals,
  panelGroupRef,
  defaultLayout,
  onLayoutChange,
}: CenterPanelProps) {
  const hasOpenFiles = useEditorStore(state => state.openFiles.length > 0)
  const appliedLayoutRef = useRef<string | null>(null)

  // Apply layout imperatively when defaultLayout changes and panel is available
  useEffect(() => {
    if (!hasOpenFiles || !defaultLayout) return

    const layoutKey = JSON.stringify(defaultLayout)
    // Skip if we've already applied this exact layout
    if (appliedLayoutRef.current === layoutKey) return

    const applyLayout = () => {
      if (panelGroupRef?.current) {
        try {
          panelGroupRef.current.setLayout(defaultLayout)
          appliedLayoutRef.current = layoutKey
          return true
        } catch {
          return false
        }
      }
      return false
    }

    // Try immediately
    if (applyLayout()) return

    // If ref not ready, poll with increasing delays
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
  }, [hasOpenFiles, defaultLayout, panelGroupRef])

  // Reset when files are closed so layout can be reapplied
  useEffect(() => {
    if (!hasOpenFiles) {
      appliedLayoutRef.current = null
    }
  }, [hasOpenFiles])

  if (!hasOpenFiles) {
    return (
      <main className="h-full overflow-hidden">
        <Terminal
          isRestoring={isRestoringTerminals}
          projectId={projectId}
          projectPath={projectPath}
        />
      </main>
    )
  }

  return (
    <ResizablePanelGroup
      className="h-full"
      defaultLayout={defaultLayout}
      onLayoutChange={onLayoutChange}
      orientation="vertical"
      ref={panelGroupRef}
    >
      <ResizablePanel defaultSize={60} id="center-editor" minSize={20}>
        <CodeEditorPanel />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={40} id="center-terminal" minSize={15}>
        <Terminal
          isRestoring={isRestoringTerminals}
          projectId={projectId}
          projectPath={projectPath}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
})

export function ProjectWorkspace({
  projectId,
}: ProjectWorkspaceProps): React.JSX.Element {
  const {
    data: project,
    isLoading: projectLoading,
    refetch: refetchProject,
  } = useProject(projectId)
  const { data: allTags = [] } = useTags()
  const addTagToProject = useAddTagToProject()
  const removeTagFromProject = useRemoveTagFromProject()

  // Git telemetry
  const { data: gitTelemetry } = useGitTelemetry(
    project?.isMissing ? null : project?.path || null
  )
  useGitTelemetryRefresh(
    projectId,
    project?.path || null,
    !!project && !project.isMissing
  )

  // App store
  const setActiveProject = useAppStore(state => state.setActiveProject)
  const sidebarCollapsed = useAppStore(state => state.sidebarCollapsed)
  const devToolsPanelCollapsed = useAppStore(state => state.devToolsPanelCollapsed)
  const zenMode = useAppStore(state => state.zenMode)
  const toggleSidebar = useAppStore(state => state.toggleSidebar)
  const toggleDevToolsPanel = useAppStore(state => state.toggleDevToolsPanel)
  const toggleZenMode = useAppStore(state => state.toggleZenMode)
  const openSettingsPanel = useAppStore(state => state.openSettingsPanel)

  // Panel refs
  const panelGroupRef = useRef<GroupImperativeHandle | null>(null)
  const centerPanelGroupRef = useRef<GroupImperativeHandle | null>(null)
  const leftPanelRef = useRef<PanelImperativeHandle | null>(null)
  const rightPanelRef = useRef<PanelImperativeHandle | null>(null)

  // Session management
  const {
    isReady: isSessionReady,
    lastLayoutRef,
    lastCenterLayoutRef,
    lastExpandedSizesRef,
    restoredLayout,
    restoredCenterLayout,
    scheduleSave,
    saveNow,
  } = useWorkspaceSession({
    projectId,
    project,
    projectLoading,
    panelGroupRef,
    centerPanelGroupRef,
  })

  // Terminal management
  const { isRestoring: isRestoringTerminals } = useWorkspaceTerminals({
    projectId,
    project,
    projectLoading,
  })

  // Computed values
  const availableTags = useMemo(
    () => allTags.filter(tag => !project?.tags.some(t => t.id === tag.id)),
    [allTags, project?.tags]
  )

  const gitTelemetryData = useMemo(
    () =>
      gitTelemetry
        ? {
            isGitRepo: gitTelemetry.isGitRepo,
            branch: gitTelemetry.branch,
            ahead: gitTelemetry.ahead,
            behind: gitTelemetry.behind,
            modified: gitTelemetry.modified,
          }
        : null,
    [gitTelemetry]
  )

  // Panel collapse sync
  useEffect(() => {
    const shouldCollapseLeft = zenMode || sidebarCollapsed
    const shouldCollapseRight = zenMode || devToolsPanelCollapsed
    const leftPanel = leftPanelRef.current
    const rightPanel = rightPanelRef.current

    if (leftPanel) {
      try {
        const { asPercentage: size } = leftPanel.getSize()
        if (size > 0) lastExpandedSizesRef.current.left = size

        if (shouldCollapseLeft && !leftPanel.isCollapsed()) {
          leftPanel.collapse()
        } else if (!shouldCollapseLeft && leftPanel.isCollapsed()) {
          leftPanel.expand()
          leftPanel.resize(lastExpandedSizesRef.current.left || 15)
        }
      } catch {
        // Panel may not be ready
      }
    }

    if (rightPanel) {
      try {
        const { asPercentage: size } = rightPanel.getSize()
        if (size > 0) lastExpandedSizesRef.current.right = size

        if (shouldCollapseRight && !rightPanel.isCollapsed()) {
          rightPanel.collapse()
        } else if (!shouldCollapseRight && rightPanel.isCollapsed()) {
          rightPanel.expand()
          rightPanel.resize(lastExpandedSizesRef.current.right || 15)
        }
      } catch {
        // Panel may not be ready
      }
    }

    scheduleSave()
  }, [
    sidebarCollapsed,
    devToolsPanelCollapsed,
    zenMode,
    scheduleSave,
    lastExpandedSizesRef,
  ])

  // Event handlers
  const handleAddTag = useCallback(
    async (tagId: string) => {
      try {
        await addTagToProject.mutateAsync({ projectId, tagId })
        refetchProject()
      } catch (error) {
        console.error('Failed to add tag:', error)
      }
    },
    [addTagToProject, projectId, refetchProject]
  )

  const handleRemoveTag = useCallback(
    async (tagId: string) => {
      try {
        await removeTagFromProject.mutateAsync({ projectId, tagId })
        refetchProject()
      } catch (error) {
        console.error('Failed to remove tag:', error)
      }
    },
    [removeTagFromProject, projectId, refetchProject]
  )

  const handleBackToDashboard = useCallback(() => {
    saveNow()
    setActiveProject(null)
  }, [saveNow, setActiveProject])

  const handleLayoutChange = useCallback(
    (layout: { [panelId: string]: number }) => {
      // Update refs with new layout
      lastLayoutRef.current = layout
      const leftSize = layout['project-workspace-left']
      const rightSize = layout['project-workspace-right']
      if (typeof leftSize === 'number' && leftSize > 0) {
        lastExpandedSizesRef.current.left = leftSize
      }
      if (typeof rightSize === 'number' && rightSize > 0) {
        lastExpandedSizesRef.current.right = rightSize
      }
      // Trigger debounced save
      scheduleSave()
    },
    [scheduleSave, lastLayoutRef, lastExpandedSizesRef]
  )

  const handleCenterLayoutChange = useCallback(
    (layout: { [panelId: string]: number }) => {
      lastCenterLayoutRef.current = layout
      scheduleSave()
    },
    [scheduleSave, lastCenterLayoutRef]
  )

  // Visibility states
  const isLeftPanelVisible = !zenMode && !sidebarCollapsed
  const isRightPanelVisible = !zenMode && !devToolsPanelCollapsed

  // Loading state - wait for both project and session to be ready
  if (projectLoading || !isSessionReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <p className="text-muted-foreground">Loading workspace...</p>
      </div>
    )
  }

  // Not found state
  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Project not found</p>
          <button
            className="px-4 py-2 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90"
            onClick={handleBackToDashboard}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <WorkspaceHeader
        devToolsPanelCollapsed={devToolsPanelCollapsed}
        availableTags={availableTags}
        gitTelemetry={gitTelemetryData}
        onAddTag={handleAddTag}
        onBackToDashboard={handleBackToDashboard}
        onOpenSettings={openSettingsPanel}
        onRemoveTag={handleRemoveTag}
        onToggleDevToolsPanel={toggleDevToolsPanel}
        onToggleSidebar={toggleSidebar}
        onToggleZenMode={toggleZenMode}
        projectName={project.name}
        projectPath={project.path}
        projectTags={project.tags}
        sidebarCollapsed={sidebarCollapsed}
        zenMode={zenMode}
      />

      <ResizablePanelGroup
        className="flex-1"
        defaultLayout={restoredLayout}
        id={`project-workspace-${projectId}`}
        onLayoutChange={handleLayoutChange}
        orientation="horizontal"
        ref={panelGroupRef}
      >
        <ResizablePanel
          className="bg-card"
          collapsedSize={0}
          collapsible
          defaultSize={15}
          id="project-workspace-left"
          minSize={10}
          ref={leftPanelRef}
        >
          {isLeftPanelVisible && (
            <aside className="h-full overflow-hidden">
              <LeftSidebar projectId={projectId} projectPath={project.path} />
            </aside>
          )}
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel
          defaultSize={70}
          id="project-workspace-center"
          minSize={10}
        >
          <CenterPanel
            defaultLayout={restoredCenterLayout}
            isRestoringTerminals={isRestoringTerminals}
            onLayoutChange={handleCenterLayoutChange}
            panelGroupRef={centerPanelGroupRef}
            projectId={projectId}
            projectPath={project.path}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel
          className="bg-card"
          collapsedSize={0}
          collapsible
          defaultSize={15}
          id="project-workspace-right"
          minSize={10}
          ref={rightPanelRef}
        >
          <DevToolsPanel
            isVisible={isRightPanelVisible}
            onTogglePanel={toggleDevToolsPanel}
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      <PinnedProcessIndicator />
    </div>
  )
}
