/**
 * AI Store - Zustand state management for AI operations
 *
 * Manages conversation state, active model, available models, and streaming state.
 * Requirements: 1.3, 3.1, 5.1
 */

import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type {
  AIModel,
  ConversationMessage,
  AIAction,
  AIRequestLog,
  AgentEnvironmentConfig,
} from 'shared/ai-types'

// ============================================================================
// Types
// ============================================================================

export interface StreamingState {
  streamId: string
  isStreaming: boolean
  currentText: string
  error?: string
}

export interface AIState {
  // Model state
  availableModels: AIModel[]
  defaultModelId: string | null
  actionModels: Map<AIAction, string>
  isLoadingModels: boolean
  modelsError: string | null
  isUsingCachedModels: boolean

  // Conversation state (per project)
  conversations: Map<string, ConversationMessage[]>
  activeProjectId: string | null

  // Streaming state
  streaming: StreamingState | null

  // Request logs
  requestLogs: AIRequestLog[]
  isLoadingLogs: boolean

  // Agent configuration
  agentConfig: AgentEnvironmentConfig | null
  isAgentConfigured: boolean

  // Actions - Model management
  setAvailableModels: (models: AIModel[], fromCache?: boolean) => void
  setDefaultModelId: (modelId: string) => void
  setActionModel: (action: AIAction, modelId: string) => void
  setModelsLoading: (loading: boolean) => void
  setModelsError: (error: string | null) => void

  // Actions - Conversation management
  setActiveProject: (projectId: string | null) => void
  setConversation: (projectId: string, messages: ConversationMessage[]) => void
  addMessage: (projectId: string, message: ConversationMessage) => void
  updateLastMessage: (projectId: string, content: string) => void
  clearConversation: (projectId: string) => void

  // Actions - Streaming
  startStreaming: (streamId: string) => void
  appendStreamText: (streamId: string, text: string) => void
  completeStreaming: (streamId: string) => void
  setStreamError: (streamId: string, error: string) => void
  cancelStreaming: () => void

  // Actions - Request logs
  setRequestLogs: (logs: AIRequestLog[]) => void
  setLogsLoading: (loading: boolean) => void

  // Actions - Agent configuration
  setAgentConfig: (config: AgentEnvironmentConfig | null) => void
  setAgentConfigured: (configured: boolean) => void

  // Selectors
  getConversation: (projectId: string) => ConversationMessage[]
  getModelForAction: (action: AIAction) => string | null
  getDefaultModel: () => AIModel | undefined
}

// ============================================================================
// Store
// ============================================================================

export const useAIStore = create<AIState>((set, get) => ({
  // Initial state
  availableModels: [],
  defaultModelId: null,
  actionModels: new Map(),
  isLoadingModels: false,
  modelsError: null,
  isUsingCachedModels: false,

  conversations: new Map(),
  activeProjectId: null,

  streaming: null,

  requestLogs: [],
  isLoadingLogs: false,

  agentConfig: null,
  isAgentConfigured: false,

  // Model management actions
  setAvailableModels: (models, fromCache = false) =>
    set({
      availableModels: models,
      isUsingCachedModels: fromCache,
      modelsError: null,
    }),

  setDefaultModelId: modelId =>
    set({
      defaultModelId: modelId,
    }),

  setActionModel: (action, modelId) =>
    set(state => {
      const newActionModels = new Map(state.actionModels)
      newActionModels.set(action, modelId)
      return { actionModels: newActionModels }
    }),

  setModelsLoading: loading =>
    set({
      isLoadingModels: loading,
    }),

  setModelsError: error =>
    set({
      modelsError: error,
    }),

  // Conversation management actions
  setActiveProject: projectId =>
    set({
      activeProjectId: projectId,
    }),

  setConversation: (projectId, messages) =>
    set(state => {
      const newConversations = new Map(state.conversations)
      newConversations.set(projectId, messages)
      return { conversations: newConversations }
    }),

  addMessage: (projectId, message) =>
    set(state => {
      const newConversations = new Map(state.conversations)
      const existing = newConversations.get(projectId) || []
      newConversations.set(projectId, [...existing, message])
      return { conversations: newConversations }
    }),

  updateLastMessage: (projectId, content) =>
    set(state => {
      const newConversations = new Map(state.conversations)
      const existing = newConversations.get(projectId) || []
      if (existing.length === 0) return state

      const updated = [...existing]
      const lastMessage = updated[updated.length - 1]
      updated[updated.length - 1] = { ...lastMessage, content }
      newConversations.set(projectId, updated)
      return { conversations: newConversations }
    }),

  clearConversation: projectId =>
    set(state => {
      const newConversations = new Map(state.conversations)
      newConversations.delete(projectId)
      return { conversations: newConversations }
    }),

  // Streaming actions
  startStreaming: streamId =>
    set({
      streaming: {
        streamId,
        isStreaming: true,
        currentText: '',
      },
    }),

  appendStreamText: (streamId, text) =>
    set(state => {
      if (!state.streaming || state.streaming.streamId !== streamId) {
        return state
      }
      return {
        streaming: {
          ...state.streaming,
          currentText: state.streaming.currentText + text,
        },
      }
    }),

  completeStreaming: streamId =>
    set(state => {
      if (!state.streaming || state.streaming.streamId !== streamId) {
        return state
      }
      return {
        streaming: {
          ...state.streaming,
          isStreaming: false,
        },
      }
    }),

  setStreamError: (streamId, error) =>
    set(state => {
      if (!state.streaming || state.streaming.streamId !== streamId) {
        return state
      }
      return {
        streaming: {
          ...state.streaming,
          isStreaming: false,
          error,
        },
      }
    }),

  cancelStreaming: () =>
    set({
      streaming: null,
    }),

  // Request logs actions
  setRequestLogs: logs =>
    set({
      requestLogs: logs,
    }),

  setLogsLoading: loading =>
    set({
      isLoadingLogs: loading,
    }),

  // Agent configuration actions
  setAgentConfig: config =>
    set({
      agentConfig: config,
    }),

  setAgentConfigured: configured =>
    set({
      isAgentConfigured: configured,
    }),

  // Selectors
  getConversation: projectId => {
    return get().conversations.get(projectId) || []
  },

  getModelForAction: action => {
    const state = get()
    return state.actionModels.get(action) || state.defaultModelId
  },

  getDefaultModel: () => {
    const state = get()
    if (!state.defaultModelId) return undefined
    return state.availableModels.find(m => m.id === state.defaultModelId)
  },
}))

// ============================================================================
// Custom Hooks
// ============================================================================

/**
 * Hook to get conversation for a specific project
 */
export const useConversation = (projectId: string): ConversationMessage[] => {
  return useAIStore(
    useShallow(state => state.conversations.get(projectId) || [])
  )
}

/**
 * Hook to get the active streaming state
 */
export const useStreaming = (): StreamingState | null => {
  return useAIStore(state => state.streaming)
}

/**
 * Hook to get available models
 */
export const useAvailableModels = (): AIModel[] => {
  return useAIStore(state => state.availableModels)
}

/**
 * Hook to get the default model
 */
export const useDefaultModel = (): AIModel | undefined => {
  return useAIStore(state => {
    if (!state.defaultModelId) return undefined
    return state.availableModels.find(m => m.id === state.defaultModelId)
  })
}

/**
 * Hook to check if models are loading
 */
export const useModelsLoading = (): boolean => {
  return useAIStore(state => state.isLoadingModels)
}

/**
 * Hook to check if using cached models
 */
export const useUsingCachedModels = (): boolean => {
  return useAIStore(state => state.isUsingCachedModels)
}

/**
 * Hook to get agent configuration status
 */
export const useAgentConfigured = (): boolean => {
  return useAIStore(state => state.isAgentConfigured)
}
