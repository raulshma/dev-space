/**
 * Task Queue Service
 *
 * Manages sequential execution of agent tasks.
 * Ensures only one task runs at a time to prevent resource conflicts.
 *
 * Implements Requirements:
 * - 8.4: Execute tasks sequentially to prevent resource conflicts
 * - 7.2: Move tasks to "implement" status and queue for execution
 * - 7.3: Reorder tasks to update execution priority
 *
 * @module task-queue
 */

import { EventEmitter } from 'node:events'

/**
 * Interface for the Task Queue service
 */
export interface ITaskQueue {
  /**
   * Add a task to the end of the queue
   * @param taskId - The task ID to enqueue
   */
  enqueue(taskId: string): void

  /**
   * Remove and return the task at the front of the queue
   * @returns The task ID or undefined if queue is empty
   */
  dequeue(): string | undefined

  /**
   * Get the task at the front of the queue without removing it
   * @returns The task ID or undefined if queue is empty
   */
  peek(): string | undefined

  /**
   * Remove a specific task from the queue
   * @param taskId - The task ID to remove
   * @returns True if the task was found and removed
   */
  remove(taskId: string): boolean

  /**
   * Reorder the queue with a new task order
   * @param taskIds - Array of task IDs in the new order
   */
  reorder(taskIds: string[]): void

  /**
   * Get all task IDs in the queue
   * @returns Array of task IDs in queue order
   */
  getQueue(): string[]

  /**
   * Check if a task is currently being processed
   * @returns True if a task is being processed
   */
  isProcessing(): boolean

  /**
   * Get the ID of the currently processing task
   * @returns The task ID or undefined if no task is processing
   */
  getCurrentTaskId(): string | undefined

  /**
   * Get the number of tasks in the queue
   * @returns The queue size
   */
  size(): number

  /**
   * Check if a task is in the queue
   * @param taskId - The task ID to check
   * @returns True if the task is in the queue
   */
  contains(taskId: string): boolean

  /**
   * Clear all tasks from the queue
   */
  clear(): void

  /**
   * Set the currently processing task
   * @param taskId - The task ID being processed, or undefined to clear
   */
  setCurrentTask(taskId: string | undefined): void
}

/**
 * Events emitted by the TaskQueue
 */
export interface TaskQueueEvents {
  /** Emitted when a task is added to the queue */
  enqueued: (taskId: string) => void
  /** Emitted when a task is removed from the queue */
  dequeued: (taskId: string) => void
  /** Emitted when a task is removed (not dequeued) */
  removed: (taskId: string) => void
  /** Emitted when the queue is reordered */
  reordered: (taskIds: string[]) => void
  /** Emitted when processing starts */
  processingStarted: (taskId: string) => void
  /** Emitted when processing ends */
  processingEnded: (taskId: string) => void
}

/**
 * Task Queue Service
 *
 * Manages a queue of agent tasks for sequential execution.
 * Ensures only one task runs at a time and provides methods
 * for queue manipulation and monitoring.
 */
export class TaskQueue extends EventEmitter implements ITaskQueue {
  /** The queue of task IDs */
  private queue: string[] = []

  /** The currently processing task ID */
  private currentTaskId: string | undefined = undefined

  /**
   * Create a new TaskQueue instance
   */
  constructor() {
    super()
  }

  /**
   * Add a task to the end of the queue
   *
   * @param taskId - The task ID to enqueue
   * @throws Error if taskId is empty or already in queue
   */
  enqueue(taskId: string): void {
    if (!taskId || taskId.trim() === '') {
      throw new Error('Task ID cannot be empty')
    }

    if (this.contains(taskId)) {
      throw new Error(`Task ${taskId} is already in the queue`)
    }

    this.queue.push(taskId)
    this.emit('enqueued', taskId)
  }

  /**
   * Remove and return the task at the front of the queue
   *
   * @returns The task ID or undefined if queue is empty
   */
  dequeue(): string | undefined {
    const taskId = this.queue.shift()
    if (taskId) {
      this.emit('dequeued', taskId)
    }
    return taskId
  }

  /**
   * Get the task at the front of the queue without removing it
   *
   * @returns The task ID or undefined if queue is empty
   */
  peek(): string | undefined {
    return this.queue[0]
  }

  /**
   * Remove a specific task from the queue
   *
   * @param taskId - The task ID to remove
   * @returns True if the task was found and removed
   */
  remove(taskId: string): boolean {
    const index = this.queue.indexOf(taskId)
    if (index === -1) {
      return false
    }

    this.queue.splice(index, 1)
    this.emit('removed', taskId)
    return true
  }

  /**
   * Reorder the queue with a new task order
   *
   * Only tasks that exist in the current queue will be included.
   * Tasks not in the new order will be removed.
   * Tasks in the new order that aren't in the queue will be ignored.
   *
   * @param taskIds - Array of task IDs in the new order
   */
  reorder(taskIds: string[]): void {
    // Create a set of current queue items for fast lookup
    const currentSet = new Set(this.queue)

    // Filter to only include tasks that are in the current queue
    const newQueue = taskIds.filter((id) => currentSet.has(id))

    // Update the queue
    this.queue = newQueue
    this.emit('reordered', [...this.queue])
  }

  /**
   * Get all task IDs in the queue
   *
   * @returns Array of task IDs in queue order (copy)
   */
  getQueue(): string[] {
    return [...this.queue]
  }

  /**
   * Check if a task is currently being processed
   *
   * @returns True if a task is being processed
   */
  isProcessing(): boolean {
    return this.currentTaskId !== undefined
  }

  /**
   * Get the ID of the currently processing task
   *
   * @returns The task ID or undefined if no task is processing
   */
  getCurrentTaskId(): string | undefined {
    return this.currentTaskId
  }

  /**
   * Get the number of tasks in the queue
   *
   * @returns The queue size
   */
  size(): number {
    return this.queue.length
  }

  /**
   * Check if a task is in the queue
   *
   * @param taskId - The task ID to check
   * @returns True if the task is in the queue
   */
  contains(taskId: string): boolean {
    return this.queue.includes(taskId)
  }

  /**
   * Clear all tasks from the queue
   */
  clear(): void {
    this.queue = []
  }

  /**
   * Set the currently processing task
   *
   * @param taskId - The task ID being processed, or undefined to clear
   */
  setCurrentTask(taskId: string | undefined): void {
    const previousTaskId = this.currentTaskId
    this.currentTaskId = taskId

    if (previousTaskId && !taskId) {
      this.emit('processingEnded', previousTaskId)
    } else if (taskId && !previousTaskId) {
      this.emit('processingStarted', taskId)
    } else if (taskId && previousTaskId && taskId !== previousTaskId) {
      this.emit('processingEnded', previousTaskId)
      this.emit('processingStarted', taskId)
    }
  }

  /**
   * Get the position of a task in the queue
   *
   * @param taskId - The task ID to find
   * @returns The position (0-indexed) or -1 if not found
   */
  getPosition(taskId: string): number {
    return this.queue.indexOf(taskId)
  }

  /**
   * Move a task to a specific position in the queue
   *
   * @param taskId - The task ID to move
   * @param position - The target position (0-indexed)
   * @returns True if the task was moved
   */
  moveTo(taskId: string, position: number): boolean {
    const currentIndex = this.queue.indexOf(taskId)
    if (currentIndex === -1) {
      return false
    }

    // Remove from current position
    this.queue.splice(currentIndex, 1)

    // Clamp position to valid range
    const targetPosition = Math.max(0, Math.min(position, this.queue.length))

    // Insert at new position
    this.queue.splice(targetPosition, 0, taskId)
    this.emit('reordered', [...this.queue])

    return true
  }

  /**
   * Move a task to the front of the queue
   *
   * @param taskId - The task ID to move
   * @returns True if the task was moved
   */
  moveToFront(taskId: string): boolean {
    return this.moveTo(taskId, 0)
  }

  /**
   * Move a task to the back of the queue
   *
   * @param taskId - The task ID to move
   * @returns True if the task was moved
   */
  moveToBack(taskId: string): boolean {
    return this.moveTo(taskId, this.queue.length)
  }
}

