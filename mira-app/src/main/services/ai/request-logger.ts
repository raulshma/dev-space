/**
 * Request Logger Service
 *
 * Logs all AI requests with full details for debugging, monitoring, and analytics.
 * Implements Property 5 (Request Logging Completeness) and Property 6 (Log Retention Cleanup).
 *
 * @module request-logger
 */

import type { DatabaseService } from '../database'
import type {
  AIRequestLog,
  AILogFilter,
  CreateAIRequestLogInput,
  AIResponseLog,
  AIErrorLog,
  AIRequestInput,
  AIRequestMetadata,
} from 'shared/ai-types'

/**
 * Configuration for the request logger
 */
export interface RequestLoggerConfig {
  /** Retention period in days for log cleanup */
  retentionDays: number
  /** Interval in milliseconds for periodic cleanup (default: 24 hours) */
  cleanupIntervalMs?: number
  /** Whether to enable periodic cleanup on initialization */
  enablePeriodicCleanup?: boolean
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<RequestLoggerConfig> = {
  retentionDays: 30,
  cleanupIntervalMs: 24 * 60 * 60 * 1000, // 24 hours
  enablePeriodicCleanup: true,
}

/**
 * Interface for the Request Logger service
 */
export interface IRequestLogger {
  /**
   * Log a new AI request
   * @param request - The request data to log
   * @returns The log ID
   */
  logRequest(request: CreateAIRequestLogInput): string

  /**
   * Update a log entry with response data
   * @param logId - The ID of the log entry
   * @param response - The response data
   */
  updateResponse(logId: string, response: AIResponseLog): void

  /**
   * Update a log entry with error data
   * @param logId - The ID of the log entry
   * @param error - The error data
   */
  logError(logId: string, error: AIErrorLog): void

  /**
   * Get logs with optional filtering
   * @param filter - Optional filter criteria
   * @returns Array of log entries
   */
  getLogs(filter?: AILogFilter): AIRequestLog[]

  /**
   * Get a single log entry by ID
   * @param logId - The ID of the log entry
   * @returns The log entry or null if not found
   */
  getLog(logId: string): AIRequestLog | null

  /**
   * Clear logs older than the retention period
   * @param retentionDays - Number of days to retain logs
   * @returns Number of logs deleted
   */
  clearOldLogs(retentionDays: number): number

  /**
   * Stop the periodic cleanup timer
   */
  stopPeriodicCleanup(): void
}

/**
 * Request Logger Service
 *
 * Provides comprehensive logging for all AI requests including:
 * - Request initiation with timestamp, model, and input
 * - Response completion with output, token usage, and latency
 * - Error logging with type, message, and stack trace
 * - Automatic cleanup of old logs based on retention policy
 */
export class RequestLogger implements IRequestLogger {
  private db: DatabaseService
  private config: Required<RequestLoggerConfig>
  private cleanupTimer: NodeJS.Timeout | null = null

  /**
   * Create a new RequestLogger instance
   * @param db - Database service for persistence
   * @param config - Optional configuration
   */
  constructor(db: DatabaseService, config?: Partial<RequestLoggerConfig>) {
    this.db = db
    this.config = { ...DEFAULT_CONFIG, ...config }
    // Don't schedule cleanup in constructor - database may not be initialized yet
    // Call initialize() after database is ready
  }

  /**
   * Initialize the logger by starting periodic cleanup
   * Must be called after database is initialized
   */
  initialize(): void {
    // Schedule periodic cleanup if enabled
    if (this.config.enablePeriodicCleanup) {
      this.schedulePeriodicCleanup()
    }
  }

  /**
   * Log a new AI request
   *
   * Creates a log entry with:
   * - Unique ID
   * - Timestamp
   * - Model ID
   * - Action type
   * - Input content (messages and system prompt)
   * - Metadata (temperature, maxTokens, projectId)
   * - Initial status of 'pending'
   *
   * @param request - The request data to log
   * @returns The generated log ID
   */
  logRequest(request: CreateAIRequestLogInput): string {
    const log = this.db.createAIRequestLog(request)
    return log.id
  }

  /**
   * Update a log entry with successful response data
   *
   * Updates the log with:
   * - Output text
   * - Token usage (prompt, completion, total)
   * - Latency in milliseconds
   * - Finish reason
   * - Optional model version
   * - Status changed to 'completed'
   *
   * @param logId - The ID of the log entry to update
   * @param response - The response data
   */
  updateResponse(logId: string, response: AIResponseLog): void {
    this.db.updateAIRequestLogResponse(logId, response)
  }

  /**
   * Update a log entry with error data
   *
   * Updates the log with:
   * - Error type
   * - Error message
   * - Optional stack trace
   * - Retry count
   * - Status changed to 'failed'
   *
   * @param logId - The ID of the log entry to update
   * @param error - The error data
   */
  logError(logId: string, error: AIErrorLog): void {
    this.db.updateAIRequestLogError(logId, error)
  }

  /**
   * Get logs with optional filtering
   *
   * Supports filtering by:
   * - Date range (startDate, endDate)
   * - Model ID
   * - Action type
   * - Status
   * - Result limit
   *
   * @param filter - Optional filter criteria
   * @returns Array of matching log entries, ordered by timestamp descending
   */
  getLogs(filter?: AILogFilter): AIRequestLog[] {
    return this.db.getAIRequestLogs(filter)
  }

  /**
   * Get a single log entry by ID
   *
   * @param logId - The ID of the log entry
   * @returns The log entry or null if not found
   */
  getLog(logId: string): AIRequestLog | null {
    return this.db.getAIRequestLog(logId)
  }

  /**
   * Clear logs older than the specified retention period
   *
   * Deletes all log entries with timestamps older than
   * (current time - retentionDays * 24 hours).
   *
   * @param retentionDays - Number of days to retain logs
   * @returns Number of logs deleted
   */
  clearOldLogs(retentionDays: number): number {
    return this.db.clearOldAIRequestLogs(retentionDays)
  }

  /**
   * Schedule periodic cleanup of old logs
   *
   * Runs cleanup at the configured interval (default: 24 hours)
   * using the configured retention period.
   */
  private schedulePeriodicCleanup(): void {
    // Run initial cleanup
    this.clearOldLogs(this.config.retentionDays)

    // Schedule periodic cleanup
    this.cleanupTimer = setInterval(() => {
      this.clearOldLogs(this.config.retentionDays)
    }, this.config.cleanupIntervalMs)

    // Ensure the timer doesn't prevent the process from exiting
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref()
    }
  }

  /**
   * Stop the periodic cleanup timer
   *
   * Should be called when shutting down the service to prevent
   * memory leaks and allow clean process exit.
   */
  stopPeriodicCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }
}

/**
 * Helper function to create a request input object
 *
 * @param messages - Array of serialized messages
 * @param systemPrompt - Optional system prompt
 * @returns AIRequestInput object
 */
export function createRequestInput(
  messages: AIRequestInput['messages'],
  systemPrompt?: string
): AIRequestInput {
  return {
    messages,
    ...(systemPrompt !== undefined && { systemPrompt }),
  }
}

/**
 * Helper function to create request metadata
 *
 * @param options - Metadata options
 * @returns AIRequestMetadata object
 */
export function createRequestMetadata(options: {
  temperature?: number
  maxTokens?: number
  projectId?: string
}): AIRequestMetadata {
  const metadata: AIRequestMetadata = {}

  if (options.temperature !== undefined) {
    metadata.temperature = options.temperature
  }
  if (options.maxTokens !== undefined) {
    metadata.maxTokens = options.maxTokens
  }
  if (options.projectId !== undefined) {
    metadata.projectId = options.projectId
  }

  return metadata
}

/**
 * Helper function to create a response log object
 *
 * @param options - Response options
 * @returns AIResponseLog object
 */
export function createResponseLog(options: {
  output: string
  promptTokens: number
  completionTokens: number
  latencyMs: number
  finishReason: string
  modelVersion?: string
}): AIResponseLog {
  return {
    output: options.output,
    tokenUsage: {
      promptTokens: options.promptTokens,
      completionTokens: options.completionTokens,
      totalTokens: options.promptTokens + options.completionTokens,
    },
    latencyMs: options.latencyMs,
    finishReason: options.finishReason,
    ...(options.modelVersion !== undefined && {
      modelVersion: options.modelVersion,
    }),
  }
}

/**
 * Helper function to create an error log object
 *
 * @param options - Error options
 * @returns AIErrorLog object
 */
export function createErrorLog(options: {
  type: string
  message: string
  stack?: string
  retryCount: number
}): AIErrorLog {
  return {
    type: options.type,
    message: options.message,
    ...(options.stack !== undefined && { stack: options.stack }),
    retryCount: options.retryCount,
  }
}
