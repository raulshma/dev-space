/**
 * Agent V2 Hook
 *
 * React hook for interacting with the Agent Service V2 (Claude SDK integration).
 * Provides session management, message sending with streaming support,
 * and error handling.
 *
 * Requirements:
 * - 3.1: Manage conversation sessions with unique session IDs
 * - 3.2: Load existing messages from persistent storage
 * - 3.3: Add messages to conversation history and invoke provider
 * - 3.4: Stream assistant responses in real-time via event emission
 * - 3.7: Handle errors and add error messages to conversation
 *
 * @module use-agent-v2
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  AgentV2SessionListResponse,
  AgentV2SessionGetResponse,
  AgentV2GetMessagesResponse,
  AgentV2Message,
  AgentV2TextDeltaData,
  AgentV2MessageData,
  AgentV2ToolUseData,
  AgentV2ErrorData,
  AgentV2CompleteData,
} from 'shared/ipc-types'

// ============================================================================
// Types
// ============================================================================

/**
 * Session metadata from the V2 API
 */
export interface AgentV2Session {
  id: string
  name: string
  projectPath?: string
  workingDirectory: string
  createdAt: string
  updatedAt: string
  archived?: boolean
  tags?: string[]
  model?: string
  sdkSessionId?: string
}

/**
 * Error information from the agent
 */
export interface AgentV2Error {
  type: 'abort' | 'rate_limit' | 'network' | 'auth' | 'unknown'
  message: string
  isAbort: boolean
  retryable: boolean
  resetTime?: string
}

/**
 * Streaming state for a session
 */
export interface StreamingState {
  isStreaming: boolean
  currentText: string
  lastToolUse?: {
    name: string
    input: unknown
  }
  error?: AgentV2Error
}

/**
 * Options for sending a message
 */
export interface SendMessageOptions {
  message: string
  imagePaths?: string[]
  model?: string
  systemPrompt?: string
  allowedTools?: string[]
}

/**
 * Options for creating a session
 */
export interface CreateSessionOptions {
  name: string
  projectPath?: string
  workingDirectory: string
  model?: string
  tags?: string[]
}

// ============================================================================
// Query Keys
// ============================================================================

export const agentV2Keys = {
  all: ['agentV2'] as const,
  sessions: (projectPath?: string) =>
    [...agentV2Keys.all, 'sessions', projectPath] as const,
  session: (sessionId: string) =>
    [...agentV2Keys.all, 'session', sessionId] as const,
  messages: (sessionId: string) =>
    [...agentV2Keys.all, 'messages', sessionId] as const,
  isExecuting: (sessionId: string) =>
    [...agentV2Keys.all, 'isExecuting', sessionId] as const,
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to initialize Agent V2 event subscriptions
 * Call ONCE at app root level
 */
export function useAgentV2Init() {
  const queryClient = useQueryClient()

  useEffect(() => {
    // Subscribe to message events
    const unsubMessage = window.api.agentV2.onMessage(
      (data: AgentV2MessageData) => {
        // Invalidate messages query to refresh
        queryClient.invalidateQueries({
          queryKey: agentV2Keys.messages(data.sessionId),
        })
      }
    )

    // Subscribe to complete events
    const unsubComplete = window.api.agentV2.onComplete(
      (data: AgentV2CompleteData) => {
        // Invalidate messages query to refresh
        queryClient.invalidateQueries({
          queryKey: agentV2Keys.messages(data.sessionId),
        })
      }
    )

    return () => {
      unsubMessage()
      unsubComplete()
    }
  }, [queryClient])
}

/**
 * Hook to list sessions for a project
 */
export function useAgentV2Sessions(
  projectPath?: string,
  includeArchived = false
) {
  return useQuery({
    queryKey: agentV2Keys.sessions(projectPath),
    queryFn: async (): Promise<AgentV2Session[]> => {
      const response: AgentV2SessionListResponse =
        await window.api.agentV2.listSessions({
          projectPath,
          includeArchived,
        })
      return response.sessions
    },
  })
}

/**
 * Hook to get a single session
 */
export function useAgentV2Session(sessionId: string | null) {
  return useQuery({
    queryKey: agentV2Keys.session(sessionId || ''),
    queryFn: async () => {
      if (!sessionId) return null
      const response: AgentV2SessionGetResponse =
        await window.api.agentV2.getSession({
          sessionId,
        })
      return response.session
    },
    enabled: !!sessionId,
  })
}

/**
 * Hook to get messages for a session
 */
export function useAgentV2Messages(sessionId: string | null) {
  return useQuery({
    queryKey: agentV2Keys.messages(sessionId || ''),
    queryFn: async (): Promise<AgentV2Message[]> => {
      if (!sessionId) return []
      const response: AgentV2GetMessagesResponse =
        await window.api.agentV2.getMessages({
          sessionId,
        })
      return response.messages
    },
    enabled: !!sessionId,
  })
}

/**
 * Hook to create a new session
 */
export function useCreateAgentV2Session() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (options: CreateSessionOptions) => {
      const response = await window.api.agentV2.createSession({
        name: options.name,
        projectPath: options.projectPath,
        workingDirectory: options.workingDirectory,
        model: options.model,
        tags: options.tags,
      })
      return response.session
    },
    onSuccess: session => {
      // Invalidate sessions list
      queryClient.invalidateQueries({
        queryKey: agentV2Keys.sessions(session.projectPath),
      })
    },
  })
}

/**
 * Hook to update a session
 */
export function useUpdateAgentV2Session() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      sessionId,
      updates,
    }: {
      sessionId: string
      updates: { name?: string; tags?: string[]; model?: string }
    }) => {
      const response = await window.api.agentV2.updateSession({
        sessionId,
        updates,
      })
      return response.session
    },
    onSuccess: session => {
      if (session) {
        queryClient.invalidateQueries({
          queryKey: agentV2Keys.session(session.id),
        })
        queryClient.invalidateQueries({
          queryKey: agentV2Keys.sessions(session.projectPath),
        })
      }
    },
  })
}

/**
 * Hook to archive a session
 */
export function useArchiveAgentV2Session() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await window.api.agentV2.archiveSession({ sessionId })
      return response.success
    },
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({
        queryKey: agentV2Keys.session(sessionId),
      })
      queryClient.invalidateQueries({
        queryKey: agentV2Keys.sessions(),
      })
    },
  })
}

/**
 * Hook to delete a session
 */
export function useDeleteAgentV2Session() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await window.api.agentV2.deleteSession({ sessionId })
      return response.success
    },
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({
        queryKey: agentV2Keys.session(sessionId),
      })
      queryClient.invalidateQueries({
        queryKey: agentV2Keys.sessions(),
      })
    },
  })
}

/**
 * Hook to clear a session's messages
 */
export function useClearAgentV2Session() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await window.api.agentV2.clearSession({ sessionId })
      return response.success
    },
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({
        queryKey: agentV2Keys.messages(sessionId),
      })
    },
  })
}

/**
 * Hook to stop execution for a session
 */
export function useStopAgentV2Execution() {
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await window.api.agentV2.stopExecution({ sessionId })
      return response.success
    },
  })
}

/**
 * Main hook for Agent V2 interactions
 *
 * Provides session management, message sending with streaming,
 * and error handling for a specific session.
 */
export function useAgentV2(sessionId: string | null) {
  const queryClient = useQueryClient()

  // Streaming state
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isStreaming: false,
    currentText: '',
  })

  // Cleanup refs
  const cleanupRefs = useRef<Array<() => void>>([])

  // Get session data
  const sessionQuery = useAgentV2Session(sessionId)
  const messagesQuery = useAgentV2Messages(sessionId)

  // Check if executing
  const isExecutingQuery = useQuery({
    queryKey: agentV2Keys.isExecuting(sessionId || ''),
    queryFn: async () => {
      if (!sessionId) return false
      const response = await window.api.agentV2.isExecuting({ sessionId })
      return response.isExecuting
    },
    enabled: !!sessionId,
    refetchInterval: streamingState.isStreaming ? 1000 : false,
  })

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const cleanup of cleanupRefs.current) {
        cleanup()
      }
      cleanupRefs.current = []
    }
  }, [])

  // Send message with streaming
  const sendMessage = useCallback(
    async (options: SendMessageOptions) => {
      if (!sessionId) {
        throw new Error('No session selected')
      }

      // Reset streaming state
      setStreamingState({
        isStreaming: true,
        currentText: '',
      })

      // Set up event listeners
      const unsubTextDelta = window.api.agentV2.onTextDelta(
        (data: AgentV2TextDeltaData) => {
          if (data.sessionId !== sessionId) return
          setStreamingState(prev => ({
            ...prev,
            currentText: prev.currentText + data.text,
          }))
        }
      )

      const unsubToolUse = window.api.agentV2.onToolUse(
        (data: AgentV2ToolUseData) => {
          if (data.sessionId !== sessionId) return
          setStreamingState(prev => ({
            ...prev,
            lastToolUse: {
              name: data.toolName,
              input: data.input,
            },
          }))
        }
      )

      const unsubError = window.api.agentV2.onError(
        (data: AgentV2ErrorData) => {
          if (data.sessionId !== sessionId) return
          setStreamingState(prev => ({
            ...prev,
            isStreaming: false,
            error: data.error,
          }))
        }
      )

      const unsubComplete = window.api.agentV2.onComplete(
        (data: AgentV2CompleteData) => {
          if (data.sessionId !== sessionId) return
          setStreamingState(prev => ({
            ...prev,
            isStreaming: false,
          }))
          // Refresh messages
          queryClient.invalidateQueries({
            queryKey: agentV2Keys.messages(sessionId),
          })
        }
      )

      // Store cleanup functions
      cleanupRefs.current = [
        unsubTextDelta,
        unsubToolUse,
        unsubError,
        unsubComplete,
      ]

      try {
        const response = await window.api.agentV2.sendMessage({
          sessionId,
          message: options.message,
          imagePaths: options.imagePaths,
          model: options.model,
          systemPrompt: options.systemPrompt,
          allowedTools: options.allowedTools,
        })

        return response.message
      } catch (error) {
        setStreamingState(prev => ({
          ...prev,
          isStreaming: false,
          error: {
            type: 'unknown',
            message: error instanceof Error ? error.message : 'Unknown error',
            isAbort: false,
            retryable: false,
          },
        }))
        throw error
      } finally {
        // Cleanup listeners
        for (const cleanup of cleanupRefs.current) {
          cleanup()
        }
        cleanupRefs.current = []
      }
    },
    [sessionId, queryClient]
  )

  // Stop execution
  const stopExecution = useCallback(async () => {
    if (!sessionId) return false
    const response = await window.api.agentV2.stopExecution({ sessionId })
    if (response.success) {
      setStreamingState(prev => ({
        ...prev,
        isStreaming: false,
      }))
    }
    return response.success
  }, [sessionId])

  // Clear error
  const clearError = useCallback(() => {
    setStreamingState(prev => ({
      ...prev,
      error: undefined,
    }))
  }, [])

  // Clear streaming text
  const clearStreamingText = useCallback(() => {
    setStreamingState(prev => ({
      ...prev,
      currentText: '',
    }))
  }, [])

  return {
    // Session data
    session: sessionQuery.data,
    sessionLoading: sessionQuery.isLoading,
    sessionError: sessionQuery.error,

    // Messages
    messages: messagesQuery.data || [],
    messagesLoading: messagesQuery.isLoading,
    messagesError: messagesQuery.error,

    // Streaming state
    isStreaming: streamingState.isStreaming,
    streamingText: streamingState.currentText,
    lastToolUse: streamingState.lastToolUse,
    error: streamingState.error,

    // Execution state
    isExecuting: isExecutingQuery.data || streamingState.isStreaming,

    // Actions
    sendMessage,
    stopExecution,
    clearError,
    clearStreamingText,

    // Refresh functions
    refreshSession: () =>
      queryClient.invalidateQueries({
        queryKey: agentV2Keys.session(sessionId || ''),
      }),
    refreshMessages: () =>
      queryClient.invalidateQueries({
        queryKey: agentV2Keys.messages(sessionId || ''),
      }),
  }
}

/**
 * Hook to get all Agent V2 session management actions
 */
export function useAgentV2Actions() {
  const createSession = useCreateAgentV2Session()
  const updateSession = useUpdateAgentV2Session()
  const archiveSession = useArchiveAgentV2Session()
  const deleteSession = useDeleteAgentV2Session()
  const clearSession = useClearAgentV2Session()
  const stopExecution = useStopAgentV2Execution()

  return {
    createSession: createSession.mutateAsync,
    updateSession: updateSession.mutateAsync,
    archiveSession: archiveSession.mutateAsync,
    deleteSession: deleteSession.mutateAsync,
    clearSession: clearSession.mutateAsync,
    stopExecution: stopExecution.mutateAsync,
    isCreating: createSession.isPending,
    isUpdating: updateSession.isPending,
    isArchiving: archiveSession.isPending,
    isDeleting: deleteSession.isPending,
    isClearing: clearSession.isPending,
    isStopping: stopExecution.isPending,
  }
}
