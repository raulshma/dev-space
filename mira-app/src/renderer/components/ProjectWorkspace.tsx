/**
 * ProjectWorkspace Component
 *
 * Workspace view for an active project with session restoration.
 * Requirements: 3.2, 4.2, 4.3, 4.4, 16.1, 16.2, 16.3, 16.4, 5.1, 6.1, 7.1, 7.2, 7.3, 9.2
 */

import { useEffect, useCallback, useState, useRef } from 'react'
import { IconTag, IconPlus, IconX } from '@tabler/icons-react'
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
import { Terminal } from 'renderer/components/Terminal/Terminal'
import { PinnedProcessIndicator } from 'renderer/components/Terminal/PinnedProcessIndicator'
import { CommandLibrary } from 'renderer/components/CommandLibrary'
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
import type { SessionState } from 'shared/models'
import type { AgentTask } from 'shared/ai-types'

interface ProjectWorkspaceProps {
  projectId: string
}

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

  // Tag menu state
  const [showTagMenu, setShowTagMenu] = useState(false)

  // Agent task panel state
  const [taskView, setTaskView] = useState<'list' | 'detail' | 'completion'>(
    'list'
  )
  const [showTaskCreation, setShowTaskCreation] = useState(false)
  const { selectedTaskId, setSelectedTask } = useAgentTaskStore()

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

  const setActiveProject = useAppStore(state => state.setActiveProject)
  const sidebarCollapsed = useAppStore(state => state.sidebarCollapsed)
  const agentPanelCollapsed = useAppStore(state => state.agentPanelCollapsed)
  const zenMode = useAppStore(state => state.zenMode)
  const toggleSidebar = useAppStore(state => state.toggleSidebar)
  const toggleAgentPanel = useAppStore(state => state.toggleAgentPanel)
  const toggleZenMode = useAppStore(state => state.toggleZenMode)
  const hydrateWorkspaceState = useAppStore(state => state.hydrateWorkspaceState)

  const addTerminal = useTerminalStore(state => state.addTerminal)
  const clearProject = useTerminalStore(state => state.clearProject)

  // Track if session restoration has been attempted
  const sessionRestoredRef = useRef(false)

  // Panel refs for layout persistence
  const panelGroupRef = useRef<ImperativePanelGroupHandle | null>(null)
  const leftPanelRef = useRef<ImperativePanelHandle | null>(null)
  const rightPanelRef = useRef<ImperativePanelHandle | null>(null)

  const lastKnownLayoutRef = useRef<number[] | null>(null)
  const lastExpandedSizesRef = useRef<{ left: number; right: number }>({
    left: 15,
    right: 15,
  })

  const saveDebounceTimerRef = useRef<number | null>(null)

  const buildSessionState = useCallback((): SessionState => {
    const terminals = useTerminalStore.getState().getTerminalsByProject(projectId)
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
        layout: {
          projectId,
          panes: [],
        },
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

  // Create a default terminal if no session exists
  const createDefaultTerminal = useCallback((): void => {
    if (!project) return

    // Check if terminals already exist for this project
    const existingTerminals = useTerminalStore
      .getState()
      .getTerminalsByProject(projectId)
    if (existingTerminals.length > 0) return

    window.api.pty
      .create({
        projectId,
        cwd: project.path,
        shell: undefined,
      })
      .then(response => {
        // Double-check no terminals were added while we were creating
        const currentTerminals = useTerminalStore
          .getState()
          .getTerminalsByProject(projectId)
        if (currentTerminals.length > 0) {
          // Kill the PTY we just created since it's not needed
          window.api.pty.kill({ ptyId: response.ptyId }).catch(console.error)
          return
        }

        const terminalId = `term-${Date.now()}`
        addTerminal({
          id: terminalId,
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

  // Restore session when component mounts
  useEffect(() => {
    // Only restore session once per mount
    if (sessionRestoredRef.current) return
    if (sessionLoading) return

    sessionRestoredRef.current = true

    // Restore workspace UI state + panel layout (even if terminals already exist)
    if (session?.workspace) {
      hydrateWorkspaceState({
        sidebarCollapsed: session.workspace.sidebarCollapsed ?? false,
        agentPanelCollapsed: session.workspace.agentPanelCollapsed ?? false,
        zenMode: session.workspace.zenMode ?? false,
        previousSidebarState: session.workspace.previousSidebarState ?? false,
        previousAgentPanelState: session.workspace.previousAgentPanelState ?? false,
      })
    }

    if (session?.workspace?.panelLayout?.length) {
      lastKnownLayoutRef.current = session.workspace.panelLayout

      const [left, , right] = session.workspace.panelLayout
      if (typeof left === 'number' && left > 0) lastExpandedSizesRef.current.left = left
      if (typeof right === 'number' && right > 0) lastExpandedSizesRef.current.right = right

      try {
        panelGroupRef.current?.setLayout(session.workspace.panelLayout)
      } catch (error) {
        console.warn('Failed to restore panel layout:', error)
      }
    }

    // Restore terminals (only if none already exist)
    const existingTerminals = useTerminalStore
      .getState()
      .getTerminalsByProject(projectId)

    if (existingTerminals.length === 0) {
      if (session?.terminals && session.terminals.length > 0) {
        session.terminals.forEach(terminalData => {
          // Create PTY and add terminal to store
          window.api.pty
            .create({
              projectId,
              cwd: terminalData.cwd,
              shell: undefined,
            })
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
        })
      } else {
        // No saved session - create default terminal
        createDefaultTerminal()
      }
    }

    // TODO: Restore agent conversation when agent service is implemented
    // TODO: Restore context files when agent service is implemented
  }, [
    session,
    sessionLoading,
    projectId,
    addTerminal,
    createDefaultTerminal,
    hydrateWorkspaceState,
  ])

  // Keep panel collapsed state in sync with UI state (and preserve last expanded sizes)
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
  }, [sidebarCollapsed, agentPanelCollapsed, zenMode])

  // Persist workspace state as it changes (collapsed/zen)
  useEffect(() => {
    scheduleSaveSession()
  }, [sidebarCollapsed, agentPanelCollapsed, zenMode, scheduleSaveSession])

  // Save session when navigating away
  useEffect(() => {
    return () => {
      // Cleanup: save session state before unmounting
      if (saveDebounceTimerRef.current) {
        window.clearTimeout(saveDebounceTimerRef.current)
        saveDebounceTimerRef.current = null
      }

      const terminals = useTerminalStore
        .getState()
        .getTerminalsByProject(projectId)

      saveSession({ projectId, state: buildSessionState() })

      // Clear non-pinned terminals
      terminals.forEach(
        (terminal: { isPinned: boolean; ptyId: string }) => {
        if (!terminal.isPinned) {
          window.api.pty.kill({ ptyId: terminal.ptyId }).catch(console.error)
        }
        }
      )

      clearProject(projectId)
    }
  }, [projectId, saveSession, clearProject, buildSessionState])

  // Handle task selection and navigation
  const handleTaskSelect = useCallback(
    (taskId: string) => {
      setSelectedTask(taskId)
      const task = useAgentTaskStore.getState().tasks.get(taskId)
      if (task) {
        // Navigate to appropriate view based on task status
        if (
          task.status === 'completed' ||
          task.status === 'failed' ||
          task.status === 'stopped'
        ) {
          setTaskView('completion')
        } else if (task.status === 'running' || task.status === 'paused') {
          setTaskView('detail')
        } else {
          setTaskView('detail')
        }
      }
    },
    [setSelectedTask]
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
      // For now, just select the task - editing could be implemented later
      setSelectedTask(task.id)
      setTaskView('detail')
    },
    [setSelectedTask]
  )

  // Handle adding a tag to the project
  const handleAddTag = async (tagId: string): Promise<void> => {
    try {
      await addTagToProject.mutateAsync({ projectId, tagId })
      refetchProject()
      setShowTagMenu(false)
    } catch (error) {
      console.error('Failed to add tag:', error)
    }
  }

  // Handle removing a tag from the project
  const handleRemoveTag = async (tagId: string): Promise<void> => {
    try {
      await removeTagFromProject.mutateAsync({ projectId, tagId })
      refetchProject()
    } catch (error) {
      console.error('Failed to remove tag:', error)
    }
  }

  // Get tags that are not already on the project
  const availableTags = allTags.filter(
    tag => !project?.tags.some(t => t.id === tag.id)
  )

  // Handle back to dashboard
  const handleBackToDashboard = (): void => {
    // Save session before navigating away
    saveSession({ projectId, state: buildSessionState() })
    setActiveProject(null)
  }

  if (projectLoading || sessionLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <p className="text-muted-foreground">Loading project...</p>
      </div>
    )
  }

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
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              className="text-muted-foreground hover:text-foreground"
              onClick={handleBackToDashboard}
            >
              ← Back
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold text-foreground">
                  {project.name}
                </h1>
                {/* Git status indicator */}
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
                <p className="text-sm text-muted-foreground">{project.path}</p>
                {/* Tags */}
                <div className="flex items-center gap-1 ml-2">
                  {project.tags.map(tag => (
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
                        onClick={() => handleRemoveTag(tag.id)}
                        title="Remove tag"
                      >
                        <IconX size={12} />
                      </button>
                    </span>
                  ))}
                  {/* Add tag button */}
                  <div className="relative">
                    <button
                      className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded"
                      onClick={() => setShowTagMenu(!showTagMenu)}
                      title="Add tag"
                    >
                      <IconPlus size={14} />
                    </button>
                    {showTagMenu && availableTags.length > 0 && (
                      <>
                        <button
                          aria-label="Close tag menu"
                          className="fixed inset-0 z-10 cursor-default bg-transparent border-none"
                          onClick={() => setShowTagMenu(false)}
                          tabIndex={-1}
                          type="button"
                        />
                        <div className="absolute left-0 top-full mt-1 z-20 bg-popover border border-border rounded shadow-lg py-1 min-w-[120px]">
                          {availableTags.map(tag => (
                            <button
                              className="w-full text-left px-3 py-1.5 text-sm text-popover-foreground hover:bg-accent flex items-center gap-2"
                              key={tag.id}
                              onClick={() => handleAddTag(tag.id)}
                            >
                              <IconTag size={12} />
                              {tag.name}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    {showTagMenu && availableTags.length === 0 && (
                      <>
                        <button
                          aria-label="Close tag menu"
                          className="fixed inset-0 z-10 cursor-default bg-transparent border-none"
                          onClick={() => setShowTagMenu(false)}
                          tabIndex={-1}
                          type="button"
                        />
                        <div className="absolute left-0 top-full mt-1 z-20 bg-popover border border-border rounded shadow-lg py-2 px-3 min-w-[150px]">
                          <p className="text-xs text-muted-foreground">
                            No more tags available
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Zen Mode Toggle */}
            <button
              className={`px-3 py-1.5 rounded-sm text-sm transition-colors ${
                zenMode
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
              onClick={toggleZenMode}
              title={
                zenMode
                  ? 'Exit Zen Mode (Mod+Shift+Z)'
                  : 'Enter Zen Mode (Mod+Shift+Z)'
              }
            >
              {zenMode ? '🧘 Zen' : '🧘'}
            </button>
            {/* Sidebar Toggle (hidden in Zen Mode) */}
            {!zenMode && (
              <>
                <button
                  className="px-3 py-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-sm text-sm"
                  onClick={toggleSidebar}
                  title="Toggle Sidebar (Mod+B)"
                >
                  {sidebarCollapsed ? '☰' : '←'}
                </button>
                <button
                  className="px-3 py-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-sm text-sm"
                  onClick={toggleAgentPanel}
                  title="Toggle Agent Panel"
                >
                  {agentPanelCollapsed ? '🤖' : '→'}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <ResizablePanelGroup
        ref={panelGroupRef}
        className="flex-1"
        direction="horizontal"
        autoSaveId={`project-workspace-${projectId}`}
        onLayout={layout => {
          lastKnownLayoutRef.current = layout

          const [left, , right] = layout
          if (typeof left === 'number' && left > 0) {
            lastExpandedSizesRef.current.left = left
          }
          if (typeof right === 'number' && right > 0) {
            lastExpandedSizesRef.current.right = right
          }

          scheduleSaveSession()
        }}
      >
        {/* Left sidebar (collapsible) */}
        <ResizablePanel
          ref={leftPanelRef}
          id="project-workspace-left"
          className="bg-card"
          collapsible
          collapsedSize={0}
          defaultSize={15}
          maxSize={30}
          minSize={10}
        >
          <aside
            className={`h-full overflow-y-auto ${
              zenMode || sidebarCollapsed ? 'hidden' : ''
            }`}
          >
            <CommandLibrary projectId={projectId} />
          </aside>
        </ResizablePanel>

        <ResizableHandle
          withHandle
          className={zenMode || sidebarCollapsed ? 'hidden' : undefined}
        />

        {/* Terminal (always visible) */}
        <ResizablePanel
          id="project-workspace-center"
          defaultSize={70}
          minSize={20}
        >
          <main className="h-full overflow-hidden">
            <Terminal projectId={projectId} projectPath={project.path} />
          </main>
        </ResizablePanel>

        <ResizableHandle
          withHandle
          className={zenMode || agentPanelCollapsed ? 'hidden' : undefined}
        />

        {/* Right agent panel (collapsible) */}
        <ResizablePanel
          ref={rightPanelRef}
          id="project-workspace-right"
          className="bg-card"
          collapsible
          collapsedSize={0}
          defaultSize={15}
          maxSize={40}
          minSize={10}
        >
          <aside
            className={`h-full flex flex-col overflow-hidden ${
              zenMode || agentPanelCollapsed ? 'hidden' : ''
            }`}
          >
            {/* Agent Panel Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <span className="text-sm font-medium">🤖 Agent Tasks</span>
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={toggleAgentPanel}
                title="Hide Agent Panel"
              >
                ✕
              </button>
            </div>

            {/* Context Shredder */}
            <div className="h-48 border-b border-border">
              <ContextShredder projectId={projectId} />
            </div>

            {/* Task Panel Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Task Panel Header */}
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
                  <Button
                    className="text-xs"
                    onClick={() => setShowTaskCreation(true)}
                    size="sm"
                    variant="outline"
                  >
                    + New Task
                  </Button>
                )}
              </div>

              {/* Task Views */}
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
          </aside>
        </ResizablePanel>

        {/* Task Creation Dialog */}
        <TaskCreationDialog
          defaultDirectory={project.path}
          onOpenChange={setShowTaskCreation}
          onTaskCreated={handleTaskCreated}
          open={showTaskCreation}
        />
      </ResizablePanelGroup>

      {/* Global pinned process indicator */}
      <PinnedProcessIndicator />
    </div>
  )
}
