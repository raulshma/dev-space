/**
 * useWorkspaceTerminals Hook
 *
 * Manages terminal lifecycle for a workspace: restoration, creation, cleanup.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useSession } from 'renderer/hooks/use-sessions'
import { useTerminalStore } from 'renderer/stores/terminal-store'
import type { Project } from 'shared/models'

interface UseWorkspaceTerminalsOptions {
  projectId: string
  project: Project | null | undefined
  projectLoading: boolean
}

interface UseWorkspaceTerminalsReturn {
  isRestoring: boolean
}

export function useWorkspaceTerminals({
  projectId,
  project,
  projectLoading,
}: UseWorkspaceTerminalsOptions): UseWorkspaceTerminalsReturn {
  const { data: session, isLoading: sessionLoading } = useSession(projectId)
  const addTerminal = useTerminalStore(state => state.addTerminal)
  const clearProject = useTerminalStore(state => state.clearProject)

  const [isRestoring, setIsRestoring] = useState(true)
  const restoredRef = useRef(false)

  // Create default terminal
  const createDefaultTerminal = useCallback(async () => {
    if (!project) return

    const existingTerminals = useTerminalStore
      .getState()
      .getTerminalsByProject(projectId)
    if (existingTerminals.length > 0) return

    try {
      const response = await window.api.pty.create({
        projectId,
        cwd: project.path,
        shell: undefined,
      })

      // Double-check no terminals were added while we waited
      const currentTerminals = useTerminalStore
        .getState()
        .getTerminalsByProject(projectId)
      if (currentTerminals.length > 0) {
        await window.api.pty.kill({ ptyId: response.ptyId })
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
    } catch (error) {
      console.error('Failed to create default terminal:', error)
    }
  }, [project, projectId, addTerminal])

  // Restore terminals from session
  useEffect(() => {
    if (restoredRef.current || sessionLoading || projectLoading || !project)
      return

    restoredRef.current = true

    const restoreTerminals = async () => {
      const existingTerminals = useTerminalStore
        .getState()
        .getTerminalsByProject(projectId)

      if (existingTerminals.length > 0) {
        setIsRestoring(false)
        return
      }

      if (session?.terminals?.length) {
        const restorations = session.terminals.map(async terminalData => {
          try {
            const response = await window.api.pty.create({
              projectId,
              cwd: terminalData.cwd,
              shell: undefined,
            })

            addTerminal({
              id: terminalData.id,
              projectId,
              ptyId: response.ptyId,
              isPinned: terminalData.isPinned,
              title: `Terminal ${terminalData.id.slice(0, 8)}`,
              cwd: terminalData.cwd,
            })
          } catch (error) {
            console.error('Failed to restore terminal:', error)
          }
        })

        await Promise.all(restorations)
        setIsRestoring(false)
      } else {
        await createDefaultTerminal()
        setIsRestoring(false)
      }
    }

    restoreTerminals()
  }, [
    session,
    sessionLoading,
    projectLoading,
    project,
    projectId,
    addTerminal,
    createDefaultTerminal,
  ])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const terminals = useTerminalStore
        .getState()
        .getTerminalsByProject(projectId)

      terminals.forEach((terminal: { isPinned: boolean; ptyId: string }) => {
        if (!terminal.isPinned) {
          window.api.pty.kill({ ptyId: terminal.ptyId }).catch(console.error)
        }
      })

      clearProject(projectId)
    }
  }, [projectId, clearProject])

  return { isRestoring }
}
