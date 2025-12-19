/**
 * Agent Sessions Hook
 *
 * Provides methods to manage agent conversation sessions for a project.
 * Handles session CRUD, message persistence, and session selection.
 * Requirements: 6.1, 6.7, 6.10
 */

import { useEffect, useCallback } from 'react'
import {
  useSessionStore,
  useSessions as useSessionsSelector,
  useActiveSessions,
  useArchivedSessions,
  useSession,
  useCurrentSession,
  useCurrentSessionId,
  useSessionMessages,
  useCurrentSessionMessages,
  useSessionLoading,
  useSessionError,
  useSessionCount,
  useActiveSessionCount,
} from 'renderer/stores/session-store'
import type { AgentSessionInfo } from 'shared/ipc-types'

/**
 * Hook to manage agent sessions for a specific project
 * Loads sessions and provides CRUD actions
 */
export function useAgentSessions(projectPath: string) {
  const sessions = useSessionsSelector()
  const currentSessionId = useCurrentSessionId()
  const currentSession = useCurrentSession()
  const { isLoadingSessions, isLoadingMessages, isSaving } = useSessionLoading()
  const error = useSessionError()
  const {
    loadSessions,
    loadMessages,
    createSession,
    updateSession,
    archiveSession,
    deleteSession,
    sendMessage,
    loadLastSession,
    setLastSession,
    setCurrentSession,
  } = useSessionStore()

  // Load sessions when project changes
  useEffect(() => {
    if (projectPath) {
      loadSessions(projectPath)
      loadLastSession(projectPath)
    }
  }, [projectPath, loadSessions, loadLastSession])

  // Load messages when current session changes
  useEffect(() => {
    if (currentSessionId) {
      loadMessages(currentSessionId)
    }
  }, [currentSessionId, loadMessages])

  const create = useCallback(
    async (name: string, modelId: string): Promise<AgentSessionInfo> => {
      return createSession(projectPath, name, modelId)
    },
    [projectPath, createSession]
  )

  const update = useCallback(
    async (
      sessionId: string,
      updates: { name?: string; modelId?: string }
    ): Promise<AgentSessionInfo> => {
      return updateSession(sessionId, updates)
    },
    [updateSession]
  )

  const archive = useCallback(
    async (sessionId: string): Promise<void> => {
      return archiveSession(sessionId)
    },
    [archiveSession]
  )

  const remove = useCallback(
    async (sessionId: string): Promise<void> => {
      return deleteSession(sessionId)
    },
    [deleteSession]
  )

  const selectSession = useCallback(
    async (sessionId: string | null): Promise<void> => {
      if (sessionId) {
        await setLastSession(projectPath, sessionId)
      } else {
        setCurrentSession(null)
      }
    },
    [projectPath, setLastSession, setCurrentSession]
  )

  const addMessage = useCallback(
    async (role: 'user' | 'assistant', content: string) => {
      if (!currentSessionId) {
        throw new Error('No session selected')
      }
      return sendMessage(currentSessionId, role, content)
    },
    [currentSessionId, sendMessage]
  )

  return {
    sessions,
    currentSession,
    currentSessionId,
    isLoading: isLoadingSessions,
    isLoadingMessages,
    isSaving,
    error,
    createSession: create,
    updateSession: update,
    archiveSession: archive,
    deleteSession: remove,
    selectSession,
    addMessage,
  }
}

/**
 * Hook to get all sessions (read-only)
 */
export { useSessionsSelector as useSessions }

/**
 * Hook to get active (non-archived) sessions
 */
export { useActiveSessions }

/**
 * Hook to get archived sessions
 */
export { useArchivedSessions }

/**
 * Hook to get a specific session by ID
 */
export { useSession }

/**
 * Hook to get the current session
 */
export { useCurrentSession }

/**
 * Hook to get the current session ID
 */
export { useCurrentSessionId }

/**
 * Hook to get messages for a specific session
 */
export { useSessionMessages }

/**
 * Hook to get messages for the current session
 */
export { useCurrentSessionMessages }

/**
 * Hook to get loading states
 */
export { useSessionLoading }

/**
 * Hook to get error state
 */
export { useSessionError }

/**
 * Hook to get session count
 */
export { useSessionCount }

/**
 * Hook to get active session count
 */
export { useActiveSessionCount }
