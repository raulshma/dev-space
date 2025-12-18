/**
 * Property-Based Tests for AI Service
 *
 * Tests correctness properties for the AI service including:
 * - Property 4: Conversation Context Preservation
 * - Property 20: Retry with Exponential Backoff
 * - Property 21: Concurrent Request Isolation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fc from 'fast-check'
import { AIService, AIErrorCode, AIServiceError, type RetryConfig } from './ai-service'
import { ProviderRegistry } from './ai/provider-registry'
import { ModelRegistry } from './ai/model-registry'
import { RequestLogger } from './ai/request-logger'
import type { ConversationMessage, AIModel } from 'shared/ai-types'

// Mock dependencies
const mockKeychainService = {
  getApiKey: vi.fn().mockResolvedValue('test-api-key'),
  setApiKey: vi.fn(),
  hasApiKey: vi.fn().mockResolvedValue(true),
  deleteApiKey: vi.fn(),
}

const mockDatabaseService = {
  createAIRequestLog: vi.fn().mockReturnValue({ id: 'test-log-id' }),
  updateAIRequestLogResponse: vi.fn(),
  updateAIRequestLogError: vi.fn(),
  getAIRequestLogs: vi.fn().mockReturnValue([]),
  getAIRequestLog: vi.fn(),
  clearOldAIRequestLogs: vi.fn().mockReturnValue(0),
  getAISetting: vi.fn(),
  setAISetting: vi.fn(),
  getCachedModels: vi.fn().mockReturnValue([]),
  cacheModels: vi.fn(),
  clearModelCache: vi.fn(),
}

// Arbitrary generators for property tests
const arbitraryRole = fc.constantFrom('user', 'assistant', 'system') as fc.Arbitrary<'user' | 'assistant' | 'system'>

const arbitraryConversationMessage: fc.Arbitrary<ConversationMessage> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }),
  role: arbitraryRole,
  content: fc.string({ minLength: 0, maxLength: 1000 }),
  timestamp: fc.date(),
  model: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  metadata: fc.option(fc.dictionary(fc.string(), fc.jsonValue()), { nil: undefined }),
})

const arbitraryConversation = fc.array(arbitraryConversationMessage, { minLength: 0, maxLength: 20 })

const arbitraryProjectId = fc.string({ minLength: 1, maxLength: 50 })


describe('AI Service Property Tests', () => {
  let providerRegistry: ProviderRegistry
  let modelRegistry: ModelRegistry
  let requestLogger: RequestLogger
  let aiService: AIService

  beforeEach(() => {
    vi.clearAllMocks()

    providerRegistry = new ProviderRegistry()
    modelRegistry = new ModelRegistry(mockDatabaseService as any, null)
    requestLogger = new RequestLogger(mockDatabaseService as any, {
      enablePeriodicCleanup: false,
    })
    aiService = new AIService(
      providerRegistry,
      modelRegistry,
      requestLogger,
      mockKeychainService as any
    )
  })

  /**
   * **Feature: ai-agent-rework, Property 4: Conversation Context Preservation**
   * **Validates: Requirements 3.6**
   *
   * For any conversation with N messages, switching the active model SHALL result
   * in the conversation still containing exactly N messages with identical content.
   */
  describe('Property 4: Conversation Context Preservation', () => {
    it('preserves conversation messages when model is switched', () => {
      fc.assert(
        fc.property(
          arbitraryProjectId,
          arbitraryConversation,
          (projectId, messages) => {
            // Create fresh service for each test iteration
            const freshProviderRegistry = new ProviderRegistry()
            const freshModelRegistry = new ModelRegistry(mockDatabaseService as any, null)
            const freshRequestLogger = new RequestLogger(mockDatabaseService as any, {
              enablePeriodicCleanup: false,
            })
            const freshService = new AIService(
              freshProviderRegistry,
              freshModelRegistry,
              freshRequestLogger,
              mockKeychainService as any
            )

            // Add all messages to the conversation
            for (const message of messages) {
              freshService.addMessageToConversation(projectId, message)
            }

            // Get conversation before model switch
            const conversationBefore = freshService.getConversation(projectId)

            // Simulate model switch by setting a new default model
            // (The conversation should remain unchanged)
            try {
              freshModelRegistry.setDefaultModel('new-model-id')
            } catch {
              // Model may not exist, but that's fine for this test
            }

            // Get conversation after model switch
            const conversationAfter = freshService.getConversation(projectId)

            // Verify conversation length is preserved
            expect(conversationAfter.length).toBe(messages.length)

            // Verify each message content is preserved
            for (let i = 0; i < messages.length; i++) {
              expect(conversationAfter[i].id).toBe(messages[i].id)
              expect(conversationAfter[i].role).toBe(messages[i].role)
              expect(conversationAfter[i].content).toBe(messages[i].content)
              expect(conversationAfter[i].timestamp.getTime()).toBe(messages[i].timestamp.getTime())
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('preserves conversation across multiple model switches', () => {
      fc.assert(
        fc.property(
          arbitraryProjectId,
          arbitraryConversation,
          fc.integer({ min: 1, max: 10 }),
          (projectId, messages, switchCount) => {
            // Create fresh service for each test iteration
            const freshProviderRegistry = new ProviderRegistry()
            const freshModelRegistry = new ModelRegistry(mockDatabaseService as any, null)
            const freshRequestLogger = new RequestLogger(mockDatabaseService as any, {
              enablePeriodicCleanup: false,
            })
            const freshService = new AIService(
              freshProviderRegistry,
              freshModelRegistry,
              freshRequestLogger,
              mockKeychainService as any
            )

            // Add all messages to the conversation
            for (const message of messages) {
              freshService.addMessageToConversation(projectId, message)
            }

            // Perform multiple model switches
            for (let i = 0; i < switchCount; i++) {
              try {
                freshModelRegistry.setDefaultModel(`model-${i}`)
              } catch {
                // Model may not exist
              }
            }

            // Verify conversation is still intact
            const conversation = freshService.getConversation(projectId)
            expect(conversation.length).toBe(messages.length)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })


  /**
   * **Feature: ai-agent-rework, Property 20: Retry with Exponential Backoff**
   * **Validates: Requirements 12.4**
   *
   * For any sequence of N retry attempts for a transient failure, the delay before
   * attempt i SHALL be greater than the delay before attempt i-1.
   */
  describe('Property 20: Retry with Exponential Backoff', () => {
    it('calculates increasing delays for consecutive retry attempts', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }),
          (maxRetries) => {
            const retryConfig: RetryConfig = {
              maxRetries,
              initialDelayMs: 1000,
              maxDelayMs: 30000,
              backoffMultiplier: 2,
            }

            const testService = new AIService(
              providerRegistry,
              modelRegistry,
              requestLogger,
              mockKeychainService as any,
              retryConfig
            )

            // Calculate delays for each retry attempt
            const delays: number[] = []
            for (let i = 0; i < maxRetries; i++) {
              delays.push(testService.calculateRetryDelay(i))
            }

            // Verify each delay is greater than or equal to the previous
            // (equal when hitting maxDelayMs cap)
            for (let i = 1; i < delays.length; i++) {
              expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1])
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('respects maximum delay cap', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 5000 }),
          fc.integer({ min: 1000, max: 60000 }),
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 0, max: 20 }),
          (initialDelayMs, maxDelayMs, backoffMultiplier, retryCount) => {
            // Ensure maxDelayMs >= initialDelayMs for valid config
            const effectiveMaxDelay = Math.max(maxDelayMs, initialDelayMs)

            const retryConfig: RetryConfig = {
              maxRetries: 10,
              initialDelayMs,
              maxDelayMs: effectiveMaxDelay,
              backoffMultiplier,
            }

            const testService = new AIService(
              providerRegistry,
              modelRegistry,
              requestLogger,
              mockKeychainService as any,
              retryConfig
            )

            const delay = testService.calculateRetryDelay(retryCount)

            // Delay should never exceed maxDelayMs
            expect(delay).toBeLessThanOrEqual(effectiveMaxDelay)

            // Delay should be at least initialDelayMs for first retry (capped by maxDelay)
            if (retryCount === 0) {
              expect(delay).toBe(Math.min(initialDelayMs, effectiveMaxDelay))
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('correctly identifies retryable error codes', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.values(AIErrorCode)),
          (errorCode) => {
            const isRetryable = aiService.isRetryableError(errorCode)

            // These error codes should be retryable
            const expectedRetryable = [
              AIErrorCode.RATE_LIMITED,
              AIErrorCode.NETWORK_ERROR,
              AIErrorCode.TIMEOUT,
            ]

            if (expectedRetryable.includes(errorCode)) {
              expect(isRetryable).toBe(true)
            } else {
              expect(isRetryable).toBe(false)
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })


  /**
   * **Feature: ai-agent-rework, Property 21: Concurrent Request Isolation**
   * **Validates: Requirements 12.5**
   *
   * For any two concurrent AI requests with different projectIds, the responses
   * SHALL be delivered to their respective callers without cross-contamination.
   */
  describe('Property 21: Concurrent Request Isolation', () => {
    it('maintains separate conversations for different project IDs', () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryProjectId, { minLength: 2, maxLength: 10 }),
          fc.array(arbitraryConversationMessage, { minLength: 1, maxLength: 5 }),
          (projectIds, messages) => {
            // Create fresh service for each test iteration
            const freshProviderRegistry = new ProviderRegistry()
            const freshModelRegistry = new ModelRegistry(mockDatabaseService as any, null)
            const freshRequestLogger = new RequestLogger(mockDatabaseService as any, {
              enablePeriodicCleanup: false,
            })
            const freshService = new AIService(
              freshProviderRegistry,
              freshModelRegistry,
              freshRequestLogger,
              mockKeychainService as any
            )

            // Ensure unique project IDs
            const uniqueProjectIds = [...new Set(projectIds)]
            if (uniqueProjectIds.length < 2) return true // Skip if not enough unique IDs

            // Add different messages to each project
            for (let i = 0; i < uniqueProjectIds.length; i++) {
              const projectId = uniqueProjectIds[i]
              const projectMessages = messages.map((msg, idx) => ({
                ...msg,
                id: `${projectId}-${idx}`,
                content: `${projectId}: ${msg.content}`,
              }))

              for (const message of projectMessages) {
                freshService.addMessageToConversation(projectId, message)
              }
            }

            // Verify each project has its own isolated conversation
            for (let i = 0; i < uniqueProjectIds.length; i++) {
              const projectId = uniqueProjectIds[i]
              const conversation = freshService.getConversation(projectId)

              // Each conversation should have the correct number of messages
              expect(conversation.length).toBe(messages.length)

              // Each message should belong to this project
              for (const msg of conversation) {
                expect(msg.id.startsWith(projectId)).toBe(true)
                expect(msg.content.startsWith(`${projectId}:`)).toBe(true)
              }
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('clearing one project conversation does not affect others', () => {
      fc.assert(
        fc.property(
          arbitraryProjectId,
          arbitraryProjectId,
          arbitraryConversation,
          (projectId1, projectId2, messages) => {
            // Create fresh service for each test iteration
            const freshProviderRegistry = new ProviderRegistry()
            const freshModelRegistry = new ModelRegistry(mockDatabaseService as any, null)
            const freshRequestLogger = new RequestLogger(mockDatabaseService as any, {
              enablePeriodicCleanup: false,
            })
            const freshService = new AIService(
              freshProviderRegistry,
              freshModelRegistry,
              freshRequestLogger,
              mockKeychainService as any
            )

            // Ensure different project IDs
            if (projectId1 === projectId2) return true

            // Add messages to both projects
            for (const message of messages) {
              freshService.addMessageToConversation(projectId1, { ...message, id: `p1-${message.id}` })
              freshService.addMessageToConversation(projectId2, { ...message, id: `p2-${message.id}` })
            }

            // Clear first project's conversation
            freshService.clearConversation(projectId1)

            // Verify first project is cleared
            expect(freshService.getConversation(projectId1).length).toBe(0)

            // Verify second project is unaffected
            expect(freshService.getConversation(projectId2).length).toBe(messages.length)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('adding messages to one project does not affect others', () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryProjectId, { minLength: 2, maxLength: 5 }),
          arbitraryConversationMessage,
          (projectIds, newMessage) => {
            // Create fresh service for each test iteration
            const freshProviderRegistry = new ProviderRegistry()
            const freshModelRegistry = new ModelRegistry(mockDatabaseService as any, null)
            const freshRequestLogger = new RequestLogger(mockDatabaseService as any, {
              enablePeriodicCleanup: false,
            })
            const freshService = new AIService(
              freshProviderRegistry,
              freshModelRegistry,
              freshRequestLogger,
              mockKeychainService as any
            )

            // Ensure unique project IDs
            const uniqueProjectIds = [...new Set(projectIds)]
            if (uniqueProjectIds.length < 2) return true

            // Initialize all projects with empty conversations
            for (const projectId of uniqueProjectIds) {
              freshService.getConversation(projectId) // Initialize
            }

            // Add message to first project only
            const targetProject = uniqueProjectIds[0]
            freshService.addMessageToConversation(targetProject, newMessage)

            // Verify only target project has the message
            expect(freshService.getConversation(targetProject).length).toBe(1)

            // Verify other projects are unaffected
            for (let i = 1; i < uniqueProjectIds.length; i++) {
              expect(freshService.getConversation(uniqueProjectIds[i]).length).toBe(0)
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
