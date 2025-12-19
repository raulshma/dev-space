/**
 * Provider Factory
 *
 * Routes model IDs to the appropriate provider implementation.
 * Supports adding new providers without modifying existing code.
 *
 * Requirements: 1.1, 1.2, 1.6
 */

import type { BaseProvider } from './base-provider'
import { ClaudeProvider } from './claude-provider'
import type { ModelDefinition, ProviderConfig } from './types'

/**
 * Model ID prefixes that map to the Claude provider
 */
const CLAUDE_PREFIXES = ['claude-', 'haiku', 'sonnet', 'opus'] as const

/**
 * Provider Factory
 *
 * Creates and manages provider instances based on model IDs.
 * Uses model ID prefixes to route to the appropriate provider.
 */
export class ProviderFactory {
  /**
   * Get the appropriate provider for a given model ID
   *
   * Routes based on model ID prefix:
   * - "claude-*", "haiku", "sonnet", "opus" → ClaudeProvider
   * - Unknown prefixes → ClaudeProvider (default)
   *
   * @param modelId - The model identifier
   * @param config - Optional provider configuration
   * @returns The appropriate provider instance
   */
  static getProviderForModel(
    modelId: string,
    config?: ProviderConfig
  ): BaseProvider {
    const lowerModel = modelId.toLowerCase()

    // Check for Claude model prefixes
    if (ProviderFactory.isClaudeModel(lowerModel)) {
      return new ClaudeProvider(config)
    }

    // Default to Claude for unknown models
    console.warn(
      `Unknown model prefix for "${modelId}", defaulting to Claude provider`
    )
    return new ClaudeProvider(config)
  }

  /**
   * Check if a model ID corresponds to a Claude model
   *
   * @param modelId - The model identifier (lowercase)
   * @returns true if this is a Claude model
   */
  private static isClaudeModel(modelId: string): boolean {
    return CLAUDE_PREFIXES.some(
      prefix => modelId.startsWith(prefix) || modelId === prefix
    )
  }

  /**
   * Get all available provider instances
   *
   * @param config - Optional provider configuration to apply to all providers
   * @returns Array of all provider instances
   */
  static getAllProviders(config?: ProviderConfig): BaseProvider[] {
    return [
      new ClaudeProvider(config),
      // Add new providers here as they are implemented
    ]
  }

  /**
   * Get all available models from all providers
   *
   * @returns Array of all model definitions from all providers
   */
  static getAllAvailableModels(): ModelDefinition[] {
    return ProviderFactory.getAllProviders().flatMap(provider =>
      provider.getAvailableModels()
    )
  }

  /**
   * Get the default model across all providers
   *
   * @returns The default model definition, or undefined if none found
   */
  static getDefaultModel(): ModelDefinition | undefined {
    const allModels = ProviderFactory.getAllAvailableModels()
    return allModels.find(model => model.default) || allModels[0]
  }

  /**
   * Get a specific model by ID
   *
   * @param modelId - The model identifier to find
   * @returns The model definition, or undefined if not found
   */
  static getModelById(modelId: string): ModelDefinition | undefined {
    const allModels = ProviderFactory.getAllAvailableModels()
    return allModels.find(
      model => model.id === modelId || model.modelString === modelId
    )
  }

  /**
   * Get all models for a specific provider
   *
   * @param providerName - The provider name (e.g., 'anthropic', 'openai')
   * @returns Array of model definitions for that provider
   */
  static getModelsByProvider(providerName: string): ModelDefinition[] {
    const allModels = ProviderFactory.getAllAvailableModels()
    return allModels.filter(model => model.provider === providerName)
  }
}
