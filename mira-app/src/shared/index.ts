// Export all shared types and constants
export * from './models'
export * from './ipc-types'

// Export AI types with explicit naming to avoid conflicts with models.ts
// The ai-types module provides enhanced versions with serialization support
export type {
  // Message types (enhanced version with 'system' role and metadata)
  ConversationMessage as AIConversationMessage,
  SerializedMessage,
  // Provider and action types
  AIProvider as AIProviderType,
  AIAction,
  // Model types (enhanced version with pricing and capabilities)
  AIModel as AIModelInfo,
  // Token usage (enhanced version with detailed breakdown)
  TokenUsage as AITokenUsage,
  // Request/Response types
  GenerateTextParams,
  GenerateTextResult,
  StreamTextParams,
  StreamTextChunk,
} from './ai-types'

// Export serialization functions
export {
  serializeMessage,
  deserializeMessage,
  serializeMessages,
  deserializeMessages,
} from './ai-types'

// Export utility functions
export { maskApiKey } from './utils'
