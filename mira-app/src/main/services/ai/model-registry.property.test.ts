/**
 * Property-based tests for Model Registry
 *
 * These tests verify that the model registry correctly handles
 * model data and ensures display completeness.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { ModelRegistry } from './model-registry'
import { DatabaseService } from '../database'
import type { AIModel } from 'shared/ai-types'
import type { AIProviderAdapter, ProviderConfig } from './provider-registry'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

/**
 * Arbitrary generator for valid AIModel objects
 * Generates models with all required display fields
 */
const arbitraryAIModel: fc.Arbitrary<AIModel> = fc.record({
  id: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
  name: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
  provider: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
  contextLength: fc.integer({ min: 1, max: 1000000 }),
  pricing: fc.record({
    prompt: fc.float({ min: 0, max: 1, noNaN: true }),
    completion: fc.float({ min: 0, max: 1, noNaN: true }),
  }),
  capabilities: fc.array(fc.string()),
  isConfigured: fc.boolean(),
})

/**
 * Mock provider adapter for testing
 */
class MockProviderAdapter implements AIProviderAdapter {
  name = 'mock'
  private configured = false
  private modelsToReturn: AIModel[] = []
  private shouldFail = false

  async initialize(_config: ProviderConfig): Promise<void> {
    this.configured = true
  }

  createChatModel(_modelId: string): never {
    throw new Error('Not implemented for tests')
  }

  async fetchModels(): Promise<AIModel[]> {
    if (this.shouldFail) {
      throw new Error('Mock fetch failure')
    }
    return this.modelsToReturn
  }

  isConfigured(): boolean {
    return this.configured
  }

  setModels(models: AIModel[]): void {
    this.modelsToReturn = models
  }

  setShouldFail(shouldFail: boolean): void {
    this.shouldFail = shouldFail
  }
}

/**
 * Helper to check if a model has all required display fields
 */
function hasRequiredDisplayFields(model: AIModel): boolean {
  // Check id is present and non-empty
  if (!model.id || typeof model.id !== 'string' || model.id.trim().length === 0) {
    return false
  }

  // Check name is present and non-empty
  if (!model.name || typeof model.name !== 'string' || model.name.trim().length === 0) {
    return false
  }

  // Check provider is present and non-empty
  if (!model.provider || typeof model.provider !== 'string' || model.provider.trim().length === 0) {
    return false
  }

  // Check contextLength is a positive number
  if (typeof model.contextLength !== 'number' || model.contextLength <= 0) {
    return false
  }

  // Check pricing object exists with required fields
  if (!model.pricing || typeof model.pricing !== 'object') {
    return false
  }

  if (typeof model.pricing.prompt !== 'number' || Number.isNaN(model.pricing.prompt)) {
    return false
  }

  if (typeof model.pricing.completion !== 'number' || Number.isNaN(model.pricing.completion)) {
    return false
  }

  return true
}

describe('Model Registry Property Tests', () => {
  let database: DatabaseService
  let registry: ModelRegistry
  let mockProvider: MockProviderAdapter
  let tempDbPath: string

  beforeEach(() => {
    // Create a temporary database for testing
    tempDbPath = path.join(os.tmpdir(), `mira-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)
    database = new DatabaseService(tempDbPath)
    database.initialize()

    mockProvider = new MockProviderAdapter()
    mockProvider.initialize({ apiKey: 'test-key' })

    registry = new ModelRegistry(database, mockProvider, 1000) // 1 second TTL for tests
  })

  afterEach(() => {
    database.close()
    // Clean up temp database
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath)
    }
    // Clean up WAL files if they exist
    const walPath = `${tempDbPath}-wal`
    const shmPath = `${tempDbPath}-shm`
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath)
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath)
  })

  /**
   * **Feature: ai-agent-rework, Property 2: Response Format Normalization**
   * **Validates: Requirements 3.2**
   *
   * For any set of models fetched from the provider, all models SHALL have
   * the required display fields populated: id, name, provider, contextLength,
   * and pricing (with prompt and completion).
   */
  it('all fetched models have required display fields', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(arbitraryAIModel, { minLength: 1, maxLength: 20 }), async (models) => {
        mockProvider.setModels(models)

        const fetchedModels = await registry.fetchModels(true)

        // All fetched models should have required display fields
        return fetchedModels.every(hasRequiredDisplayFields)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Feature: ai-agent-rework, Property 2: Response Format Normalization**
   * **Validates: Requirements 3.2**
   *
   * For any set of models, after caching and retrieval, all models SHALL
   * still have the required display fields populated.
   */
  it('cached models preserve required display fields', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(arbitraryAIModel, { minLength: 1, maxLength: 20 }), async (models) => {
        mockProvider.setModels(models)

        // Fetch and cache models
        await registry.fetchModels(true)

        // Get cached models
        const cachedModels = registry.getCachedModels()

        // All cached models should have required display fields
        return cachedModels.every(hasRequiredDisplayFields)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Feature: ai-agent-rework, Property 2: Response Format Normalization**
   * **Validates: Requirements 3.2**
   *
   * For any model retrieved by ID, it SHALL have all required display fields.
   */
  it('individual model retrieval preserves display fields', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(arbitraryAIModel, { minLength: 1, maxLength: 20 }), async (models) => {
        mockProvider.setModels(models)

        // Fetch models
        await registry.fetchModels(true)

        // Check each model retrieved by ID
        for (const model of models) {
          const retrieved = registry.getModel(model.id)
          if (retrieved && !hasRequiredDisplayFields(retrieved)) {
            return false
          }
        }

        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Feature: ai-agent-rework, Property 2: Response Format Normalization**
   * **Validates: Requirements 3.5**
   *
   * When the provider fails, fallback to cached models SHALL still provide
   * models with all required display fields.
   */
  it('fallback models have required display fields', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(arbitraryAIModel, { minLength: 1, maxLength: 20 }), async (models) => {
        // First, successfully fetch and cache models
        mockProvider.setModels(models)
        await registry.fetchModels(true)

        // Now simulate provider failure
        mockProvider.setShouldFail(true)

        // Create a new registry that will need to use fallback
        const newRegistry = new ModelRegistry(database, mockProvider, 0) // 0 TTL to force refresh attempt

        // Fetch should fall back to cached models
        const fallbackModels = await newRegistry.fetchModels(true)

        // All fallback models should have required display fields
        return fallbackModels.every(hasRequiredDisplayFields)
      }),
      { numRuns: 100 }
    )
  })
})
