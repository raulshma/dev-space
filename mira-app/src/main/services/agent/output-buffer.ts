/**
 * Output Buffer Service
 *
 * A unified output buffer that supports multiple agent types:
 * - Claude Code CLI (Python agents)
 * - Jules (Google cloud API)
 * - Claude SDK (native TypeScript)
 * - Future agents (extensible design)
 *
 * @module output-buffer
 */

import { EventEmitter } from 'node:events'
import type { DatabaseService } from '../database'
import type {
  OutputLine,
  OutputStreamType,
  CreateOutputLineInput,
} from 'shared/ai-types'

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
 * Agent types supported by the output buffer
 */
export type AgentType = 'claude-code' | 'jules' | 'claude-sdk' | string

/**
 * Internal buffer entry
 */
interface BufferEntry {
  lines: OutputLineWithMetadata[]
  subscribers: Set<OutputCallback>
  dirty: boolean
  lastPersistedIndex: number
  agentType?: AgentType
}

/**
 * Output Buffer Service
 *
 * Manages buffering and persistence of agent output for all agent types.
 * Uses a generic ID-based approach (works with taskId or sessionId).
 */
export class OutputBuffer extends EventEmitter {
  private buffers: Map<string, BufferEntry> = new Map()
  private db: DatabaseService | null = null

  constructor(db?: DatabaseService) {
    super()
    this.db = db ?? null
  }

  setDatabase(db: DatabaseService): void {
    this.db = db
  }

  private getOrCreateBuffer(id: string, agentType?: AgentType): BufferEntry {
    let buffer = this.buffers.get(id)
    if (!buffer) {
      buffer = {
        lines: [],
        subscribers: new Set(),
        dirty: false,
        lastPersistedIndex: -1,
        agentType,
      }
      this.buffers.set(id, buffer)
    } else if (agentType && !buffer.agentType) {
      buffer.agentType = agentType
    }
    return buffer
  }

  setAgentType(id: string, agentType: AgentType): void {
    const buffer = this.getOrCreateBuffer(id)
    buffer.agentType = agentType
  }

  /**
   * Append a line of output to the buffer.
   * ANSI escape codes are preserved.
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

    // Notify subscribers immediately
    for (const callback of buffer.subscribers) {
      try {
        callback(line)
      } catch (error) {
        console.error('Output subscriber error:', error)
      }
    }

    this.emit('outputReceived', id, line)

    return line
  }

  /**
   * Get output lines for a task/session
   */
  getLines(id: string, fromIndex?: number): OutputLineWithMetadata[] {
    const buffer = this.buffers.get(id)
    if (!buffer) return []

    if (fromIndex !== undefined && fromIndex >= 0) {
      return buffer.lines.slice(fromIndex)
    }
    return [...buffer.lines]
  }

  getLineCount(id: string): number {
    return this.buffers.get(id)?.lines.length ?? 0
  }

  /**
   * Clear all output for a task/session
   */
  clear(id: string): void {
    const buffer = this.buffers.get(id)
    if (buffer) {
      buffer.lines = []
      buffer.dirty = false
      buffer.lastPersistedIndex = -1
    }

    if (this.db) {
      this.db.clearTaskOutput(id)
    }

    this.emit('cleared', id)
  }

  /**
   * Persist buffered output to database
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
   * Subscribe to output updates
   */
  subscribe(id: string, callback: OutputCallback): () => void {
    const buffer = this.getOrCreateBuffer(id)
    buffer.subscribers.add(callback)

    return () => {
      buffer.subscribers.delete(callback)
    }
  }

  getSubscriberCount(id: string): number {
    return this.buffers.get(id)?.subscribers.size ?? 0
  }

  isDirty(id: string): boolean {
    return this.buffers.get(id)?.dirty ?? false
  }

  removeBuffer(id: string): void {
    this.buffers.delete(id)
  }

  getActiveIds(): string[] {
    return Array.from(this.buffers.keys())
  }

  async persistAll(): Promise<void> {
    await Promise.all(
      Array.from(this.buffers.keys()).map(id => this.persist(id))
    )
  }

  getFullContent(id: string, separator = '\n'): string {
    const buffer = this.buffers.get(id)
    if (!buffer) return ''
    return buffer.lines.map(line => line.content).join(separator)
  }

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

// Re-export types
export type { OutputStreamType, OutputLine } from 'shared/ai-types'
