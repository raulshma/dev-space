/**
 * Output Buffer Service
 *
 * A unified output buffer that captures and streams agent output in real-time.
 * Supports multiple sessions/tasks with subscription-based updates and
 * persistence to database.
 *
 * @module output-buffer
 */

import { EventEmitter } from 'node:events'
import type { DatabaseService } from './database'
import type {
  OutputLine,
  OutputStreamType,
  CreateOutputLineInput,
} from '../../shared/ai-types'

/**
 * Extended output line with optional metadata
 */
export interface OutputLineWithMetadata extends OutputLine {
  metadata?: Record<string, unknown>
}

/**
 * Callback type for output subscriptions
 */
export type OutputCallback = (line: OutputLineWithMetadata) => void

/**
 * Internal buffer entry for a session/task
 */
interface BufferEntry {
  lines: OutputLineWithMetadata[]
  subscribers: Set<OutputCallback>
  dirty: boolean
  lastPersistedIndex: number
}

/**
 * Output Buffer Service
 *
 * Manages buffering and persistence of agent output.
 * Uses a generic ID-based approach (works with taskId or sessionId).
 *
 * Events emitted:
 * - 'outputReceived' (id: string, line: OutputLineWithMetadata) - When new output is appended
 * - 'cleared' (id: string) - When buffer is cleared
 * - 'persisted' (id: string) - When buffer is persisted to database
 * - 'loaded' (id: string, lines: OutputLineWithMetadata[]) - When buffer is loaded from database
 */
export class OutputBuffer extends EventEmitter {
  private buffers: Map<string, BufferEntry> = new Map()
  private db: DatabaseService | null = null

  constructor(db?: DatabaseService) {
    super()
    this.db = db ?? null
  }

  /**
   * Set the database service for persistence
   */
  setDatabase(db: DatabaseService): void {
    this.db = db
  }

  /**
   * Get or create a buffer entry for an ID
   */
  private getOrCreateBuffer(id: string): BufferEntry {
    let buffer = this.buffers.get(id)
    if (!buffer) {
      buffer = {
        lines: [],
        subscribers: new Set(),
        dirty: false,
        lastPersistedIndex: -1,
      }
      this.buffers.set(id, buffer)
    }
    return buffer
  }

  /**
   * Append a line of output to the buffer.
   * ANSI escape codes are preserved for terminal rendering.
   *
   * Emits 'outputReceived' event within 100ms as per requirement 6.2.
   *
   * @param id - Session or task ID
   * @param content - Output content (may include ANSI codes)
   * @param stream - Output stream type ('stdout' or 'stderr')
   * @param metadata - Optional metadata to attach to the line
   * @returns The created output line
   */
  append(
    id: string,
    content: string,
    stream: OutputStreamType,
    metadata?: Record<string, unknown>
  ): OutputLineWithMetadata {
    const buffer = this.getOrCreateBuffer(id)

    const line: OutputLineWithMetadata = {
      taskId: id,
      timestamp: new Date(),
      content,
      stream,
      ...(metadata && { metadata }),
    }

    buffer.lines.push(line)
    buffer.dirty = true

    // Notify subscribers immediately (within 100ms requirement)
    for (const callback of buffer.subscribers) {
      try {
        callback(line)
      } catch (error) {
        console.error('[OutputBuffer] Subscriber error:', error)
      }
    }

    // Emit event for external listeners
    this.emit('outputReceived', id, line)

    return line
  }

  /**
   * Get output lines for a session/task
   *
   * @param id - Session or task ID
   * @param fromIndex - Optional starting index for pagination
   * @returns Array of output lines
   */
  getLines(id: string, fromIndex?: number): OutputLineWithMetadata[] {
    const buffer = this.buffers.get(id)
    if (!buffer) return []

    if (fromIndex !== undefined && fromIndex >= 0) {
      return buffer.lines.slice(fromIndex)
    }
    return [...buffer.lines]
  }

  /**
   * Get the count of output lines for a session/task
   */
  getLineCount(id: string): number {
    return this.buffers.get(id)?.lines.length ?? 0
  }

  /**
   * Clear all output for a session/task
   *
   * @param id - Session or task ID
   */
  clear(id: string): void {
    const buffer = this.buffers.get(id)
    if (buffer) {
      buffer.lines = []
      buffer.dirty = false
      buffer.lastPersistedIndex = -1
    }

    // Also clear from database if available
    if (this.db) {
      this.db.clearTaskOutput(id)
    }

    this.emit('cleared', id)
  }

  /**
   * Subscribe to output updates for a specific session/task
   *
   * @param id - Session or task ID
   * @param callback - Function to call when new output is received
   * @returns Unsubscribe function
   */
  subscribe(id: string, callback: OutputCallback): () => void {
    const buffer = this.getOrCreateBuffer(id)
    buffer.subscribers.add(callback)

    // Return unsubscribe function
    return () => {
      buffer.subscribers.delete(callback)
    }
  }

  /**
   * Get the number of active subscribers for a session/task
   */
  getSubscriberCount(id: string): number {
    return this.buffers.get(id)?.subscribers.size ?? 0
  }

  /**
   * Check if buffer has unpersisted changes
   */
  isDirty(id: string): boolean {
    return this.buffers.get(id)?.dirty ?? false
  }

  /**
   * Persist buffered output to database
   *
   * Only persists lines that haven't been persisted yet (incremental).
   *
   * @param id - Session or task ID
   */
  async persist(id: string): Promise<void> {
    if (!this.db) return

    const buffer = this.buffers.get(id)
    if (!buffer || !buffer.dirty) return

    const startIndex = buffer.lastPersistedIndex + 1
    const linesToPersist = buffer.lines.slice(startIndex)

    for (const line of linesToPersist) {
      const input: CreateOutputLineInput = {
        taskId: line.taskId,
        content: line.content,
        stream: line.stream,
      }
      const persisted = this.db.createTaskOutput(input)
      line.id = persisted.id
    }

    buffer.lastPersistedIndex = buffer.lines.length - 1
    buffer.dirty = false

    this.emit('persisted', id)
  }

  /**
   * Load output from database into buffer
   *
   * @param id - Session or task ID
   * @returns Array of loaded output lines
   */
  async load(id: string): Promise<OutputLineWithMetadata[]> {
    if (!this.db) return []

    const lines = this.db.getTaskOutput(id) as OutputLineWithMetadata[]
    const buffer = this.getOrCreateBuffer(id)

    buffer.lines = lines
    buffer.dirty = false
    buffer.lastPersistedIndex = lines.length - 1

    this.emit('loaded', id, lines)

    return lines
  }

  /**
   * Remove a buffer from memory (does not affect database)
   */
  removeBuffer(id: string): void {
    this.buffers.delete(id)
  }

  /**
   * Get all active buffer IDs
   */
  getActiveIds(): string[] {
    return Array.from(this.buffers.keys())
  }

  /**
   * Persist all dirty buffers to database
   */
  async persistAll(): Promise<void> {
    await Promise.all(
      Array.from(this.buffers.keys()).map(id => this.persist(id))
    )
  }

  /**
   * Get full content as a single string
   *
   * @param id - Session or task ID
   * @param separator - Line separator (default: newline)
   * @returns Concatenated output content
   */
  getFullContent(id: string, separator = '\n'): string {
    const buffer = this.buffers.get(id)
    if (!buffer) return ''
    return buffer.lines.map(line => line.content).join(separator)
  }

  /**
   * Append multiple lines at once
   *
   * @param id - Session or task ID
   * @param lines - Array of line data to append
   * @returns Array of created output lines
   */
  appendBatch(
    id: string,
    lines: Array<{
      content: string
      stream: OutputStreamType
      metadata?: Record<string, unknown>
    }>
  ): OutputLineWithMetadata[] {
    return lines.map(({ content, stream, metadata }) =>
      this.append(id, content, stream, metadata)
    )
  }
}

// Re-export types for convenience
export type { OutputStreamType, OutputLine } from '../../shared/ai-types'
