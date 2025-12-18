/**
 * OpenRouter Provider Adapter
 *
 * Implementation of the AIProviderAdapter interface for OpenRouter.
 * Uses the Vercel AI SDK with @openrouter/ai-sdk-provider.
 *
 * Requirements: 1.1, 1.2
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { LanguageModel } from 'ai'
import type { AIModel } from 'shared/ai-types'
import type { AIProviderAdapter, ProviderConfig } from './provider-registry'

/**
 * OpenRouter API model response structure
 */
interface OpenRouterModelResponse {
  data: OpenRouterModel[]
}

interface OpenRouterModel {
  id: string
  name: string
  created: number
  description?: string
  context_length: number
  pricing: {
    prompt: string
    completion: string
    request?: string
    image?: string
  }
  top_provider?: {
    context_length?: number
    max_completion_tokens?: number
    is_moderated?: boolean
  }
  architecture?: {
    modality?: string
    tokenizer?: string
    instruct_type?: string
  }
  supported_generation_methods?: string[]
}

/**
 * OpenRouter Provider implementation
 *
 * Provides access to multiple AI models through OpenRouter's unified API.
 * Implements the AIProviderAdapter interface for use with the ProviderRegistry.
 */
export class OpenRouterProvider implements AIProviderAdapter {
  readonly name = 'openrouter'

  private client: ReturnType<typeof createOpenRouter> | null = null
  private apiKey: string | null = null
  private baseUrl: string | undefined

  /**
   * Initialize the provider with configuration
   *
   * @param config - Provider configuration including API key
   */
  async initialize(config: ProviderConfig): Promise<void> {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl

    this.client = createOpenRouter({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    })
  }

  /**
   * Create a chat model instance for the given model ID
   *
   * @param modelId - The OpenRouter model ID (e.g., 'anthropic/claude-3-opus')
   * @returns A LanguageModel instance for use with Vercel AI SDK
   * @throws Error if provider is not initialized
   */
  createChatModel(modelId: string): LanguageModel {
    if (!this.client) {
      throw new Error(
        'OpenRouter provider not initialized. Call initialize() first.'
      )
    }

    return this.client.chat(modelId)
  }

  /**
   * Fetch available models from OpenRouter's API
   *
   * @returns Array of available AI models with their details
   * @throws Error if provider is not initialized or API call fails
   */
  async fetchModels(): Promise<AIModel[]> {
    if (!this.apiKey) {
      throw new Error(
        'OpenRouter provider not initialized. Call initialize() first.'
      )
    }

    const baseUrl = this.baseUrl || 'https://openrouter.ai/api/v1'
    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(
        `Failed to fetch models: ${response.status} ${response.statusText}`
      )
    }

    const data: OpenRouterModelResponse = await response.json()
    return this.transformModels(data.data)
  }

  /**
   * Check if the provider is properly configured
   *
   * @returns true if the provider has been initialized with an API key
   */
  isConfigured(): boolean {
    return this.client !== null && this.apiKey !== null
  }

  /**
   * Transform OpenRouter API models to our AIModel format
   *
   * @param models - Raw models from OpenRouter API
   * @returns Transformed AIModel array
   */
  private transformModels(models: OpenRouterModel[]): AIModel[] {
    return models.map(model => {
      const promptPrice = this.parsePrice(model.pricing.prompt)
      const completionPrice = this.parsePrice(model.pricing.completion)
      const isFree = promptPrice === 0 && completionPrice === 0

      return {
        id: model.id,
        name: model.name,
        provider: this.extractProvider(model.id),
        contextLength: model.context_length,
        pricing: {
          prompt: promptPrice,
          completion: completionPrice,
          request: model.pricing.request
            ? this.parsePrice(model.pricing.request)
            : undefined,
          image: model.pricing.image
            ? this.parsePrice(model.pricing.image)
            : undefined,
        },
        capabilities: this.extractCapabilities(model),
        isConfigured: true, // Always true for OpenRouter since we have the API key
        description: model.description,
        isFree,
        maxCompletionTokens: model.top_provider?.max_completion_tokens,
        supportedMethods: model.supported_generation_methods,
        created: model.created,
        architecture: {
          modality: model.architecture?.modality || 'text->text',
          tokenizer: model.architecture?.tokenizer,
          instructType: model.architecture?.instruct_type,
        },
      }
    })
  }

  /**
   * Extract provider name from model ID
   * OpenRouter model IDs are typically formatted as 'provider/model-name'
   *
   * @param modelId - The full model ID
   * @returns The provider name
   */
  private extractProvider(modelId: string): string {
    const parts = modelId.split('/')
    return parts.length > 1 ? parts[0] : 'unknown'
  }

  /**
   * Parse price string to number
   * OpenRouter returns prices as strings (e.g., "0.00001")
   *
   * @param priceStr - Price as string
   * @returns Price as number
   */
  private parsePrice(priceStr: string): number {
    const parsed = Number.parseFloat(priceStr)
    return Number.isNaN(parsed) ? 0 : parsed
  }

  /**
   * Extract capabilities from model metadata
   *
   * @param model - The OpenRouter model
   * @returns Array of capability strings
   */
  private extractCapabilities(model: OpenRouterModel): string[] {
    const capabilities: string[] = ['chat']

    if (model.architecture?.modality) {
      capabilities.push(model.architecture.modality)
    }

    if (model.top_provider?.max_completion_tokens) {
      capabilities.push('completion')
    }

    return capabilities
  }

  /**
   * Get the current API key (masked for display)
   *
   * @returns Masked API key or null if not configured
   */
  getMaskedApiKey(): string | null {
    if (!this.apiKey) {
      return null
    }

    if (this.apiKey.length <= 4) {
      return '****'
    }

    return `${'*'.repeat(this.apiKey.length - 4)}${this.apiKey.slice(-4)}`
  }
}
