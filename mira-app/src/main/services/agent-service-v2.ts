/**
 * Agent Service V2
 *
 * Native TypeScript implementation using the Claude Agent SDK.
 * Manages conversation sessions with persistence, real-time streaming,
 * and image support.
 *
 * Implements Requirements:
 * - 3.1: Manage conversation sessions with unique session IDs
 * - 3.2: Load existing messages from persistent storage
 * - 3.3: Add messages to conversation history and invoke provider
 * - 3.4: Stream assistant responses in real-time via event emission
 * - 3.5: Emit tool_use events with tool name and input
 * - 3.6: Persist conversation history after each message exchange
 * - 3.7: Emit error events and add error messages to conversation
 * - 7.1: Persist session messages to JSON files
 * - 7.2: Maintain session metadata (name, projectPath, workingDirectory, timestamps)
 * - 7.3: Restore SDK session ID for conversation continuity
 * - 7.4: Support listing, creating, archiving, and deleting sessions
 * - 7.5: Exclude archived sessions from default session list
 * - 8.1: Read images as base64 and include in prompts
 * - 8.2: Support common image formats (PNG, JPEG, GIF, WebP)
 * - 8.3: Store image metadata with messages
 * - 8.4: Format images as multi-part content blocks
 * - 10.2: Handle abort errors without marking task as failed
 * - 10.3: Classify errors by type for appropriate handling
 *
 * @module agent-service-v2
 */

import { EventEmitter } from 'node:events'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'
import { ProviderFactory } from './providers/provider-factory'
import type { ProviderErrorInfo } from './providers/types'
import { loadContextFiles, combineSystemPrompts } from './agent/context-loader'
import {
  readImageAsBase64 as readImage,
  buildPromptWithImages as buildPrompt,
  type ImageMetadata,
} from './utils/image-handler'

// ============================================================================
// Types
// ============================================================================

/**
 * Session metadata stored with each session
 */
export interface SessionMetadata {
  /** Unique session identifier */
  id: string
  /** Human-readable session name */
  name: string
  /** Project path this session belongs to */
  projectPath?: string
  /** Working directory for file operations */
  workingDirectory: string
  /** ISO 8601 timestamp of creation */
  createdAt: string
  /** ISO 8601 timestamp of last update */
  updatedAt: string
  /** Whether session is archived */
  archived?: boolean
  /** Optional tags for organization */
  tags?: string[]
  /** Model used for this session */
  model?: string
  /** SDK session ID for conversation continuity */
  sdkSessionId?: string
}

// ImageMetadata is imported from utils/image-handler
export type { ImageMetadata } from './utils/image-handler'

/**
 * Message in a conversation
 */
export interface Message {
  /** Unique message identifier */
  id: string
  /** Role of the message sender */
  role: 'user' | 'assistant'
  /** Text content of the message */
  content: string
  /** Attached images */
  images?: ImageMetadata[]
  /** ISO 8601 timestamp */
  timestamp: string
  /** Whether this is an error message */
  isError?: boolean
  /** Tool uses in this message */
  toolUses?: Array<{
    name: string
    input: unknown
    id: string
  }>
}

/**
 * Full session data including messages
 */
export interface SessionData {
  metadata: SessionMetadata
  messages: Message[]
}

/**
 * Options for creating a new session
 */
export interface CreateSessionOptions {
  /** Session name */
  name: string
  /** Project path */
  projectPath?: string
  /** Working directory */
  workingDirectory: string
  /** Model to use */
  model?: string
  /** Optional tags */
  tags?: string[]
}

/**
 * Options for sending a message
 */
export interface SendMessageOptions {
  /** Session ID */
  sessionId: string
  /** Message content */
  message: string
  /** Image paths to attach */
  imagePaths?: string[]
  /** Model to use (overrides session default) */
  model?: string
  /** System prompt */
  systemPrompt?: string
  /** Allowed tools */
  allowedTools?: string[]
}

/**
 * Events emitted by the AgentServiceV2
 */
export interface AgentServiceV2Events {
  /** Emitted when streaming text is received */
  textDelta: (sessionId: string, text: string) => void
  /** Emitted when a complete message is received */
  message: (sessionId: string, message: Message) => void
  /** Emitted when a tool is used */
  toolUse: (sessionId: string, toolName: string, input: unknown) => void
  /** Emitted when an error occurs */
  error: (sessionId: string, error: ProviderErrorInfo) => void
  /** Emitted when execution completes */
  complete: (sessionId: string, result: string) => void
  /** Emitted when a session is created */
  sessionCreated: (session: SessionMetadata) => void
  /** Emitted when a session is updated */
  sessionUpdated: (session: SessionMetadata) => void
  /** Emitted when a session is deleted */
  sessionDeleted: (sessionId: string) => void
  /** Emitted when a session is archived */
  sessionArchived: (sessionId: string) => void
}

// ============================================================================
// Constants
// ============================================================================

/** Default model to use */
const DEFAULT_MODEL = 'claude-sonnet-4-20250514'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Check if an error is an abort error
 */
function isAbortError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.name === 'AbortError' ||
      error.message.includes('abort') ||
      error.message.includes('cancel')
    )
  }
  return false
}

/**
 * Classify an error into a type
 */
export function classifyError(error: unknown): ProviderErrorInfo {
  const message = error instanceof Error ? error.message : String(error)

  if (isAbortError(error)) {
    return {
      type: 'abort',
      message,
      isAbort: true,
      retryable: false,
      originalError: error instanceof Error ? error : undefined,
    }
  }

  if (message.includes('429') || message.toLowerCase().includes('rate limit')) {
    // Try to extract reset time from error message
    const resetMatch = message.match(
      /reset at (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/
    )
    return {
      type: 'rate_limit',
      message,
      isAbort: false,
      retryable: true,
      resetTime: resetMatch ? resetMatch[1] : undefined,
      originalError: error instanceof Error ? error : undefined,
    }
  }

  if (
    message.includes('ECONNREFUSED') ||
    message.includes('network') ||
    message.includes('ETIMEDOUT') ||
    message.includes('ENOTFOUND')
  ) {
    return {
      type: 'network',
      message,
      isAbort: false,
      retryable: true,
      originalError: error instanceof Error ? error : undefined,
    }
  }

  if (
    message.includes('401') ||
    message.includes('403') ||
    message.toLowerCase().includes('unauthorized') ||
    message.toLowerCase().includes('authentication')
  ) {
    return {
      type: 'auth',
      message,
      isAbort: false,
      retryable: false,
      originalError: error instanceof Error ? error : undefined,
    }
  }

  return {
    type: 'unknown',
    message,
    isAbort: false,
    retryable: false,
    originalError: error instanceof Error ? error : undefined,
  }
}

// ============================================================================
// Agent Service V2
// ============================================================================

/**
 * Agent Service V2
 *
 * Manages AI agent conversations with session persistence,
 * real-time streaming, and image support.
 */
export class AgentServiceV2 extends EventEmitter {
  /** Base directory for session storage */
  private stateDir: string

  /** Active abort controllers by session ID */
  private abortControllers: Map<string, AbortController> = new Map()

  /** In-memory session cache */
  private sessionCache: Map<string, SessionData> = new Map()

  /**
   * Create a new AgentServiceV2 instance
   *
   * @param stateDir - Optional custom state directory
   */
  constructor(stateDir?: string) {
    super()
    this.stateDir =
      stateDir || path.join(app.getPath('userData'), 'agent-sessions')
    this.ensureStateDir()
  }

  /**
   * Ensure the state directory exists
   */
  private ensureStateDir(): void {
    if (!fs.existsSync(this.stateDir)) {
      fs.mkdirSync(this.stateDir, { recursive: true })
    }
  }

  /**
   * Get the file path for a session
   */
  private getSessionPath(sessionId: string): string {
    return path.join(this.stateDir, `${sessionId}.json`)
  }

  // ============================================================================
  // Session CRUD Operations
  // ============================================================================

  /**
   * Create a new session
   *
   * @param options - Session creation options
   * @returns The created session metadata
   */
  createSession(options: CreateSessionOptions): SessionMetadata {
    const id = generateId()
    const now = new Date().toISOString()

    const metadata: SessionMetadata = {
      id,
      name: options.name,
      projectPath: options.projectPath,
      workingDirectory: options.workingDirectory,
      createdAt: now,
      updatedAt: now,
      archived: false,
      tags: options.tags,
      model: options.model || DEFAULT_MODEL,
    }

    const sessionData: SessionData = {
      metadata,
      messages: [],
    }

    // Save to disk
    this.saveSession(sessionData)

    // Cache in memory
    this.sessionCache.set(id, sessionData)

    this.emit('sessionCreated', metadata)

    return metadata
  }

  /**
   * Get a session by ID
   *
   * @param sessionId - The session ID
   * @returns The session data or null if not found
   */
  getSession(sessionId: string): SessionData | null {
    // Check cache first
    if (this.sessionCache.has(sessionId)) {
      const cached = this.sessionCache.get(sessionId)
      return cached ?? null
    }

    // Load from disk
    const sessionPath = this.getSessionPath(sessionId)
    if (!fs.existsSync(sessionPath)) {
      return null
    }

    try {
      const data = fs.readFileSync(sessionPath, 'utf-8')
      const sessionData = JSON.parse(data) as SessionData
      this.sessionCache.set(sessionId, sessionData)
      return sessionData
    } catch (error) {
      console.error(`Failed to load session ${sessionId}:`, error)
      return null
    }
  }

  /**
   * List all sessions
   *
   * @param options - Filter options
   * @returns Array of session metadata
   */
  listSessions(options?: {
    projectPath?: string
    includeArchived?: boolean
  }): SessionMetadata[] {
    const sessions: SessionMetadata[] = []

    try {
      const files = fs.readdirSync(this.stateDir)

      for (const file of files) {
        if (!file.endsWith('.json')) continue

        const sessionId = file.replace('.json', '')
        const session = this.getSession(sessionId)

        if (!session) continue

        // Filter by project path if specified
        if (
          options?.projectPath &&
          session.metadata.projectPath !== options.projectPath
        ) {
          continue
        }

        // Filter archived sessions unless explicitly included
        if (!options?.includeArchived && session.metadata.archived) {
          continue
        }

        sessions.push(session.metadata)
      }
    } catch (error) {
      console.error('Failed to list sessions:', error)
    }

    // Sort by updatedAt descending
    return sessions.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  }

  /**
   * Update session metadata
   *
   * @param sessionId - The session ID
   * @param updates - Fields to update
   * @returns The updated session metadata or null if not found
   */
  updateSession(
    sessionId: string,
    updates: Partial<
      Pick<SessionMetadata, 'name' | 'tags' | 'model' | 'sdkSessionId'>
    >
  ): SessionMetadata | null {
    const session = this.getSession(sessionId)
    if (!session) return null

    // Apply updates
    if (updates.name !== undefined) {
      session.metadata.name = updates.name
    }
    if (updates.tags !== undefined) {
      session.metadata.tags = updates.tags
    }
    if (updates.model !== undefined) {
      session.metadata.model = updates.model
    }
    if (updates.sdkSessionId !== undefined) {
      session.metadata.sdkSessionId = updates.sdkSessionId
    }

    session.metadata.updatedAt = new Date().toISOString()

    // Save to disk
    this.saveSession(session)

    this.emit('sessionUpdated', session.metadata)

    return session.metadata
  }

  /**
   * Archive a session
   *
   * @param sessionId - The session ID
   * @returns true if archived, false if not found
   */
  archiveSession(sessionId: string): boolean {
    const session = this.getSession(sessionId)
    if (!session) return false

    session.metadata.archived = true
    session.metadata.updatedAt = new Date().toISOString()

    this.saveSession(session)

    this.emit('sessionArchived', sessionId)

    return true
  }

  /**
   * Unarchive a session
   *
   * @param sessionId - The session ID
   * @returns true if unarchived, false if not found
   */
  unarchiveSession(sessionId: string): boolean {
    const session = this.getSession(sessionId)
    if (!session) return false

    session.metadata.archived = false
    session.metadata.updatedAt = new Date().toISOString()

    this.saveSession(session)

    this.emit('sessionUpdated', session.metadata)

    return true
  }

  /**
   * Delete a session
   *
   * @param sessionId - The session ID
   * @returns true if deleted, false if not found
   */
  deleteSession(sessionId: string): boolean {
    const sessionPath = this.getSessionPath(sessionId)

    // Remove from cache
    this.sessionCache.delete(sessionId)

    // Remove abort controller if exists
    this.abortControllers.delete(sessionId)

    // Delete file
    if (fs.existsSync(sessionPath)) {
      try {
        fs.unlinkSync(sessionPath)
        this.emit('sessionDeleted', sessionId)
        return true
      } catch (error) {
        console.error(`Failed to delete session ${sessionId}:`, error)
        return false
      }
    }

    return false
  }

  /**
   * Save session data to disk
   */
  private saveSession(session: SessionData): void {
    const sessionPath = this.getSessionPath(session.metadata.id)
    try {
      fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2), 'utf-8')
      this.sessionCache.set(session.metadata.id, session)
    } catch (error) {
      console.error(`Failed to save session ${session.metadata.id}:`, error)
      throw error
    }
  }

  // ============================================================================
  // Message Operations
  // ============================================================================

  /**
   * Get messages for a session
   *
   * @param sessionId - The session ID
   * @returns Array of messages or empty array if session not found
   */
  getMessages(sessionId: string): Message[] {
    const session = this.getSession(sessionId)
    return session?.messages || []
  }

  /**
   * Add a message to a session
   *
   * @param sessionId - The session ID
   * @param message - The message to add
   * @returns The added message or null if session not found
   */
  private addMessage(sessionId: string, message: Message): Message | null {
    const session = this.getSession(sessionId)
    if (!session) return null

    session.messages.push(message)
    session.metadata.updatedAt = new Date().toISOString()

    this.saveSession(session)

    return message
  }

  /**
   * Clear all messages in a session
   *
   * @param sessionId - The session ID
   * @returns true if cleared, false if session not found
   */
  clearSession(sessionId: string): boolean {
    const session = this.getSession(sessionId)
    if (!session) return false

    session.messages = []
    session.metadata.sdkSessionId = undefined
    session.metadata.updatedAt = new Date().toISOString()

    this.saveSession(session)

    return true
  }

  // ============================================================================
  // Message Sending and Streaming
  // ============================================================================

  /**
   * Send a message and stream the response
   *
   * @param options - Send message options
   * @returns The assistant's response message
   */
  async sendMessage(options: SendMessageOptions): Promise<Message> {
    const {
      sessionId,
      message,
      imagePaths,
      model,
      systemPrompt,
      allowedTools,
    } = options

    const session = this.getSession(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    // Read and encode images
    const images: ImageMetadata[] = []
    if (imagePaths && imagePaths.length > 0) {
      for (const imagePath of imagePaths) {
        const imageData = readImage(imagePath)
        if (imageData) {
          images.push(imageData)
        }
      }
    }

    // Create user message
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: message,
      images: images.length > 0 ? images : undefined,
      timestamp: new Date().toISOString(),
    }

    // Add user message to history
    this.addMessage(sessionId, userMessage)

    // Get provider for the model
    const modelToUse = model || session.metadata.model || DEFAULT_MODEL
    const provider = ProviderFactory.getProviderForModel(modelToUse)

    // Create abort controller
    const abortController = new AbortController()
    this.abortControllers.set(sessionId, abortController)

    // Build prompt with images if present
    const prompt = images.length > 0 ? buildPrompt(message, images) : message

    // Build conversation history for context
    const conversationHistory = session.messages
      .filter(m => !m.isError)
      .slice(-20) // Last 20 messages for context
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

    try {
      // Load project context files from .mira/context
      const { formattedPrompt: contextFilesPrompt } = await loadContextFiles({
        projectPath: session.metadata.workingDirectory,
      })

      // Combine context prompt with any caller-provided system prompt
      const combinedSystemPrompt = combineSystemPrompts(
        contextFilesPrompt || undefined,
        systemPrompt
      )

      // Execute query with streaming
      const stream = provider.executeQuery({
        prompt,
        model: modelToUse,
        cwd: session.metadata.workingDirectory,
        systemPrompt: combinedSystemPrompt,
        allowedTools,
        abortController,
        conversationHistory,
        sdkSessionId: session.metadata.sdkSessionId,
      })

      let assistantContent = ''
      const toolUses: Message['toolUses'] = []
      let sdkSessionId: string | undefined

      // Process stream
      for await (const msg of stream) {
        // Capture session ID for continuity
        if (msg.session_id) {
          sdkSessionId = msg.session_id
        }

        if (msg.type === 'assistant' && msg.message) {
          // Process content blocks
          for (const block of msg.message.content) {
            if (block.type === 'text' && block.text) {
              assistantContent += block.text
              this.emit('textDelta', sessionId, block.text)
            } else if (block.type === 'tool_use' && block.name) {
              toolUses.push({
                name: block.name,
                input: block.input,
                id: block.tool_use_id || generateId(),
              })
              this.emit('toolUse', sessionId, block.name, block.input)
            }
          }
        } else if (msg.type === 'result') {
          if (msg.subtype === 'success' && msg.result) {
            assistantContent = msg.result
          } else if (msg.subtype === 'error' && msg.error) {
            throw new Error(msg.error)
          }
        } else if (msg.type === 'error') {
          throw new Error(msg.error || 'Unknown error')
        }
      }

      // Update SDK session ID for continuity
      if (sdkSessionId) {
        this.updateSession(sessionId, { sdkSessionId })
      }

      // Create assistant message
      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date().toISOString(),
        toolUses: toolUses.length > 0 ? toolUses : undefined,
      }

      // Add assistant message to history
      this.addMessage(sessionId, assistantMessage)

      this.emit('message', sessionId, assistantMessage)
      this.emit('complete', sessionId, assistantContent)

      return assistantMessage
    } catch (error) {
      // Classify and handle error
      const errorInfo = classifyError(error)

      // Don't add error message for aborts
      if (!errorInfo.isAbort) {
        const errorMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content: `Error: ${errorInfo.message}`,
          timestamp: new Date().toISOString(),
          isError: true,
        }

        this.addMessage(sessionId, errorMessage)
        this.emit('error', sessionId, errorInfo)

        return errorMessage
      }

      // For aborts, emit error but don't add to history
      this.emit('error', sessionId, errorInfo)
      throw error
    } finally {
      // Clean up abort controller
      this.abortControllers.delete(sessionId)
    }
  }

  /**
   * Stop execution for a session
   *
   * @param sessionId - The session ID
   * @returns true if stopped, false if no active execution
   */
  stopExecution(sessionId: string): boolean {
    const controller = this.abortControllers.get(sessionId)
    if (controller) {
      controller.abort()
      this.abortControllers.delete(sessionId)
      return true
    }
    return false
  }

  /**
   * Check if a session has an active execution
   *
   * @param sessionId - The session ID
   * @returns true if executing
   */
  isExecuting(sessionId: string): boolean {
    return this.abortControllers.has(sessionId)
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get the state directory path
   */
  getStateDir(): string {
    return this.stateDir
  }

  /**
   * Get session count
   */
  getSessionCount(options?: {
    projectPath?: string
    includeArchived?: boolean
  }): number {
    return this.listSessions(options).length
  }

  /**
   * Export session data for backup
   *
   * @param sessionId - The session ID
   * @returns Session data as JSON string or null if not found
   */
  exportSession(sessionId: string): string | null {
    const session = this.getSession(sessionId)
    if (!session) return null
    return JSON.stringify(session, null, 2)
  }

  /**
   * Import session data from backup
   *
   * @param jsonData - Session data as JSON string
   * @returns The imported session metadata or null if invalid
   */
  importSession(jsonData: string): SessionMetadata | null {
    try {
      const session = JSON.parse(jsonData) as SessionData

      // Validate required fields
      if (!session.metadata?.id || !session.metadata?.workingDirectory) {
        return null
      }

      // Generate new ID to avoid conflicts
      const newId = generateId()
      session.metadata.id = newId
      session.metadata.createdAt = new Date().toISOString()
      session.metadata.updatedAt = new Date().toISOString()

      this.saveSession(session)
      this.emit('sessionCreated', session.metadata)

      return session.metadata
    } catch (error) {
      console.error('Failed to import session:', error)
      return null
    }
  }
}
