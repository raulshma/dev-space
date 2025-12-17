import { describe, it, expect, beforeEach } from 'vitest'
import { AgentService } from './agent-service'
import { KeychainService } from './keychain-service'

describe('AgentService', () => {
  let agentService: AgentService
  let keychainService: KeychainService

  beforeEach(() => {
    keychainService = new KeychainService()
    agentService = new AgentService(keychainService)
  })

  describe('initialization', () => {
    it('should create AgentService instance', () => {
      expect(agentService).toBeDefined()
      expect(agentService).toBeInstanceOf(AgentService)
    })

    it('should have getAvailableModels method', async () => {
      const models = await agentService.getAvailableModels()
      expect(models).toBeDefined()
      expect(Array.isArray(models)).toBe(true)
      expect(models.length).toBeGreaterThan(0)
    })

    it('should return models with correct structure', async () => {
      const models = await agentService.getAvailableModels()
      const model = models[0]

      expect(model).toHaveProperty('id')
      expect(model).toHaveProperty('provider')
      expect(model).toHaveProperty('name')
      expect(model).toHaveProperty('maxTokens')
      expect(model).toHaveProperty('isConfigured')
    })
  })

  describe('context management', () => {
    const projectId = 'test-project'

    it('should start with empty context files', () => {
      const files = agentService.getContextFiles(projectId)
      expect(files).toEqual([])
    })

    it('should return zero token usage for empty context', () => {
      const usage = agentService.getTokenUsage(projectId)
      expect(usage.used).toBe(0)
      expect(usage.percentage).toBe(0)
      expect(usage.limit).toBeGreaterThan(0)
    })

    it('should start with empty conversation', () => {
      const messages = agentService.getConversation(projectId)
      expect(messages).toEqual([])
    })

    it('should clear conversation', () => {
      agentService.clearConversation(projectId)
      const messages = agentService.getConversation(projectId)
      expect(messages).toEqual([])
    })
  })

  describe('model management', () => {
    it('should throw error when getting active model before setting one', () => {
      expect(() => agentService.getActiveModel()).toThrow('No active model set')
    })

    it('should throw error when setting unconfigured model', async () => {
      const models = await agentService.getAvailableModels()
      const unconfiguredModel = models.find(m => !m.isConfigured)

      if (unconfiguredModel) {
        expect(() => agentService.setActiveModel(unconfiguredModel)).toThrow(
          'is not configured'
        )
      }
    })
  })
})
