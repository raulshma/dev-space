/**
 * Base Provider Abstract Class
 *
 * Defines the abstract interface that all AI providers must implement.
 * Provides common functionality and ensures consistent behavior across providers.
 *
 * Requirements: 1.3
 */

import type {
  ProviderConfig,
  ExecuteOptions,
  ProviderMessage,
  InstallationStatus,
  ModelDefinition,
} from './types'

/**
 * Features that providers can support
 */
export type ProviderFeature = 'tools' | 'text' | 'vision' | 'streaming' | 'code'

/**
 * Abstract base class for AI providers
 *
 * All provider implementations must extend this class and implement
 * the abstract methods to provide a consistent interface for AI interactions.
 */
export abstract class BaseProvider {
  /** Provider configuration */
  protected config: ProviderConfig

  /** Provider name (cached from getName()) */
  protected name: string

  /**
   * Create a new provider instance
   *
   * @param config - Optional configuration for the provider
   */
  constructor(config: ProviderConfig = {}) {
    this.config = config
    this.name = this.getName()
  }

  /**
   * Get the provider's unique name identifier
   *
   * @returns The provider name (e.g., 'claude', 'openai')
   */
  abstract getName(): string

  /**
   * Execute a query against the AI model
   *
   * This method streams responses as they are received from the model.
   * Implementations should yield ProviderMessage objects for each
   * response chunk, tool use, or result.
   *
   * @param options - Execution options including prompt, model, and settings
   * @yields ProviderMessage objects as responses are received
   */
  abstract executeQuery(
    options: ExecuteOptions
  ): AsyncGenerator<ProviderMessage>

  /**
   * Detect whether the provider is properly installed and configured
   *
   * Checks for required dependencies, API keys, and authentication status.
   *
   * @returns Installation status with details about configuration
   */
  abstract detectInstallation(): Promise<InstallationStatus>

  /**
   * Get the list of available models for this provider
   *
   * @returns Array of model definitions supported by this provider
   */
  abstract getAvailableModels(): ModelDefinition[]

  /**
   * Check if the provider supports a specific feature
   *
   * Default implementation supports common features.
   * Override in subclasses to add provider-specific features.
   *
   * @param feature - The feature to check support for
   * @returns true if the feature is supported
   */
  supportsFeature(feature: ProviderFeature): boolean {
    const commonFeatures: ProviderFeature[] = ['tools', 'text']
    return commonFeatures.includes(feature)
  }

  /**
   * Get the current provider configuration
   *
   * @returns The provider configuration
   */
  getConfig(): ProviderConfig {
    return { ...this.config }
  }

  /**
   * Update the provider configuration
   *
   * @param config - Partial configuration to merge with existing config
   */
  updateConfig(config: Partial<ProviderConfig>): void {
    this.config = { ...this.config, ...config }
  }
}
