/**
 * Provider Types
 *
 * Type definitions for the provider abstraction layer that wraps AI model SDKs.
 * These types enable a common interface across different AI providers (Claude, OpenAI, etc.)
 *
 * Requirements: 1.3, 1.5
 */

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for a provider instance
 */
export interface ProviderConfig {
  /** API key for authentication */
  apiKey?: string
  /** Custom environment variables for the provider */
  env?: Record<string, string>
  /** Custom base URL for API requests */
  baseUrl?: string
}

// ============================================================================
// Message and Content Types
// ============================================================================

/**
 * Content block in a provider message
 */
export interface ContentBlock {
  /** Type of content block */
  type: 'text' | 'tool_use' | 'tool_result' | 'image'
  /** Text content (for type: 'text') */
  text?: string
  /** Tool name (for type: 'tool_use') */
  name?: string
  /** Tool input parameters (for type: 'tool_use') */
  input?: unknown
  /** Tool use ID reference (for type: 'tool_result') */
  tool_use_id?: string
  /** Tool result content (for type: 'tool_result') */
  content?: string
  /** Image source data (for type: 'image') */
  source?: {
    type: 'base64'
    media_type: string
    data: string
  }
}

/**
 * Message in conversation history
 */
export interface ConversationMessage {
  /** Role of the message sender */
  role: 'user' | 'assistant'
  /** Message content - can be string or array of content blocks */
  content: string | ContentBlock[]
}

// ============================================================================
// Execution Types
// ============================================================================

/**
 * Options for executing a query via a provider
 */
export interface ExecuteOptions {
  /** The prompt to send to the model */
  prompt: string | ContentBlock[]
  /** Model identifier to use */
  model: string
  /** Current working directory for file operations */
  cwd: string
  /** Optional system prompt to set context */
  systemPrompt?: string
  /** Maximum number of conversation turns (default: 20) */
  maxTurns?: number
  /** List of allowed tools for the model to use */
  allowedTools?: string[]
  /** AbortController for cancelling the request */
  abortController?: AbortController
  /** Previous conversation history for context */
  conversationHistory?: ConversationMessage[]
  /** SDK session ID for resuming conversations */
  sdkSessionId?: string
}

/**
 * Message returned by a provider (matches Claude SDK streaming format)
 */
export interface ProviderMessage {
  /** Type of message */
  type: 'assistant' | 'user' | 'error' | 'result'
  /** Subtype for result messages */
  subtype?: 'success' | 'error'
  /** Session ID for conversation continuity */
  session_id?: string
  /** Message content */
  message?: {
    role: 'user' | 'assistant'
    content: ContentBlock[]
  }
  /** Final result text (for type: 'result') */
  result?: string
  /** Error message (for type: 'error' or subtype: 'error') */
  error?: string
}

// ============================================================================
// Installation and Model Types
// ============================================================================

/**
 * Installation status for a provider
 */
export interface InstallationStatus {
  /** Whether the provider is installed/available */
  installed: boolean
  /** Method of installation */
  method?: 'sdk' | 'cli'
  /** Whether an API key is configured */
  hasApiKey?: boolean
  /** Whether authentication is successful */
  authenticated?: boolean
  /** Error message if installation check failed */
  error?: string
}

/**
 * Model tier for pricing/capability classification
 */
export type ModelTier = 'basic' | 'standard' | 'premium'

/**
 * Model definition
 */
export interface ModelDefinition {
  /** Unique model identifier */
  id: string
  /** Human-readable model name */
  name: string
  /** Model string to pass to the API */
  modelString: string
  /** Provider name (e.g., 'anthropic', 'openai') */
  provider: string
  /** Description of the model's capabilities */
  description: string
  /** Context window size in tokens */
  contextWindow?: number
  /** Maximum output tokens */
  maxOutputTokens?: number
  /** Whether the model supports vision/image input */
  supportsVision?: boolean
  /** Whether the model supports tool use */
  supportsTools?: boolean
  /** Pricing/capability tier */
  tier?: ModelTier
  /** Whether this is the default model for the provider */
  default?: boolean
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error type classification for provider errors
 */
export type ProviderErrorType =
  | 'abort'
  | 'rate_limit'
  | 'network'
  | 'auth'
  | 'unknown'

/**
 * Structured error information from a provider
 */
export interface ProviderErrorInfo {
  /** Classified error type */
  type: ProviderErrorType
  /** Human-readable error message */
  message: string
  /** Whether this was an abort/cancellation */
  isAbort: boolean
  /** Whether the operation can be retried */
  retryable: boolean
  /** Reset time for rate limit errors (ISO 8601) */
  resetTime?: string
  /** Original error for debugging */
  originalError?: Error
}
