import { describe, it, expect, beforeEach, vi } from 'vitest'
import { KeychainService } from 'main/services/keychain-service'
import type { AIProvider } from 'shared/models'

// Mock electron's safeStorage
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (text: string) => Buffer.from(text, 'utf-8'),
    decryptString: (buffer: Buffer) => buffer.toString('utf-8'),
  },
}))

describe('KeychainService', () => {
  let service: KeychainService

  beforeEach(() => {
    service = new KeychainService()
  })

  describe('API Key Operations', () => {
    it('should store and retrieve an API key', async () => {
      const provider: AIProvider = 'openai'
      const apiKey = 'sk-test-key-12345'

      await service.setApiKey(provider, apiKey)
      const retrieved = await service.getApiKey(provider)

      expect(retrieved).toBe(apiKey)
    })

    it('should return null for non-existent API key', async () => {
      const provider: AIProvider = 'anthropic'
      const retrieved = await service.getApiKey(provider)

      expect(retrieved).toBeNull()
    })

    it('should handle multiple providers independently', async () => {
      const openaiKey = 'sk-openai-key'
      const anthropicKey = 'sk-anthropic-key'
      const googleKey = 'google-api-key'

      await service.setApiKey('openai', openaiKey)
      await service.setApiKey('anthropic', anthropicKey)
      await service.setApiKey('google', googleKey)

      expect(await service.getApiKey('openai')).toBe(openaiKey)
      expect(await service.getApiKey('anthropic')).toBe(anthropicKey)
      expect(await service.getApiKey('google')).toBe(googleKey)
    })

    it('should store and retrieve OpenRouter API key', async () => {
      const provider: AIProvider = 'openrouter'
      const apiKey = 'sk-or-v1-test-openrouter-key-12345'

      await service.setApiKey(provider, apiKey)
      const retrieved = await service.getApiKey(provider)

      expect(retrieved).toBe(apiKey)
    })

    it('should handle OpenRouter key alongside other providers', async () => {
      const openrouterKey = 'sk-or-v1-openrouter-key'
      const openaiKey = 'sk-openai-key'
      const anthropicKey = 'sk-anthropic-key'

      await service.setApiKey('openrouter', openrouterKey)
      await service.setApiKey('openai', openaiKey)
      await service.setApiKey('anthropic', anthropicKey)

      expect(await service.getApiKey('openrouter')).toBe(openrouterKey)
      expect(await service.getApiKey('openai')).toBe(openaiKey)
      expect(await service.getApiKey('anthropic')).toBe(anthropicKey)
    })

    it('should delete OpenRouter API key', async () => {
      const provider: AIProvider = 'openrouter'
      const apiKey = 'sk-or-v1-test-key'

      await service.setApiKey(provider, apiKey)
      expect(await service.hasApiKey(provider)).toBe(true)

      await service.deleteApiKey(provider)
      expect(await service.hasApiKey(provider)).toBe(false)
      expect(await service.getApiKey(provider)).toBeNull()
    })

    it('should delete an API key', async () => {
      const provider: AIProvider = 'openai'
      const apiKey = 'sk-test-key'

      await service.setApiKey(provider, apiKey)
      expect(await service.hasApiKey(provider)).toBe(true)

      await service.deleteApiKey(provider)
      expect(await service.hasApiKey(provider)).toBe(false)
      expect(await service.getApiKey(provider)).toBeNull()
    })

    it('should check if API key exists', async () => {
      const provider: AIProvider = 'openai'

      expect(await service.hasApiKey(provider)).toBe(false)

      await service.setApiKey(provider, 'test-key')
      expect(await service.hasApiKey(provider)).toBe(true)
    })

    it('should overwrite existing API key', async () => {
      const provider: AIProvider = 'openai'
      const firstKey = 'first-key'
      const secondKey = 'second-key'

      await service.setApiKey(provider, firstKey)
      expect(await service.getApiKey(provider)).toBe(firstKey)

      await service.setApiKey(provider, secondKey)
      expect(await service.getApiKey(provider)).toBe(secondKey)
    })
  })

  describe('Generic Secret Operations', () => {
    it('should store and retrieve a generic secret', async () => {
      const service_name = 'test-service'
      const account = 'test-account'
      const secret = 'my-secret-value'

      await service.setSecret(service_name, account, secret)
      const retrieved = await service.getSecret(service_name, account)

      expect(retrieved).toBe(secret)
    })

    it('should return null for non-existent secret', async () => {
      const retrieved = await service.getSecret('non-existent', 'account')
      expect(retrieved).toBeNull()
    })

    it('should delete a generic secret', async () => {
      const service_name = 'test-service'
      const account = 'test-account'
      const secret = 'secret-value'

      await service.setSecret(service_name, account, secret)
      expect(await service.getSecret(service_name, account)).toBe(secret)

      await service.deleteSecret(service_name, account)
      expect(await service.getSecret(service_name, account)).toBeNull()
    })

    it('should handle multiple secrets independently', async () => {
      await service.setSecret('service1', 'account1', 'secret1')
      await service.setSecret('service1', 'account2', 'secret2')
      await service.setSecret('service2', 'account1', 'secret3')

      expect(await service.getSecret('service1', 'account1')).toBe('secret1')
      expect(await service.getSecret('service1', 'account2')).toBe('secret2')
      expect(await service.getSecret('service2', 'account1')).toBe('secret3')
    })
  })

  describe('Clear All', () => {
    it('should clear all stored secrets', async () => {
      await service.setApiKey('openai', 'key1')
      await service.setApiKey('anthropic', 'key2')
      await service.setSecret('service', 'account', 'secret')

      service.clearAll()

      expect(await service.getApiKey('openai')).toBeNull()
      expect(await service.getApiKey('anthropic')).toBeNull()
      expect(await service.getSecret('service', 'account')).toBeNull()
    })
  })

  describe('Availability Check', () => {
    it('should report encryption availability', () => {
      expect(service.isAvailable()).toBe(true)
    })
  })
})
