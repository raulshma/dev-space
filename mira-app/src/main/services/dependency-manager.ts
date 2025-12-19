/**
 * Dependency Manager Service
 *
 * Manages task dependencies, including CRUD operations, cycle detection,
 * and blocking status calculation.
 *
 * Implements Requirements:
 * - 5.1: Allow users to specify dependency tasks by ID
 * - 5.2: Display "blocked" indicator on tasks with incomplete dependencies
 * - 5.4: Remove blocked indicator when all dependencies complete
 * - 5.5: Show which dependencies are blocking a task
 * - 5.6: Mark dependent tasks as blocked with failure indicator when dependency fails
 * - 5.7: Prevent circular dependencies
 *
 * @module dependency-manager
 */

import { EventEmitter } from 'node:events'
import type { DatabaseService } from './database'
import type { TaskStatus } from 'shared/ai-types'

/**
 * Represents a task dependency relationship
 */
export interface TaskDependency {
  taskId: string
  dependsOn: string[]
}

/**
 * Status of a task's dependencies
 */
export interface DependencyStatus {
  taskId: string
  isBlocked: boolean
  blockingTasks: string[]
  failedDependencies: string[]
}

/**
 * Events emitted by the DependencyManager
 */
export interface DependencyManagerEvents {
  /** Emitted when dependencies are set for a task */
  dependenciesSet: (taskId: string, dependsOn: string[]) => void
  /** Emitted when dependencies are removed for a task */
  dependenciesRemoved: (taskId: string) => void
  /** Emitted when blocking status changes for a task */
  blockingStatusChanged: (taskId: string, status: DependencyStatus) => void
}

/**
 * Interface for the Dependency Manager service
 */
export interface IDependencyManager {
  /**
   * Set dependencies for a task
   * @param taskId - The task ID to set dependencies for
   * @param dependsOn - Array of task IDs this task depends on
   * @throws Error if setting dependencies would create a cycle
   */
  setDependencies(taskId: string, dependsOn: string[]): void

  /**
   * Get dependencies for a task
   * @param taskId - The task ID to get dependencies for
   * @returns Array of task IDs this task depends on
   */
  getDependencies(taskId: string): string[]

  /**
   * Remove all dependencies for a task
   * @param taskId - The task ID to remove dependencies for
   */
  removeDependencies(taskId: string): void

  /**
   * Get the blocking status for a task
   * @param taskId - The task ID to check
   * @returns DependencyStatus with blocking information
   */
  getBlockingStatus(taskId: string): DependencyStatus

  /**
   * Check if all dependencies are satisfied for a task
   * @param taskId - The task ID to check
   * @returns True if all dependencies are completed
   */
  areDependenciesSatisfied(taskId: string): boolean

  /**
   * Check if adding dependencies would create a cycle
   * @param taskId - The task ID to add dependencies to
   * @param dependsOn - Array of task IDs to depend on
   * @returns True if adding these dependencies would create a cycle
   */
  wouldCreateCycle(taskId: string, dependsOn: string[]): boolean

  /**
   * Get all tasks that depend on a given task
   * @param taskId - The task ID to find dependents for
   * @returns Array of task IDs that depend on this task
   */
  getDependents(taskId: string): string[]
}

/**
 * Dependency Manager Service
 *
 * Manages task dependencies with cycle detection and blocking status calculation.
 * Uses the database for persistence and provides real-time dependency tracking.
 */
export class DependencyManager
  extends EventEmitter
  implements IDependencyManager
{
  private db: DatabaseService

  /**
   * Create a new DependencyManager instance
   * @param db - The database service for persistence
   */
  constructor(db: DatabaseService) {
    super()
    this.db = db
  }

  /**
   * Set dependencies for a task
   *
   * @param taskId - The task ID to set dependencies for
   * @param dependsOn - Array of task IDs this task depends on
   * @throws Error if taskId is empty
   * @throws Error if setting dependencies would create a cycle
   */
  setDependencies(taskId: string, dependsOn: string[]): void {
    if (!taskId || taskId.trim() === '') {
      throw new Error('Task ID cannot be empty')
    }

    // Filter out empty strings and duplicates
    const uniqueDependencies = [
      ...new Set(dependsOn.filter(id => id && id.trim() !== '')),
    ]

    // Filter out self-dependency
    const filteredDependencies = uniqueDependencies.filter(id => id !== taskId)

    // Check for cycles before setting
    if (this.wouldCreateCycle(taskId, filteredDependencies)) {
      throw new Error(
        'Cannot set dependencies: would create a circular dependency'
      )
    }

    // Set dependencies in database (replaces existing)
    this.db.setTaskDependencies(taskId, filteredDependencies)

    this.emit('dependenciesSet', taskId, filteredDependencies)
  }

  /**
   * Get dependencies for a task
   *
   * @param taskId - The task ID to get dependencies for
   * @returns Array of task IDs this task depends on
   */
  getDependencies(taskId: string): string[] {
    if (!taskId || taskId.trim() === '') {
      return []
    }

    return this.db.getTaskDependencies(taskId)
  }

  /**
   * Remove all dependencies for a task
   *
   * @param taskId - The task ID to remove dependencies for
   */
  removeDependencies(taskId: string): void {
    if (!taskId || taskId.trim() === '') {
      return
    }

    this.db.removeTaskDependencies(taskId)
    this.emit('dependenciesRemoved', taskId)
  }

  /**
   * Get the blocking status for a task
   *
   * Checks all dependencies and returns information about which ones
   * are blocking the task and which have failed.
   *
   * @param taskId - The task ID to check
   * @returns DependencyStatus with blocking information
   */
  getBlockingStatus(taskId: string): DependencyStatus {
    const dependencies = this.getDependencies(taskId)

    if (dependencies.length === 0) {
      return {
        taskId,
        isBlocked: false,
        blockingTasks: [],
        failedDependencies: [],
      }
    }

    const blockingTasks: string[] = []
    const failedDependencies: string[] = []

    for (const depId of dependencies) {
      const task = this.db.getAgentTask(depId)

      if (!task) {
        // Dependency task doesn't exist - treat as blocking
        // (could also choose to ignore missing dependencies)
        blockingTasks.push(depId)
        continue
      }

      const status = task.status as TaskStatus

      if (status === 'failed') {
        failedDependencies.push(depId)
        blockingTasks.push(depId)
      } else if (status !== 'completed') {
        // Any status other than 'completed' or 'failed' is blocking
        blockingTasks.push(depId)
      }
    }

    return {
      taskId,
      isBlocked: blockingTasks.length > 0,
      blockingTasks,
      failedDependencies,
    }
  }

  /**
   * Check if all dependencies are satisfied for a task
   *
   * @param taskId - The task ID to check
   * @returns True if all dependencies are completed
   */
  areDependenciesSatisfied(taskId: string): boolean {
    const status = this.getBlockingStatus(taskId)
    return !status.isBlocked
  }

  /**
   * Check if adding dependencies would create a cycle
   *
   * Uses DFS to detect if any of the proposed dependencies
   * would create a path back to the original task.
   *
   * @param taskId - The task ID to add dependencies to
   * @param dependsOn - Array of task IDs to depend on
   * @returns True if adding these dependencies would create a cycle
   */
  wouldCreateCycle(taskId: string, dependsOn: string[]): boolean {
    if (!taskId || dependsOn.length === 0) {
      return false
    }

    // Check if any of the proposed dependencies can reach back to taskId
    // This would create a cycle: taskId -> dependsOn[i] -> ... -> taskId

    const visited = new Set<string>()

    // DFS to check if we can reach targetId starting from startId
    const canReach = (startId: string, targetId: string): boolean => {
      if (startId === targetId) {
        return true
      }

      if (visited.has(startId)) {
        return false
      }

      visited.add(startId)

      const deps = this.db.getTaskDependencies(startId)
      for (const dep of deps) {
        if (canReach(dep, targetId)) {
          return true
        }
      }

      return false
    }

    // For each proposed dependency, check if it can reach back to taskId
    for (const depId of dependsOn) {
      visited.clear()

      // If depId can reach taskId through existing dependencies,
      // then adding taskId -> depId would create a cycle
      if (canReach(depId, taskId)) {
        return true
      }
    }

    return false
  }

  /**
   * Get all tasks that depend on a given task
   *
   * @param taskId - The task ID to find dependents for
   * @returns Array of task IDs that depend on this task
   */
  getDependents(taskId: string): string[] {
    if (!taskId || taskId.trim() === '') {
      return []
    }

    return this.db.getTaskDependents(taskId)
  }
}
