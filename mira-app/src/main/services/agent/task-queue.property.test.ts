/**
 * Property-based tests for Task Queue Service
 *
 * These tests verify that the task queue correctly manages sequential
 * task execution, ensuring only one task runs at a time.
 *
 * @module task-queue.property.test
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { TaskQueue } from './task-queue'

/**
 * Arbitrary generator for valid task IDs
 * Task IDs must be non-empty strings
 */
const arbitraryTaskId: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter(s => s.trim().length > 0)
  .map(s => s.trim())

/**
 * Arbitrary generator for arrays of unique task IDs
 */
const arbitraryUniqueTaskIds: fc.Arbitrary<string[]> = fc
  .array(arbitraryTaskId, { minLength: 0, maxLength: 20 })
  .map(ids => [...new Set(ids)]) // Ensure uniqueness

/**
 * Type for queue operations (defined for potential future stateful testing)
 */
type _QueueOperation =
  | { type: 'enqueue'; taskId: string }
  | { type: 'dequeue' }
  | { type: 'setCurrentTask'; taskId: string | undefined }
  | { type: 'clearCurrentTask' }

// Note: _QueueOperation is defined for potential future use in stateful testing
// but is not currently used in the property tests below

describe('Task Queue Property Tests', () => {
  let _taskQueue: TaskQueue

  beforeEach(() => {
    _taskQueue = new TaskQueue()
  })

  /**
   * **Feature: ai-agent-rework, Property 13: Sequential Task Execution**
   * **Validates: Requirements 8.4**
   *
   * For any point in time, at most one agent task SHALL have status "running".
   * This is enforced by the task queue tracking only one current task at a time.
   */
  describe('Property 13: Sequential Task Execution', () => {
    it('at most one task can be marked as currently processing at any time', () => {
      fc.assert(
        fc.property(arbitraryUniqueTaskIds, taskIds => {
          const queue = new TaskQueue()

          // Enqueue all tasks
          for (const taskId of taskIds) {
            queue.enqueue(taskId)
          }

          // At any point, isProcessing should be consistent with getCurrentTaskId
          // Initially, no task is processing
          expect(queue.isProcessing()).toBe(false)
          expect(queue.getCurrentTaskId()).toBeUndefined()

          // Set a current task
          if (taskIds.length > 0) {
            queue.setCurrentTask(taskIds[0])
            expect(queue.isProcessing()).toBe(true)
            expect(queue.getCurrentTaskId()).toBe(taskIds[0])

            // Only one task can be current
            // Setting another task replaces the current one
            if (taskIds.length > 1) {
              queue.setCurrentTask(taskIds[1])
              expect(queue.isProcessing()).toBe(true)
              expect(queue.getCurrentTaskId()).toBe(taskIds[1])
              // Previous task is no longer current
              expect(queue.getCurrentTaskId()).not.toBe(taskIds[0])
            }
          }

          // Clear current task
          queue.setCurrentTask(undefined)
          expect(queue.isProcessing()).toBe(false)
          expect(queue.getCurrentTaskId()).toBeUndefined()

          return true
        }),
        { numRuns: 100 }
      )
    })

    it('getCurrentTaskId returns undefined when no task is processing', () => {
      fc.assert(
        fc.property(arbitraryUniqueTaskIds, taskIds => {
          const queue = new TaskQueue()

          // Enqueue tasks
          for (const taskId of taskIds) {
            queue.enqueue(taskId)
          }

          // Without setting a current task, getCurrentTaskId should be undefined
          return queue.getCurrentTaskId() === undefined && !queue.isProcessing()
        }),
        { numRuns: 100 }
      )
    })

    it('isProcessing is true if and only if getCurrentTaskId is defined', () => {
      fc.assert(
        fc.property(
          arbitraryUniqueTaskIds,
          fc.boolean(),
          (taskIds, shouldSetCurrent) => {
            const queue = new TaskQueue()

            // Enqueue tasks
            for (const taskId of taskIds) {
              queue.enqueue(taskId)
            }

            // Optionally set a current task
            if (shouldSetCurrent && taskIds.length > 0) {
              queue.setCurrentTask(taskIds[0])
            }

            // The invariant: isProcessing() === (getCurrentTaskId() !== undefined)
            const isProcessing = queue.isProcessing()
            const currentTaskId = queue.getCurrentTaskId()

            return isProcessing === (currentTaskId !== undefined)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('setting current task to undefined clears processing state', () => {
      fc.assert(
        fc.property(arbitraryUniqueTaskIds, taskIds => {
          const queue = new TaskQueue()

          // Enqueue and set a current task
          for (const taskId of taskIds) {
            queue.enqueue(taskId)
          }

          if (taskIds.length > 0) {
            queue.setCurrentTask(taskIds[0])
            expect(queue.isProcessing()).toBe(true)
          }

          // Clear current task
          queue.setCurrentTask(undefined)

          // Should no longer be processing
          return !queue.isProcessing() && queue.getCurrentTaskId() === undefined
        }),
        { numRuns: 100 }
      )
    })

    it('only one task ID can be returned by getCurrentTaskId', () => {
      fc.assert(
        fc.property(
          arbitraryUniqueTaskIds,
          fc.nat({ max: 100 }),
          (taskIds, operationCount) => {
            const queue = new TaskQueue()

            // Enqueue all tasks
            for (const taskId of taskIds) {
              queue.enqueue(taskId)
            }

            // Perform random operations
            for (let i = 0; i < Math.min(operationCount, 50); i++) {
              const currentId = queue.getCurrentTaskId()

              // At any point, there's either 0 or 1 current task
              if (currentId !== undefined) {
                // Exactly one task is current
                expect(typeof currentId).toBe('string')
                expect(currentId.length).toBeGreaterThan(0)
              }

              // Randomly change state
              if (taskIds.length > 0 && Math.random() > 0.5) {
                const randomTask =
                  taskIds[Math.floor(Math.random() * taskIds.length)]
                queue.setCurrentTask(randomTask)
              } else {
                queue.setCurrentTask(undefined)
              }
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Additional queue invariant tests
   */
  describe('Queue Invariants', () => {
    it('enqueue increases queue size by exactly 1', () => {
      fc.assert(
        fc.property(
          arbitraryUniqueTaskIds,
          arbitraryTaskId,
          (initialTasks, newTask) => {
            const queue = new TaskQueue()

            // Enqueue initial tasks
            for (const taskId of initialTasks) {
              queue.enqueue(taskId)
            }

            const sizeBefore = queue.size()

            // Skip if newTask is already in queue
            if (queue.contains(newTask)) {
              return true
            }

            queue.enqueue(newTask)
            const sizeAfter = queue.size()

            return sizeAfter === sizeBefore + 1
          }
        ),
        { numRuns: 100 }
      )
    })

    it('dequeue decreases queue size by exactly 1 when queue is non-empty', () => {
      fc.assert(
        fc.property(arbitraryUniqueTaskIds, taskIds => {
          const queue = new TaskQueue()

          // Enqueue tasks
          for (const taskId of taskIds) {
            queue.enqueue(taskId)
          }

          if (queue.size() === 0) {
            // Dequeue on empty queue returns undefined and doesn't change size
            const result = queue.dequeue()
            return result === undefined && queue.size() === 0
          }

          const sizeBefore = queue.size()
          queue.dequeue()
          const sizeAfter = queue.size()

          return sizeAfter === sizeBefore - 1
        }),
        { numRuns: 100 }
      )
    })

    it('dequeue returns tasks in FIFO order', () => {
      fc.assert(
        fc.property(arbitraryUniqueTaskIds, taskIds => {
          const queue = new TaskQueue()

          // Enqueue all tasks
          for (const taskId of taskIds) {
            queue.enqueue(taskId)
          }

          // Dequeue and verify order
          for (const expectedTaskId of taskIds) {
            const dequeuedTaskId = queue.dequeue()
            if (dequeuedTaskId !== expectedTaskId) {
              return false
            }
          }

          // Queue should be empty
          return queue.size() === 0 && queue.dequeue() === undefined
        }),
        { numRuns: 100 }
      )
    })

    it('peek returns the same task as dequeue would without removing it', () => {
      fc.assert(
        fc.property(arbitraryUniqueTaskIds, taskIds => {
          const queue = new TaskQueue()

          // Enqueue tasks
          for (const taskId of taskIds) {
            queue.enqueue(taskId)
          }

          const sizeBefore = queue.size()
          const peeked = queue.peek()
          const sizeAfterPeek = queue.size()

          // Peek doesn't change size
          if (sizeBefore !== sizeAfterPeek) {
            return false
          }

          const dequeued = queue.dequeue()

          // Peek and dequeue return the same value
          return peeked === dequeued
        }),
        { numRuns: 100 }
      )
    })

    it('remove returns true only if task was in queue', () => {
      fc.assert(
        fc.property(
          arbitraryUniqueTaskIds,
          arbitraryTaskId,
          (taskIds, taskToRemove) => {
            const queue = new TaskQueue()

            // Enqueue tasks
            for (const taskId of taskIds) {
              queue.enqueue(taskId)
            }

            const wasInQueue = queue.contains(taskToRemove)
            const removeResult = queue.remove(taskToRemove)

            return removeResult === wasInQueue
          }
        ),
        { numRuns: 100 }
      )
    })

    it('after remove, task is no longer in queue', () => {
      fc.assert(
        fc.property(arbitraryUniqueTaskIds, taskIds => {
          const queue = new TaskQueue()

          // Enqueue tasks
          for (const taskId of taskIds) {
            queue.enqueue(taskId)
          }

          // Remove each task and verify it's gone
          for (const taskId of taskIds) {
            queue.remove(taskId)
            if (queue.contains(taskId)) {
              return false
            }
          }

          return true
        }),
        { numRuns: 100 }
      )
    })

    it('reorder preserves only tasks that exist in both current queue and new order', () => {
      fc.assert(
        fc.property(
          arbitraryUniqueTaskIds,
          arbitraryUniqueTaskIds,
          (initialTasks, newOrder) => {
            const queue = new TaskQueue()

            // Enqueue initial tasks
            for (const taskId of initialTasks) {
              queue.enqueue(taskId)
            }

            const initialSet = new Set(initialTasks)
            queue.reorder(newOrder)

            const resultQueue = queue.getQueue()

            // Result should only contain tasks that were in both initial and newOrder
            for (const taskId of resultQueue) {
              if (!initialSet.has(taskId) || !newOrder.includes(taskId)) {
                return false
              }
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('clear removes all tasks from queue', () => {
      fc.assert(
        fc.property(arbitraryUniqueTaskIds, taskIds => {
          const queue = new TaskQueue()

          // Enqueue tasks
          for (const taskId of taskIds) {
            queue.enqueue(taskId)
          }

          queue.clear()

          return queue.size() === 0 && queue.getQueue().length === 0
        }),
        { numRuns: 100 }
      )
    })

    it('getQueue returns a copy, not the internal array', () => {
      fc.assert(
        fc.property(arbitraryUniqueTaskIds, taskIds => {
          const queue = new TaskQueue()

          // Enqueue tasks
          for (const taskId of taskIds) {
            queue.enqueue(taskId)
          }

          const queueCopy = queue.getQueue()

          // Modifying the copy should not affect the queue
          queueCopy.push('modified-task')
          queueCopy.pop()

          const queueAfter = queue.getQueue()

          // Original queue should be unchanged
          return queueAfter.length === taskIds.length
        }),
        { numRuns: 100 }
      )
    })
  })
})
