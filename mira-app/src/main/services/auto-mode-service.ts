/**
 * Auto-Mode Service
 *
 * Manages auto-mode for continuous task execution, including task scheduling,
 * concurrency control, and state persistence.
 *
 * Implements Requirements:
 * - 1.1: Enable auto-mode to monitor task backlog for pending tasks
 * - 1.2: Automatically start next pending task when capacity available
 * - 1.3: Respect concurrency limit and not exceed specified concurrent tasks
 * - 1.4: Start next pending task when task completes or fails
 * - 1.5: Stop starting new tasks when disabled, allow running tasks to complete
 * - 1.7: Log errors and continue with next task on error
 * - 1.8: Persist auto-mode state per project across restarts
 * - 5.3: Skip blocked tasks and try next eligible task
 *
 * @module auto-mode-service
 */

import { EventEmitter } from 'node:events'
import type { DatabaseService } from './database'
import type { AgentExecutorService } from './agent-executor-service'
import type { DependencyManager } from './dependency-manager'
import type { AgentTask } from 'shared/ai-types'

/**
 * Configuration for auto-mode per project
 */
export interface AutoModeConfig {
  projectPath: string
  concurrencyLimit: number
  enabled: boolean
}

/**
 * State of auto-mode for a project
 */
export interface AutoModeState {
  isRunning: boolean
  runningTaskCount: number
  concurrencyLimit: number
  lastStartedTaskId: string | null
}

/**
 * Internal loop state for managing auto-mode per project
 */
interface AutoModeLoop {
  projectPath: string
  enabled: boolean
  concurrencyLimit: number
  runningTaskIds: Set<string>
  lastStartedTaskId: string | null
  loopInterval: NodeJS.Timeout | null
  isProcessing: boolean
}

/**
 * Events emitted by the AutoModeService
 */
export interface AutoModeServiceEvents {
  /** Emitted when auto-mode is started for a project */
  started: (projectPath: string, state: AutoModeState) => void
  /** Emitted when auto-mode is stopped for a project */
  stopped: (projectPath: string) => void
  /** Emitted when auto-mode state changes */
  stateChanged: (projectPath: string, state: AutoModeState) => void
  /** Emitted when a task is started by auto-mode */
  taskStarted: (projectPath: string, taskId: string) => void
  /** Emitted when a task completes in auto-mode */
  taskCompleted: (projectPath: string, taskId: string) => void
  /** Emitted when a task fails in auto-mode */
  taskFailed: (projectPath: string, taskId: string, error: string) => void
  /** Emitted when an error occurs during task start */
  taskStartError: (projectPath: string, taskId: string, error: string) => void
  /** Emitted when auto-mode is idle (no eligible tasks) */
  idle: (projectPath: string) => void
}

/**
 * Interface for the Auto-Mode Service
 */
export interface IAutoModeService {
  /**
   * Start auto-mode for a project
   * @param projectPath - The project path
   * @param concurrencyLimit - Optional concurrency limit (default: 1)
   */
  start(projectPath: string, concurrencyLimit?: number): Promise<void>

  /**
   * Stop auto-mode for a project
   * @param projectPath - The project path
   */
  stop(projectPath: string): Promise<void>

  /**
   * Check if auto-mode is running for a project
   * @param projectPath - The project path
   * @returns True if auto-mode is running
   */
  isRunning(projectPath: string): boolean

  /**
   * Set the concurrency limit for a project
   * @param projectPath - The project path
   * @param limit - The concurrency limit (1-5)
   */
  setConcurrencyLimit(projectPath: string, limit: number): void

  /**
   * Get the current auto-mode state for a project
   * @param projectPath - The project path
   * @returns The auto-mode state or null if not configured
   */
  getState(projectPath: string): AutoModeState | null

  /**
   * Save auto-mode state to database
   * @param projectPath - The project path
   */
  saveState(projectPath: string): Promise<void>

  /**
   * Load auto-mode state from database
   * @param projectPath - The project path
   * @returns The loaded state or null if not found
   */
  loadState(projectPath: string): Promise<AutoModeState | null>

  /**
   * Restore all auto-mode states from database on startup
   */
  restoreAllStates(): Promise<void>

  /**
   * Get running task count for a project
   * @param projectPath - The project path
   * @returns The number of running tasks
   */
  getRunningTaskCount(projectPath: string): number

  /**
   * Get running task IDs for a project
   * @param projectPath - The project path
   * @returns Array of running task IDs
   */
  getRunningTaskIds(projectPath: string): string[]
}

/** Default concurrency limit */
const DEFAULT_CONCURRENCY_LIMIT = 1

/** Maximum concurrency limit */
const MAX_CONCURRENCY_LIMIT = 5

/** Minimum concurrency limit */
const MIN_CONCURRENCY_LIMIT = 1

/** Interval for checking pending tasks (ms) */
const LOOP_INTERVAL_MS = 2000

/**
 * Auto-Mode Service
 *
 * Manages auto-mode for continuous task execution across projects.
 * Handles task scheduling, concurrency control, and state persistence.
 */
export class AutoModeService extends EventEmitter implements IAutoModeService {
  private db: DatabaseService
  private executorService: AgentExecutorService
  private dependencyManager: DependencyManager | null
  private loops: Map<string, AutoModeLoop> = new Map()
  private initialized = false

  /**
   * Create a new AutoModeService instance
   * @param db - The database service for persistence
   * @param executorService - The agent executor service for task execution
   * @param dependencyManager - Optional dependency manager for checking dependencies
   */
  constructor(
    db: DatabaseService,
    executorService: AgentExecutorService,
    dependencyManager?: DependencyManager
  ) {
    super()
    this.db = db
    this.executorService = executorService
    this.dependencyManager = dependencyManager ?? null

    // Listen to executor service events
    this.setupExecutorListeners()
  }

  /**
   * Set up listeners for executor service events
   */
  private setupExecutorListeners(): void {
    // Listen for task completion
    this.executorService.on('taskCompleted', (task: AgentTask) => {
      this.handleTaskCompleted(task)
    })

    // Listen for task failure
    this.executorService.on('taskFailed', (task: AgentTask, error: string) => {
      this.handleTaskFailed(task, error)
    })

    // Listen for task stopped
    this.executorService.on('taskStopped', (task: AgentTask) => {
      this.handleTaskStopped(task)
    })
  }

  /**
   * Handle task completion event
   */
  private handleTaskCompleted(task: AgentTask): void {
    const projectPath = task.targetDirectory
    const loop = this.loops.get(projectPath)

    if (loop && loop.runningTaskIds.has(task.id)) {
      loop.runningTaskIds.delete(task.id)
      this.emit('taskCompleted', projectPath, task.id)
      this.emitStateChanged(projectPath)

      // Trigger next task processing if auto-mode is still enabled
      if (loop.enabled) {
        this.processNextTask(projectPath).catch(err => {
          console.error(
            `[AutoMode] Error processing next task after completion:`,
            err
          )
        })
      }
    }
  }

  /**
   * Handle task failure event
   */
  private handleTaskFailed(task: AgentTask, error: string): void {
    const projectPath = task.targetDirectory
    const loop = this.loops.get(projectPath)

    if (loop && loop.runningTaskIds.has(task.id)) {
      loop.runningTaskIds.delete(task.id)
      this.emit('taskFailed', projectPath, task.id, error)
      this.emitStateChanged(projectPath)

      // Trigger next task processing if auto-mode is still enabled
      if (loop.enabled) {
        this.processNextTask(projectPath).catch(err => {
          console.error(
            `[AutoMode] Error processing next task after failure:`,
            err
          )
        })
      }
    }
  }

  /**
   * Handle task stopped event
   */
  private handleTaskStopped(task: AgentTask): void {
    const taskProjectPath = task.targetDirectory
    const loop = this.loops.get(taskProjectPath)

    if (loop && loop.runningTaskIds.has(task.id)) {
      loop.runningTaskIds.delete(task.id)
      this.emitStateChanged(taskProjectPath)

      // Trigger next task processing if auto-mode is still enabled
      if (loop.enabled) {
        this.processNextTask(taskProjectPath).catch(err => {
          console.error(
            `[AutoMode] Error processing next task after stop:`,
            err
          )
        })
      }
    }
  }

  /**
   * Emit state changed event
   */
  private emitStateChanged(projectPath: string): void {
    const state = this.getState(projectPath)
    if (state) {
      this.emit('stateChanged', projectPath, state)
    }
  }

  /**
   * Start auto-mode for a project
   *
   * @param projectPath - The project path
   * @param concurrencyLimit - Optional concurrency limit (default: 1)
   */
  async start(
    projectPath: string,
    concurrencyLimit: number = DEFAULT_CONCURRENCY_LIMIT
  ): Promise<void> {
    // Validate concurrency limit
    const validLimit = Math.max(
      MIN_CONCURRENCY_LIMIT,
      Math.min(MAX_CONCURRENCY_LIMIT, concurrencyLimit)
    )

    // Check if already running
    let loop = this.loops.get(projectPath)

    if (loop && loop.enabled) {
      // Already running, just update concurrency limit if different
      if (loop.concurrencyLimit !== validLimit) {
        loop.concurrencyLimit = validLimit
        await this.saveState(projectPath)
        this.emitStateChanged(projectPath)
      }
      return
    }

    // Create or update loop
    if (!loop) {
      loop = {
        projectPath,
        enabled: true,
        concurrencyLimit: validLimit,
        runningTaskIds: new Set(),
        lastStartedTaskId: null,
        loopInterval: null,
        isProcessing: false,
      }
      this.loops.set(projectPath, loop)
    } else {
      loop.enabled = true
      loop.concurrencyLimit = validLimit
    }

    // Start the loop interval
    loop.loopInterval = setInterval(() => {
      this.runLoop(projectPath).catch(err => {
        console.error(`[AutoMode] Loop error for ${projectPath}:`, err)
      })
    }, LOOP_INTERVAL_MS)

    // Save state to database
    await this.saveState(projectPath)

    // Emit started event
    const state = this.getState(projectPath)
    if (state) {
      this.emit('started', projectPath, state)
    }

    console.log(
      `[AutoMode] Started for ${projectPath} with concurrency limit ${validLimit}`
    )

    // Immediately try to process tasks
    await this.processNextTask(projectPath)
  }

  /**
   * Stop auto-mode for a project
   *
   * @param projectPath - The project path
   */
  async stop(projectPath: string): Promise<void> {
    const loop = this.loops.get(projectPath)

    if (!loop) {
      return
    }

    // Disable the loop (but don't stop running tasks)
    loop.enabled = false

    // Clear the interval
    if (loop.loopInterval) {
      clearInterval(loop.loopInterval)
      loop.loopInterval = null
    }

    // Save state to database
    await this.saveState(projectPath)

    // Emit stopped event
    this.emit('stopped', projectPath)

    console.log(
      `[AutoMode] Stopped for ${projectPath}. ${loop.runningTaskIds.size} tasks still running.`
    )
  }

  /**
   * Check if auto-mode is running for a project
   *
   * @param projectPath - The project path
   * @returns True if auto-mode is running
   */
  isRunning(projectPath: string): boolean {
    const loop = this.loops.get(projectPath)
    return loop?.enabled ?? false
  }

  /**
   * Set the concurrency limit for a project
   *
   * @param projectPath - The project path
   * @param limit - The concurrency limit (1-5)
   */
  setConcurrencyLimit(projectPath: string, limit: number): void {
    const validLimit = Math.max(
      MIN_CONCURRENCY_LIMIT,
      Math.min(MAX_CONCURRENCY_LIMIT, limit)
    )

    let loop = this.loops.get(projectPath)

    if (!loop) {
      // Create a new loop (disabled by default)
      loop = {
        projectPath,
        enabled: false,
        concurrencyLimit: validLimit,
        runningTaskIds: new Set(),
        lastStartedTaskId: null,
        loopInterval: null,
        isProcessing: false,
      }
      this.loops.set(projectPath, loop)
    } else {
      loop.concurrencyLimit = validLimit
    }

    // Save state to database
    this.saveState(projectPath).catch(err => {
      console.error(`[AutoMode] Error saving state:`, err)
    })

    this.emitStateChanged(projectPath)
  }

  /**
   * Get the current auto-mode state for a project
   *
   * @param projectPath - The project path
   * @returns The auto-mode state or null if not configured
   */
  getState(projectPath: string): AutoModeState | null {
    const loop = this.loops.get(projectPath)

    if (!loop) {
      return null
    }

    return {
      isRunning: loop.enabled,
      runningTaskCount: loop.runningTaskIds.size,
      concurrencyLimit: loop.concurrencyLimit,
      lastStartedTaskId: loop.lastStartedTaskId,
    }
  }

  /**
   * Save auto-mode state to database
   *
   * @param projectPath - The project path
   */
  async saveState(projectPath: string): Promise<void> {
    const loop = this.loops.get(projectPath)

    if (!loop) {
      return
    }

    try {
      this.db.saveAutoModeState(
        projectPath,
        loop.enabled,
        loop.concurrencyLimit,
        loop.lastStartedTaskId
      )
    } catch (error) {
      console.error(`[AutoMode] Error saving state for ${projectPath}:`, error)
      // Continue operation even if state save fails
    }
  }

  /**
   * Load auto-mode state from database
   *
   * @param projectPath - The project path
   * @returns The loaded state or null if not found
   */
  async loadState(projectPath: string): Promise<AutoModeState | null> {
    try {
      const dbState = this.db.getAutoModeState(projectPath)

      if (!dbState) {
        return null
      }

      return {
        isRunning: dbState.enabled,
        runningTaskCount: 0, // Will be updated when tasks are tracked
        concurrencyLimit: dbState.concurrencyLimit,
        lastStartedTaskId: dbState.lastStartedTaskId,
      }
    } catch (error) {
      console.error(`[AutoMode] Error loading state for ${projectPath}:`, error)
      return null
    }
  }

  /**
   * Restore all auto-mode states from database on startup
   */
  async restoreAllStates(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      const enabledStates = this.db.getEnabledAutoModeStates()

      for (const state of enabledStates) {
        console.log(
          `[AutoMode] Restoring auto-mode for ${state.projectPath} (concurrency: ${state.concurrencyLimit})`
        )

        // Start auto-mode for this project
        await this.start(state.projectPath, state.concurrencyLimit)
      }

      this.initialized = true
      console.log(
        `[AutoMode] Restored ${enabledStates.length} auto-mode states`
      )
    } catch (error) {
      console.error(`[AutoMode] Error restoring states:`, error)
    }
  }

  /**
   * Get running task count for a project
   *
   * @param projectPath - The project path
   * @returns The number of running tasks
   */
  getRunningTaskCount(projectPath: string): number {
    const loop = this.loops.get(projectPath)
    return loop?.runningTaskIds.size ?? 0
  }

  /**
   * Get running task IDs for a project
   *
   * @param projectPath - The project path
   * @returns Array of running task IDs
   */
  getRunningTaskIds(projectPath: string): string[] {
    const loop = this.loops.get(projectPath)
    return loop ? Array.from(loop.runningTaskIds) : []
  }

  /**
   * Run the auto-mode loop for a project
   *
   * @param projectPath - The project path
   */
  private async runLoop(projectPath: string): Promise<void> {
    const loop = this.loops.get(projectPath)

    if (!loop || !loop.enabled) {
      return
    }

    // Prevent concurrent loop execution
    if (loop.isProcessing) {
      return
    }

    await this.processNextTask(projectPath)
  }

  /**
   * Process the next eligible task for a project
   *
   * @param projectPath - The project path
   */
  private async processNextTask(projectPath: string): Promise<void> {
    const loop = this.loops.get(projectPath)

    if (!loop || !loop.enabled) {
      return
    }

    // Prevent concurrent processing
    if (loop.isProcessing) {
      return
    }

    loop.isProcessing = true

    try {
      // Check if we have capacity
      if (loop.runningTaskIds.size >= loop.concurrencyLimit) {
        return
      }

      // Get pending tasks for this project
      const pendingTasks = this.getPendingTasksForProject(projectPath)

      if (pendingTasks.length === 0) {
        this.emit('idle', projectPath)
        return
      }

      // Find the next eligible task
      const eligibleTask = this.findNextEligibleTask(pendingTasks)

      if (!eligibleTask) {
        // All pending tasks are blocked
        this.emit('idle', projectPath)
        return
      }

      // Start the task
      await this.startTask(projectPath, eligibleTask)
    } finally {
      loop.isProcessing = false
    }
  }

  /**
   * Get pending tasks for a project
   *
   * @param projectPath - The project path
   * @returns Array of pending tasks
   */
  private getPendingTasksForProject(projectPath: string): AgentTask[] {
    // Get all pending tasks
    const allPendingTasks = this.executorService.getTasks({ status: 'pending' })

    // Filter to tasks for this project
    return allPendingTasks.filter(task => task.targetDirectory === projectPath)
  }

  /**
   * Find the next eligible task (not blocked by dependencies)
   *
   * @param tasks - Array of pending tasks
   * @returns The next eligible task or null if all are blocked
   */
  private findNextEligibleTask(tasks: AgentTask[]): AgentTask | null {
    // Sort by priority (higher first) then by creation time (older first)
    const sortedTasks = [...tasks].sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority
      }
      return a.createdAt.getTime() - b.createdAt.getTime()
    })

    for (const task of sortedTasks) {
      if (this.isTaskEligible(task)) {
        return task
      }
    }

    return null
  }

  /**
   * Check if a task is eligible to be started
   *
   * @param task - The task to check
   * @returns True if the task can be started
   */
  private isTaskEligible(task: AgentTask): boolean {
    // Check if task is in pending status
    if (task.status !== 'pending') {
      return false
    }

    // Check dependencies if dependency manager is available and blocking is enabled
    if (this.dependencyManager) {
      // Check if dependency blocking is enabled in settings
      const dependencyBlockingEnabled = this.db.getSetting(
        'tasks.dependencyBlockingEnabled'
      )

      // Only check dependencies if blocking is enabled (default: true)
      if (dependencyBlockingEnabled !== 'false') {
        const areSatisfied = this.dependencyManager.areDependenciesSatisfied(
          task.id
        )
        if (!areSatisfied) {
          return false
        }
      }
    }

    return true
  }

  /**
   * Start a task via the executor service
   *
   * @param projectPath - The project path
   * @param task - The task to start
   */
  private async startTask(projectPath: string, task: AgentTask): Promise<void> {
    const loop = this.loops.get(projectPath)

    if (!loop || !loop.enabled) {
      return
    }

    try {
      // Track the task as running
      loop.runningTaskIds.add(task.id)
      loop.lastStartedTaskId = task.id

      // Start the task via executor service
      await this.executorService.startTask(task.id)

      // Emit task started event
      this.emit('taskStarted', projectPath, task.id)

      // Save state
      await this.saveState(projectPath)

      // Emit state changed
      this.emitStateChanged(projectPath)

      console.log(`[AutoMode] Started task ${task.id} for ${projectPath}`)
    } catch (error) {
      // Remove from running tasks on error
      loop.runningTaskIds.delete(task.id)

      const errorMessage =
        error instanceof Error ? error.message : String(error)

      // Emit error event
      this.emit('taskStartError', projectPath, task.id, errorMessage)

      console.error(`[AutoMode] Error starting task ${task.id}:`, errorMessage)

      // Continue with next task (error resilience)
      // Don't throw - just log and continue
    }
  }

  /**
   * Clean up resources when service is destroyed
   */
  destroy(): void {
    // Stop all loops
    for (const [projectPath, loop] of this.loops) {
      if (loop.loopInterval) {
        clearInterval(loop.loopInterval)
        loop.loopInterval = null
      }
      loop.enabled = false
    }

    this.loops.clear()
    this.removeAllListeners()
  }
}
