/**
 * Session Store - Zustand state management for agent session persistence
 *
 * Manages sessions and messages per project, including CRUD operations,
 * message persistence, and session selection.
 * Requirements: 6.1, 6.3, 6.4, 6.7, 6.8, 6.9, 6.10
 */

import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type {
  AgentSessionInfo,
  AgentSessionMessageInfo,
} from 'shared/ipc-types'

// ============================================================================
// Types
// ============================================================================

/**
 * Session store state
 */
export interface SessionStoreState {
  // Session data
  sessions: Map<string, AgentSessionInfo>
  messages: Map<string, AgentSessionMessageInfo[]>
  currentSessionId: string | null
  currentProjectPath: string | null

  // Loading states
  isLoadingSessions: boolean
  isLoadingMessages: boolean
  isSaving: boolean
  error: string | null

  // Synchronous actions
  setSessions: (sessions: AgentSessionInfo[]) => void
  addSession: (session: AgentSessionInfo) => void
  updateSessionInStore: (
    sessionId: string,
    updates: Partial<AgentSessionInfo>
  ) => void
  removeSession: (sessionId: string) => void
  setCurrentSession: (sessionId: string | null) => void
  setCurrentProject: (projectPath: string | null) => void
  setMessages: (sessionId: string, messages: AgentSessionMessageInfo[]) => void
  addMessage: (sessionId: string, message: AgentSessionMessageInfo) => void
  clearMessages: (sessionId: string) => void
  setLoadingSessions: (loading: boolean) => void
  setLoadingMessages: (loading: boolean) => void
  setSaving: (saving: boolean) => void
  setError: (error: string | null) => void

  // Async actions (call IPC)
  loadSessions: (
    projectPath: string,
    includeArchived?: boolean
  ) => Promise<void>
  loadMessages: (sessionId: string) => Promise<void>
  createSession: (
    projectPath: string,
    name: string,
    modelId: string
  ) => Promise<AgentSessionInfo>
  updateSession: (
    sessionId: string,
    updates: { name?: string; modelId?: string }
  ) => Promise<AgentSessionInfo>
  archiveSession: (sessionId: string) => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
  sendMessage: (
    sessionId: string,
    role: 'user' | 'assistant',
    content: string
  ) => Promise<AgentSessionMessageInfo>
  loadLastSession: (projectPath: string) => Promise<void>
  setLastSession: (projectPath: string, sessionId: string) => Promise<void>
}

// ============================================================================
// Store
// ============================================================================

export const useSessionStore = create<SessionStoreState>((set, get) => ({
  // Initial state
  sessions: new Map(),
  messages: new Map(),
  currentSessionId: null,
  currentProjectPath: null,
  isLoadingSessions: false,
  isLoadingMessages: false,
  isSaving: false,
  error: null,

  // Synchronous actions
  setSessions: sessions =>
    set(() => {
      const sessionMap = new Map<string, AgentSessionInfo>()
      for (const session of sessions) {
        sessionMap.set(session.id, session)
      }
      return { sessions: sessionMap, error: null }
    }),

  addSession: session =>
    set(state => {
      const newSessions = new Map(state.sessions)
      newSessions.set(session.id, session)
      return { sessions: newSessions }
    }),

  updateSessionInStore: (sessionId, updates) =>
    set(state => {
      const session = state.sessions.get(sessionId)
      if (!session) return state

      const newSessions = new Map(state.sessions)
      newSessions.set(sessionId, { ...session, ...updates })
      return { sessions: newSessions }
    }),

  removeSession: sessionId =>
    set(state => {
      const newSessions = new Map(state.sessions)
      newSessions.delete(sessionId)

      const newMessages = new Map(state.messages)
      newMessages.delete(sessionId)

      // Clear current session if it was deleted
      const newCurrentSessionId =
        state.currentSessionId === sessionId ? null : state.currentSessionId

      return {
        sessions: newSessions,
        messages: newMessages,
        currentSessionId: newCurrentSessionId,
      }
    }),

  setCurrentSession: sessionId => set({ currentSessionId: sessionId }),

  setCurrentProject: projectPath =>
    set({
      currentProjectPath: projectPath,
      // Clear sessions when switching projects
      sessions: new Map(),
      messages: new Map(),
      currentSessionId: null,
    }),

  setMessages: (sessionId, messages) =>
    set(state => {
      const newMessages = new Map(state.messages)
      newMessages.set(sessionId, messages)
      return { messages: newMessages }
    }),

  addMessage: (sessionId, message) =>
    set(state => {
      const newMessages = new Map(state.messages)
      const existing = newMessages.get(sessionId) || []
      newMessages.set(sessionId, [...existing, message])

      // Update message count in session
      const session = state.sessions.get(sessionId)
      if (session) {
        const newSessions = new Map(state.sessions)
        newSessions.set(sessionId, {
          ...session,
          messageCount: session.messageCount + 1,
          updatedAt: new Date(),
        })
        return { messages: newMessages, sessions: newSessions }
      }

      return { messages: newMessages }
    }),

  clearMessages: sessionId =>
    set(state => {
      const newMessages = new Map(state.messages)
      newMessages.delete(sessionId)
      return { messages: newMessages }
    }),

  setLoadingSessions: loading => set({ isLoadingSessions: loading }),
  setLoadingMessages: loading => set({ isLoadingMessages: loading }),
  setSaving: saving => set({ isSaving: saving }),
  setError: error => set({ error }),

  // Async actions
  loadSessions: async (projectPath, includeArchived = false) => {
    const { setSessions, setLoadingSessions, setError, setCurrentProject } =
      get()
    setCurrentProject(projectPath)
    setLoadingSessions(true)
    setError(null)

    try {
      const response = await window.api.agentSessions.list({
        projectPath,
        includeArchived,
      })
      setSessions(response.sessions)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load sessions'
      setError(message)
    } finally {
      setLoadingSessions(false)
    }
  },

  loadMessages: async sessionId => {
    const { setMessages, setLoadingMessages, setError } = get()
    setLoadingMessages(true)
    setError(null)

    try {
      const response = await window.api.agentSessions.getMessages({ sessionId })
      setMessages(sessionId, response.messages)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load messages'
      setError(message)
    } finally {
      setLoadingMessages(false)
    }
  },

  createSession: async (projectPath, name, modelId) => {
    const { addSession, setCurrentSession, setSaving, setError } = get()
    setSaving(true)
    setError(null)

    try {
      const response = await window.api.agentSessions.create({
        projectPath,
        name,
        modelId,
      })
      addSession(response.session)
      setCurrentSession(response.session.id)

      // Also set as last session
      await window.api.agentSessions.setLast({
        projectPath,
        sessionId: response.session.id,
      })

      return response.session
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to create session'
      setError(message)
      throw err
    } finally {
      setSaving(false)
    }
  },

  updateSession: async (sessionId, updates) => {
    const { updateSessionInStore, setSaving, setError } = get()
    setSaving(true)
    setError(null)

    try {
      const response = await window.api.agentSessions.update({
        sessionId,
        updates,
      })
      updateSessionInStore(sessionId, response.session)
      return response.session
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to update session'
      setError(message)
      throw err
    } finally {
      setSaving(false)
    }
  },

  archiveSession: async sessionId => {
    const { updateSessionInStore, setSaving, setError } = get()
    setSaving(true)
    setError(null)

    try {
      await window.api.agentSessions.archive({ sessionId })
      updateSessionInStore(sessionId, { isArchived: true })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to archive session'
      setError(message)
      throw err
    } finally {
      setSaving(false)
    }
  },

  deleteSession: async sessionId => {
    const { removeSession, setSaving, setError } = get()
    setSaving(true)
    setError(null)

    try {
      await window.api.agentSessions.delete({ sessionId })
      removeSession(sessionId)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete session'
      setError(message)
      throw err
    } finally {
      setSaving(false)
    }
  },

  sendMessage: async (sessionId, role, content) => {
    const { addMessage, setSaving, setError } = get()
    setSaving(true)
    setError(null)

    try {
      const response = await window.api.agentSessions.addMessage({
        sessionId,
        role,
        content,
      })
      addMessage(sessionId, response.message)
      return response.message
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to send message'
      setError(message)
      throw err
    } finally {
      setSaving(false)
    }
  },

  loadLastSession: async projectPath => {
    const { setCurrentSession, setError } = get()
    setError(null)

    try {
      const response = await window.api.agentSessions.getLast({ projectPath })
      if (response.sessionId) {
        setCurrentSession(response.sessionId)
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load last session'
      setError(message)
    }
  },

  setLastSession: async (projectPath, sessionId) => {
    const { setCurrentSession, setError } = get()
    setError(null)

    try {
      await window.api.agentSessions.setLast({ projectPath, sessionId })
      setCurrentSession(sessionId)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to set last session'
      setError(message)
      throw err
    }
  },
}))

// ============================================================================
// Selectors / Custom Hooks
// ============================================================================

/**
 * Hook to get all sessions for the current project
 */
export const useSessions = (): AgentSessionInfo[] => {
  return useSessionStore(
    useShallow(state => Array.from(state.sessions.values()))
  )
}

/**
 * Hook to get active (non-archived) sessions
 */
export const useActiveSessions = (): AgentSessionInfo[] => {
  return useSessionStore(
    useShallow(state =>
      Array.from(state.sessions.values()).filter(s => !s.isArchived)
    )
  )
}

/**
 * Hook to get archived sessions
 */
export const useArchivedSessions = (): AgentSessionInfo[] => {
  return useSessionStore(
    useShallow(state =>
      Array.from(state.sessions.values()).filter(s => s.isArchived)
    )
  )
}

/**
 * Hook to get a specific session by ID
 */
export const useSession = (sessionId: string): AgentSessionInfo | undefined => {
  return useSessionStore(state => state.sessions.get(sessionId))
}

/**
 * Hook to get the current session
 */
export const useCurrentSession = (): AgentSessionInfo | undefined => {
  return useSessionStore(state =>
    state.currentSessionId
      ? state.sessions.get(state.currentSessionId)
      : undefined
  )
}

/**
 * Hook to get the current session ID
 */
export const useCurrentSessionId = (): string | null => {
  return useSessionStore(state => state.currentSessionId)
}

/**
 * Hook to get messages for a specific session
 */
export const useSessionMessages = (
  sessionId: string
): AgentSessionMessageInfo[] => {
  return useSessionStore(
    useShallow(state => state.messages.get(sessionId) || [])
  )
}

/**
 * Hook to get messages for the current session
 */
export const useCurrentSessionMessages = (): AgentSessionMessageInfo[] => {
  return useSessionStore(
    useShallow(state =>
      state.currentSessionId
        ? state.messages.get(state.currentSessionId) || []
        : []
    )
  )
}

/**
 * Hook to get loading states
 */
export const useSessionLoading = () => {
  return useSessionStore(
    useShallow(state => ({
      isLoadingSessions: state.isLoadingSessions,
      isLoadingMessages: state.isLoadingMessages,
      isSaving: state.isSaving,
    }))
  )
}

/**
 * Hook to get error state
 */
export const useSessionError = (): string | null => {
  return useSessionStore(state => state.error)
}

/**
 * Hook to get session actions
 */
export const useSessionActions = () => {
  return useSessionStore(
    useShallow(state => ({
      loadSessions: state.loadSessions,
      loadMessages: state.loadMessages,
      createSession: state.createSession,
      updateSession: state.updateSession,
      archiveSession: state.archiveSession,
      deleteSession: state.deleteSession,
      sendMessage: state.sendMessage,
      loadLastSession: state.loadLastSession,
      setLastSession: state.setLastSession,
      setCurrentSession: state.setCurrentSession,
    }))
  )
}

/**
 * Hook to get session count
 */
export const useSessionCount = (): number => {
  return useSessionStore(state => state.sessions.size)
}

/**
 * Hook to get active session count
 */
export const useActiveSessionCount = (): number => {
  return useSessionStore(
    state =>
      Array.from(state.sessions.values()).filter(s => !s.isArchived).length
  )
}
