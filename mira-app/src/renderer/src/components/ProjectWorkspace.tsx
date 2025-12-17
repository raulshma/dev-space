/**
 * ProjectWorkspace Component
 *
 * Workspace view for an active project with session restoration.
 * Requirements: 4.2, 4.3, 4.4, 16.1, 16.2, 16.3, 16.4, 5.1, 6.1, 7.2, 7.3
 */

import { useEffect, useCallback, useState } from 'react'
import { useProject } from '../hooks/use-projects'
import { useSession, useSaveSession } from '../hooks/use-sessions'
import { useGitTelemetryRefresh } from '../hooks/use-git-telemetry'
import { useAppStore } from '../stores/app-store'
import { useTerminalStore } from '../stores/terminal-store'
import { Terminal } from './Terminal/Terminal'
import { PinnedProcessIndicator } from './Terminal/PinnedProcessIndicator'
import { CommandLibrary } from './CommandLibrary'
import { ModelSelector } from './Agent/ModelSelector'
import { ContextShredder } from './Agent/ContextShredder'
import { ConversationView } from './Agent/ConversationView'
import type { SessionState, ErrorContext } from '../../../shared/models'

interface ProjectWorkspaceProps {
  projectId: string
}

export function ProjectWorkspace({ projectId }: ProjectWorkspaceProps): React.JSX.Element {
  const { data: project, isLoading: projectLoading } = useProject(projectId)
  const { data: session, isLoading: sessionLoading } = useSession(projectId)
  const { mutate: saveSession } = useSaveSession()

  // Error context state for Fix button integration
  const [errorContext, setErrorContext] = useState<ErrorContext | null>(null)

  // Start background git telemetry refresh when project is opened
  useGitTelemetryRefresh(projectId, project?.path || null, !!project && !project.isMissing)

  const setActiveProject = useAppStore((state) => state.setActiveProject)
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed)
  const agentPanelCollapsed = useAppStore((state) => state.agentPanelCollapsed)
  const zenMode = useAppStore((state) => state.zenMode)
  const toggleSidebar = useAppStore((state) => state.toggleSidebar)
  const toggleAgentPanel = useAppStore((state) => state.toggleAgentPanel)
  const toggleZenMode = useAppStore((state) => state.toggleZenMode)

  const addTerminal = useTerminalStore((state) => state.addTerminal)
  const clearProject = useTerminalStore((state) => state.clearProject)
  const getTerminalsByProject = useTerminalStore((state) => state.getTerminalsByProject)

  // Create a default terminal if no session exists
  const createDefaultTerminal = useCallback((): void => {
    if (!project) return

    window.api.pty
      .create({
        projectId,
        cwd: project.path,
        shell: undefined
      })
      .then((response) => {
        const terminalId = `term-${Date.now()}`
        addTerminal({
          id: terminalId,
          projectId,
          ptyId: response.ptyId,
          isPinned: false,
          title: 'Terminal',
          cwd: project.path
        })
      })
      .catch((error) => {
        console.error('Failed to create default terminal:', error)
      })
  }, [project, projectId, addTerminal])

  // Restore session when component mounts
  useEffect(() => {
    if (!session || sessionLoading) return

    // Restore terminals
    if (session.terminals && session.terminals.length > 0) {
      session.terminals.forEach((terminalData) => {
        // Create PTY and add terminal to store
        window.api.pty
          .create({
            projectId,
            cwd: terminalData.cwd,
            shell: undefined
          })
          .then((response) => {
            addTerminal({
              id: terminalData.id,
              projectId,
              ptyId: response.ptyId,
              isPinned: terminalData.isPinned,
              title: `Terminal ${terminalData.id.slice(0, 8)}`,
              cwd: terminalData.cwd
            })
          })
          .catch((error) => {
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
      const terminals = getTerminalsByProject(projectId)
      const sessionState: SessionState = {
        terminals: terminals.map((t) => ({
          id: t.id,
          cwd: t.cwd,
          isPinned: t.isPinned,
          layout: {
            projectId,
            panes: []
          }
        })),
        agentConversation: [],
        contextFiles: [],
        activeTerminalId: null
      }

      saveSession({ projectId, state: sessionState })

      // Clear non-pinned terminals
      terminals.forEach((terminal) => {
        if (!terminal.isPinned) {
          window.api.pty.kill({ ptyId: terminal.ptyId }).catch(console.error)
        }
      })

      clearProject(projectId)
    }
  }, [projectId, getTerminalsByProject, saveSession, clearProject])

  // Handle error context from Fix button
  const handleErrorContext = useCallback((context: ErrorContext) => {
    setErrorContext(context)
  }, [])

  // Clear error context after it's been used
  const handleErrorContextUsed = useCallback(() => {
    setErrorContext(null)
  }, [])

  // Handle back to dashboard
  const handleBackToDashboard = (): void => {
    // Save session before navigating away
    const terminals = getTerminalsByProject(projectId)
    const sessionState: SessionState = {
      terminals: terminals.map((t) => ({
        id: t.id,
        cwd: t.cwd,
        isPinned: t.isPinned,
        layout: {
          projectId,
          panes: []
        }
      })),
      agentConversation: [],
      contextFiles: [],
      activeTerminalId: null
    }

    saveSession({ projectId, state: sessionState })
    setActiveProject(null)
  }

  if (projectLoading || sessionLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-50">
        <p className="text-neutral-500">Loading project...</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-50">
        <div className="text-center">
          <p className="text-neutral-500 mb-4">Project not found</p>
          <button
            onClick={handleBackToDashboard}
            className="px-4 py-2 bg-amber-500 text-white rounded-sm hover:bg-amber-600"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBackToDashboard}
              className="text-neutral-600 hover:text-neutral-900"
            >
              ← Back
            </button>
            <div>
              <h1 className="text-xl font-semibold text-neutral-900">{project.name}</h1>
              <p className="text-sm text-neutral-500">{project.path}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Zen Mode Toggle */}
            <button
              onClick={toggleZenMode}
              className={`px-3 py-1.5 rounded-sm text-sm transition-colors ${
                zenMode
                  ? 'bg-amber-500 text-white hover:bg-amber-600'
                  : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
              }`}
              title={zenMode ? 'Exit Zen Mode (Mod+Shift+Z)' : 'Enter Zen Mode (Mod+Shift+Z)'}
            >
              {zenMode ? '🧘 Zen' : '🧘'}
            </button>
            {/* Sidebar Toggle (hidden in Zen Mode) */}
            {!zenMode && (
              <>
                <button
                  onClick={toggleSidebar}
                  className="px-3 py-1.5 bg-neutral-200 text-neutral-700 hover:bg-neutral-300 rounded-sm text-sm"
                  title="Toggle Sidebar (Mod+B)"
                >
                  {sidebarCollapsed ? '☰' : '←'}
                </button>
                <button
                  onClick={toggleAgentPanel}
                  className="px-3 py-1.5 bg-neutral-200 text-neutral-700 hover:bg-neutral-300 rounded-sm text-sm"
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
          <aside className="w-64 bg-white border-r border-neutral-200 overflow-y-auto">
            <CommandLibrary projectId={projectId} />
          </aside>
        )}

        {/* Terminal Area */}
        <main className="flex-1 overflow-hidden">
          <Terminal
            projectId={projectId}
            projectPath={project.path}
            onErrorContext={handleErrorContext}
          />
        </main>

        {/* Agent Panel (hidden in Zen Mode or when collapsed) */}
        {!zenMode && !agentPanelCollapsed && (
          <aside className="w-96 bg-white border-l border-neutral-200 flex flex-col overflow-hidden">
            {/* Agent Panel Header */}
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-lg font-semibold text-neutral-900">AI Agent</h2>
              <button
                onClick={toggleAgentPanel}
                className="text-neutral-500 hover:text-neutral-700"
                title="Hide Agent Panel"
              >
                ✕
              </button>
            </div>

            {/* Model Selector */}
            <div className="border-b border-neutral-200 px-4 py-3">
              <ModelSelector projectId={projectId} />
            </div>

            {/* Context Shredder */}
            <div className="h-64 border-b border-neutral-200">
              <ContextShredder projectId={projectId} />
            </div>

            {/* Conversation View - takes remaining space */}
            <div className="flex-1 overflow-hidden">
              <ConversationView
                projectId={projectId}
                errorContext={errorContext}
                onErrorContextUsed={handleErrorContextUsed}
              />
            </div>
          </aside>
        )}
      </div>

      {/* Global pinned process indicator */}
      <PinnedProcessIndicator />
    </div>
  )
}
