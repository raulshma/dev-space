/**
 * ProjectWorkspace Component
 *
 * Workspace view for an active project with session restoration.
 * Requirements: 3.2, 4.2, 4.3, 4.4, 16.1, 16.2, 16.3, 16.4, 5.1, 6.1, 7.1, 7.2, 7.3, 9.2
 */

import { useEffect, useCallback, useState, useRef } from 'react'
import { Tag as TagIcon, Plus, X } from 'lucide-react'
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
import { ModelSelector } from 'renderer/components/Agent/ModelSelector'
import { ContextShredder } from 'renderer/components/Agent/ContextShredder'
import { ConversationView } from 'renderer/components/Agent/ConversationView'
import { TaskBacklogList } from 'renderer/components/Agent/TaskBacklogList'
import { TaskDetailView } from 'renderer/components/Agent/TaskDetailView'
import { TaskCompletionView } from 'renderer/components/Agent/TaskCompletionView'
import { TaskCreationDialog } from 'renderer/components/Agent/TaskCreationDialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from 'renderer/components/ui/tabs'
import { Button } from 'renderer/components/ui/button'
import type { SessionState, ErrorContext } from 'shared/models'
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

  // Error context state for Fix button integration
  const [errorContext, setErrorContext] = useState<ErrorContext | null>(null)
  const [showTagMenu, setShowTagMenu] = useState(false)

  // Agent task panel state
  const [agentPanelTab, setAgentPanelTab] = useState<'chat' | 'tasks'>('chat')
  const [taskView, setTaskView] = useState<'list' | 'detail' | 'completion'>('list')
  const [showTaskCreation, setShowTaskCreation] = useState(false)
  const { selectedTaskId, setSelectedTask } = useAgentTaskStore()
  const selectedTask = useAgentTaskStore(state =>
    selectedTaskId ? state.tasks.get(selectedTaskId) : undefined
  )

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

  const addTerminal = useTerminalStore(state => state.addTerminal)
  const clearProject = useTerminalStore(state => state.clearProject)

  // Track if session restoration has been attempted
  const sessionRestoredRef = useRef(false)

  // Create a default terminal if no session exists
  const createDefaultTerminal = useCallback((): void => {
    if (!project) return

    // Check if terminals already exist for this project
    const existingTerminals = useTerminalStore.getState().getTerminalsByProject(projectId)
    if (existingTerminals.length > 0) return

    window.api.pty
      .create({
        projectId,
        cwd: project.path,
        shell: undefined,
      })
      .then(response => {
        // Double-check no terminals were added while we were creating
        const currentTerminals = useTerminalStore.getState().getTerminalsByProject(projectId)
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

    // Check if terminals already exist for this project (e.g., from a previous mount)
    const existingTerminals = useTerminalStore.getState().getTerminalsByProject(projectId)
    if (existingTerminals.length > 0) return

    // Restore terminals from session
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

    // TODO: Restore agent conversation when agent service is implemented
    // TODO: Restore context files when agent service is implemented
  }, [session, sessionLoading, projectId, addTerminal, createDefaultTerminal])

  // Save session when navigating away
  useEffect(() => {
    return () => {
      // Cleanup: save session state before unmounting
      // Use getState() to get current terminals without subscribing
      const terminals = useTerminalStore.getState().getTerminalsByProject(projectId)
      const sessionState: SessionState = {
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
        activeTerminalId: null,
      }

      saveSession({ projectId, state: sessionState })

      // Clear non-pinned terminals
      terminals.forEach(terminal => {
        if (!terminal.isPinned) {
          window.api.pty.kill({ ptyId: terminal.ptyId }).catch(console.error)
        }
      })

      clearProject(projectId)
    }
  }, [projectId, saveSession, clearProject])

  // Handle error context from Fix button
  const handleErrorContext = useCallback((context: ErrorContext) => {
    setErrorContext(context)
  }, [])

  // Clear error context after it's been used
  const handleErrorContextUsed = useCallback(() => {
    setErrorContext(null)
  }, [])

  // Handle task selection and navigation
  const handleTaskSelect = useCallback((taskId: string) => {
    setSelectedTask(taskId)
    const task = useAgentTaskStore.getState().tasks.get(taskId)
    if (task) {
      // Navigate to appropriate view based on task status
      if (task.status === 'completed' || task.status === 'failed' || task.status === 'stopped') {
        setTaskView('completion')
      } else if (task.status === 'running' || task.status === 'paused') {
        setTaskView('detail')
      } else {
        setTaskView('detail')
      }
    }
  }, [setSelectedTask])

  const handleTaskCreated = useCallback((taskId: string) => {
    setSelectedTask(taskId)
    setTaskView('list')
  }, [setSelectedTask])

  const handleBackToTaskList = useCallback(() => {
    setTaskView('list')
    setSelectedTask(null)
  }, [setSelectedTask])

  const handleViewFullOutput = useCallback(() => {
    setTaskView('detail')
  }, [])

  const handleEditTask = useCallback((task: AgentTask) => {
    // For now, just select the task - editing could be implemented later
    setSelectedTask(task.id)
    setTaskView('detail')
  }, [setSelectedTask])

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
    // Use getState() to get current terminals without subscribing
    const terminals = useTerminalStore.getState().getTerminalsByProject(projectId)
    const sessionState: SessionState = {
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
      activeTerminalId: null,
    }

    saveSession({ projectId, state: sessionState })
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
                        <X size={12} />
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
                      <Plus size={14} />
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
                              <TagIcon size={12} />
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
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Command Library (hidden in Zen Mode or when collapsed) */}
        {!zenMode && !sidebarCollapsed && (
          <aside className="w-64 bg-card border-r border-border overflow-y-auto">
            <CommandLibrary projectId={projectId} />
          </aside>
        )}

        {/* Terminal Area */}
        <main className="flex-1 overflow-hidden">
          <Terminal
            onErrorContext={handleErrorContext}
            projectId={projectId}
            projectPath={project.path}
          />
        </main>

        {/* Agent Panel (hidden in Zen Mode or when collapsed) */}
        {!zenMode && !agentPanelCollapsed && (
          <aside className="w-96 bg-card border-l border-border flex flex-col overflow-hidden">
            {/* Agent Panel Header with Tabs */}
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <Tabs value={agentPanelTab} onValueChange={(v) => setAgentPanelTab(v as 'chat' | 'tasks')}>
                <TabsList className="h-8">
                  <TabsTrigger value="chat" className="text-xs px-3">
                    💬 Chat
                  </TabsTrigger>
                  <TabsTrigger value="tasks" className="text-xs px-3">
                    🤖 Tasks
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={toggleAgentPanel}
                title="Hide Agent Panel"
              >
                ✕
              </button>
            </div>

            {/* Chat Tab Content */}
            {agentPanelTab === 'chat' && (
              <>
                {/* Model Selector */}
                <div className="border-b border-border px-4 py-3">
                  <ModelSelector />
                </div>

                {/* Context Shredder */}
                <div className="h-64 border-b border-border">
                  <ContextShredder projectId={projectId} />
                </div>

                {/* Conversation View - takes remaining space */}
                <div className="flex-1 overflow-hidden">
                  <ConversationView
                    errorContext={errorContext}
                    onErrorContextUsed={handleErrorContextUsed}
                    projectId={projectId}
                  />
                </div>
              </>
            )}

            {/* Tasks Tab Content */}
            {agentPanelTab === 'tasks' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Task Panel Header */}
                <div className="flex items-center justify-between border-b border-border px-4 py-2">
                  {taskView !== 'list' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleBackToTaskList}
                      className="text-xs"
                    >
                      ← Back to List
                    </Button>
                  )}
                  {taskView === 'list' && (
                    <span className="text-sm font-medium">Agent Tasks</span>
                  )}
                  {taskView === 'list' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTaskCreation(true)}
                      className="text-xs"
                    >
                      + New Task
                    </Button>
                  )}
                </div>

                {/* Task Views */}
                <div className="flex-1 overflow-y-auto p-4">
                  {taskView === 'list' && (
                    <TaskBacklogList
                      onTaskSelect={handleTaskSelect}
                      onEditTask={handleEditTask}
                    />
                  )}
                  {taskView === 'detail' && selectedTaskId && (
                    <TaskDetailView
                      taskId={selectedTaskId}
                      onBack={handleBackToTaskList}
                    />
                  )}
                  {taskView === 'completion' && selectedTaskId && (
                    <TaskCompletionView
                      taskId={selectedTaskId}
                      onBack={handleBackToTaskList}
                      onViewOutput={handleViewFullOutput}
                    />
                  )}
                </div>
              </div>
            )}
          </aside>
        )}

        {/* Task Creation Dialog */}
        <TaskCreationDialog
          open={showTaskCreation}
          onOpenChange={setShowTaskCreation}
          defaultDirectory={project.path}
          onTaskCreated={handleTaskCreated}
        />
      </div>

      {/* Global pinned process indicator */}
      <PinnedProcessIndicator />
    </div>
  )
}
