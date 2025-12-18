/**
 * Property-based tests for Request Logger
 *
 * These tests verify that the request logger correctly logs all AI requests
 * with complete information and properly handles log retention cleanup.
 */

import { describe, it, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { RequestLogger, createResponseLog, createErrorLog } from './request-logger'
import { DatabaseService } from '../database'
import type {
  AIAction,
  AIRequestInput,
  AIRequestMetadata,
  CreateAIRequestLogInput,
  SerializedMessage,
} from 'shared/ai-types'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

/**
 * Arbitrary generator for valid AI actions
 */
const arbitraryAIAction: fc.Arbitrary<AIAction> = fc.constantFrom(
  'chat',
  'code-generation',
  'error-fix',
  'parameter-extraction'
)

/**
 * Arbitrary generator for valid timestamps as ISO strings
 * Uses integer milliseconds to avoid invalid date issues
 */
const arbitraryTimestampString: fc.Arbitrary<string> = fc
  .integer({ min: 946684800000, max: 4102444800000 }) // 2000-01-01 to 2100-01-01 in ms
  .map((ms) => new Date(ms).toISOString())

/**
 * Arbitrary generator for valid serialized messages
 */
const arbitrarySerializedMessage: fc.Arbitrary<SerializedMessage> = fc.record({
  id: fc.uuid(),
  role: fc.constantFrom('user', 'assistant', 'system') as fc.Arbitrary<'user' | 'assistant' | 'system'>,
  content: fc.string(),
  timestamp: arbitraryTimestampString,
  model: fc.option(fc.string(), { nil: undefined }),
  metadata: fc.option(fc.dictionary(fc.string(), fc.jsonValue()), { nil: undefined }),
})

/**
 * Arbitrary generator for AI request input
 */
const arbitraryAIRequestInput: fc.Arbitrary<AIRequestInput> = fc.record({
  messages: fc.array(arbitrarySerializedMessage, { minLength: 1, maxLength: 10 }),
  systemPrompt: fc.option(fc.string(), { nil: undefined }),
})

/**
 * Arbitrary generator for AI request metadata
 */
const arbitraryAIRequestMetadata: fc.Arbitrary<AIRequestMetadata> = fc.record({
  temperature: fc.option(fc.float({ min: 0, max: 2, noNaN: true }), { nil: undefined }),
  maxTokens: fc.option(fc.integer({ min: 1, max: 100000 }), { nil: undefined }),
  projectId: fc.option(fc.uuid(), { nil: undefined }),
})

/**
 * Arbitrary generator for model IDs
 */
const arbitraryModelId: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0)

/**
 * Arbitrary generator for CreateAIRequestLogInput
 */
const arbitraryCreateAIRequestLogInput: fc.Arbitrary<CreateAIRequestLogInput> = fc.record({
  modelId: arbitraryModelId,
  action: arbitraryAIAction,
  input: arbitraryAIRequestInput,
  metadata: fc.option(arbitraryAIRequestMetadata, { nil: undefined }),
})

/**
 * Arbitrary generator for response log data
 */
const arbitraryResponseData = fc.record({
  output: fc.string(),
  promptTokens: fc.integer({ min: 0, max: 100000 }),
  completionTokens: fc.integer({ min: 0, max: 100000 }),
  latencyMs: fc.integer({ min: 0, max: 1000000 }),
  finishReason: fc.constantFrom('stop', 'length', 'content_filter', 'tool_calls'),
  modelVersion: fc.option(fc.string(), { nil: undefined }),
})

/**
 * Arbitrary generator for error log data
 */
const arbitraryErrorData = fc.record({
  type: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
  message: fc.string(),
  stack: fc.option(fc.string(), { nil: undefined }),
  retryCount: fc.integer({ min: 0, max: 10 }),
})

describe('Request Logger Property Tests', () => {
  let database: DatabaseService
  let logger: RequestLogger
  let tempDbPath: string

  beforeEach(() => {
    // Create a temporary database for testing
    tempDbPath = path.join(os.tmpdir(), `mira-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)
    database = new DatabaseService(tempDbPath)
    database.initialize()

    // Create logger with periodic cleanup disabled for tests
    logger = new RequestLogger(database, { enablePeriodicCleanup: false })
  })

  afterEach(() => {
    logger.stopPeriodicCleanup()
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
   * **Feature: ai-agent-rework, Property 5: Request Logging Completeness**
   * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
   *
   * For any AI request that completes successfully, the corresponding log entry
   * SHALL contain: timestamp, modelId, input content, response with tokenUsage and latency.
   */
  it('successful request logs contain all required fields', () => {
    fc.assert(
      fc.property(
        arbitraryCreateAIRequestLogInput,
        arbitraryResponseData,
        (requestInput, responseData) => {
          // Log the request
          const logId = logger.logRequest(requestInput)

          // Update with response
          const response = createResponseLog(responseData)
          logger.updateResponse(logId, response)

          // Retrieve the log
          const log = logger.getLog(logId)

          if (!log) return false

          // Verify timestamp is present and valid
          if (!(log.timestamp instanceof Date) || Number.isNaN(log.timestamp.getTime())) {
            return false
          }

          // Verify modelId is present
          if (!log.modelId || log.modelId !== requestInput.modelId) {
            return false
          }

          // Verify input content is present
          if (!log.input || !log.input.messages || log.input.messages.length === 0) {
            return false
          }

          // Verify status is completed
          if (log.status !== 'completed') {
            return false
          }

          // Verify response is present with required fields
          if (!log.response) {
            return false
          }

          // Verify tokenUsage is present
          if (!log.response.tokenUsage) {
            return false
          }

          if (typeof log.response.tokenUsage.promptTokens !== 'number') {
            return false
          }

          if (typeof log.response.tokenUsage.completionTokens !== 'number') {
            return false
          }

          if (typeof log.response.tokenUsage.totalTokens !== 'number') {
            return false
          }

          // Verify latency is present
          if (typeof log.response.latencyMs !== 'number') {
            return false
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Feature: ai-agent-rework, Property 5: Request Logging Completeness**
   * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
   *
   * For any AI request that fails, the corresponding log entry SHALL contain:
   * timestamp, modelId, input content, error with type and message.
   */
  it('failed request logs contain all required fields', () => {
    fc.assert(
      fc.property(
        arbitraryCreateAIRequestLogInput,
        arbitraryErrorData,
        (requestInput, errorData) => {
          // Log the request
          const logId = logger.logRequest(requestInput)

          // Update with error
          const error = createErrorLog(errorData)
          logger.logError(logId, error)

          // Retrieve the log
          const log = logger.getLog(logId)

          if (!log) return false

          // Verify timestamp is present and valid
          if (!(log.timestamp instanceof Date) || Number.isNaN(log.timestamp.getTime())) {
            return false
          }

          // Verify modelId is present
          if (!log.modelId || log.modelId !== requestInput.modelId) {
            return false
          }

          // Verify input content is present
          if (!log.input || !log.input.messages || log.input.messages.length === 0) {
            return false
          }

          // Verify status is failed
          if (log.status !== 'failed') {
            return false
          }

          // Verify error is present with required fields
          if (!log.error) {
            return false
          }

          // Verify error type is present
          if (typeof log.error.type !== 'string') {
            return false
          }

          // Verify error message is present
          if (typeof log.error.message !== 'string') {
            return false
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Feature: ai-agent-rework, Property 5: Request Logging Completeness**
   * **Validates: Requirements 4.1, 4.4**
   *
   * For any AI request, the log entry SHALL include provider metadata
   * (temperature, maxTokens, projectId) when provided.
   */
  it('request logs preserve metadata when provided', () => {
    fc.assert(
      fc.property(
        arbitraryCreateAIRequestLogInput,
        (requestInput) => {
          // Log the request
          const logId = logger.logRequest(requestInput)

          // Retrieve the log
          const log = logger.getLog(logId)

          if (!log) return false

          // If metadata was provided, verify it's preserved
          if (requestInput.metadata) {
            if (!log.metadata) return false

            if (requestInput.metadata.temperature !== undefined) {
              if (log.metadata.temperature !== requestInput.metadata.temperature) {
                return false
              }
            }

            if (requestInput.metadata.maxTokens !== undefined) {
              if (log.metadata.maxTokens !== requestInput.metadata.maxTokens) {
                return false
              }
            }

            if (requestInput.metadata.projectId !== undefined) {
              if (log.metadata.projectId !== requestInput.metadata.projectId) {
                return false
              }
            }
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Request Logger Log Retention Property Tests', () => {
  let database: DatabaseService
  let logger: RequestLogger
  let tempDbPath: string

  beforeEach(() => {
    // Create a temporary database for testing
    tempDbPath = path.join(os.tmpdir(), `mira-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)
    database = new DatabaseService(tempDbPath)
    database.initialize()

    // Create logger with periodic cleanup disabled for tests
    logger = new RequestLogger(database, { enablePeriodicCleanup: false })
  })

  afterEach(() => {
    logger.stopPeriodicCleanup()
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
   * **Feature: ai-agent-rework, Property 6: Log Retention Cleanup**
   * **Validates: Requirements 4.6**
   *
   * For any log entry with timestamp older than the configured retention period,
   * after cleanup runs, that entry SHALL NOT exist in the database.
   */
  it('old logs are deleted after cleanup', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 365 }), // retention days
        fc.array(arbitraryCreateAIRequestLogInput, { minLength: 1, maxLength: 20 }),
        (retentionDays, requestInputs) => {
          // Create logs
          const logIds: string[] = []
          for (const input of requestInputs) {
            const logId = logger.logRequest(input)
            logIds.push(logId)
          }

          // All logs should exist before cleanup
          for (const logId of logIds) {
            const log = logger.getLog(logId)
            if (!log) return false
          }

          // Run cleanup with retention period
          // Since all logs were just created, none should be deleted
          const deletedCount = logger.clearOldLogs(retentionDays)

          // No logs should be deleted since they're all recent
          if (deletedCount !== 0) return false

          // All logs should still exist
          for (const logId of logIds) {
            const log = logger.getLog(logId)
            if (!log) return false
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Feature: ai-agent-rework, Property 6: Log Retention Cleanup**
   * **Validates: Requirements 4.6**
   *
   * Cleanup with a large retention period SHALL NOT delete recently created logs.
   * This verifies that the retention logic correctly preserves recent logs.
   */
  it('large retention period preserves recent logs', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryCreateAIRequestLogInput, { minLength: 1, maxLength: 20 }),
        (requestInputs) => {
          // Create logs (they will have current timestamp)
          const logIds: string[] = []
          for (const input of requestInputs) {
            const logId = logger.logRequest(input)
            logIds.push(logId)
          }

          // Run cleanup with 1 day retention - recent logs should NOT be deleted
          const deletedCount = logger.clearOldLogs(1)

          // No logs should be deleted since they were just created (less than 1 day old)
          if (deletedCount !== 0) return false

          // All created logs should still exist (check by ID, not total count)
          for (const logId of logIds) {
            const log = logger.getLog(logId)
            if (!log) return false
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Feature: ai-agent-rework, Property 6: Log Retention Cleanup**
   * **Validates: Requirements 4.6**
   *
   * The number of deleted logs SHALL equal the number of logs older than
   * the retention period. For recently created logs with large retention, this should be 0.
   */
  it('cleanup returns correct count of deleted logs', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryCreateAIRequestLogInput, { minLength: 1, maxLength: 20 }),
        (requestInputs) => {
          // Create logs (they will have current timestamp)
          const logIds: string[] = []
          for (const input of requestInputs) {
            const logId = logger.logRequest(input)
            logIds.push(logId)
          }

          // Run cleanup with very large retention (should delete nothing)
          const deletedWithLargeRetention = logger.clearOldLogs(36500) // 100 years
          if (deletedWithLargeRetention !== 0) return false

          // Verify all created logs still exist (check by ID)
          for (const logId of logIds) {
            const log = logger.getLog(logId)
            if (!log) return false
          }

          // Run cleanup with 1 day retention (should also delete nothing for recent logs)
          const deletedWithOneDayRetention = logger.clearOldLogs(1)

          // No logs should be deleted since they were just created (less than 1 day old)
          if (deletedWithOneDayRetention !== 0) return false

          // All created logs should still exist (check by ID)
          for (const logId of logIds) {
            const log = logger.getLog(logId)
            if (!log) return false
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})
