/**
 * Model Registry Service
 *
 * Manages available AI models with caching and fallback support.
 * Fetches models from OpenRouter API and caches them for offline access.
 *
 * Requirements: 3.1, 3.2, 3.4, 3.5
 */

import type {
  AIModel,
  AIAction,
  CachedModel,
  CacheModelInput,
} from 'shared/ai-types'
import type { DatabaseService } from '../database'
import type { AIProviderAdapter } from './provider-registry'

/**
 * Default cache TTL: 1 hour in milliseconds
 */
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000

/**
 * AI Settings keys for model configuration
 */
const SETTINGS_KEYS = {
  DEFAULT_MODEL: 'default_model',
  ACTION_MODEL_PREFIX: 'action_model_',
} as const

/**
 * Interface for the Model Registry
 */
export interface IModelRegistry {
  /** Fetch models from provider, with optional force refresh */
  fetchModels(forceRefresh?: boolean): Promise<AIModel[]>

  /** Get a specific model by ID */
  getModel(modelId: string): AIModel | undefined

  /** Get cached models (for offline/fallback use) */
  getCachedModels(): AIModel[]

  /** Get the default model */
  getDefaultModel(): AIModel | undefined

  /** Set the default model */
  setDefaultModel(modelId: string): void

  /** Get model mappings for all actions */
  getActionModels(): Map<AIAction, string>

  /** Set model for a specific action */
  setActionModel(action: AIAction, modelId: string): void

  /** Get model for a specific action (falls back to default) */
  getModelForAction(action: AIAction): AIModel | undefined

  /** Check if using cached/fallback models */
  isUsingFallback(): boolean
}

/**
 * Error thrown when model registry operations fail
 */
export class ModelRegistryError extends Error {
  constructor(
    message: string,
    public code: ModelRegistryErrorCode,
    public cause?: Error
  ) {
    super(message)
    this.name = 'ModelRegistryError'
  }
}

export enum ModelRegistryErrorCode {
  FETCH_FAILED = 'FETCH_FAILED',
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  NO_PROVIDER = 'NO_PROVIDER',
  CACHE_EMPTY = 'CACHE_EMPTY',
}

/**
 * Model Registry implementation
 *
 * Manages AI models with caching and fallback support.
 * Uses database for persistent cache and settings storage.
 */
export class ModelRegistry implements IModelRegistry {
  private models: Map<string, AIModel> = new Map()
  private defaultModelId: string | null = null
  private actionModels: Map<AIAction, string> = new Map()
  private lastFetchTime: number = 0
  private usingFallback: boolean = false
  private cacheTtlMs: number
  private initialized: boolean = false

  constructor(
    private database: DatabaseService,
    private provider: AIProviderAdapter | null = null,
    cacheTtlMs: number = DEFAULT_CACHE_TTL_MS
  ) {
    this.cacheTtlMs = cacheTtlMs
    // Don't load from database in constructor - database may not be initialized yet
    // Call initialize() after database is ready
  }

  /**
   * Initialize the registry by loading settings from database
   * Must be called after database is initialized
   */
  initialize(): void {
    if (this.initialized) return
    this.loadSettingsFromDatabase()
    this.initialized = true
  }

  /**
   * Set the provider adapter for fetching models
   */
  setProvider(provider: AIProviderAdapter): void {
    this.provider = provider
  }

  /**
   * Fetch models from the provider with caching
   *
   * @param forceRefresh - If true, bypass cache and fetch fresh data
   * @returns Array of available AI models
   */
  async fetchModels(forceRefresh: boolean = false): Promise<AIModel[]> {
    // Check if we can use cached data
    if (!forceRefresh && !this.isCacheStale()) {
      return Array.from(this.models.values())
    }

    // Try to fetch from provider
    if (this.provider && this.provider.isConfigured()) {
      try {
        const freshModels = await this.provider.fetchModels()
        this.updateModelsCache(freshModels)
        this.usingFallback = false
        return freshModels
      } catch (error) {
        console.warn(
          'Failed to fetch models from provider, falling back to cache:',
          error
        )
        // Fall through to use cached models
      }
    }

    // Fallback to cached models from database
    return this.loadCachedModels()
  }

  /**
   * Get a specific model by ID
   *
   * @param modelId - The model ID to retrieve
   * @returns The model or undefined if not found
   */
  getModel(modelId: string): AIModel | undefined {
    return this.models.get(modelId)
  }

  /**
   * Get all cached models
   *
   * @returns Array of cached models
   */
  getCachedModels(): AIModel[] {
    return Array.from(this.models.values())
  }

  /**
   * Get the default model
   *
   * @returns The default model or undefined if not set
   */
  getDefaultModel(): AIModel | undefined {
    if (!this.defaultModelId) {
      // Return first available model if no default set
      const models = Array.from(this.models.values())
      return models.length > 0 ? models[0] : undefined
    }
    return this.models.get(this.defaultModelId)
  }

  /**
   * Set the default model
   *
   * @param modelId - The model ID to set as default
   */
  setDefaultModel(modelId: string): void {
    this.defaultModelId = modelId
    this.database.setAISetting(SETTINGS_KEYS.DEFAULT_MODEL, modelId)
  }

  /**
   * Get model mappings for all actions
   *
   * @returns Map of action to model ID
   */
  getActionModels(): Map<AIAction, string> {
    return new Map(this.actionModels)
  }

  /**
   * Set model for a specific action
   *
   * @param action - The action type
   * @param modelId - The model ID to use for this action
   */
  setActionModel(action: AIAction, modelId: string): void {
    this.actionModels.set(action, modelId)
    this.database.setAISetting(
      `${SETTINGS_KEYS.ACTION_MODEL_PREFIX}${action}`,
      modelId
    )
  }

  /**
   * Get model for a specific action
   * Falls back to default model if no action-specific model is set
   *
   * @param action - The action type
   * @returns The model for the action or undefined
   */
  getModelForAction(action: AIAction): AIModel | undefined {
    const actionModelId = this.actionModels.get(action)
    if (actionModelId) {
      const model = this.models.get(actionModelId)
      if (model) return model
    }
    // Fall back to default model
    return this.getDefaultModel()
  }

  /**
   * Check if currently using fallback/cached models
   *
   * @returns true if using cached models due to API failure
   */
  isUsingFallback(): boolean {
    return this.usingFallback
  }

  /**
   * Check if the cache is stale
   */
  private isCacheStale(): boolean {
    if (this.models.size === 0) return true
    return Date.now() - this.lastFetchTime > this.cacheTtlMs
  }

  /**
   * Update the in-memory and database cache with fresh models
   */
  private updateModelsCache(models: AIModel[]): void {
    // Update in-memory cache
    this.models.clear()
    for (const model of models) {
      this.models.set(model.id, model)
    }
    this.lastFetchTime = Date.now()

    // Persist to database
    const cacheInputs: CacheModelInput[] = models.map(model => ({
      id: model.id,
      name: model.name,
      provider: model.provider,
      contextLength: model.contextLength,
      pricing: model.pricing,
      capabilities: model.capabilities,
      description: model.description,
      isFree: model.isFree,
      maxCompletionTokens: model.maxCompletionTokens,
      supportedMethods: model.supportedMethods,
      created: model.created,
      architecture: model.architecture,
    }))

    // Clear old cache and insert new models
    this.database.clearModelCache()
    this.database.cacheModels(cacheInputs)
  }

  /**
   * Load cached models from database
   */
  private loadCachedModels(): AIModel[] {
    const cachedModels = this.database.getCachedModels()

    if (cachedModels.length === 0) {
      this.usingFallback = false
      return []
    }

    // Convert CachedModel to AIModel and update in-memory cache
    this.models.clear()
    const models: AIModel[] = cachedModels.map(cached => ({
      id: cached.id,
      name: cached.name,
      provider: cached.provider,
      contextLength: cached.contextLength,
      pricing: cached.pricing,
      capabilities: cached.capabilities,
      isConfigured: true,
      description: cached.description,
      isFree: cached.isFree,
      maxCompletionTokens: cached.maxCompletionTokens,
      supportedMethods: cached.supportedMethods,
      created: cached.created,
      architecture: cached.architecture,
    }))

    for (const model of models) {
      this.models.set(model.id, model)
    }

    this.usingFallback = true
    return models
  }

  /**
   * Load settings from database on initialization
   */
  private loadSettingsFromDatabase(): void {
    // Load default model
    const defaultModel = this.database.getAISetting(SETTINGS_KEYS.DEFAULT_MODEL)
    if (defaultModel) {
      this.defaultModelId = defaultModel
    }

    // Load action-specific models
    const actions: AIAction[] = [
      'chat',
      'code-generation',
      'error-fix',
      'parameter-extraction',
    ]
    for (const action of actions) {
      const modelId = this.database.getAISetting(
        `${SETTINGS_KEYS.ACTION_MODEL_PREFIX}${action}`
      )
      if (modelId) {
        this.actionModels.set(action, modelId)
      }
    }

    // Load cached models into memory
    this.loadCachedModels()
  }

  /**
   * Get the cache TTL in milliseconds
   */
  getCacheTtlMs(): number {
    return this.cacheTtlMs
  }

  /**
   * Set the cache TTL in milliseconds
   */
  setCacheTtlMs(ttlMs: number): void {
    this.cacheTtlMs = ttlMs
  }

  /**
   * Clear all cached data and settings
   */
  clear(): void {
    this.models.clear()
    this.actionModels.clear()
    this.defaultModelId = null
    this.lastFetchTime = 0
    this.usingFallback = false
  }
}
