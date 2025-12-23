/**
 * Agent Hook
 *
 * React hook for interacting with the new Agent Service (AI Agent Rework).
 * Provides session management, message sending with streaming support,
 * and error handling.
 *
 * Requirements:
 * - 12.1: Provide session management state and methods
 * - 12.2: Support real-time message streaming with proper state updates
 *
 * @module use-agent
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  AgentListSessionsResponse,
  AgentStartConversationResponse,
  AgentGetMessagesResponse,
  AgentMessage,
  AgentStreamData,
  AgentToolUseData,
  AgentErrorData,
  AgentCompleteData,
} from 'shared/ipc-types'

// ============================================================================
// Types
// ============================================================================

/**
 * Session metadata from the Agent API
 */
export interface AgentSession {
  id: string
  name: string
  projectPath?: string
  workingDirectory: string
  createdAt: string
  updatedAt: string
  archived?: boolean
  model?: string
  sdkSessionId?: string
}

/**
 * Error information from the agent
 */
export interface AgentError {
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
  error?: AgentError
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
  workingDirectory?: string
}

// ============================================================================
// Query Keys
// ============================================================================

export const agentKeys = {
  all: ['agent'] as const,
  sessions: () => [...agentKeys.all, 'sessions'] as const,
  session: (sessionId: string) =>
    [...agentKeys.all, 'session', sessionId] as const,
  messages: (sessionId: string) =>
    [...agentKeys.all, 'messages', sessionId] as const,
  isExecuting: (sessionId: string) =>
    [...agentKeys.all, 'isExecuting', sessionId] as const,
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to initialize Agent event subscriptions
 * Call ONCE at app root level
 */
export function useAgentInit() {
  const queryClient = useQueryClient()

  useEffect(() => {
    // Subscribe to complete events to refresh messages
    const unsubComplete = window.api.agent.onComplete(
      (data: AgentCompleteData) => {
        // Invalidate messages query to refresh
        queryClient.invalidateQueries({
          queryKey: agentKeys.messages(data.sessionId),
        })
      }
    )

    return () => {
      unsubComplete()
    }
  }, [queryClient])
}

/**
 * Hook to list all sessions
 */
export function useAgentSessions(includeArchived = false) {
  return useQuery({
    queryKey: agentKeys.sessions(),
    queryFn: async (): Promise<AgentSession[]> => {
      const response: AgentListSessionsResponse =
        await window.api.agent.listSessions({
          includeArchived,
        })
      return response.sessions
    },
  })
}

/**
 * Hook to get messages for a session
 */
export function useAgentMessages(sessionId: string | null) {
  return useQuery({
    queryKey: agentKeys.messages(sessionId || ''),
    queryFn: async (): Promise<AgentMessage[]> => {
      if (!sessionId) return []
      const response: AgentGetMessagesResponse =
        await window.api.agent.getMessages({
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
export function useCreateAgentSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (options: CreateSessionOptions) => {
      const response = await window.api.agent.createSession({
        name: options.name,
        projectPath: options.projectPath,
        workingDirectory: options.workingDirectory,
      })
      return response.session
    },
    onSuccess: () => {
      // Invalidate sessions list
      queryClient.invalidateQueries({
        queryKey: agentKeys.sessions(),
      })
    },
  })
}

/**
 * Hook to archive a session
 */
export function useArchiveAgentSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await window.api.agent.archiveSession({ sessionId })
      return response.success
    },
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({
        queryKey: agentKeys.session(sessionId),
      })
      queryClient.invalidateQueries({
        queryKey: agentKeys.sessions(),
      })
    },
  })
}

/**
 * Hook to delete a session
 */
export function useDeleteAgentSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await window.api.agent.deleteSession({ sessionId })
      return response.success
    },
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({
        queryKey: agentKeys.session(sessionId),
      })
      queryClient.invalidateQueries({
        queryKey: agentKeys.sessions(),
      })
    },
  })
}

/**
 * Hook to clear a session's messages
 */
export function useClearAgentSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await window.api.agent.clearSession({ sessionId })
      return response.success
    },
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({
        queryKey: agentKeys.messages(sessionId),
      })
    },
  })
}

/**
 * Hook to stop execution for a session
 */
export function useStopAgentExecution() {
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await window.api.agent.stopExecution({ sessionId })
      return response.success
    },
  })
}

/**
 * Hook to start a conversation
 */
export function useStartConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      sessionId,
      workingDirectory,
    }: {
      sessionId: string
      workingDirectory: string
    }) => {
      const response: AgentStartConversationResponse =
        await window.api.agent.startConversation({
          sessionId,
          workingDirectory,
        })
      return response
    },
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({
        queryKey: agentKeys.messages(sessionId),
      })
    },
  })
}

/**
 * Main hook for Agent interactions
 *
 * Provides session management, message sending with streaming,
 * and error handling for a specific session.
 */
export function useAgent(sessionId: string | null) {
  const queryClient = useQueryClient()

  // Streaming state
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isStreaming: false,
    currentText: '',
  })

  // Cleanup refs
  const cleanupRefs = useRef<Array<() => void>>([])

  // Get messages
  const messagesQuery = useAgentMessages(sessionId)

  // Check if executing
  const isExecutingQuery = useQuery({
    queryKey: agentKeys.isExecuting(sessionId || ''),
    queryFn: async () => {
      if (!sessionId) return false
      const response = await window.api.agent.isExecuting({ sessionId })
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
      const unsubStream = window.api.agent.onStream((data: AgentStreamData) => {
        if (data.sessionId !== sessionId) return
        setStreamingState(prev => ({
          ...prev,
          currentText: prev.currentText + data.text,
        }))
      })

      const unsubToolUse = window.api.agent.onToolUse(
        (data: AgentToolUseData) => {
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

      const unsubError = window.api.agent.onError((data: AgentErrorData) => {
        if (data.sessionId !== sessionId) return
        setStreamingState(prev => ({
          ...prev,
          isStreaming: false,
          error: data.error,
        }))
      })

      const unsubComplete = window.api.agent.onComplete(
        (data: AgentCompleteData) => {
          if (data.sessionId !== sessionId) return
          setStreamingState(prev => ({
            ...prev,
            isStreaming: false,
          }))
          // Refresh messages
          queryClient.invalidateQueries({
            queryKey: agentKeys.messages(sessionId),
          })
        }
      )

      // Store cleanup functions
      cleanupRefs.current = [
        unsubStream,
        unsubToolUse,
        unsubError,
        unsubComplete,
      ]

      try {
        const response = await window.api.agent.sendMessage({
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
    const response = await window.api.agent.stopExecution({ sessionId })
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
    refreshMessages: () =>
      queryClient.invalidateQueries({
        queryKey: agentKeys.messages(sessionId || ''),
      }),
  }
}

/**
 * Hook to get all Agent session management actions
 */
export function useAgentActions() {
  const createSession = useCreateAgentSession()
  const archiveSession = useArchiveAgentSession()
  const deleteSession = useDeleteAgentSession()
  const clearSession = useClearAgentSession()
  const stopExecution = useStopAgentExecution()
  const startConversation = useStartConversation()

  return {
    createSession: createSession.mutateAsync,
    archiveSession: archiveSession.mutateAsync,
    deleteSession: deleteSession.mutateAsync,
    clearSession: clearSession.mutateAsync,
    stopExecution: stopExecution.mutateAsync,
    startConversation: startConversation.mutateAsync,
    isCreating: createSession.isPending,
    isArchiving: archiveSession.isPending,
    isDeleting: deleteSession.isPending,
    isClearing: clearSession.isPending,
    isStopping: stopExecution.isPending,
    isStartingConversation: startConversation.isPending,
  }
}
