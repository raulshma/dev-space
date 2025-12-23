/**
 * Error Handler Utilities
 *
 * Provides functions for classifying and handling errors from AI providers.
 * Supports classification of abort, rate_limit, network, and unknown errors.
 *
 * Requirements:
 * - 10.1: Emit rate_limit event with reset time for 429 errors
 * - 10.2: Stop execution on abort without marking task as failed
 * - 10.3: Classify errors by type for appropriate handling
 *
 * @module utils/error-handler
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Error classification types
 */
export type ErrorType = 'abort' | 'rate_limit' | 'network' | 'unknown'

/**
 * Classified error information
 */
export interface ErrorInfo {
  /** The type of error */
  type: ErrorType
  /** Human-readable error message */
  message: string
  /** Whether this is an abort error (execution was cancelled) */
  isAbort: boolean
  /** Whether the operation can be retried */
  retryable: boolean
  /** Original error object if available */
  originalError?: unknown
  /** Rate limit reset time in milliseconds (for rate_limit errors) */
  resetTimeMs?: number
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if an error is an abort error
 *
 * Abort errors occur when execution is cancelled via AbortController.
 * These should not mark tasks as failed.
 *
 * @param error - The error to check
 * @returns true if the error is an abort error
 *
 * @example
 * ```typescript
 * try {
 *   await someOperation()
 * } catch (error) {
 *   if (isAbortError(error)) {
 *     console.log('Operation was cancelled')
 *     return // Don't mark as failed
 *   }
 *   throw error
 * }
 * ```
 */
export function isAbortError(error: unknown): boolean {
  if (error instanceof Error) {
    // Check for standard AbortError name
    if (error.name === 'AbortError') {
      return true
    }

    // Check for common abort-related messages
    const message = error.message.toLowerCase()
    if (
      message.includes('aborted') ||
      message.includes('cancelled') ||
      message.includes('canceled') ||
      message.includes('abort')
    ) {
      return true
    }
  }

  // Check for DOMException AbortError (used by fetch)
  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: string }).name === 'AbortError'
  ) {
    return true
  }

  return false
}

/**
 * Check if an error is a rate limit error (HTTP 429)
 *
 * @param error - The error to check
 * @returns true if the error is a rate limit error
 */
export function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes('429') ||
      message.includes('rate limit') ||
      message.includes('rate_limit') ||
      message.includes('too many requests') ||
      message.includes('quota exceeded')
    )
  }

  // Check for error objects with status code
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>
    if (errorObj.status === 429 || errorObj.statusCode === 429) {
      return true
    }
  }

  return false
}

/**
 * Check if an error is a network error
 *
 * @param error - The error to check
 * @returns true if the error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('etimedout') ||
      message.includes('econnreset') ||
      message.includes('network') ||
      message.includes('fetch failed') ||
      message.includes('connection refused') ||
      message.includes('dns') ||
      message.includes('socket hang up')
    )
  }

  // Check for error objects with network-related codes
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>
    const code = errorObj.code
    if (
      typeof code === 'string' &&
      ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET'].includes(code)
    ) {
      return true
    }
  }

  return false
}

/**
 * Extract rate limit reset time from error message or headers
 *
 * @param error - The error to extract reset time from
 * @returns Reset time in milliseconds, or undefined if not found
 */
export function extractResetTime(error: unknown): number | undefined {
  if (error instanceof Error) {
    // Try to extract from message (e.g., "retry after 30 seconds")
    const message = error.message.toLowerCase()

    // Match patterns like "retry after 30" or "wait 30 seconds"
    const secondsMatch = message.match(
      /(?:retry after|wait|in)\s*(\d+)\s*(?:seconds?|s\b)/i
    )
    if (secondsMatch) {
      return Number.parseInt(secondsMatch[1], 10) * 1000
    }

    // Match patterns like "retry after 2 minutes"
    const minutesMatch = message.match(
      /(?:retry after|wait|in)\s*(\d+)\s*(?:minutes?|m\b)/i
    )
    if (minutesMatch) {
      return Number.parseInt(minutesMatch[1], 10) * 60 * 1000
    }
  }

  // Check for error objects with retry-after header
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>

    // Check headers object
    if (typeof errorObj.headers === 'object' && errorObj.headers !== null) {
      const headers = errorObj.headers as Record<string, unknown>
      const retryAfter = headers['retry-after'] || headers['Retry-After']
      if (typeof retryAfter === 'string') {
        const seconds = Number.parseInt(retryAfter, 10)
        if (!Number.isNaN(seconds)) {
          return seconds * 1000
        }
      }
      if (typeof retryAfter === 'number') {
        return retryAfter * 1000
      }
    }

    // Check direct retry_after property
    if (typeof errorObj.retry_after === 'number') {
      return errorObj.retry_after * 1000
    }
  }

  return undefined
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Classify an error by type for appropriate handling
 *
 * Analyzes the error and returns structured information about its type,
 * whether it's retryable, and any additional metadata.
 *
 * @param error - The error to classify
 * @returns ErrorInfo object with classification details
 *
 * @example
 * ```typescript
 * try {
 *   await provider.executeQuery(options)
 * } catch (error) {
 *   const errorInfo = classifyError(error)
 *
 *   if (errorInfo.isAbort) {
 *     // User cancelled, don't mark as failed
 *     return
 *   }
 *
 *   if (errorInfo.type === 'rate_limit') {
 *     emit('rate_limit', { resetTimeMs: errorInfo.resetTimeMs })
 *   }
 *
 *   if (errorInfo.retryable) {
 *     // Schedule retry
 *   }
 * }
 * ```
 */
export function classifyError(error: unknown): ErrorInfo {
  const message = error instanceof Error ? error.message : String(error)

  // Check for abort errors first (highest priority)
  if (isAbortError(error)) {
    return {
      type: 'abort',
      message,
      isAbort: true,
      retryable: false,
      originalError: error,
    }
  }

  // Check for rate limit errors
  if (isRateLimitError(error)) {
    return {
      type: 'rate_limit',
      message,
      isAbort: false,
      retryable: true,
      originalError: error,
      resetTimeMs: extractResetTime(error),
    }
  }

  // Check for network errors
  if (isNetworkError(error)) {
    return {
      type: 'network',
      message,
      isAbort: false,
      retryable: true,
      originalError: error,
    }
  }

  // Unknown error type
  return {
    type: 'unknown',
    message,
    isAbort: false,
    retryable: false,
    originalError: error,
  }
}

/**
 * Create a user-friendly error message from an error
 *
 * @param error - The error to format
 * @returns A user-friendly error message
 */
export function formatErrorMessage(error: unknown): string {
  const errorInfo = classifyError(error)

  switch (errorInfo.type) {
    case 'abort':
      return 'Operation was cancelled'
    case 'rate_limit':
      if (errorInfo.resetTimeMs) {
        const seconds = Math.ceil(errorInfo.resetTimeMs / 1000)
        return `Rate limit exceeded. Please wait ${seconds} seconds before retrying.`
      }
      return 'Rate limit exceeded. Please wait before retrying.'
    case 'network':
      return 'Network error. Please check your connection and try again.'
    default:
      return errorInfo.message || 'An unexpected error occurred'
  }
}

/**
 * Wrap an async function with error classification
 *
 * @param fn - The async function to wrap
 * @param onError - Callback for classified errors
 * @returns Wrapped function that classifies errors
 *
 * @example
 * ```typescript
 * const wrappedQuery = withErrorClassification(
 *   () => provider.executeQuery(options),
 *   (errorInfo) => {
 *     if (errorInfo.type === 'rate_limit') {
 *       emit('rate_limit', errorInfo)
 *     }
 *   }
 * )
 *
 * try {
 *   await wrappedQuery()
 * } catch (error) {
 *   // Error has already been classified and handled
 * }
 * ```
 */
export function withErrorClassification<T>(
  fn: () => Promise<T>,
  onError?: (errorInfo: ErrorInfo) => void
): () => Promise<T> {
  return async () => {
    try {
      return await fn()
    } catch (error) {
      const errorInfo = classifyError(error)
      onError?.(errorInfo)
      throw error
    }
  }
}
