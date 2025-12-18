/**
 * Output Buffer Service
 *
 * Buffers and persists agent output with timestamp tracking.
 * Provides real-time log capture for agent task execution.
 *
 * Implements Requirements:
 * - 9.1: Store output logs with timestamps in a persistent buffer
 * - 9.3: Append new output to display within 100 milliseconds
 * - 9.4: Preserve ANSI escape codes for formatting
 *
 * @module output-buffer
 */

import { EventEmitter } from 'node:events'
import type { OutputLine, OutputStreamType, CreateOutputLineInput } from 'shared/ai-types'
import type { DatabaseService } from '../database'

/**
 * Interface for the Output Buffer service
 */
export interface IOutputBuffer {
  /**
   * Append a line of output to the buffer
   * @param taskId - The task ID
   * @param content - The output content
   * @param stream - The stream type (stdout or stderr)
   * @returns The created output line
   */
  append(taskId: string, content: string, stream: OutputStreamType): OutputLine

  /**
   * Get output lines for a task
   * @param taskId - The task ID
   * @param fromIndex - Optional starting index for pagination
   * @returns Array of output lines
   */
  getLines(taskId: string, fromIndex?: number): OutputLine[]

  /**
   * Get the count of output lines for a task
   * @param taskId - The task ID
   * @returns The number of output lines
   */
  getLineCount(taskId: string): number

  /**
   * Clear all output for a task
   * @param taskId - The task ID
   */
  clear(taskId: string): void

  /**
   * Persist buffered output to database
   * @param taskId - The task ID
   */
  persist(taskId: string): Promise<void>

  /**
   * Load output from database into buffer
   * @param taskId - The task ID
   * @returns Array of output lines
   */
  load(taskId: string): Promise<OutputLine[]>

  /**
   * Subscribe to output updates for a task
   * @param taskId - The task ID
   * @param callback - Callback function for new output
   * @returns Unsubscribe function
   */
  subscribe(taskId: string, callback: OutputCallback): () => void
}

/**
 * Callback type for output subscriptions
 */
export type OutputCallback = (line: OutputLine) => void

/**
 * Events emitted by the OutputBuffer
 */
export interface OutputBufferEvents {
  /** Emitted when a new line is appended */
  lineAppended: (taskId: string, line: OutputLine) => void
  /** Emitted when output is cleared */
  cleared: (taskId: string) => void
  /** Emitted when output is persisted */
  persisted: (taskId: string) => void
  /** Emitted when output is loaded */
  loaded: (taskId: string, lines: OutputLine[]) => void
}

/**
 * Internal buffer entry for a task
 */
interface TaskBuffer {
  /** In-memory output lines */
  lines: OutputLine[]
  /** Subscribers for this task */
  subscribers: Set<OutputCallback>
  /** Whether buffer has unpersisted changes */
  dirty: boolean
  /** Last persisted index */
  lastPersistedIndex: number
}

/**
 * Output Buffer Service
 *
 * Manages buffering and persistence of agent output.
 * Provides real-time streaming to subscribers and database persistence.
 */
export class OutputBuffer extends EventEmitter implements IOutputBuffer {
  /** In-memory buffers per task */
  private buffers: Map<string, TaskBuffer> = new Map()

  /** Database service for persistence */
  private db: DatabaseService | null = null

  /**
   * Create a new OutputBuffer instance
   * @param db - Optional database service for persistence
   */
  constructor(db?: DatabaseService) {
    super()
    this.db = db ?? null
  }

  /**
   * Set the database service for persistence
   * @param db - The database service
   */
  setDatabase(db: DatabaseService): void {
    this.db = db
  }

  /**
   * Get or create a buffer for a task
   * @param taskId - The task ID
   * @returns The task buffer
   */
  private getOrCreateBuffer(taskId: string): TaskBuffer {
    let buffer = this.buffers.get(taskId)
    if (!buffer) {
      buffer = {
        lines: [],
        subscribers: new Set(),
        dirty: false,
        lastPersistedIndex: -1,
      }
      this.buffers.set(taskId, buffer)
    }
    return buffer
  }

  /**
   * Append a line of output to the buffer
   *
   * Creates an OutputLine with the current timestamp and appends it
   * to the in-memory buffer. Notifies all subscribers immediately.
   * ANSI escape codes in content are preserved without modification.
   *
   * @param taskId - The task ID
   * @param content - The output content (ANSI codes preserved)
   * @param stream - The stream type (stdout or stderr)
   * @returns The created output line
   */
  append(taskId: string, content: string, stream: OutputStreamType): OutputLine {
    const buffer = this.getOrCreateBuffer(taskId)
    const timestamp = new Date()

    const line: OutputLine = {
      taskId,
      timestamp,
      content, // ANSI codes are preserved as-is
      stream,
    }

    buffer.lines.push(line)
    buffer.dirty = true

    // Notify subscribers immediately
    for (const callback of buffer.subscribers) {
      try {
        callback(line)
      } catch (error) {
        // Don't let subscriber errors affect other subscribers
        console.error('Output subscriber error:', error)
      }
    }

    this.emit('lineAppended', taskId, line)

    return line
  }

  /**
   * Get output lines for a task
   *
   * Returns lines from the in-memory buffer. If fromIndex is provided,
   * returns only lines after that index.
   *
   * @param taskId - The task ID
   * @param fromIndex - Optional starting index for pagination
   * @returns Array of output lines (copy)
   */
  getLines(taskId: string, fromIndex?: number): OutputLine[] {
    const buffer = this.buffers.get(taskId)
    if (!buffer) {
      return []
    }

    if (fromIndex !== undefined && fromIndex >= 0) {
      return buffer.lines.slice(fromIndex)
    }

    return [...buffer.lines]
  }

  /**
   * Get the count of output lines for a task
   *
   * @param taskId - The task ID
   * @returns The number of output lines
   */
  getLineCount(taskId: string): number {
    const buffer = this.buffers.get(taskId)
    return buffer?.lines.length ?? 0
  }

  /**
   * Clear all output for a task
   *
   * Removes all in-memory output and optionally clears from database.
   *
   * @param taskId - The task ID
   */
  clear(taskId: string): void {
    const buffer = this.buffers.get(taskId)
    if (buffer) {
      buffer.lines = []
      buffer.dirty = false
      buffer.lastPersistedIndex = -1
    }

    // Clear from database if available
    if (this.db) {
      this.db.clearTaskOutput(taskId)
    }

    this.emit('cleared', taskId)
  }

  /**
   * Persist buffered output to database
   *
   * Saves all unpersisted lines to the database. Only persists
   * lines that haven't been saved yet.
   *
   * @param taskId - The task ID
   */
  async persist(taskId: string): Promise<void> {
    if (!this.db) {
      return
    }

    const buffer = this.buffers.get(taskId)
    if (!buffer || !buffer.dirty) {
      return
    }

    // Persist only new lines
    const startIndex = buffer.lastPersistedIndex + 1
    const linesToPersist = buffer.lines.slice(startIndex)

    for (const line of linesToPersist) {
      const input: CreateOutputLineInput = {
        taskId: line.taskId,
        content: line.content,
        stream: line.stream,
      }
      const persisted = this.db.createTaskOutput(input)
      // Update the line with the database ID
      line.id = persisted.id
    }

    buffer.lastPersistedIndex = buffer.lines.length - 1
    buffer.dirty = false

    this.emit('persisted', taskId)
  }

  /**
   * Load output from database into buffer
   *
   * Loads all persisted output for a task into the in-memory buffer.
   * Clears any existing in-memory data first.
   *
   * @param taskId - The task ID
   * @returns Array of output lines
   */
  async load(taskId: string): Promise<OutputLine[]> {
    if (!this.db) {
      return []
    }

    const lines = this.db.getTaskOutput(taskId)
    const buffer = this.getOrCreateBuffer(taskId)

    buffer.lines = lines
    buffer.dirty = false
    buffer.lastPersistedIndex = lines.length - 1

    this.emit('loaded', taskId, lines)

    return lines
  }

  /**
   * Subscribe to output updates for a task
   *
   * The callback will be invoked immediately for each new line
   * appended to the buffer.
   *
   * @param taskId - The task ID
   * @param callback - Callback function for new output
   * @returns Unsubscribe function
   */
  subscribe(taskId: string, callback: OutputCallback): () => void {
    const buffer = this.getOrCreateBuffer(taskId)
    buffer.subscribers.add(callback)

    // Return unsubscribe function
    return () => {
      buffer.subscribers.delete(callback)
    }
  }

  /**
   * Get the number of subscribers for a task
   *
   * @param taskId - The task ID
   * @returns The number of subscribers
   */
  getSubscriberCount(taskId: string): number {
    const buffer = this.buffers.get(taskId)
    return buffer?.subscribers.size ?? 0
  }

  /**
   * Check if a task has unpersisted changes
   *
   * @param taskId - The task ID
   * @returns True if there are unpersisted changes
   */
  isDirty(taskId: string): boolean {
    const buffer = this.buffers.get(taskId)
    return buffer?.dirty ?? false
  }

  /**
   * Remove a task buffer from memory
   *
   * Does not clear from database. Use clear() to remove from both.
   *
   * @param taskId - The task ID
   */
  removeBuffer(taskId: string): void {
    this.buffers.delete(taskId)
  }

  /**
   * Get all task IDs with active buffers
   *
   * @returns Array of task IDs
   */
  getActiveTaskIds(): string[] {
    return Array.from(this.buffers.keys())
  }

  /**
   * Persist all dirty buffers
   *
   * Useful for shutdown or periodic persistence.
   */
  async persistAll(): Promise<void> {
    const promises: Promise<void>[] = []

    for (const taskId of this.buffers.keys()) {
      promises.push(this.persist(taskId))
    }

    await Promise.all(promises)
  }
}
