/**
 * AI Service
 *
 * Core service for managing AI interactions using Vercel AI SDK with OpenRouter provider.
 * Provides unified access to multiple AI models through a single interface.
 *
 * Requirements: 1.1, 1.2, 2.2, 3.6, 12.4, 12.5
 */

import { generateText, streamText } from 'ai'
import type {
  AIAction,
  AIModel,
  ConversationMessage,
  GenerateTextParams,
  GenerateTextResult,
  StreamTextParams,
  StreamTextChunk,
  TokenUsage,
} from 'shared/ai-types'
import type { KeychainService } from './keychain-service'
import type {
  ProviderRegistry,
  AIProviderAdapter,
} from './ai/provider-registry'
import type { ModelRegistry } from './ai/model-registry'
import type { RequestLogger } from './ai/request-logger'
import { OpenRouterProvider } from './ai/openrouter-provider'

/**
 * Error codes for AI service errors
 */
export enum AIErrorCode {
  NOT_CONFIGURED = 'NOT_CONFIGURED',
  INVALID_API_KEY = 'INVALID_API_KEY',
  RATE_LIMITED = 'RATE_LIMITED',
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  CONTEXT_TOO_LONG = 'CONTEXT_TOO_LONG',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  TIMEOUT = 'TIMEOUT',
}

/**
 * Custom error class for AI service errors
 */
export class AIServiceError extends Error {
  constructor(
    message: string,
    public code: AIErrorCode,
    public isRetryable: boolean,
    public cause?: Error
  ) {
    super(message)
    this.name = 'AIServiceError'
  }
}

/**
 * Retry configuration for transient failures
 */
export interface RetryConfig {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
}

/**
 * Error codes that are retryable
 */
const RETRYABLE_ERROR_CODES = new Set([
  AIErrorCode.RATE_LIMITED,
  AIErrorCode.NETWORK_ERROR,
  AIErrorCode.TIMEOUT,
])

/**
 * Project context for managing conversation and files
 */
interface ProjectContext {
  conversation: ConversationMessage[]
  contextFiles: ContextFile[]
}

/**
 * Context file with content and token count
 */
interface ContextFile {
  path: string
  content: string
  tokenCount: number
}

/**
 * Interface for the AI Service
 */
export interface IAIService {
  initialize(): Promise<void>
  getProvider(): AIProviderAdapter | undefined
  getAvailableModels(): Promise<AIModel[]>
  setDefaultModel(modelId: string): Promise<void>
  setActionModel(action: AIAction, modelId: string): Promise<void>
  getModelForAction(action: AIAction): AIModel | undefined
  generateText(params: GenerateTextParams): Promise<GenerateTextResult>
  streamText(params: StreamTextParams): AsyncIterable<StreamTextChunk>
  getConversation(projectId: string): ConversationMessage[]
  clearConversation(projectId: string): void
  addMessageToConversation(
    projectId: string,
    message: ConversationMessage
  ): void
}

/**
 * AI Service implementation
 *
 * Manages AI interactions using Vercel AI SDK with OpenRouter provider.
 * Supports multiple models, conversation context, and request logging.
 */
export class AIService implements IAIService {
  private providerRegistry: ProviderRegistry
  private modelRegistry: ModelRegistry
  private requestLogger: RequestLogger
  private keychainService: KeychainService
  private projectContexts: Map<string, ProjectContext> = new Map()
  private initialized: boolean = false
  private retryConfig: RetryConfig

  constructor(
    providerRegistry: ProviderRegistry,
    modelRegistry: ModelRegistry,
    requestLogger: RequestLogger,
    keychainService: KeychainService,
    retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
  ) {
    this.providerRegistry = providerRegistry
    this.modelRegistry = modelRegistry
    this.requestLogger = requestLogger
    this.keychainService = keychainService
    this.retryConfig = retryConfig
  }

  /**
   * Initialize the AI service
   *
   * Sets up the OpenRouter provider with API key from keychain.
   * Requirements: 1.1, 2.2
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    // Get API key from keychain
    const apiKey = await this.keychainService.getApiKey('openrouter' as any)

    if (apiKey) {
      // Create and register OpenRouter provider
      const openRouterProvider = new OpenRouterProvider()
      await openRouterProvider.initialize({ apiKey })

      this.providerRegistry.registerProvider('openrouter', openRouterProvider)
      this.providerRegistry.setDefaultProvider('openrouter')

      // Set provider on model registry
      this.modelRegistry.setProvider(openRouterProvider)
    }

    this.initialized = true
  }

  /**
   * Get the current provider
   */
  getProvider(): AIProviderAdapter | undefined {
    return this.providerRegistry.getDefaultProvider()
  }

  /**
   * Get available models from the provider
   * Requirements: 3.1
   */
  async getAvailableModels(): Promise<AIModel[]> {
    return this.modelRegistry.fetchModels()
  }

  /**
   * Set the default model
   * Requirements: 3.3
   */
  async setDefaultModel(modelId: string): Promise<void> {
    this.modelRegistry.setDefaultModel(modelId)
  }

  /**
   * Set model for a specific action
   * Requirements: 3.4
   */
  async setActionModel(action: AIAction, modelId: string): Promise<void> {
    this.modelRegistry.setActionModel(action, modelId)
  }

  /**
   * Get model for a specific action
   */
  getModelForAction(action: AIAction): AIModel | undefined {
    return this.modelRegistry.getModelForAction(action)
  }

  /**
   * Generate text using the AI model
   *
   * Requirements: 1.2
   *
   * @param params - Generation parameters
   * @returns Generated text result
   */
  async generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
    const provider = this.providerRegistry.getDefaultProvider()
    if (!provider || !provider.isConfigured()) {
      throw new AIServiceError(
        'AI provider not configured. Please add an API key.',
        AIErrorCode.NOT_CONFIGURED,
        false
      )
    }

    const action = params.action || 'chat'
    const model = this.modelRegistry.getModelForAction(action)
    if (!model) {
      throw new AIServiceError(
        'No model configured for this action',
        AIErrorCode.MODEL_NOT_FOUND,
        false
      )
    }

    // Get or create project context
    const context = this.getProjectContext(params.projectId)

    // Add user message to conversation
    const userMessage: ConversationMessage = {
      id: this.generateId(),
      role: 'user',
      content: params.content,
      timestamp: new Date(),
      model: model.id,
    }
    context.conversation.push(userMessage)

    // Build messages for the API
    const messages = this.buildMessages(context, params.systemPrompt)

    // Log the request
    const logId = this.requestLogger.logRequest({
      modelId: model.id,
      action,
      input: {
        messages: messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp.toISOString(),
          model: m.model,
        })),
        systemPrompt: params.systemPrompt,
      },
      metadata: {
        projectId: params.projectId,
      },
    })

    const startTime = Date.now()

    try {
      // Execute with retry logic
      const result = await this.executeWithRetry(async () => {
        const languageModel = provider.createChatModel(model.id)
        return generateText({
          model: languageModel,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          ...(params.systemPrompt && { system: params.systemPrompt }),
        })
      })

      const latencyMs = Date.now() - startTime

      // Create assistant message
      const assistantMessage: ConversationMessage = {
        id: this.generateId(),
        role: 'assistant',
        content: result.text,
        timestamp: new Date(),
        model: model.id,
      }
      context.conversation.push(assistantMessage)

      // Log successful response
      this.requestLogger.updateResponse(logId, {
        output: result.text,
        tokenUsage: {
          promptTokens: result.usage?.inputTokens || 0,
          completionTokens: result.usage?.outputTokens || 0,
          totalTokens: result.usage?.totalTokens || 0,
        },
        latencyMs,
        finishReason: result.finishReason || 'stop',
      })

      return {
        text: result.text,
        usage: {
          promptTokens: result.usage?.inputTokens || 0,
          completionTokens: result.usage?.outputTokens || 0,
          totalTokens: result.usage?.totalTokens || 0,
        },
        model: model.id,
        finishReason: result.finishReason || 'stop',
      }
    } catch (error) {
      // Calculate latency for potential future logging
      const _latencyMs = Date.now() - startTime
      const aiError = this.classifyError(error)

      // Log error
      this.requestLogger.logError(logId, {
        type: aiError.code,
        message: aiError.message,
        stack: aiError.stack,
        retryCount: 0,
      })

      throw aiError
    }
  }

  /**
   * Stream text generation
   *
   * Requirements: 1.3
   *
   * @param params - Stream parameters
   * @returns AsyncIterable of text chunks
   */
  async *streamText(params: StreamTextParams): AsyncIterable<StreamTextChunk> {
    const provider = this.providerRegistry.getDefaultProvider()
    if (!provider || !provider.isConfigured()) {
      throw new AIServiceError(
        'AI provider not configured. Please add an API key.',
        AIErrorCode.NOT_CONFIGURED,
        false
      )
    }

    const action = params.action || 'chat'
    const model = this.modelRegistry.getModelForAction(action)
    if (!model) {
      throw new AIServiceError(
        'No model configured for this action',
        AIErrorCode.MODEL_NOT_FOUND,
        false
      )
    }

    // Get or create project context
    const context = this.getProjectContext(params.projectId)

    // Add user message to conversation
    const userMessage: ConversationMessage = {
      id: this.generateId(),
      role: 'user',
      content: params.content,
      timestamp: new Date(),
      model: model.id,
    }
    context.conversation.push(userMessage)

    // Build messages for the API
    const messages = this.buildMessages(context, params.systemPrompt)

    // Log the request
    const logId = this.requestLogger.logRequest({
      modelId: model.id,
      action,
      input: {
        messages: messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp.toISOString(),
          model: m.model,
        })),
        systemPrompt: params.systemPrompt,
      },
      metadata: {
        projectId: params.projectId,
      },
    })

    const startTime = Date.now()
    let fullText = ''
    let finalUsage: TokenUsage | undefined

    try {
      const languageModel = provider.createChatModel(model.id)
      const result = streamText({
        model: languageModel,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        ...(params.systemPrompt && { system: params.systemPrompt }),
      })

      // Stream the text chunks
      for await (const chunk of result.textStream) {
        fullText += chunk

        // Call the onChunk callback if provided
        if (params.onChunk) {
          params.onChunk(chunk)
        }

        yield {
          text: chunk,
          isComplete: false,
        }
      }

      // Get final usage after streaming completes
      const usage = await result.usage
      finalUsage = {
        promptTokens: usage?.inputTokens || 0,
        completionTokens: usage?.outputTokens || 0,
        totalTokens: usage?.totalTokens || 0,
      }

      // Yield final chunk with usage
      yield {
        text: '',
        isComplete: true,
        usage: finalUsage,
      }

      const latencyMs = Date.now() - startTime

      // Create assistant message with full response
      const assistantMessage: ConversationMessage = {
        id: this.generateId(),
        role: 'assistant',
        content: fullText,
        timestamp: new Date(),
        model: model.id,
      }
      context.conversation.push(assistantMessage)

      // Log successful response
      this.requestLogger.updateResponse(logId, {
        output: fullText,
        tokenUsage: finalUsage,
        latencyMs,
        finishReason: 'stop',
      })
    } catch (error) {
      // Calculate latency for potential future logging
      const _latencyMs = Date.now() - startTime
      const aiError = this.classifyError(error)

      // Log error
      this.requestLogger.logError(logId, {
        type: aiError.code,
        message: aiError.message,
        stack: aiError.stack,
        retryCount: 0,
      })

      throw aiError
    }
  }

  /**
   * Get conversation for a project
   *
   * Requirements: 3.6, 5.3
   */
  getConversation(projectId: string): ConversationMessage[] {
    const context = this.projectContexts.get(projectId)
    return context?.conversation || []
  }

  /**
   * Clear conversation for a project
   */
  clearConversation(projectId: string): void {
    const context = this.projectContexts.get(projectId)
    if (context) {
      context.conversation = []
    }
  }

  /**
   * Add a message to the conversation
   *
   * Used for preserving conversation context on model switch.
   * Requirements: 3.6
   */
  addMessageToConversation(
    projectId: string,
    message: ConversationMessage
  ): void {
    const context = this.getProjectContext(projectId)
    context.conversation.push(message)
  }

  /**
   * Get or create project context
   */
  private getProjectContext(projectId: string): ProjectContext {
    let context = this.projectContexts.get(projectId)
    if (!context) {
      context = {
        conversation: [],
        contextFiles: [],
      }
      this.projectContexts.set(projectId, context)
    }
    return context
  }

  /**
   * Build messages array for API call
   */
  private buildMessages(
    context: ProjectContext,
    _systemPrompt?: string
  ): ConversationMessage[] {
    const messages: ConversationMessage[] = []

    // Add context files as system message if present
    if (context.contextFiles.length > 0) {
      const contextContent = context.contextFiles
        .map(file => `File: ${file.path}\n\`\`\`\n${file.content}\n\`\`\``)
        .join('\n\n')

      messages.push({
        id: this.generateId(),
        role: 'system',
        content: `Context files:\n\n${contextContent}`,
        timestamp: new Date(),
      })
    }

    // Add conversation history (last 20 messages to avoid token limits)
    const recentMessages = context.conversation.slice(-20)
    messages.push(...recentMessages)

    return messages
  }

  /**
   * Execute a function with retry logic
   *
   * Requirements: 12.4
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    retryCount: number = 0
  ): Promise<T> {
    try {
      return await fn()
    } catch (error) {
      const aiError = this.classifyError(error)

      // Check if we should retry
      if (aiError.isRetryable && retryCount < this.retryConfig.maxRetries) {
        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.retryConfig.initialDelayMs *
            this.retryConfig.backoffMultiplier ** retryCount,
          this.retryConfig.maxDelayMs
        )

        // Wait before retrying
        await this.sleep(delay)

        // Retry
        return this.executeWithRetry(fn, retryCount + 1)
      }

      throw aiError
    }
  }

  /**
   * Classify an error into an AIServiceError
   */
  private classifyError(error: unknown): AIServiceError {
    if (error instanceof AIServiceError) {
      return error
    }

    const errorMessage = error instanceof Error ? error.message : String(error)

    // Check for rate limiting
    if (
      errorMessage.includes('rate limit') ||
      errorMessage.includes('429') ||
      errorMessage.includes('too many requests')
    ) {
      return new AIServiceError(
        'Rate limited by AI provider. Please try again later.',
        AIErrorCode.RATE_LIMITED,
        true,
        error instanceof Error ? error : undefined
      )
    }

    // Check for network errors
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('fetch failed')
    ) {
      return new AIServiceError(
        'Network error connecting to AI provider.',
        AIErrorCode.NETWORK_ERROR,
        true,
        error instanceof Error ? error : undefined
      )
    }

    // Check for timeout
    if (errorMessage.includes('timeout')) {
      return new AIServiceError(
        'Request timed out.',
        AIErrorCode.TIMEOUT,
        true,
        error instanceof Error ? error : undefined
      )
    }

    // Check for invalid API key
    if (
      errorMessage.includes('401') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('invalid api key')
    ) {
      return new AIServiceError(
        'Invalid API key. Please check your configuration.',
        AIErrorCode.INVALID_API_KEY,
        false,
        error instanceof Error ? error : undefined
      )
    }

    // Check for context too long
    if (
      errorMessage.includes('context length') ||
      errorMessage.includes('too long') ||
      errorMessage.includes('maximum context')
    ) {
      return new AIServiceError(
        'Context too long for the selected model.',
        AIErrorCode.CONTEXT_TOO_LONG,
        false,
        error instanceof Error ? error : undefined
      )
    }

    // Default to provider error
    return new AIServiceError(
      errorMessage || 'Unknown error from AI provider',
      AIErrorCode.PROVIDER_ERROR,
      false,
      error instanceof Error ? error : undefined
    )
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get retry configuration (for testing)
   */
  getRetryConfig(): RetryConfig {
    return { ...this.retryConfig }
  }

  /**
   * Calculate delay for a given retry attempt (for testing)
   */
  calculateRetryDelay(retryCount: number): number {
    return Math.min(
      this.retryConfig.initialDelayMs *
        this.retryConfig.backoffMultiplier ** retryCount,
      this.retryConfig.maxDelayMs
    )
  }

  /**
   * Check if an error code is retryable
   */
  isRetryableError(code: AIErrorCode): boolean {
    return RETRYABLE_ERROR_CODES.has(code)
  }
}
