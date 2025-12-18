/**
 * Provider Registry for AI Service
 *
 * Manages AI provider instances with support for multiple backends.
 * Provides a pluggable architecture for adding new AI providers.
 *
 * Requirements: 12.1, 12.2
 */

import type { LanguageModel } from 'ai'
import type { AIModel } from 'shared/ai-types'

/**
 * Configuration for initializing a provider
 */
export interface ProviderConfig {
  apiKey: string
  baseUrl?: string
  extraOptions?: Record<string, unknown>
}

/**
 * Interface for AI provider adapters
 * Each provider must implement this interface to be registered
 */
export interface AIProviderAdapter {
  /** Unique name identifier for the provider */
  name: string

  /** Initialize the provider with configuration */
  initialize(config: ProviderConfig): Promise<void>

  /** Create a chat model instance for the given model ID */
  createChatModel(modelId: string): LanguageModel

  /** Fetch available models from the provider */
  fetchModels(): Promise<AIModel[]>

  /** Check if the provider is properly configured */
  isConfigured(): boolean
}

/**
 * Interface for the provider registry
 */
export interface IProviderRegistry {
  /** Register a new provider adapter */
  registerProvider(name: string, provider: AIProviderAdapter): void

  /** Get a provider by name */
  getProvider(name: string): AIProviderAdapter | undefined

  /** Get the default provider */
  getDefaultProvider(): AIProviderAdapter | undefined

  /** Set the default provider by name */
  setDefaultProvider(name: string): void

  /** List all registered provider names */
  listProviders(): string[]

  /** Check if a provider is registered */
  hasProvider(name: string): boolean
}

/**
 * Error thrown when provider operations fail
 */
export class ProviderRegistryError extends Error {
  constructor(
    message: string,
    public code: ProviderRegistryErrorCode,
    public providerName?: string
  ) {
    super(message)
    this.name = 'ProviderRegistryError'
  }
}

export enum ProviderRegistryErrorCode {
  PROVIDER_NOT_FOUND = 'PROVIDER_NOT_FOUND',
  PROVIDER_ALREADY_REGISTERED = 'PROVIDER_ALREADY_REGISTERED',
  NO_DEFAULT_PROVIDER = 'NO_DEFAULT_PROVIDER',
  PROVIDER_NOT_CONFIGURED = 'PROVIDER_NOT_CONFIGURED',
}

/**
 * Provider Registry implementation
 *
 * Manages AI provider instances with support for multiple backends.
 * Supports default provider configuration and provider switching.
 */
export class ProviderRegistry implements IProviderRegistry {
  private providers: Map<string, AIProviderAdapter> = new Map()
  private defaultProviderName: string | null = null

  /**
   * Register a new provider adapter
   *
   * @param name - Unique name for the provider
   * @param provider - The provider adapter instance
   * @throws ProviderRegistryError if provider is already registered
   */
  registerProvider(name: string, provider: AIProviderAdapter): void {
    if (this.providers.has(name)) {
      throw new ProviderRegistryError(
        `Provider '${name}' is already registered`,
        ProviderRegistryErrorCode.PROVIDER_ALREADY_REGISTERED,
        name
      )
    }

    this.providers.set(name, provider)

    // Set as default if it's the first provider
    if (this.defaultProviderName === null) {
      this.defaultProviderName = name
    }
  }

  /**
   * Get a provider by name
   *
   * @param name - The provider name to retrieve
   * @returns The provider adapter or undefined if not found
   */
  getProvider(name: string): AIProviderAdapter | undefined {
    return this.providers.get(name)
  }

  /**
   * Get the default provider
   *
   * @returns The default provider adapter or undefined if none set
   */
  getDefaultProvider(): AIProviderAdapter | undefined {
    if (this.defaultProviderName === null) {
      return undefined
    }
    return this.providers.get(this.defaultProviderName)
  }

  /**
   * Set the default provider by name
   *
   * @param name - The provider name to set as default
   * @throws ProviderRegistryError if provider is not registered
   */
  setDefaultProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new ProviderRegistryError(
        `Provider '${name}' is not registered`,
        ProviderRegistryErrorCode.PROVIDER_NOT_FOUND,
        name
      )
    }

    this.defaultProviderName = name
  }

  /**
   * List all registered provider names
   *
   * @returns Array of registered provider names
   */
  listProviders(): string[] {
    return Array.from(this.providers.keys())
  }

  /**
   * Check if a provider is registered
   *
   * @param name - The provider name to check
   * @returns true if the provider is registered
   */
  hasProvider(name: string): boolean {
    return this.providers.has(name)
  }

  /**
   * Get the name of the current default provider
   *
   * @returns The default provider name or null if none set
   */
  getDefaultProviderName(): string | null {
    return this.defaultProviderName
  }

  /**
   * Unregister a provider by name
   *
   * @param name - The provider name to unregister
   * @returns true if the provider was unregistered, false if not found
   */
  unregisterProvider(name: string): boolean {
    const deleted = this.providers.delete(name)

    // If we deleted the default provider, reset to first available or null
    if (deleted && this.defaultProviderName === name) {
      const remaining = this.listProviders()
      this.defaultProviderName = remaining.length > 0 ? remaining[0] : null
    }

    return deleted
  }

  /**
   * Clear all registered providers
   */
  clear(): void {
    this.providers.clear()
    this.defaultProviderName = null
  }
}
