/**
 * ProjectWorkspace Component
 *
 * Workspace view for an active project with session restoration.
 * Requirements: 3.2, 4.2, 4.3, 4.4, 16.1, 16.2, 16.3, 16.4, 5.1, 6.1, 7.1, 7.2, 7.3, 9.2
 *
 * Performance optimizations:
 * - Memoized callbacks with useCallback
 * - Computed values with useMemo
 * - Extracted sub-components to prevent re-renders
 * - Consolidated useEffects for related logic
 * - Stable references for event handlers
 */

import { useEffect, useCallback, useState, useRef, useMemo, memo } from 'react'
import { IconTag, IconPlus, IconX, IconSettings } from '@tabler/icons-react'
import type {
  ImperativePanelGroupHandle,
  ImperativePanelHandle,
} from 'react-resizable-panels'
import { useProject } from 'renderer/hooks/use-projects'
import { useSession, useSaveSession } from 'renderer/hooks/use-sessions'
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
import { useTerminalStore } from 'renderer/stores/terminal-store'
import { useAgentTaskStore } from 'renderer/stores/agent-task-store'
import { useAgentTasks } from 'renderer/hooks/use-agent-tasks'
import { Terminal } from 'renderer/components/Terminal/Terminal'
import { PinnedProcessIndicator } from 'renderer/components/Terminal/PinnedProcessIndicator'
import { CommandLibrary } from 'renderer/components/CommandLibrary'
import { ProjectScripts } from 'renderer/components/ProjectScripts'
import { ContextShredder } from 'renderer/components/Agent/ContextShredder'
import { TaskBacklogList } from 'renderer/components/Agent/TaskBacklogList'
import { TaskDetailView } from 'renderer/components/Agent/TaskDetailView'
import { TaskCompletionView } from 'renderer/components/Agent/TaskCompletionView'
import { TaskCreationDialog } from 'renderer/components/Agent/TaskCreationDialog'
import { Button } from 'renderer/components/ui/button'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from 'renderer/components/ui/resizable'
import type { SessionState, Tag } from 'shared/models'
import type { AgentTask } from 'shared/ai-types'

interface ProjectWorkspaceProps {
  projectId: string
}

// Memoized header component to prevent re-renders
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
  agentPanelCollapsed: boolean
  onBackToDashboard: () => void
  onToggleZenMode: () => void
  onToggleSidebar: () => void
  onToggleAgentPanel: () => void
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
  agentPanelCollapsed,
  onBackToDashboard,
  onToggleZenMode,
  onToggleSidebar,
  onToggleAgentPanel,
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
                  <span className="px-2 py-0.5 bg-secondary rounded">
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
                onClick={onToggleAgentPanel}
                title="Toggle Agent Panel"
              >
                {agentPanelCollapsed ? '🤖' : '→'}
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

// Memoized agent panel component
interface AgentPanelProps {
  projectId: string
  projectPath: string
  isVisible: boolean
  onTogglePanel: () => void
  onNavigateToTasks: (taskId?: string) => void
}

const AgentPanel = memo(function AgentPanel({
  projectId,
  projectPath,
  isVisible,
  onTogglePanel,
  onNavigateToTasks,
}: AgentPanelProps) {
  const [taskView, setTaskView] = useState<'list' | 'detail' | 'completion'>(
    'list'
  )
  const [showTaskCreation, setShowTaskCreation] = useState(false)
  const { selectedTaskId, setSelectedTask } = useAgentTaskStore()

  // Load persisted tasks from database on mount
  useAgentTasks()

  const handleTaskSelect = useCallback(
    (taskId: string) => {
      // Navigate to tasks page with the selected task
      setSelectedTask(taskId)
      onNavigateToTasks(taskId)
    },
    [setSelectedTask, onNavigateToTasks]
  )

  const handleTaskCreated = useCallback(
    (taskId: string) => {
      setSelectedTask(taskId)
      setTaskView('list')
    },
    [setSelectedTask]
  )

  const handleBackToTaskList = useCallback(() => {
    setTaskView('list')
    setSelectedTask(null)
  }, [setSelectedTask])

  const handleViewFullOutput = useCallback(() => {
    setTaskView('detail')
  }, [])

  const handleEditTask = useCallback(
    (task: AgentTask) => {
      // Navigate to tasks page with the selected task for editing
      setSelectedTask(task.id)
      onNavigateToTasks(task.id)
    },
    [setSelectedTask, onNavigateToTasks]
  )

  const handleOpenTaskCreation = useCallback(() => {
    setShowTaskCreation(true)
  }, [])

  const handleCloseTaskCreation = useCallback((open: boolean) => {
    setShowTaskCreation(open)
  }, [])

  const handleViewAllTasks = useCallback(() => {
    onNavigateToTasks()
  }, [onNavigateToTasks])

  if (!isVisible) return null

  return (
    <aside className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-sm font-medium">🤖 Agent Tasks</span>
        <button
          className="text-muted-foreground hover:text-foreground"
          onClick={onTogglePanel}
          title="Hide Agent Panel"
        >
          ✕
        </button>
      </div>

      <div className="h-48 border-b border-border">
        <ContextShredder projectId={projectId} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          {taskView !== 'list' && (
            <Button
              className="text-xs"
              onClick={handleBackToTaskList}
              size="sm"
              variant="ghost"
            >
              ← Back to List
            </Button>
          )}
          {taskView === 'list' && (
            <span className="text-sm font-medium">Tasks</span>
          )}
          {taskView === 'list' && (
            <div className="flex items-center gap-2">
              <Button
                className="text-xs"
                onClick={handleViewAllTasks}
                size="sm"
                variant="ghost"
              >
                View All
              </Button>
              <Button
                className="text-xs"
                onClick={handleOpenTaskCreation}
                size="sm"
                variant="outline"
              >
                + New Task
              </Button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {taskView === 'list' && (
            <TaskBacklogList
              onEditTask={handleEditTask}
              onTaskSelect={handleTaskSelect}
            />
          )}
          {taskView === 'detail' && selectedTaskId && (
            <TaskDetailView
              onBack={handleBackToTaskList}
              taskId={selectedTaskId}
            />
          )}
          {taskView === 'completion' && selectedTaskId && (
            <TaskCompletionView
              onBack={handleBackToTaskList}
              onViewOutput={handleViewFullOutput}
              taskId={selectedTaskId}
            />
          )}
        </div>
      </div>

      <TaskCreationDialog
        defaultDirectory={projectPath}
        onOpenChange={handleCloseTaskCreation}
        onTaskCreated={handleTaskCreated}
        open={showTaskCreation}
      />
    </aside>
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
  const { data: session, isLoading: sessionLoading } = useSession(projectId)
  const { mutate: saveSession } = useSaveSession()
  const { data: allTags = [] } = useTags()
  const addTagToProject = useAddTagToProject()
  const removeTagFromProject = useRemoveTagFromProject()

  // Git telemetry for header display
  const { data: gitTelemetry } = useGitTelemetry(
    project?.isMissing ? null : project?.path || null
  )

  // Start background git telemetry refresh when project is opened
  useGitTelemetryRefresh(
    projectId,
    project?.path || null,
    !!project && !project.isMissing
  )

  // Select store values individually to prevent unnecessary re-renders
  const setActiveProject = useAppStore(state => state.setActiveProject)
  const setActiveView = useAppStore(state => state.setActiveView)
  const sidebarCollapsed = useAppStore(state => state.sidebarCollapsed)
  const agentPanelCollapsed = useAppStore(state => state.agentPanelCollapsed)
  const zenMode = useAppStore(state => state.zenMode)
  const toggleSidebar = useAppStore(state => state.toggleSidebar)
  const toggleAgentPanel = useAppStore(state => state.toggleAgentPanel)
  const toggleZenMode = useAppStore(state => state.toggleZenMode)
  const openSettingsPanel = useAppStore(state => state.openSettingsPanel)
  const hydrateWorkspaceState = useAppStore(
    state => state.hydrateWorkspaceState
  )

  const addTerminal = useTerminalStore(state => state.addTerminal)
  const clearProject = useTerminalStore(state => state.clearProject)

  // Refs for session management
  const sessionRestoredRef = useRef(false)
  const panelGroupRef = useRef<ImperativePanelGroupHandle | null>(null)
  const leftPanelRef = useRef<ImperativePanelHandle | null>(null)
  const rightPanelRef = useRef<ImperativePanelHandle | null>(null)
  const lastKnownLayoutRef = useRef<number[] | null>(null)
  const lastExpandedSizesRef = useRef<{ left: number; right: number }>({
    left: 15,
    right: 15,
  })
  const saveDebounceTimerRef = useRef<number | null>(null)

  // Track if terminal restoration is in progress to prevent flash
  const [isRestoringTerminals, setIsRestoringTerminals] = useState(true)

  // Memoized computed values
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

  // Build session state - memoized to prevent recreation
  const buildSessionState = useCallback((): SessionState => {
    const terminals = useTerminalStore
      .getState()
      .getTerminalsByProject(projectId)
    const appState = useAppStore.getState()
    const layout =
      panelGroupRef.current?.getLayout() ??
      lastKnownLayoutRef.current ??
      undefined

    return {
      terminals: terminals.map(t => ({
        id: t.id,
        cwd: t.cwd,
        isPinned: t.isPinned,
        layout: { projectId, panes: [] },
      })),
      agentConversation: [],
      contextFiles: [],
      activeTerminalId: appState.activeTerminalId,
      workspace: {
        panelLayout: layout,
        sidebarCollapsed: appState.sidebarCollapsed,
        agentPanelCollapsed: appState.agentPanelCollapsed,
        zenMode: appState.zenMode,
        previousSidebarState: appState.previousSidebarState,
        previousAgentPanelState: appState.previousAgentPanelState,
      },
    }
  }, [projectId])

  // Debounced session save
  const scheduleSaveSession = useCallback((): void => {
    if (!sessionRestoredRef.current) return

    if (saveDebounceTimerRef.current) {
      window.clearTimeout(saveDebounceTimerRef.current)
    }

    saveDebounceTimerRef.current = window.setTimeout(() => {
      saveDebounceTimerRef.current = null
      saveSession({ projectId, state: buildSessionState() })
    }, 800)
  }, [buildSessionState, projectId, saveSession])

  // Create default terminal
  const createDefaultTerminal = useCallback((): void => {
    if (!project) return

    const existingTerminals = useTerminalStore
      .getState()
      .getTerminalsByProject(projectId)
    if (existingTerminals.length > 0) return

    window.api.pty
      .create({ projectId, cwd: project.path, shell: undefined })
      .then(response => {
        const currentTerminals = useTerminalStore
          .getState()
          .getTerminalsByProject(projectId)
        if (currentTerminals.length > 0) {
          window.api.pty.kill({ ptyId: response.ptyId }).catch(console.error)
          return
        }

        addTerminal({
          id: `term-${Date.now()}`,
          projectId,
          ptyId: response.ptyId,
          isPinned: false,
          title: 'Terminal',
          cwd: project.path,
        })
      })
      .catch(error => {
        console.error('Failed to create default terminal:', error)
      })
  }, [project, projectId, addTerminal])

  // Session restoration and cleanup - single consolidated effect
  useEffect(() => {
    if (sessionRestoredRef.current || sessionLoading) return

    sessionRestoredRef.current = true

    // Restore workspace UI state
    if (session?.workspace) {
      hydrateWorkspaceState({
        sidebarCollapsed: session.workspace.sidebarCollapsed ?? false,
        agentPanelCollapsed: session.workspace.agentPanelCollapsed ?? false,
        zenMode: session.workspace.zenMode ?? false,
        previousSidebarState: session.workspace.previousSidebarState ?? false,
        previousAgentPanelState:
          session.workspace.previousAgentPanelState ?? false,
      })
    }

    // Restore panel layout
    if (session?.workspace?.panelLayout?.length) {
      lastKnownLayoutRef.current = session.workspace.panelLayout
      const [left, , right] = session.workspace.panelLayout
      if (typeof left === 'number' && left > 0)
        lastExpandedSizesRef.current.left = left
      if (typeof right === 'number' && right > 0)
        lastExpandedSizesRef.current.right = right

      try {
        panelGroupRef.current?.setLayout(session.workspace.panelLayout)
      } catch (error) {
        console.warn('Failed to restore panel layout:', error)
      }
    }

    // Restore terminals
    const existingTerminals = useTerminalStore
      .getState()
      .getTerminalsByProject(projectId)

    if (existingTerminals.length === 0) {
      if (session?.terminals?.length) {
        // Track pending terminal restorations
        let pendingCount = session.terminals.length
        session.terminals.forEach(terminalData => {
          window.api.pty
            .create({ projectId, cwd: terminalData.cwd, shell: undefined })
            .then(response => {
              addTerminal({
                id: terminalData.id,
                projectId,
                ptyId: response.ptyId,
                isPinned: terminalData.isPinned,
                title: `Terminal ${terminalData.id.slice(0, 8)}`,
                cwd: terminalData.cwd,
              })
            })
            .catch(error => {
              console.error('Failed to restore terminal:', error)
            })
            .finally(() => {
              pendingCount--
              if (pendingCount === 0) {
                setIsRestoringTerminals(false)
              }
            })
        })
      } else {
        // No session terminals - create default and mark restoration complete
        createDefaultTerminal()
        // Small delay to allow the default terminal creation to complete
        setTimeout(() => setIsRestoringTerminals(false), 100)
      }
    } else {
      // Terminals already exist, no restoration needed
      setIsRestoringTerminals(false)
    }
  }, [
    session,
    sessionLoading,
    projectId,
    addTerminal,
    createDefaultTerminal,
    hydrateWorkspaceState,
  ])

  // Panel collapse sync - only runs when collapse state changes
  useEffect(() => {
    if (!sessionRestoredRef.current) return

    const shouldCollapseLeft = zenMode || sidebarCollapsed
    const shouldCollapseRight = zenMode || agentPanelCollapsed
    const leftPanel = leftPanelRef.current
    const rightPanel = rightPanelRef.current

    if (leftPanel) {
      const size = leftPanel.getSize()
      if (size > 0) lastExpandedSizesRef.current.left = size

      if (shouldCollapseLeft && leftPanel.isExpanded()) {
        leftPanel.collapse()
      } else if (!shouldCollapseLeft && leftPanel.isCollapsed()) {
        leftPanel.expand(10)
        leftPanel.resize(lastExpandedSizesRef.current.left || 15)
      }
    }

    if (rightPanel) {
      const size = rightPanel.getSize()
      if (size > 0) lastExpandedSizesRef.current.right = size

      if (shouldCollapseRight && rightPanel.isExpanded()) {
        rightPanel.collapse()
      } else if (!shouldCollapseRight && rightPanel.isCollapsed()) {
        rightPanel.expand(10)
        rightPanel.resize(lastExpandedSizesRef.current.right || 15)
      }
    }

    // Save session when workspace state changes
    scheduleSaveSession()
  }, [sidebarCollapsed, agentPanelCollapsed, zenMode, scheduleSaveSession])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveDebounceTimerRef.current) {
        window.clearTimeout(saveDebounceTimerRef.current)
        saveDebounceTimerRef.current = null
      }

      const terminals = useTerminalStore
        .getState()
        .getTerminalsByProject(projectId)
      saveSession({ projectId, state: buildSessionState() })

      terminals.forEach((terminal: { isPinned: boolean; ptyId: string }) => {
        if (!terminal.isPinned) {
          window.api.pty.kill({ ptyId: terminal.ptyId }).catch(console.error)
        }
      })

      clearProject(projectId)
    }
  }, [projectId, saveSession, clearProject, buildSessionState])

  // Memoized event handlers
  const handleAddTag = useCallback(
    async (tagId: string): Promise<void> => {
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
    async (tagId: string): Promise<void> => {
      try {
        await removeTagFromProject.mutateAsync({ projectId, tagId })
        refetchProject()
      } catch (error) {
        console.error('Failed to remove tag:', error)
      }
    },
    [removeTagFromProject, projectId, refetchProject]
  )

  const handleBackToDashboard = useCallback((): void => {
    saveSession({ projectId, state: buildSessionState() })
    setActiveProject(null)
  }, [saveSession, projectId, buildSessionState, setActiveProject])

  const handleNavigateToTasks = useCallback(
    (_taskId?: string): void => {
      setActiveView('tasks')
    },
    [setActiveView]
  )

  const handleLayoutChange = useCallback(
    (layout: number[]) => {
      lastKnownLayoutRef.current = layout
      const [left, , right] = layout
      if (typeof left === 'number' && left > 0) {
        lastExpandedSizesRef.current.left = left
      }
      if (typeof right === 'number' && right > 0) {
        lastExpandedSizesRef.current.right = right
      }
      scheduleSaveSession()
    },
    [scheduleSaveSession]
  )

  // Derived visibility states
  const isLeftPanelVisible = !zenMode && !sidebarCollapsed
  const isRightPanelVisible = !zenMode && !agentPanelCollapsed

  // Loading state
  if (projectLoading || sessionLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <p className="text-muted-foreground">Loading project...</p>
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
        agentPanelCollapsed={agentPanelCollapsed}
        availableTags={availableTags}
        gitTelemetry={gitTelemetryData}
        onAddTag={handleAddTag}
        onBackToDashboard={handleBackToDashboard}
        onOpenSettings={openSettingsPanel}
        onRemoveTag={handleRemoveTag}
        onToggleAgentPanel={toggleAgentPanel}
        onToggleSidebar={toggleSidebar}
        onToggleZenMode={toggleZenMode}
        projectName={project.name}
        projectPath={project.path}
        projectTags={project.tags}
        sidebarCollapsed={sidebarCollapsed}
        zenMode={zenMode}
      />

      <ResizablePanelGroup
        autoSaveId={`project-workspace-${projectId}`}
        className="flex-1"
        direction="horizontal"
        onLayout={handleLayoutChange}
        ref={panelGroupRef}
      >
        <ResizablePanel
          className="bg-card"
          collapsedSize={0}
          collapsible
          defaultSize={15}
          id="project-workspace-left"
          maxSize={30}
          minSize={10}
          ref={leftPanelRef}
        >
          {isLeftPanelVisible && (
            <aside className="h-full overflow-y-auto">
              <ProjectScripts projectId={projectId} projectPath={project.path} />
              <CommandLibrary projectId={projectId} />
            </aside>
          )}
        </ResizablePanel>

        <ResizableHandle
          className={!isLeftPanelVisible ? 'hidden' : undefined}
          withHandle
        />

        <ResizablePanel
          defaultSize={70}
          id="project-workspace-center"
          minSize={20}
        >
          <main className="h-full overflow-hidden">
            <Terminal
              isRestoring={isRestoringTerminals}
              projectId={projectId}
              projectPath={project.path}
            />
          </main>
        </ResizablePanel>

        <ResizableHandle
          className={!isRightPanelVisible ? 'hidden' : undefined}
          withHandle
        />

        <ResizablePanel
          className="bg-card"
          collapsedSize={0}
          collapsible
          defaultSize={15}
          id="project-workspace-right"
          maxSize={40}
          minSize={10}
          ref={rightPanelRef}
        >
          <AgentPanel
            isVisible={isRightPanelVisible}
            onNavigateToTasks={handleNavigateToTasks}
            onTogglePanel={toggleAgentPanel}
            projectId={projectId}
            projectPath={project.path}
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      <PinnedProcessIndicator />
    </div>
  )
}
