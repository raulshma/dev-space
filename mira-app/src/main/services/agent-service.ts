import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { encoding_for_model } from 'tiktoken'
import { readFileSync } from 'node:fs'
import type {
  AIModel,
  AIProvider,
  ConversationMessage,
  ContextFile,
  TokenUsage,
  ErrorContext,
  FixSuggestion,
} from 'shared/models'
import type { KeychainService } from 'main/services/keychain-service'

/**
 * AI Agent Service for Mira Developer Hub
 *
 * Manages AI model configuration, conversation state, context files,
 * and integrations with AI provider APIs (OpenAI, Anthropic, Google).
 *
 * Requirements: 5.1, 5.2, 5.3
 */

interface ProjectContext {
  conversation: ConversationMessage[]
  contextFiles: ContextFile[]
}

export class AgentService {
  private keychainService: KeychainService
  private activeModel: AIModel | null = null
  private projectContexts: Map<string, ProjectContext> = new Map()

  // Available models configuration
  private availableModels: AIModel[] = [
    {
      id: 'gpt-4o',
      provider: 'openai',
      name: 'GPT-4o',
      maxTokens: 128000,
      isConfigured: false,
    },
    {
      id: 'gpt-4-turbo',
      provider: 'openai',
      name: 'GPT-4 Turbo',
      maxTokens: 128000,
      isConfigured: false,
    },
    {
      id: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
      name: 'Claude 3.5 Sonnet',
      maxTokens: 200000,
      isConfigured: false,
    },
    {
      id: 'claude-3-opus-20240229',
      provider: 'anthropic',
      name: 'Claude 3 Opus',
      maxTokens: 200000,
      isConfigured: false,
    },
    {
      id: 'gemini-pro',
      provider: 'google',
      name: 'Gemini Pro',
      maxTokens: 32000,
      isConfigured: false,
    },
  ]

  constructor(keychainService: KeychainService) {
    this.keychainService = keychainService
    this.initializeModelConfiguration()
  }

  /**
   * Initialize model configuration by checking which API keys are available
   */
  private async initializeModelConfiguration(): Promise<void> {
    const providers: AIProvider[] = ['openai', 'anthropic', 'google']

    for (const provider of providers) {
      const hasKey = await this.keychainService.hasApiKey(provider)
      this.availableModels = this.availableModels.map(model =>
        model.provider === provider ? { ...model, isConfigured: hasKey } : model
      )
    }

    // Set first configured model as active
    const firstConfigured = this.availableModels.find(m => m.isConfigured)
    if (firstConfigured) {
      this.activeModel = firstConfigured
    }
  }

  /**
   * Set the active AI model
   * Requirements: 5.2
   */
  setActiveModel(model: AIModel): void {
    if (!model.isConfigured) {
      throw new Error(
        `Model ${model.name} is not configured. Please add an API key.`
      )
    }
    this.activeModel = model
  }

  /**
   * Get the currently active model
   * Requirements: 5.1
   */
  getActiveModel(): AIModel {
    if (!this.activeModel) {
      throw new Error('No active model set')
    }
    return this.activeModel
  }

  /**
   * Get all available models with their configuration status
   * Requirements: 5.1, 5.4
   */
  async getAvailableModels(): Promise<AIModel[]> {
    // Refresh configuration status
    await this.initializeModelConfiguration()
    return this.availableModels
  }

  /**
   * Send a message to the AI agent
   * Requirements: 5.2, 5.3
   */
  async sendMessage(
    projectId: string,
    content: string
  ): Promise<ConversationMessage> {
    if (!this.activeModel) {
      throw new Error('No active model set')
    }

    // Get or create project context
    const context = this.getProjectContext(projectId)

    // Create user message
    const userMessage: ConversationMessage = {
      id: this.generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
      model: this.activeModel.id,
    }

    // Add to conversation
    context.conversation.push(userMessage)

    // Get AI response based on provider
    const assistantContent = await this.getAIResponse(projectId, content)

    // Create assistant message
    const assistantMessage: ConversationMessage = {
      id: this.generateId(),
      role: 'assistant',
      content: assistantContent,
      timestamp: new Date(),
      model: this.activeModel.id,
    }

    // Add to conversation
    context.conversation.push(assistantMessage)

    return assistantMessage
  }

  /**
   * Get AI response from the appropriate provider
   */
  private async getAIResponse(
    projectId: string,
    userMessage: string
  ): Promise<string> {
    if (!this.activeModel) {
      throw new Error('No active model set')
    }

    const context = this.getProjectContext(projectId)
    const apiKey = await this.keychainService.getApiKey(
      this.activeModel.provider
    )

    if (!apiKey) {
      throw new Error(`No API key found for ${this.activeModel.provider}`)
    }

    // Build messages array with context
    const messages = this.buildMessagesWithContext(context, userMessage)

    switch (this.activeModel.provider) {
      case 'openai':
        return await this.getOpenAIResponse(apiKey, messages)
      case 'anthropic':
        return await this.getAnthropicResponse(apiKey, messages)
      case 'google':
        return await this.getGoogleResponse(apiKey, messages)
      default:
        throw new Error(`Unsupported provider: ${this.activeModel.provider}`)
    }
  }

  /**
   * Build messages array with context files
   */
  private buildMessagesWithContext(
    context: ProjectContext,
    userMessage: string
  ): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = []

    // Add context files as system message if present
    if (context.contextFiles.length > 0) {
      const contextContent = context.contextFiles
        .map(file => `File: ${file.path}\n\`\`\`\n${file.content}\n\`\`\``)
        .join('\n\n')

      messages.push({
        role: 'system',
        content: `Context files:\n\n${contextContent}`,
      })
    }

    // Add conversation history (last 10 messages to avoid token limits)
    const recentMessages = context.conversation.slice(-10)
    for (const msg of recentMessages) {
      messages.push({
        role: msg.role,
        content: msg.content,
      })
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: userMessage,
    })

    return messages
  }

  /**
   * Get response from OpenAI
   */
  private async getOpenAIResponse(
    apiKey: string,
    messages: Array<{ role: string; content: string }>
  ): Promise<string> {
    const openai = new OpenAI({ apiKey })

    const response = await openai.chat.completions.create({
      model: this.activeModel?.id,
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature: 0.7,
      max_tokens: 2000,
    })

    return response.choices[0]?.message?.content || 'No response generated'
  }

  /**
   * Get response from Anthropic
   */
  private async getAnthropicResponse(
    apiKey: string,
    messages: Array<{ role: string; content: string }>
  ): Promise<string> {
    const anthropic = new Anthropic({ apiKey })

    // Anthropic requires system messages to be separate
    const systemMessages = messages.filter(m => m.role === 'system')
    const conversationMessages = messages.filter(m => m.role !== 'system')

    const response = await anthropic.messages.create({
      model: this.activeModel?.id,
      max_tokens: 2000,
      system: systemMessages.map(m => m.content).join('\n\n'),
      messages: conversationMessages as Anthropic.MessageParam[],
    })

    const content = response.content[0]
    return content.type === 'text' ? content.text : 'No response generated'
  }

  /**
   * Get response from Google
   */
  private async getGoogleResponse(
    apiKey: string,
    messages: Array<{ role: string; content: string }>
  ): Promise<string> {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: this.activeModel?.id })

    // Convert messages to Google format
    const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n\n')

    const result = await model.generateContent(prompt)
    const response = await result.response
    return response.text()
  }

  /**
   * Get conversation for a project
   * Requirements: 5.3
   */
  getConversation(projectId: string): ConversationMessage[] {
    const context = this.projectContexts.get(projectId)
    return context?.conversation || []
  }

  /**
   * Clear conversation for a project
   */
  clearConversation(projectId: string): void {
    const context = this.getProjectContext(projectId)
    context.conversation = []
  }

  /**
   * Add a file to the context
   * Requirements: 6.1, 6.2
   */
  addFileToContext(projectId: string, filePath: string): ContextFile {
    const context = this.getProjectContext(projectId)

    // Read file content
    let content: string
    try {
      content = readFileSync(filePath, 'utf-8')
    } catch {
      throw new Error(`Failed to read file: ${filePath}`)
    }

    // Calculate token count
    const tokenCount = this.calculateTokenCount(content)

    const contextFile: ContextFile = {
      path: filePath,
      tokenCount,
      content,
    }

    // Check if file already exists in context
    const existingIndex = context.contextFiles.findIndex(
      f => f.path === filePath
    )
    if (existingIndex >= 0) {
      context.contextFiles[existingIndex] = contextFile
    } else {
      context.contextFiles.push(contextFile)
    }

    return contextFile
  }

  /**
   * Remove a file from the context
   * Requirements: 6.4
   */
  removeFileFromContext(projectId: string, filePath: string): void {
    const context = this.getProjectContext(projectId)
    context.contextFiles = context.contextFiles.filter(f => f.path !== filePath)
  }

  /**
   * Get all context files for a project
   * Requirements: 6.1
   */
  getContextFiles(projectId: string): ContextFile[] {
    const context = this.projectContexts.get(projectId)
    return context?.contextFiles || []
  }

  /**
   * Get token usage for a project
   * Requirements: 6.2, 6.3, 6.4
   */
  getTokenUsage(projectId: string): TokenUsage {
    const context = this.projectContexts.get(projectId)
    const limit = this.activeModel?.maxTokens || 128000

    if (!context) {
      return {
        used: 0,
        limit,
        percentage: 0,
      }
    }

    const used = context.contextFiles.reduce(
      (sum, file) => sum + file.tokenCount,
      0
    )
    const percentage = (used / limit) * 100

    return {
      used,
      limit,
      percentage,
    }
  }

  /**
   * Generate a fix suggestion for an error
   * Requirements: 7.1, 7.2, 7.3, 7.4
   */
  async generateFix(errorContext: ErrorContext): Promise<FixSuggestion> {
    if (!this.activeModel) {
      throw new Error('No active model set')
    }

    const apiKey = await this.keychainService.getApiKey(
      this.activeModel.provider
    )
    if (!apiKey) {
      throw new Error(`No API key found for ${this.activeModel.provider}`)
    }

    // Build fix request prompt
    const prompt = `
I encountered an error in my terminal. Please analyze it and suggest a fix.

Command: ${errorContext.command}
Exit Code: ${errorContext.exitCode}

Error Output:
${errorContext.errorOutput}

${errorContext.relevantFiles.length > 0 ? `Relevant Files: ${errorContext.relevantFiles.join(', ')}` : ''}

Please provide:
1. An explanation of what went wrong
2. A suggested fix or command to resolve the issue
3. Your confidence level (0-100)

Format your response as:
EXPLANATION: <explanation>
FIX: <suggested fix>
CONFIDENCE: <0-100>
`

    const messages = [{ role: 'user', content: prompt }]

    let response: string
    switch (this.activeModel.provider) {
      case 'openai':
        response = await this.getOpenAIResponse(apiKey, messages)
        break
      case 'anthropic':
        response = await this.getAnthropicResponse(apiKey, messages)
        break
      case 'google':
        response = await this.getGoogleResponse(apiKey, messages)
        break
      default:
        throw new Error(`Unsupported provider: ${this.activeModel.provider}`)
    }

    // Parse response
    return this.parseFixSuggestion(response)
  }

  /**
   * Parse fix suggestion from AI response
   */
  private parseFixSuggestion(response: string): FixSuggestion {
    const explanationMatch = response.match(/EXPLANATION:\s*(.+?)(?=FIX:|$)/s)
    const fixMatch = response.match(/FIX:\s*(.+?)(?=CONFIDENCE:|$)/s)
    const confidenceMatch = response.match(/CONFIDENCE:\s*(\d+)/)

    return {
      explanation: explanationMatch?.[1]?.trim() || response,
      suggestedFix: fixMatch?.[1]?.trim() || 'No specific fix suggested',
      confidence: confidenceMatch ? parseInt(confidenceMatch[1], 10) : 50,
    }
  }

  /**
   * Calculate token count for text
   * Requirements: 6.2
   */
  private calculateTokenCount(text: string): number {
    try {
      // Use GPT-4 encoding as a reasonable default
      const encoding = encoding_for_model('gpt-4')
      const tokens = encoding.encode(text)
      encoding.free()
      return tokens.length
    } catch {
      // Fallback: rough estimate of 4 characters per token
      return Math.ceil(text.length / 4)
    }
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
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}
