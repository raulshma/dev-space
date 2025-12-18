/**
 * React hooks for AI operations
 *
 * Provides TanStack Query hooks for AI service operations including
 * text generation, streaming, model management, and conversation handling.
 * Requirements: 1.2, 1.3, 3.1
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import { useAIStore } from 'renderer/stores/ai-store'
import type {
  AIAction,
  AIModel,
  ConversationMessage,
  AILogFilter,
} from 'shared/ai-types'

// ============================================================================
// Query Keys
// ============================================================================

export const aiKeys = {
  all: ['ai'] as const,
  models: () => [...aiKeys.all, 'models'] as const,
  conversation: (projectId: string) =>
    [...aiKeys.all, 'conversation', projectId] as const,
  logs: (filter?: AILogFilter) => [...aiKeys.all, 'logs', filter] as const,
  log: (logId: string) => [...aiKeys.all, 'log', logId] as const,
  config: () => [...aiKeys.all, 'config'] as const,
  configStatus: () => [...aiKeys.all, 'configStatus'] as const,
}

// ============================================================================
// Model Hooks
// ============================================================================

/**
 * Hook to fetch available AI models
 */
export function useAIModels() {
  const { setAvailableModels, setModelsLoading, setModelsError } = useAIStore()

  return useQuery({
    queryKey: aiKeys.models(),
    queryFn: async () => {
      setModelsLoading(true)
      try {
        const response = await window.api.ai.getModels({})
        setAvailableModels(response.models)
        return response.models
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to fetch models'
        setModelsError(message)
        throw error
      } finally {
        setModelsLoading(false)
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to set the default AI model
 */
export function useSetDefaultModel() {
  const queryClient = useQueryClient()
  const { setDefaultModelId } = useAIStore()

  return useMutation({
    mutationFn: async (modelId: string) => {
      const response = await window.api.ai.setDefaultModel({ modelId })
      return response.success
    },
    onSuccess: (_, modelId) => {
      setDefaultModelId(modelId)
      queryClient.invalidateQueries({ queryKey: aiKeys.models() })
    },
  })
}

/**
 * Hook to set a model for a specific action
 */
export function useSetActionModel() {
  const { setActionModel } = useAIStore()

  return useMutation({
    mutationFn: async ({
      action,
      modelId,
    }: {
      action: AIAction
      modelId: string
    }) => {
      const response = await window.api.ai.setActionModel({ action, modelId })
      return response.success
    },
    onSuccess: (_, { action, modelId }) => {
      setActionModel(action, modelId)
    },
  })
}

// ============================================================================
// Conversation Hooks
// ============================================================================

/**
 * Hook to fetch conversation for a project
 */
export function useAIConversation(projectId: string | null) {
  const { setConversation } = useAIStore()

  return useQuery({
    queryKey: aiKeys.conversation(projectId || ''),
    queryFn: async () => {
      if (!projectId) return []
      const response = await window.api.ai.getConversation({ projectId })
      // Convert serialized timestamps back to Date objects
      const messages = response.messages.map(msg => ({
        ...msg,
        timestamp:
          msg.timestamp instanceof Date
            ? msg.timestamp
            : new Date(msg.timestamp as unknown as string),
      }))
      setConversation(projectId, messages)
      return messages
    },
    enabled: !!projectId,
  })
}

/**
 * Hook to clear conversation for a project
 */
export function useClearConversation() {
  const queryClient = useQueryClient()
  const { clearConversation } = useAIStore()

  return useMutation({
    mutationFn: async (projectId: string) => {
      const response = await window.api.ai.clearConversation({ projectId })
      return response.success
    },
    onSuccess: (_, projectId) => {
      clearConversation(projectId)
      queryClient.invalidateQueries({
        queryKey: aiKeys.conversation(projectId),
      })
    },
  })
}

// ============================================================================
// Text Generation Hooks
// ============================================================================

/**
 * Hook for non-streaming text generation
 */
export function useGenerateText() {
  const queryClient = useQueryClient()
  const { addMessage } = useAIStore()

  return useMutation({
    mutationFn: async ({
      projectId,
      content,
      action,
      systemPrompt,
    }: {
      projectId: string
      content: string
      action?: AIAction
      systemPrompt?: string
    }) => {
      // Add user message to store
      const userMessage: ConversationMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: new Date(),
      }
      addMessage(projectId, userMessage)

      const response = await window.api.ai.generateText({
        projectId,
        content,
        action,
        systemPrompt,
      })

      // Add assistant message to store
      const assistantMessage: ConversationMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.text,
        timestamp: new Date(),
        model: response.model,
      }
      addMessage(projectId, assistantMessage)

      return response
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: aiKeys.conversation(projectId),
      })
    },
  })
}

/**
 * Hook for streaming text generation
 */
export function useStreamText() {
  const queryClient = useQueryClient()
  const {
    addMessage,
    updateLastMessage,
    startStreaming,
    appendStreamText,
    completeStreaming,
    setStreamError,
  } = useAIStore()

  const cleanupRef = useRef<(() => void) | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
      }
    }
  }, [])

  const streamText = useCallback(
    async ({
      projectId,
      content,
      action,
      systemPrompt,
    }: {
      projectId: string
      content: string
      action?: AIAction
      systemPrompt?: string
    }) => {
      const streamId = crypto.randomUUID()

      // Add user message
      const userMessage: ConversationMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: new Date(),
      }
      addMessage(projectId, userMessage)

      // Add placeholder assistant message
      const assistantMessage: ConversationMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      }
      addMessage(projectId, assistantMessage)

      // Start streaming state
      startStreaming(streamId)

      // Set up chunk listener
      const cleanup = window.api.ai.onStreamChunk(data => {
        if (data.streamId !== streamId) return

        if (data.error) {
          setStreamError(streamId, data.error)
          return
        }

        if (data.text) {
          appendStreamText(streamId, data.text)
          updateLastMessage(projectId, data.text)
        }

        if (data.isComplete) {
          completeStreaming(streamId)
          queryClient.invalidateQueries({
            queryKey: aiKeys.conversation(projectId),
          })
        }
      })

      cleanupRef.current = cleanup

      try {
        await window.api.ai.streamText({
          projectId,
          content,
          action,
          systemPrompt,
          streamId,
        })
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Streaming failed'
        setStreamError(streamId, message)
        cleanup()
      }

      return streamId
    },
    [
      addMessage,
      updateLastMessage,
      startStreaming,
      appendStreamText,
      completeStreaming,
      setStreamError,
      queryClient,
    ]
  )

  const cancelStream = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
  }, [])

  return { streamText, cancelStream }
}

// ============================================================================
// Request Log Hooks
// ============================================================================

/**
 * Hook to fetch AI request logs
 */
export function useAIRequestLogs(filter?: AILogFilter) {
  const { setRequestLogs, setLogsLoading } = useAIStore()

  return useQuery({
    queryKey: aiKeys.logs(filter),
    queryFn: async () => {
      setLogsLoading(true)
      try {
        const response = await window.api.ai.getRequestLogs({ filter })
        // Convert timestamps
        const logs = response.logs.map(log => ({
          ...log,
          timestamp:
            log.timestamp instanceof Date
              ? log.timestamp
              : new Date(log.timestamp as unknown as string),
        }))
        setRequestLogs(logs)
        return logs
      } finally {
        setLogsLoading(false)
      }
    },
  })
}

/**
 * Hook to fetch a single AI request log
 */
export function useAIRequestLog(logId: string | null) {
  return useQuery({
    queryKey: aiKeys.log(logId || ''),
    queryFn: async () => {
      if (!logId) return null
      const response = await window.api.ai.getRequestLog({ logId })
      if (!response.log) return null
      return {
        ...response.log,
        timestamp:
          response.log.timestamp instanceof Date
            ? response.log.timestamp
            : new Date(response.log.timestamp as unknown as string),
      }
    },
    enabled: !!logId,
  })
}

// ============================================================================
// Agent Configuration Hooks
// ============================================================================

/**
 * Hook to fetch agent configuration
 */
export function useAgentConfig() {
  const { setAgentConfig } = useAIStore()

  return useQuery({
    queryKey: aiKeys.config(),
    queryFn: async () => {
      const response = await window.api.agentConfig.get({})
      setAgentConfig(response.config)
      return response.config
    },
  })
}

/**
 * Hook to check if agent is configured
 */
export function useAgentConfigStatus() {
  const { setAgentConfigured } = useAIStore()

  return useQuery({
    queryKey: aiKeys.configStatus(),
    queryFn: async () => {
      const response = await window.api.agentConfig.isConfigured({})
      setAgentConfigured(response.isConfigured)
      return response.isConfigured
    },
  })
}

/**
 * Hook to update agent configuration
 */
export function useUpdateAgentConfig() {
  const queryClient = useQueryClient()
  const { setAgentConfig } = useAIStore()

  return useMutation({
    mutationFn: async (
      updates: import('shared/ai-types').UpdateAgentConfigInput
    ) => {
      const response = await window.api.agentConfig.set({ updates })
      return response.success
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiKeys.config() })
      queryClient.invalidateQueries({ queryKey: aiKeys.configStatus() })
    },
  })
}

/**
 * Hook to validate agent configuration
 */
export function useValidateAgentConfig() {
  return useMutation({
    mutationFn: async (
      config: import('shared/ai-types').AgentEnvironmentConfig
    ) => {
      const response = await window.api.agentConfig.validate({ config })
      return response.result
    },
  })
}
