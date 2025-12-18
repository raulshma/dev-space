/**
 * Unit tests for AI Store
 * Requirements: 1.3, 3.1, 5.1
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useAIStore } from './ai-store'
import type { AIModel, ConversationMessage, AIAction } from 'shared/ai-types'

describe('AIStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAIStore.setState({
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
    })
  })

  describe('Model Management', () => {
    const mockModels: AIModel[] = [
      {
        id: 'model-1',
        name: 'Test Model 1',
        provider: 'openrouter',
        contextLength: 4096,
        pricing: { prompt: 0.001, completion: 0.002 },
        capabilities: ['chat'],
        isConfigured: true,
      },
      {
        id: 'model-2',
        name: 'Test Model 2',
        provider: 'openrouter',
        contextLength: 8192,
        pricing: { prompt: 0.002, completion: 0.004 },
        capabilities: ['chat', 'code'],
        isConfigured: true,
      },
    ]

    it('should set available models', () => {
      const { setAvailableModels } = useAIStore.getState()

      setAvailableModels(mockModels)

      expect(useAIStore.getState().availableModels).toEqual(mockModels)
      expect(useAIStore.getState().isUsingCachedModels).toBe(false)
    })

    it('should set available models from cache', () => {
      const { setAvailableModels } = useAIStore.getState()

      setAvailableModels(mockModels, true)

      expect(useAIStore.getState().availableModels).toEqual(mockModels)
      expect(useAIStore.getState().isUsingCachedModels).toBe(true)
    })

    it('should set default model ID', () => {
      const { setDefaultModelId } = useAIStore.getState()

      setDefaultModelId('model-1')

      expect(useAIStore.getState().defaultModelId).toBe('model-1')
    })

    it('should set action model', () => {
      const { setActionModel } = useAIStore.getState()

      setActionModel('chat', 'model-1')
      setActionModel('code-generation', 'model-2')

      const actionModels = useAIStore.getState().actionModels
      expect(actionModels.get('chat')).toBe('model-1')
      expect(actionModels.get('code-generation')).toBe('model-2')
    })

    it('should get model for action', () => {
      const { setActionModel, setDefaultModelId, getModelForAction } =
        useAIStore.getState()

      setDefaultModelId('model-1')
      setActionModel('chat', 'model-2')

      // Should return action-specific model
      expect(getModelForAction('chat')).toBe('model-2')
      // Should fall back to default model
      expect(getModelForAction('code-generation')).toBe('model-1')
    })

    it('should get default model', () => {
      const { setAvailableModels, setDefaultModelId, getDefaultModel } =
        useAIStore.getState()

      setAvailableModels(mockModels)
      setDefaultModelId('model-1')

      const defaultModel = getDefaultModel()
      expect(defaultModel).toEqual(mockModels[0])
    })

    it('should set models loading state', () => {
      const { setModelsLoading } = useAIStore.getState()

      setModelsLoading(true)
      expect(useAIStore.getState().isLoadingModels).toBe(true)

      setModelsLoading(false)
      expect(useAIStore.getState().isLoadingModels).toBe(false)
    })

    it('should set models error', () => {
      const { setModelsError } = useAIStore.getState()

      setModelsError('Failed to fetch models')
      expect(useAIStore.getState().modelsError).toBe('Failed to fetch models')

      setModelsError(null)
      expect(useAIStore.getState().modelsError).toBe(null)
    })
  })

  describe('Conversation Management', () => {
    const mockMessage: ConversationMessage = {
      id: 'msg-1',
      role: 'user',
      content: 'Hello',
      timestamp: new Date('2024-01-01'),
    }

    it('should set active project', () => {
      const { setActiveProject } = useAIStore.getState()

      setActiveProject('project-1')
      expect(useAIStore.getState().activeProjectId).toBe('project-1')

      setActiveProject(null)
      expect(useAIStore.getState().activeProjectId).toBe(null)
    })

    it('should set conversation for a project', () => {
      const { setConversation } = useAIStore.getState()

      setConversation('project-1', [mockMessage])

      const conversations = useAIStore.getState().conversations
      expect(conversations.get('project-1')).toEqual([mockMessage])
    })

    it('should add message to conversation', () => {
      const { setConversation, addMessage } = useAIStore.getState()

      setConversation('project-1', [mockMessage])

      const newMessage: ConversationMessage = {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hi there!',
        timestamp: new Date('2024-01-02'),
      }

      addMessage('project-1', newMessage)

      const conversations = useAIStore.getState().conversations
      expect(conversations.get('project-1')).toHaveLength(2)
      expect(conversations.get('project-1')?.[1]).toEqual(newMessage)
    })

    it('should update last message content', () => {
      const { setConversation, updateLastMessage } = useAIStore.getState()

      setConversation('project-1', [mockMessage])
      updateLastMessage('project-1', 'Updated content')

      const conversations = useAIStore.getState().conversations
      expect(conversations.get('project-1')?.[0].content).toBe('Updated content')
    })

    it('should clear conversation', () => {
      const { setConversation, clearConversation } = useAIStore.getState()

      setConversation('project-1', [mockMessage])
      clearConversation('project-1')

      const conversations = useAIStore.getState().conversations
      expect(conversations.has('project-1')).toBe(false)
    })

    it('should get conversation for project', () => {
      const { setConversation, getConversation } = useAIStore.getState()

      setConversation('project-1', [mockMessage])

      expect(getConversation('project-1')).toEqual([mockMessage])
      expect(getConversation('non-existent')).toEqual([])
    })
  })

  describe('Streaming State', () => {
    it('should start streaming', () => {
      const { startStreaming } = useAIStore.getState()

      startStreaming('stream-1')

      const streaming = useAIStore.getState().streaming
      expect(streaming).toEqual({
        streamId: 'stream-1',
        isStreaming: true,
        currentText: '',
      })
    })

    it('should append stream text', () => {
      const { startStreaming, appendStreamText } = useAIStore.getState()

      startStreaming('stream-1')
      appendStreamText('stream-1', 'Hello ')
      appendStreamText('stream-1', 'World')

      const streaming = useAIStore.getState().streaming
      expect(streaming?.currentText).toBe('Hello World')
    })

    it('should not append text for different stream ID', () => {
      const { startStreaming, appendStreamText } = useAIStore.getState()

      startStreaming('stream-1')
      appendStreamText('stream-2', 'Wrong stream')

      const streaming = useAIStore.getState().streaming
      expect(streaming?.currentText).toBe('')
    })

    it('should complete streaming', () => {
      const { startStreaming, completeStreaming } = useAIStore.getState()

      startStreaming('stream-1')
      completeStreaming('stream-1')

      const streaming = useAIStore.getState().streaming
      expect(streaming?.isStreaming).toBe(false)
    })

    it('should set stream error', () => {
      const { startStreaming, setStreamError } = useAIStore.getState()

      startStreaming('stream-1')
      setStreamError('stream-1', 'Connection failed')

      const streaming = useAIStore.getState().streaming
      expect(streaming?.isStreaming).toBe(false)
      expect(streaming?.error).toBe('Connection failed')
    })

    it('should cancel streaming', () => {
      const { startStreaming, cancelStreaming } = useAIStore.getState()

      startStreaming('stream-1')
      cancelStreaming()

      expect(useAIStore.getState().streaming).toBe(null)
    })
  })

  describe('Agent Configuration', () => {
    it('should set agent config', () => {
      const { setAgentConfig } = useAIStore.getState()

      const config = {
        anthropicAuthToken: 'test-token',
        apiTimeoutMs: 30000,
        pythonPath: '/usr/bin/python',
        customEnvVars: {},
      }

      setAgentConfig(config)
      expect(useAIStore.getState().agentConfig).toEqual(config)
    })

    it('should set agent configured status', () => {
      const { setAgentConfigured } = useAIStore.getState()

      setAgentConfigured(true)
      expect(useAIStore.getState().isAgentConfigured).toBe(true)

      setAgentConfigured(false)
      expect(useAIStore.getState().isAgentConfigured).toBe(false)
    })
  })
})
