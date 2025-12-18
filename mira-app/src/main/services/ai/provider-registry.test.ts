import { describe, it, expect, beforeEach } from 'vitest'
import type { LanguageModel } from 'ai'
import type { AIModel } from 'shared/ai-types'
import {
  ProviderRegistry,
  ProviderRegistryError,
  ProviderRegistryErrorCode,
  type AIProviderAdapter,
  type ProviderConfig,
} from './provider-registry'

/**
 * Mock provider adapter for testing
 */
class MockProviderAdapter implements AIProviderAdapter {
  name: string
  private configured = false

  constructor(name: string) {
    this.name = name
  }

  async initialize(_config: ProviderConfig): Promise<void> {
    this.configured = true
  }

  createChatModel(_modelId: string): LanguageModel {
    return {} as LanguageModel
  }

  async fetchModels(): Promise<AIModel[]> {
    return [
      {
        id: `${this.name}/test-model`,
        name: 'Test Model',
        provider: this.name,
        contextLength: 4096,
        pricing: { prompt: 0.001, completion: 0.002 },
        capabilities: ['chat'],
        isConfigured: true,
      },
    ]
  }

  isConfigured(): boolean {
    return this.configured
  }
}

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry

  beforeEach(() => {
    registry = new ProviderRegistry()
  })

  describe('registerProvider', () => {
    it('should register a new provider', () => {
      const provider = new MockProviderAdapter('test-provider')

      registry.registerProvider('test-provider', provider)

      expect(registry.hasProvider('test-provider')).toBe(true)
      expect(registry.listProviders()).toContain('test-provider')
    })

    it('should set first registered provider as default', () => {
      const provider = new MockProviderAdapter('first-provider')

      registry.registerProvider('first-provider', provider)

      expect(registry.getDefaultProviderName()).toBe('first-provider')
      expect(registry.getDefaultProvider()).toBe(provider)
    })

    it('should not change default when registering additional providers', () => {
      const first = new MockProviderAdapter('first')
      const second = new MockProviderAdapter('second')

      registry.registerProvider('first', first)
      registry.registerProvider('second', second)

      expect(registry.getDefaultProviderName()).toBe('first')
    })

    it('should throw error when registering duplicate provider', () => {
      const provider = new MockProviderAdapter('duplicate')

      registry.registerProvider('duplicate', provider)

      expect(() => registry.registerProvider('duplicate', provider)).toThrow(
        ProviderRegistryError
      )
      expect(() => registry.registerProvider('duplicate', provider)).toThrow(
        "Provider 'duplicate' is already registered"
      )
    })

    it('should throw error with correct error code for duplicate', () => {
      const provider = new MockProviderAdapter('duplicate')
      registry.registerProvider('duplicate', provider)

      try {
        registry.registerProvider('duplicate', provider)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderRegistryError)
        expect((error as ProviderRegistryError).code).toBe(
          ProviderRegistryErrorCode.PROVIDER_ALREADY_REGISTERED
        )
        expect((error as ProviderRegistryError).providerName).toBe('duplicate')
      }
    })
  })

  describe('getProvider', () => {
    it('should return registered provider', () => {
      const provider = new MockProviderAdapter('test')
      registry.registerProvider('test', provider)

      expect(registry.getProvider('test')).toBe(provider)
    })

    it('should return undefined for non-existent provider', () => {
      expect(registry.getProvider('non-existent')).toBeUndefined()
    })
  })

  describe('getDefaultProvider', () => {
    it('should return undefined when no providers registered', () => {
      expect(registry.getDefaultProvider()).toBeUndefined()
    })

    it('should return the default provider', () => {
      const provider = new MockProviderAdapter('default')
      registry.registerProvider('default', provider)

      expect(registry.getDefaultProvider()).toBe(provider)
    })
  })

  describe('setDefaultProvider', () => {
    it('should change the default provider', () => {
      const first = new MockProviderAdapter('first')
      const second = new MockProviderAdapter('second')

      registry.registerProvider('first', first)
      registry.registerProvider('second', second)

      expect(registry.getDefaultProviderName()).toBe('first')

      registry.setDefaultProvider('second')

      expect(registry.getDefaultProviderName()).toBe('second')
      expect(registry.getDefaultProvider()).toBe(second)
    })

    it('should throw error for non-existent provider', () => {
      expect(() => registry.setDefaultProvider('non-existent')).toThrow(
        ProviderRegistryError
      )
      expect(() => registry.setDefaultProvider('non-existent')).toThrow(
        "Provider 'non-existent' is not registered"
      )
    })

    it('should throw error with correct error code', () => {
      try {
        registry.setDefaultProvider('non-existent')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderRegistryError)
        expect((error as ProviderRegistryError).code).toBe(
          ProviderRegistryErrorCode.PROVIDER_NOT_FOUND
        )
      }
    })
  })

  describe('listProviders', () => {
    it('should return empty array when no providers registered', () => {
      expect(registry.listProviders()).toEqual([])
    })

    it('should return all registered provider names', () => {
      registry.registerProvider(
        'provider1',
        new MockProviderAdapter('provider1')
      )
      registry.registerProvider(
        'provider2',
        new MockProviderAdapter('provider2')
      )
      registry.registerProvider(
        'provider3',
        new MockProviderAdapter('provider3')
      )

      const providers = registry.listProviders()

      expect(providers).toHaveLength(3)
      expect(providers).toContain('provider1')
      expect(providers).toContain('provider2')
      expect(providers).toContain('provider3')
    })
  })

  describe('hasProvider', () => {
    it('should return false for non-existent provider', () => {
      expect(registry.hasProvider('non-existent')).toBe(false)
    })

    it('should return true for registered provider', () => {
      registry.registerProvider('exists', new MockProviderAdapter('exists'))

      expect(registry.hasProvider('exists')).toBe(true)
    })
  })

  describe('unregisterProvider', () => {
    it('should remove a registered provider', () => {
      registry.registerProvider('test', new MockProviderAdapter('test'))

      expect(registry.hasProvider('test')).toBe(true)

      const result = registry.unregisterProvider('test')

      expect(result).toBe(true)
      expect(registry.hasProvider('test')).toBe(false)
    })

    it('should return false for non-existent provider', () => {
      const result = registry.unregisterProvider('non-existent')

      expect(result).toBe(false)
    })

    it('should update default when default provider is removed', () => {
      registry.registerProvider('first', new MockProviderAdapter('first'))
      registry.registerProvider('second', new MockProviderAdapter('second'))

      expect(registry.getDefaultProviderName()).toBe('first')

      registry.unregisterProvider('first')

      expect(registry.getDefaultProviderName()).toBe('second')
    })

    it('should set default to null when last provider is removed', () => {
      registry.registerProvider('only', new MockProviderAdapter('only'))

      registry.unregisterProvider('only')

      expect(registry.getDefaultProviderName()).toBeNull()
      expect(registry.getDefaultProvider()).toBeUndefined()
    })
  })

  describe('clear', () => {
    it('should remove all providers', () => {
      registry.registerProvider('p1', new MockProviderAdapter('p1'))
      registry.registerProvider('p2', new MockProviderAdapter('p2'))

      registry.clear()

      expect(registry.listProviders()).toEqual([])
      expect(registry.getDefaultProviderName()).toBeNull()
      expect(registry.getDefaultProvider()).toBeUndefined()
    })
  })

  describe('integration scenarios', () => {
    it('should handle provider switching workflow', () => {
      const openrouter = new MockProviderAdapter('openrouter')
      const openai = new MockProviderAdapter('openai')

      // Register providers
      registry.registerProvider('openrouter', openrouter)
      registry.registerProvider('openai', openai)

      // Default should be first registered
      expect(registry.getDefaultProvider()).toBe(openrouter)

      // Switch default
      registry.setDefaultProvider('openai')
      expect(registry.getDefaultProvider()).toBe(openai)

      // Switch back
      registry.setDefaultProvider('openrouter')
      expect(registry.getDefaultProvider()).toBe(openrouter)
    })

    it('should maintain provider instances correctly', async () => {
      const provider = new MockProviderAdapter('test')
      registry.registerProvider('test', provider)

      // Initialize the provider
      await provider.initialize({ apiKey: 'test-key' })

      // Retrieved provider should be the same instance
      const retrieved = registry.getProvider('test')
      expect(retrieved).toBe(provider)
      expect(retrieved?.isConfigured()).toBe(true)
    })
  })
})
