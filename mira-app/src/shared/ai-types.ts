/**
 * AI Types and Serialization Utilities
 *
 * This module provides types and utilities for AI message handling,
 * including serialization/deserialization for storage and IPC communication.
 */

// ============================================================================
// Message Types
// ============================================================================

/**
 * Represents a message in an AI conversation.
 * Used at runtime with proper Date objects.
 */
export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  model?: string
  metadata?: Record<string, unknown>
}

/**
 * Serialized form of ConversationMessage for JSON storage/transmission.
 * Timestamps are converted to ISO 8601 strings.
 */
export interface SerializedMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string // ISO 8601 format
  model?: string
  metadata?: Record<string, unknown>
}

// ============================================================================
// AI Model Types
// ============================================================================

/**
 * Supported AI provider types
 */
export type AIProvider =
  | 'openrouter'
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'local'

/**
 * Action types that can have different model configurations
 */
export type AIAction =
  | 'chat'
  | 'code-generation'
  | 'error-fix'
  | 'parameter-extraction'

/**
 * Represents an AI model available through a provider
 */
export interface AIModel {
  id: string
  name: string
  provider: string
  contextLength: number
  pricing: {
    prompt: number
    completion: number
    request?: number
    image?: number
  }
  capabilities: string[]
  isConfigured: boolean
  description?: string
  isFree?: boolean
  maxCompletionTokens?: number
  supportedMethods?: string[]
  created: number
  architecture: {
    modality: string
    tokenizer?: string
    instructType?: string
  }
}

// ============================================================================
// Token Usage Types
// ============================================================================

/**
 * Token usage information from an AI request
 */
export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Parameters for text generation requests
 */
export interface GenerateTextParams {
  projectId: string
  content: string
  action?: AIAction
  systemPrompt?: string
}

/**
 * Result from a text generation request
 */
export interface GenerateTextResult {
  text: string
  usage: TokenUsage
  model: string
  finishReason: string
}

/**
 * Parameters for streaming text generation
 */
export interface StreamTextParams extends GenerateTextParams {
  onChunk?: (chunk: string) => void
}

/**
 * A chunk from a streaming text response
 */
export interface StreamTextChunk {
  text: string
  isComplete: boolean
  usage?: TokenUsage
}

// ============================================================================
// Serialization Functions
// ============================================================================

/**
 * Serializes a ConversationMessage to a JSON-safe format.
 * Converts Date objects to ISO 8601 strings.
 *
 * @param msg - The message to serialize
 * @returns A serialized message with string timestamp
 */
export function serializeMessage(msg: ConversationMessage): SerializedMessage {
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp.toISOString(),
    ...(msg.model !== undefined && { model: msg.model }),
    ...(msg.metadata !== undefined && { metadata: msg.metadata }),
  }
}

/**
 * Deserializes a SerializedMessage back to a ConversationMessage.
 * Converts ISO 8601 strings back to Date objects.
 *
 * @param json - The serialized message to deserialize
 * @returns A ConversationMessage with proper Date timestamp
 */
export function deserializeMessage(
  json: SerializedMessage
): ConversationMessage {
  return {
    id: json.id,
    role: json.role,
    content: json.content,
    timestamp: new Date(json.timestamp),
    ...(json.model !== undefined && { model: json.model }),
    ...(json.metadata !== undefined && { metadata: json.metadata }),
  }
}

/**
 * Serializes an array of ConversationMessages to a JSON string.
 *
 * @param msgs - Array of messages to serialize
 * @returns JSON string representation
 */
export function serializeMessages(msgs: ConversationMessage[]): string {
  return JSON.stringify(msgs.map(serializeMessage))
}

/**
 * Deserializes a JSON string back to an array of ConversationMessages.
 *
 * @param json - JSON string to deserialize
 * @returns Array of ConversationMessages with proper Date timestamps
 */
export function deserializeMessages(json: string): ConversationMessage[] {
  const parsed: SerializedMessage[] = JSON.parse(json)
  return parsed.map(deserializeMessage)
}

// ============================================================================
// AI Request Log Types
// ============================================================================

/**
 * Status of an AI request
 */
export type AIRequestStatus = 'pending' | 'completed' | 'failed'

/**
 * Input data for an AI request log
 */
export interface AIRequestInput {
  messages: SerializedMessage[]
  systemPrompt?: string
}

/**
 * Response data for an AI request log
 */
export interface AIResponseLog {
  output: string
  tokenUsage: TokenUsage
  latencyMs: number
  finishReason: string
  modelVersion?: string
}

/**
 * Error data for a failed AI request
 */
export interface AIErrorLog {
  type: string
  message: string
  stack?: string
  retryCount: number
}

/**
 * Metadata for an AI request
 */
export interface AIRequestMetadata {
  temperature?: number
  maxTokens?: number
  projectId?: string
}

/**
 * Full AI request log entry
 */
export interface AIRequestLog {
  id: string
  timestamp: Date
  modelId: string
  action: AIAction
  input: AIRequestInput
  metadata?: AIRequestMetadata
  status: AIRequestStatus
  response?: AIResponseLog
  error?: AIErrorLog
}

/**
 * Filter options for querying AI request logs
 */
export interface AILogFilter {
  startDate?: Date
  endDate?: Date
  modelId?: string
  action?: AIAction
  status?: AIRequestStatus
  limit?: number
}

/**
 * Input for creating an AI request log
 */
export interface CreateAIRequestLogInput {
  modelId: string
  action: AIAction
  input: AIRequestInput
  metadata?: AIRequestMetadata
}

// ============================================================================
// Agent Task Types
// ============================================================================

/**
 * Type of coding agent
 */
export type AgentType = 'autonomous' | 'feature'

/**
 * Status of an agent task
 */
export type TaskStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'stopped'

/**
 * Parameters for agent execution
 */
export interface AgentParameters {
  model?: string
  maxIterations?: number
  testCount?: number
  taskFile?: string
  customEnv?: Record<string, string>
}

/**
 * Summary of file changes made by an agent
 */
export interface FileChangeSummary {
  created: string[]
  modified: string[]
  deleted: string[]
  gitDiff?: string
}

/**
 * Agent task entity
 */
export interface AgentTask {
  id: string
  description: string
  agentType: AgentType
  targetDirectory: string
  parameters: AgentParameters
  status: TaskStatus
  priority: number
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  processId?: number
  exitCode?: number
  error?: string
  fileChanges?: FileChangeSummary
}

/**
 * Input for creating an agent task
 */
export interface CreateAgentTaskInput {
  description: string
  agentType: AgentType
  targetDirectory: string
  parameters?: AgentParameters
  priority?: number
}

/**
 * Input for updating an agent task
 */
export interface UpdateAgentTaskInput {
  description?: string
  parameters?: AgentParameters
  status?: TaskStatus
  priority?: number
  processId?: number
  exitCode?: number
  error?: string
  fileChanges?: FileChangeSummary
  startedAt?: Date
  completedAt?: Date
}

/**
 * Filter options for querying agent tasks
 */
export interface AgentTaskFilter {
  status?: TaskStatus
  agentType?: AgentType
  limit?: number
}

// ============================================================================
// Agent Task Output Types
// ============================================================================

/**
 * Output stream type
 */
export type OutputStreamType = 'stdout' | 'stderr'

/**
 * A line of output from an agent process
 */
export interface OutputLine {
  id?: number
  taskId: string
  timestamp: Date
  content: string
  stream: OutputStreamType
}

/**
 * Input for creating an output line
 */
export interface CreateOutputLineInput {
  taskId: string
  content: string
  stream: OutputStreamType
}

// ============================================================================
// Model Cache Types
// ============================================================================

/**
 * Cached model entry
 */
export interface CachedModel {
  id: string
  name: string
  provider: string
  contextLength: number
  pricing: {
    prompt: number
    completion: number
    request?: number
    image?: number
  }
  capabilities: string[]
  cachedAt: Date
  description?: string
  isFree?: boolean
  maxCompletionTokens?: number
  supportedMethods?: string[]
  created: number
  architecture: {
    modality: string
    tokenizer?: string
    instructType?: string
  }
}

/**
 * Input for caching a model
 */
export interface CacheModelInput {
  id: string
  name: string
  provider: string
  contextLength: number
  pricing: {
    prompt: number
    completion: number
    request?: number
    image?: number
  }
  capabilities: string[]
  description?: string
  isFree?: boolean
  maxCompletionTokens?: number
  supportedMethods?: string[]
  created: number
  architecture: {
    modality: string
    tokenizer?: string
    instructType?: string
  }
}

// ============================================================================
// AI Settings Types
// ============================================================================

/**
 * AI setting entry
 */
export interface AISetting {
  key: string
  value: string
  updatedAt: Date
}

// ============================================================================
// Agent Environment Configuration Types
// ============================================================================

/**
 * Supported agent CLI services
 */
export type AgentCLIService =
  | 'claude-code'
  | 'opencode'
  | 'google-jules'
  | 'aider'
  | 'custom'

/**
 * Metadata for an agent CLI service
 */
export interface AgentCLIServiceInfo {
  id: AgentCLIService
  name: string
  description: string
  icon?: string
  docsUrl?: string
}

/**
 * Available agent CLI services
 */
export const AGENT_CLI_SERVICES: AgentCLIServiceInfo[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    description: "Anthropic's Claude-powered coding assistant CLI",
    docsUrl: 'https://docs.anthropic.com/claude-code',
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    description: 'Open-source AI coding assistant with multiple model support',
    docsUrl: 'https://github.com/opencode-ai/opencode',
  },
  {
    id: 'google-jules',
    name: 'Google Jules',
    description: "Google's AI coding assistant powered by Gemini",
    docsUrl: 'https://developers.google.com/jules',
  },
  {
    id: 'aider',
    name: 'Aider',
    description: 'AI pair programming in your terminal',
    docsUrl: 'https://aider.chat',
  },
  {
    id: 'custom',
    name: 'Custom Agent',
    description: 'Configure a custom agent CLI with your own settings',
  },
]

/**
 * Configuration for coding agent execution environment.
 * Contains authentication tokens, API settings, and custom environment variables.
 */
export interface AgentEnvironmentConfig {
  /** Selected agent CLI service */
  agentService: AgentCLIService
  /** Anthropic authentication token for Claude Code agents */
  anthropicAuthToken: string
  /** Optional custom base URL for Anthropic API */
  anthropicBaseUrl?: string
  /** API timeout in milliseconds (default: 30000) */
  apiTimeoutMs: number
  /** Path to Python executable */
  pythonPath: string
  /** Custom environment variables to inject into agent process */
  customEnvVars: Record<string, string>
  /** Google API key for Jules */
  googleApiKey?: string
  /** OpenAI API key for OpenCode */
  openaiApiKey?: string
  /** Custom command for custom agent */
  customCommand?: string
}

/**
 * Validation result for agent environment configuration
 */
export interface AgentConfigValidationResult {
  /** Whether the configuration is valid */
  isValid: boolean
  /** Array of validation error messages */
  errors: AgentConfigValidationError[]
}

/**
 * A single validation error for agent configuration
 */
export interface AgentConfigValidationError {
  /** The field that failed validation */
  field: keyof AgentEnvironmentConfig
  /** Human-readable error message */
  message: string
}

/**
 * Input for updating agent environment configuration.
 * All fields are optional to allow partial updates.
 */
export interface UpdateAgentConfigInput {
  agentService?: AgentCLIService
  anthropicAuthToken?: string
  anthropicBaseUrl?: string
  apiTimeoutMs?: number
  pythonPath?: string
  customEnvVars?: Record<string, string>
  googleApiKey?: string
  openaiApiKey?: string
  customCommand?: string
}
