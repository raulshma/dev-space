/**
 * Session Service
 *
 * Manages agent conversation sessions with persistence, including CRUD operations
 * for sessions and messages, and tracking the last selected session per project.
 *
 * Implements Requirements:
 * - 6.1: Persist session metadata to the database
 * - 6.2: Restore all previous sessions for each project on restart
 * - 6.3: Load conversation history from persistent storage
 * - 6.4: Persist messages and responses to storage
 * - 6.7: Display session name, last updated time, and selected model
 * - 6.8: Archive sessions (hide from default view but preserve)
 * - 6.9: Delete sessions and all associated data
 * - 6.10: Remember last selected session per project
 *
 * @module session-service
 */

import { EventEmitter } from 'node:events'
import type { DatabaseService } from './database'

/**
 * Represents an agent conversation session
 */
export interface AgentSession {
  id: string
  projectPath: string
  name: string
  modelId: string
  createdAt: Date
  updatedAt: Date
  isArchived: boolean
  messageCount: number
}

/**
 * Represents a message in a session
 */
export interface SessionMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

/**
 * Events emitted by the SessionService
 */
export interface SessionServiceEvents {
  /** Emitted when a session is created */
  sessionCreated: (session: AgentSession) => void
  /** Emitted when a session is updated */
  sessionUpdated: (session: AgentSession) => void
  /** Emitted when a session is archived */
  sessionArchived: (sessionId: string) => void
  /** Emitted when a session is deleted */
  sessionDeleted: (sessionId: string) => void
  /** Emitted when a message is added to a session */
  messageAdded: (message: SessionMessage) => void
}

/**
 * Interface for the Session Service
 */
export interface ISessionService {
  /**
   * Create a new session
   * @param projectPath - The project path for the session
   * @param name - The session name
   * @param modelId - The AI model ID for the session
   * @returns The created session
   */
  createSession(
    projectPath: string,
    name: string,
    modelId: string
  ): Promise<AgentSession>

  /**
   * Get a session by ID
   * @param sessionId - The session ID
   * @returns The session or null if not found
   */
  getSession(sessionId: string): AgentSession | null

  /**
   * Get all sessions for a project
   * @param projectPath - The project path
   * @param includeArchived - Whether to include archived sessions
   * @returns Array of sessions
   */
  getSessions(projectPath: string, includeArchived?: boolean): AgentSession[]

  /**
   * Update a session
   * @param sessionId - The session ID
   * @param updates - The fields to update
   * @returns The updated session
   */
  updateSession(
    sessionId: string,
    updates: Partial<Pick<AgentSession, 'name' | 'modelId'>>
  ): Promise<AgentSession>

  /**
   * Archive a session (hide from default view but preserve)
   * @param sessionId - The session ID
   */
  archiveSession(sessionId: string): Promise<void>

  /**
   * Delete a session and all associated messages
   * @param sessionId - The session ID
   */
  deleteSession(sessionId: string): Promise<void>

  /**
   * Add a message to a session
   * @param sessionId - The session ID
   * @param role - The message role
   * @param content - The message content
   * @returns The created message
   */
  addMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<SessionMessage>

  /**
   * Get all messages for a session
   * @param sessionId - The session ID
   * @returns Array of messages ordered by timestamp
   */
  getMessages(sessionId: string): SessionMessage[]

  /**
   * Get the last selected session ID for a project
   * @param projectPath - The project path
   * @returns The last session ID or null
   */
  getLastSessionId(projectPath: string): string | null

  /**
   * Set the last selected session ID for a project
   * @param projectPath - The project path
   * @param sessionId - The session ID
   */
  setLastSessionId(projectPath: string, sessionId: string): void
}

/**
 * Session Service
 *
 * Manages agent conversation sessions with full CRUD operations,
 * message persistence, and last session tracking per project.
 */
export class SessionService extends EventEmitter implements ISessionService {
  private db: DatabaseService

  /**
   * Create a new SessionService instance
   * @param db - The database service for persistence
   */
  constructor(db: DatabaseService) {
    super()
    this.db = db
  }

  /**
   * Create a new session
   *
   * @param projectPath - The project path for the session
   * @param name - The session name
   * @param modelId - The AI model ID for the session
   * @returns The created session
   * @throws Error if projectPath, name, or modelId is empty
   */
  async createSession(
    projectPath: string,
    name: string,
    modelId: string
  ): Promise<AgentSession> {
    if (!projectPath || projectPath.trim() === '') {
      throw new Error('Project path cannot be empty')
    }

    if (!name || name.trim() === '') {
      throw new Error('Session name cannot be empty')
    }

    if (!modelId || modelId.trim() === '') {
      throw new Error('Model ID cannot be empty')
    }

    const session = this.db.createAgentSession(
      projectPath.trim(),
      name.trim(),
      modelId.trim()
    )

    this.emit('sessionCreated', session)

    return session
  }

  /**
   * Get a session by ID
   *
   * @param sessionId - The session ID
   * @returns The session or null if not found
   */
  getSession(sessionId: string): AgentSession | null {
    if (!sessionId || sessionId.trim() === '') {
      return null
    }

    return this.db.getAgentSession(sessionId)
  }

  /**
   * Get all sessions for a project
   *
   * @param projectPath - The project path
   * @param includeArchived - Whether to include archived sessions (default: false)
   * @returns Array of sessions ordered by updated_at descending
   */
  getSessions(projectPath: string, includeArchived = false): AgentSession[] {
    if (!projectPath || projectPath.trim() === '') {
      return []
    }

    return this.db.getAgentSessions(projectPath, includeArchived)
  }

  /**
   * Update a session
   *
   * @param sessionId - The session ID
   * @param updates - The fields to update (name and/or modelId)
   * @returns The updated session
   * @throws Error if session not found
   */
  async updateSession(
    sessionId: string,
    updates: Partial<Pick<AgentSession, 'name' | 'modelId'>>
  ): Promise<AgentSession> {
    if (!sessionId || sessionId.trim() === '') {
      throw new Error('Session ID cannot be empty')
    }

    const existingSession = this.db.getAgentSession(sessionId)
    if (!existingSession) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    const updatedSession = this.db.updateAgentSession(sessionId, updates)

    if (!updatedSession) {
      throw new Error(`Failed to update session: ${sessionId}`)
    }

    this.emit('sessionUpdated', updatedSession)

    return updatedSession
  }

  /**
   * Archive a session
   *
   * Archives a session so it's hidden from the default view but preserved
   * for later access.
   *
   * @param sessionId - The session ID
   * @throws Error if session not found
   */
  async archiveSession(sessionId: string): Promise<void> {
    if (!sessionId || sessionId.trim() === '') {
      throw new Error('Session ID cannot be empty')
    }

    const existingSession = this.db.getAgentSession(sessionId)
    if (!existingSession) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    this.db.archiveAgentSession(sessionId)

    this.emit('sessionArchived', sessionId)
  }

  /**
   * Delete a session and all associated messages
   *
   * Permanently removes the session and all its messages from storage.
   * Messages are cascade deleted via foreign key constraint.
   *
   * @param sessionId - The session ID
   */
  async deleteSession(sessionId: string): Promise<void> {
    if (!sessionId || sessionId.trim() === '') {
      return
    }

    // Check if this was the last session for any project
    const session = this.db.getAgentSession(sessionId)
    if (session) {
      const lastSessionId = this.db.getLastSessionId(session.projectPath)
      if (lastSessionId === sessionId) {
        // Clear the last session reference
        this.db.setLastSessionId(session.projectPath, null)
      }
    }

    this.db.deleteAgentSession(sessionId)

    this.emit('sessionDeleted', sessionId)
  }

  /**
   * Add a message to a session
   *
   * @param sessionId - The session ID
   * @param role - The message role ('user' or 'assistant')
   * @param content - The message content
   * @returns The created message
   * @throws Error if session not found or content is empty
   */
  async addMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<SessionMessage> {
    if (!sessionId || sessionId.trim() === '') {
      throw new Error('Session ID cannot be empty')
    }

    if (!content || content.trim() === '') {
      throw new Error('Message content cannot be empty')
    }

    const session = this.db.getAgentSession(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    const message = this.db.addSessionMessage(sessionId, role, content)

    this.emit('messageAdded', message)

    return message
  }

  /**
   * Get all messages for a session
   *
   * @param sessionId - The session ID
   * @returns Array of messages ordered by timestamp ascending
   */
  getMessages(sessionId: string): SessionMessage[] {
    if (!sessionId || sessionId.trim() === '') {
      return []
    }

    return this.db.getSessionMessages(sessionId)
  }

  /**
   * Get the last selected session ID for a project
   *
   * @param projectPath - The project path
   * @returns The last session ID or null if none selected
   */
  getLastSessionId(projectPath: string): string | null {
    if (!projectPath || projectPath.trim() === '') {
      return null
    }

    return this.db.getLastSessionId(projectPath)
  }

  /**
   * Set the last selected session ID for a project
   *
   * @param projectPath - The project path
   * @param sessionId - The session ID to set as last selected
   */
  setLastSessionId(projectPath: string, sessionId: string): void {
    if (!projectPath || projectPath.trim() === '') {
      return
    }

    if (!sessionId || sessionId.trim() === '') {
      return
    }

    this.db.setLastSessionId(projectPath, sessionId)
  }
}
