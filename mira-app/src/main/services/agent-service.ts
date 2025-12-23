/**
 * Agent Service
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
 * - 3.8: Support stopping execution mid-stream via abort controller
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
 * @module agent-service
 */

import { EventEmitter } from 'node:events'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'
import { ProviderFactory } from './providers/provider-factory'
import type { ProviderErrorInfo, ContentBlock } from './providers/types'
import { loadContextFiles, combineSystemPrompts } from './context-loader'
import {
  readImageAsBase64,
  buildPromptWithImages,
  type ImageMetadata,
} from './utils/image-handler'
import {
  classifyError as classifyErrorUtil,
  type ErrorInfo,
} from './utils/error-handler'

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

// Re-export ImageMetadata from utils/image-handler
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
 * In-memory session state
 */
interface Session {
  messages: Message[]
  isRunning: boolean
  abortController: AbortController | null
  workingDirectory: string
  model?: string
  sdkSessionId?: string
}

/**
 * Result from starting a conversation
 */
export interface StartResult {
  sessionId: string
  messages: Message[]
  sdkSessionId?: string
}

/**
 * Parameters for sending a message
 */
export interface SendMessageParams {
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
 * Result from sending a message
 */
export interface SendResult {
  message: Message
  sdkSessionId?: string
}

/**
 * Events emitted by the AgentService
 */
export interface AgentServiceEvents {
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

/** Session file extension */
const SESSION_FILE_EXT = '.json'

/** Default system prompt for agent conversations */
const DEFAULT_SYSTEM_PROMPT = `You are an AI assistant helping users build software. You are part of the Mira application,
which is designed to help developers plan, design, and implement software projects autonomously.

Your role is to:
- Help users define their project requirements and specifications
- Ask clarifying questions to better understand their needs
- Suggest technical approaches and architectures
- Guide them through the development process
- Be conversational and helpful
- Write, edit, and modify code files as requested
- Execute commands and tests
- Search and analyze the codebase

When discussing projects, help users think through:
- Core functionality and features
- Technical stack choices
- Data models and architecture
- User experience considerations
- Testing strategies

You have full access to the codebase and can:
- Read files to understand existing code
- Write new files
- Edit existing files
- Run bash commands
- Search for code patterns
- Execute tests and builds`

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique ID
 * Format: timestamp-random for uniqueness and sortability
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Convert ErrorInfo to ProviderErrorInfo for event emission
 */
function toProviderErrorInfo(errorInfo: ErrorInfo): ProviderErrorInfo {
  return {
    type: errorInfo.type,
    message: errorInfo.message,
    isAbort: errorInfo.isAbort,
    retryable: errorInfo.retryable,
    resetTime: errorInfo.resetTimeMs
      ? new Date(Date.now() + errorInfo.resetTimeMs).toISOString()
      : undefined,
    originalError:
      errorInfo.originalError instanceof Error
        ? errorInfo.originalError
        : undefined,
  }
}

// ============================================================================
// Agent Service
// ============================================================================

/**
 * Agent Service
 *
 * Manages AI agent conversations with session persistence,
 * real-time streaming, and image support.
 */
export class AgentService extends EventEmitter {
  /** Base directory for session storage */
  private stateDir: string

  /** Active sessions in memory */
  private sessions: Map<string, Session> = new Map()

  /** Session metadata cache */
  private metadataCache: Map<string, SessionMetadata> = new Map()

  /**
   * Create a new AgentService instance
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
    return path.join(this.stateDir, `${sessionId}${SESSION_FILE_EXT}`)
  }

  // ============================================================================
  // Session CRUD Operations (Requirements 3.1, 7.1, 7.2, 7.4, 7.5)
  // ============================================================================

  /**
   * Create a new session
   *
   * @param name - Session name
   * @param projectPath - Optional project path
   * @param workingDirectory - Working directory for file operations
   * @returns The created session metadata
   */
  createSession(
    name: string,
    projectPath?: string,
    workingDirectory?: string
  ): SessionMetadata {
    const id = generateId()
    const now = new Date().toISOString()
    const cwd = workingDirectory || projectPath || process.cwd()

    const metadata: SessionMetadata = {
      id,
      name,
      projectPath,
      workingDirectory: cwd,
      createdAt: now,
      updatedAt: now,
      archived: false,
      model: DEFAULT_MODEL,
    }

    const sessionData: SessionData = {
      metadata,
      messages: [],
    }

    // Save to disk
    this.saveSessionData(sessionData)

    // Cache metadata
    this.metadataCache.set(id, metadata)

    this.emit('sessionCreated', metadata)

    return metadata
  }

  /**
   * List all sessions
   *
   * @param includeArchived - Whether to include archived sessions
   * @returns Array of session metadata
   */
  listSessions(includeArchived = false): SessionMetadata[] {
    const sessions: SessionMetadata[] = []

    try {
      const files = fs.readdirSync(this.stateDir)

      for (const file of files) {
        if (!file.endsWith(SESSION_FILE_EXT)) continue

        const sessionId = file.replace(SESSION_FILE_EXT, '')
        const sessionData = this.loadSessionData(sessionId)

        if (!sessionData) continue

        // Filter archived sessions unless explicitly included
        if (!includeArchived && sessionData.metadata.archived) {
          continue
        }

        sessions.push(sessionData.metadata)
      }
    } catch (error) {
      console.error('[AgentService] Failed to list sessions:', error)
    }

    // Sort by updatedAt descending
    return sessions.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  }

  /**
   * Delete a session
   *
   * @param sessionId - The session ID
   * @returns true if deleted, false if not found
   */
  deleteSession(sessionId: string): boolean {
    const sessionPath = this.getSessionPath(sessionId)

    // Remove from memory
    this.sessions.delete(sessionId)
    this.metadataCache.delete(sessionId)

    // Delete file
    if (fs.existsSync(sessionPath)) {
      try {
        fs.unlinkSync(sessionPath)
        this.emit('sessionDeleted', sessionId)
        return true
      } catch (error) {
        console.error(
          `[AgentService] Failed to delete session ${sessionId}:`,
          error
        )
        return false
      }
    }

    return false
  }

  /**
   * Archive a session
   *
   * @param sessionId - The session ID
   * @returns true if archived, false if not found
   */
  archiveSession(sessionId: string): boolean {
    const sessionData = this.loadSessionData(sessionId)
    if (!sessionData) return false

    sessionData.metadata.archived = true
    sessionData.metadata.updatedAt = new Date().toISOString()

    this.saveSessionData(sessionData)
    this.metadataCache.set(sessionId, sessionData.metadata)

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
    const sessionData = this.loadSessionData(sessionId)
    if (!sessionData) return false

    sessionData.metadata.archived = false
    sessionData.metadata.updatedAt = new Date().toISOString()

    this.saveSessionData(sessionData)
    this.metadataCache.set(sessionId, sessionData.metadata)

    this.emit('sessionUpdated', sessionData.metadata)

    return true
  }

  /**
   * Get session metadata
   *
   * @param sessionId - The session ID
   * @returns Session metadata or null if not found
   */
  getSessionMetadata(sessionId: string): SessionMetadata | null {
    // Check cache first
    if (this.metadataCache.has(sessionId)) {
      return this.metadataCache.get(sessionId) || null
    }

    // Load from disk
    const sessionData = this.loadSessionData(sessionId)
    if (sessionData) {
      this.metadataCache.set(sessionId, sessionData.metadata)
      return sessionData.metadata
    }

    return null
  }

  // ============================================================================
  // Session Persistence (Requirements 3.2, 3.6, 7.1, 7.3)
  // ============================================================================

  /**
   * Load session data from disk
   */
  private loadSessionData(sessionId: string): SessionData | null {
    const sessionPath = this.getSessionPath(sessionId)

    if (!fs.existsSync(sessionPath)) {
      return null
    }

    try {
      const data = fs.readFileSync(sessionPath, 'utf-8')
      return JSON.parse(data) as SessionData
    } catch (error) {
      console.error(
        `[AgentService] Failed to load session ${sessionId}:`,
        error
      )
      return null
    }
  }

  /**
   * Save session data to disk
   */
  private saveSessionData(sessionData: SessionData): void {
    const sessionPath = this.getSessionPath(sessionData.metadata.id)

    try {
      fs.writeFileSync(
        sessionPath,
        JSON.stringify(sessionData, null, 2),
        'utf-8'
      )
    } catch (error) {
      console.error(
        `[AgentService] Failed to save session ${sessionData.metadata.id}:`,
        error
      )
      throw error
    }
  }

  /**
   * Update session metadata
   */
  private updateSessionMetadata(
    sessionId: string,
    updates: Partial<SessionMetadata>
  ): SessionMetadata | null {
    const sessionData = this.loadSessionData(sessionId)
    if (!sessionData) return null

    // Apply updates
    Object.assign(sessionData.metadata, updates)
    sessionData.metadata.updatedAt = new Date().toISOString()

    this.saveSessionData(sessionData)
    this.metadataCache.set(sessionId, sessionData.metadata)

    this.emit('sessionUpdated', sessionData.metadata)

    return sessionData.metadata
  }

  // ============================================================================
  // Conversation Operations (Requirements 3.3, 3.4, 3.5, 3.6, 7.3)
  // ============================================================================

  /**
   * Start or resume a conversation
   *
   * @param sessionId - The session ID
   * @param workingDirectory - Working directory for file operations
   * @returns Start result with session info and messages
   */
  async startConversation(
    sessionId: string,
    workingDirectory: string
  ): Promise<StartResult> {
    const sessionData = this.loadSessionData(sessionId)

    if (!sessionData) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    // Initialize in-memory session
    const session: Session = {
      messages: sessionData.messages,
      isRunning: false,
      abortController: null,
      workingDirectory,
      model: sessionData.metadata.model,
      sdkSessionId: sessionData.metadata.sdkSessionId,
    }

    this.sessions.set(sessionId, session)

    return {
      sessionId,
      messages: session.messages,
      sdkSessionId: session.sdkSessionId,
    }
  }

  /**
   * Send a message and stream the response
   *
   * @param params - Send message parameters
   * @returns The assistant's response message
   */
  async sendMessage(params: SendMessageParams): Promise<SendResult> {
    const {
      sessionId,
      message,
      imagePaths,
      model,
      systemPrompt,
      allowedTools,
    } = params

    // Get or load session
    let session = this.sessions.get(sessionId)
    if (!session) {
      const sessionData = this.loadSessionData(sessionId)
      if (!sessionData) {
        throw new Error(`Session not found: ${sessionId}`)
      }

      session = {
        messages: sessionData.messages,
        isRunning: false,
        abortController: null,
        workingDirectory: sessionData.metadata.workingDirectory,
        model: sessionData.metadata.model,
        sdkSessionId: sessionData.metadata.sdkSessionId,
      }
      this.sessions.set(sessionId, session)
    }

    // Read and encode images (Requirements 8.1, 8.2, 8.3)
    const images: ImageMetadata[] = []
    if (imagePaths && imagePaths.length > 0) {
      for (const imagePath of imagePaths) {
        const imageData = readImageAsBase64(imagePath)
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
    session.messages.push(userMessage)
    this.persistSession(sessionId)

    // Get provider for the model
    const modelToUse = model || session.model || DEFAULT_MODEL
    const provider = ProviderFactory.getProviderForModel(modelToUse)

    // Create abort controller (Requirement 3.8)
    const abortController = new AbortController()
    session.abortController = abortController
    session.isRunning = true

    // Build prompt with images if present (Requirement 8.4)
    const prompt: string | ContentBlock[] =
      images.length > 0 ? buildPromptWithImages(message, images) : message

    // Build conversation history for context
    const conversationHistory = session.messages
      .filter(m => !m.isError)
      .slice(-20) // Last 20 messages for context
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

    try {
      // Load project context files
      const { formattedPrompt: contextFilesPrompt } = await loadContextFiles({
        projectPath: session.workingDirectory,
      })

      // Combine context prompt with default system prompt and any caller-provided system prompt
      // Order: context files -> default system prompt -> caller system prompt
      const combinedSystemPrompt = combineSystemPrompts(
        contextFilesPrompt || undefined,
        DEFAULT_SYSTEM_PROMPT,
        systemPrompt
      )

      // Execute query with streaming (Requirements 3.4, 3.5)
      const stream = provider.executeQuery({
        prompt,
        model: modelToUse,
        cwd: session.workingDirectory,
        systemPrompt: combinedSystemPrompt,
        allowedTools,
        abortController,
        conversationHistory,
        sdkSessionId: session.sdkSessionId,
      })

      let assistantContent = ''
      const toolUses: Message['toolUses'] = []
      let sdkSessionId: string | undefined

      // Process stream
      for await (const msg of stream) {
        // Capture session ID for continuity (Requirement 7.3)
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
        session.sdkSessionId = sdkSessionId
        this.updateSessionMetadata(sessionId, { sdkSessionId })
      }

      // Create assistant message
      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date().toISOString(),
        toolUses: toolUses.length > 0 ? toolUses : undefined,
      }

      // Add assistant message to history and persist (Requirement 3.6)
      session.messages.push(assistantMessage)
      this.persistSession(sessionId)

      this.emit('message', sessionId, assistantMessage)
      this.emit('complete', sessionId, assistantContent)

      return {
        message: assistantMessage,
        sdkSessionId,
      }
    } catch (error) {
      // Classify and handle error (Requirements 3.7, 10.2, 10.3)
      const errorInfo = classifyErrorUtil(error)
      const providerErrorInfo = toProviderErrorInfo(errorInfo)

      // Don't add error message for aborts (Requirement 10.2)
      if (!errorInfo.isAbort) {
        const errorMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content: `Error: ${errorInfo.message}`,
          timestamp: new Date().toISOString(),
          isError: true,
        }

        session.messages.push(errorMessage)
        this.persistSession(sessionId)
        this.emit('error', sessionId, providerErrorInfo)

        return {
          message: errorMessage,
          sdkSessionId: session.sdkSessionId,
        }
      }

      // For aborts, emit error but don't add to history
      this.emit('error', sessionId, providerErrorInfo)
      throw error
    } finally {
      // Clean up
      session.abortController = null
      session.isRunning = false
    }
  }

  /**
   * Stop execution for a session (Requirement 3.8)
   *
   * @param sessionId - The session ID
   * @returns true if stopped, false if no active execution
   */
  stopExecution(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (session?.abortController) {
      session.abortController.abort()
      session.abortController = null
      session.isRunning = false
      return true
    }
    return false
  }

  /**
   * Clear all messages in a session
   *
   * @param sessionId - The session ID
   * @returns true if cleared, false if session not found
   */
  clearSession(sessionId: string): boolean {
    const sessionData = this.loadSessionData(sessionId)
    if (!sessionData) return false

    sessionData.messages = []
    sessionData.metadata.sdkSessionId = undefined
    sessionData.metadata.updatedAt = new Date().toISOString()

    this.saveSessionData(sessionData)

    // Update in-memory session if exists
    const session = this.sessions.get(sessionId)
    if (session) {
      session.messages = []
      session.sdkSessionId = undefined
    }

    return true
  }

  /**
   * Get messages for a session
   *
   * @param sessionId - The session ID
   * @returns Array of messages or empty array if session not found
   */
  getMessages(sessionId: string): Message[] {
    // Check in-memory first
    const session = this.sessions.get(sessionId)
    if (session) {
      return [...session.messages]
    }

    // Load from disk
    const sessionData = this.loadSessionData(sessionId)
    return sessionData?.messages || []
  }

  /**
   * Check if a session has an active execution
   *
   * @param sessionId - The session ID
   * @returns true if executing
   */
  isExecuting(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    return session?.isRunning || false
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Persist session to disk
   */
  private persistSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    const sessionData = this.loadSessionData(sessionId)
    if (!sessionData) return

    sessionData.messages = session.messages
    sessionData.metadata.sdkSessionId = session.sdkSessionId
    sessionData.metadata.updatedAt = new Date().toISOString()

    this.saveSessionData(sessionData)
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
  getSessionCount(includeArchived = false): number {
    return this.listSessions(includeArchived).length
  }

  /**
   * Export session data for backup
   *
   * @param sessionId - The session ID
   * @returns Session data as JSON string or null if not found
   */
  exportSession(sessionId: string): string | null {
    const sessionData = this.loadSessionData(sessionId)
    if (!sessionData) return null
    return JSON.stringify(sessionData, null, 2)
  }

  /**
   * Import session data from backup
   *
   * @param jsonData - Session data as JSON string
   * @returns The imported session metadata or null if invalid
   */
  importSession(jsonData: string): SessionMetadata | null {
    try {
      const sessionData = JSON.parse(jsonData) as SessionData

      // Validate required fields
      if (
        !sessionData.metadata?.id ||
        !sessionData.metadata?.workingDirectory
      ) {
        return null
      }

      // Generate new ID to avoid conflicts
      const newId = generateId()
      sessionData.metadata.id = newId
      sessionData.metadata.createdAt = new Date().toISOString()
      sessionData.metadata.updatedAt = new Date().toISOString()

      this.saveSessionData(sessionData)
      this.emit('sessionCreated', sessionData.metadata)

      return sessionData.metadata
    } catch (error) {
      console.error('[AgentService] Failed to import session:', error)
      return null
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/** Default agent service instance */
let agentServiceInstance: AgentService | null = null

/**
 * Get the singleton agent service instance
 */
export function getAgentService(): AgentService {
  if (!agentServiceInstance) {
    agentServiceInstance = new AgentService()
  }
  return agentServiceInstance
}

/**
 * Create a new agent service instance (for testing)
 */
export function createAgentService(stateDir?: string): AgentService {
  return new AgentService(stateDir)
}
