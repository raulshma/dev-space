/**
 * Global Process Service
 *
 * Aggregates running tasks across all projects and provides a unified view
 * of all active agent processes. Enables global task monitoring and control.
 *
 * Implements Requirements:
 * - 2.1: Display list of all currently running tasks across all projects
 * - 2.2: Show task description, project name, project path, and auto-mode indicator
 * - 2.4: Stop specific running tasks
 * - 2.5: Update running tasks view when tasks start/complete
 *
 * @module global-process-service
 */

import { EventEmitter } from 'node:events'
import * as path from 'node:path'
import type { AgentExecutorService } from './agent-executor-service'
import type { AutoModeService } from './auto-mode-service'
import type { AgentTask, TaskStatus } from 'shared/ai-types'

/**
 * Information about a running task for the global view
 */
export interface RunningTaskInfo {
  /** Unique task identifier */
  taskId: string
  /** Path to the project directory */
  projectPath: string
  /** Human-readable project name (derived from path) */
  projectName: string
  /** Task description */
  description: string
  /** Current task status */
  status: TaskStatus
  /** When the task was started */
  startedAt: Date
  /** Whether this task was started by auto-mode */
  isAutoMode: boolean
}

/**
 * Events emitted by the GlobalProcessService
 */
export interface GlobalProcessServiceEvents {
  /** Emitted when the running tasks list is updated */
  tasksUpdated: (tasks: RunningTaskInfo[]) => void
  /** Emitted when a task starts anywhere in the system */
  taskStarted: (task: RunningTaskInfo) => void
  /** Emitted when a task completes anywhere in the system */
  taskCompleted: (taskId: string, projectPath: string) => void
  /** Emitted when a task fails anywhere in the system */
  taskFailed: (taskId: string, projectPath: string, error: string) => void
  /** Emitted when a task is stopped anywhere in the system */
  taskStopped: (taskId: string, projectPath: string) => void
}

/**
 * Interface for the Global Process Service
 */
export interface IGlobalProcessService {
  /**
   * Get all currently running tasks across all projects
   * @returns Array of running task information
   */
  getRunningTasks(): RunningTaskInfo[]

  /**
   * Get the count of currently running tasks
   * @returns Number of running tasks
   */
  getRunningTaskCount(): number

  /**
   * Stop a specific task by ID
   * @param taskId - The task ID to stop
   */
  stopTask(taskId: string): Promise<void>

  /**
   * Register an executor service for a project
   * @param projectPath - The project path
   * @param executorService - The executor service instance
   */
  registerExecutorService(
    projectPath: string,
    executorService: AgentExecutorService
  ): void

  /**
   * Unregister an executor service for a project
   * @param projectPath - The project path
   */
  unregisterExecutorService(projectPath: string): void

  /**
   * Set the auto-mode service for checking auto-mode status
   * @param autoModeService - The auto-mode service instance
   */
  setAutoModeService(autoModeService: AutoModeService): void

  /**
   * Subscribe to running tasks updates
   * @param callback - Callback for task updates
   * @returns Unsubscribe function
   */
  subscribe(callback: (tasks: RunningTaskInfo[]) => void): () => void
}

/**
 * Global Process Service
 *
 * Provides a unified view of all running agent tasks across all projects.
 * Aggregates task information from registered executor services and emits
 * events when tasks start, complete, or fail.
 */
export class GlobalProcessService
  extends EventEmitter
  implements IGlobalProcessService
{
  /** Map of project paths to their executor services */
  private executorServices: Map<string, AgentExecutorService> = new Map()

  /** Reference to the auto-mode service for checking auto-mode status */
  private autoModeService: AutoModeService | null = null

  /** Cleanup functions for executor service listeners */
  private listenerCleanups: Map<string, () => void> = new Map()

  /**
   * Create a new GlobalProcessService instance
   */
  constructor() {
    super()
  }

  /**
   * Register an executor service for a project
   *
   * @param projectPath - The project path
   * @param executorService - The executor service instance
   */
  registerExecutorService(
    projectPath: string,
    executorService: AgentExecutorService
  ): void {
    // Unregister existing service if present
    if (this.executorServices.has(projectPath)) {
      this.unregisterExecutorService(projectPath)
    }

    this.executorServices.set(projectPath, executorService)

    // Set up listeners for task events
    const onTaskStarted = (task: AgentTask) => {
      this.handleTaskStarted(projectPath, task)
    }

    const onTaskCompleted = (task: AgentTask) => {
      this.handleTaskCompleted(projectPath, task)
    }

    const onTaskFailed = (task: AgentTask, error: string) => {
      this.handleTaskFailed(projectPath, task, error)
    }

    const onTaskStopped = (task: AgentTask) => {
      this.handleTaskStopped(projectPath, task)
    }

    executorService.on('taskStarted', onTaskStarted)
    executorService.on('taskCompleted', onTaskCompleted)
    executorService.on('taskFailed', onTaskFailed)
    executorService.on('taskStopped', onTaskStopped)

    // Store cleanup function
    this.listenerCleanups.set(projectPath, () => {
      executorService.off('taskStarted', onTaskStarted)
      executorService.off('taskCompleted', onTaskCompleted)
      executorService.off('taskFailed', onTaskFailed)
      executorService.off('taskStopped', onTaskStopped)
    })

    // Emit updated tasks list
    this.emitTasksUpdated()
  }

  /**
   * Unregister an executor service for a project
   *
   * @param projectPath - The project path
   */
  unregisterExecutorService(projectPath: string): void {
    // Clean up listeners
    const cleanup = this.listenerCleanups.get(projectPath)
    if (cleanup) {
      cleanup()
      this.listenerCleanups.delete(projectPath)
    }

    this.executorServices.delete(projectPath)

    // Emit updated tasks list
    this.emitTasksUpdated()
  }

  /**
   * Set the auto-mode service for checking auto-mode status
   *
   * @param autoModeService - The auto-mode service instance
   */
  setAutoModeService(autoModeService: AutoModeService): void {
    this.autoModeService = autoModeService
  }

  /**
   * Get all currently running tasks across all projects
   *
   * @returns Array of running task information
   */
  getRunningTasks(): RunningTaskInfo[] {
    const runningTasks: RunningTaskInfo[] = []

    for (const [projectPath, executorService] of this.executorServices) {
      // Get running and paused tasks (both are "active")
      const running = executorService.getTasks({ status: 'running' })
      const paused = executorService.getTasks({ status: 'paused' })

      const activeTasks = [...running, ...paused]

      for (const task of activeTasks) {
        runningTasks.push(this.taskToRunningTaskInfo(projectPath, task))
      }
    }

    // Sort by startedAt (most recent first)
    runningTasks.sort((a, b) => {
      return b.startedAt.getTime() - a.startedAt.getTime()
    })

    return runningTasks
  }

  /**
   * Get the count of currently running tasks
   *
   * @returns Number of running tasks
   */
  getRunningTaskCount(): number {
    let count = 0

    for (const executorService of this.executorServices.values()) {
      const running = executorService.getTasks({ status: 'running' })
      const paused = executorService.getTasks({ status: 'paused' })
      count += running.length + paused.length
    }

    return count
  }

  /**
   * Stop a specific task by ID
   *
   * Finds the task across all registered executor services and stops it.
   *
   * @param taskId - The task ID to stop
   * @throws Error if task not found
   */
  async stopTask(taskId: string): Promise<void> {
    // Find the executor service that has this task
    for (const executorService of this.executorServices.values()) {
      const task = executorService.getTask(taskId)
      if (task) {
        await executorService.stopTask(taskId)
        return
      }
    }

    throw new Error(`Task not found: ${taskId}`)
  }

  /**
   * Subscribe to running tasks updates
   *
   * @param callback - Callback for task updates
   * @returns Unsubscribe function
   */
  subscribe(callback: (tasks: RunningTaskInfo[]) => void): () => void {
    this.on('tasksUpdated', callback)
    return () => {
      this.off('tasksUpdated', callback)
    }
  }

  /**
   * Handle task started event from an executor service
   */
  private handleTaskStarted(projectPath: string, task: AgentTask): void {
    const taskInfo = this.taskToRunningTaskInfo(projectPath, task)
    this.emit('taskStarted', taskInfo)
    this.emitTasksUpdated()
  }

  /**
   * Handle task completed event from an executor service
   */
  private handleTaskCompleted(projectPath: string, task: AgentTask): void {
    this.emit('taskCompleted', task.id, projectPath)
    this.emitTasksUpdated()
  }

  /**
   * Handle task failed event from an executor service
   */
  private handleTaskFailed(
    projectPath: string,
    task: AgentTask,
    error: string
  ): void {
    this.emit('taskFailed', task.id, projectPath, error)
    this.emitTasksUpdated()
  }

  /**
   * Handle task stopped event from an executor service
   */
  private handleTaskStopped(projectPath: string, task: AgentTask): void {
    this.emit('taskStopped', task.id, projectPath)
    this.emitTasksUpdated()
  }

  /**
   * Emit the tasksUpdated event with current running tasks
   */
  private emitTasksUpdated(): void {
    const tasks = this.getRunningTasks()
    this.emit('tasksUpdated', tasks)
  }

  /**
   * Convert an AgentTask to RunningTaskInfo
   */
  private taskToRunningTaskInfo(
    projectPath: string,
    task: AgentTask
  ): RunningTaskInfo {
    // Derive project name from path
    const projectName = path.basename(projectPath)

    // Check if this task was started by auto-mode
    let isAutoMode = false
    if (this.autoModeService) {
      const runningTaskIds = this.autoModeService.getRunningTaskIds(projectPath)
      isAutoMode = runningTaskIds.includes(task.id)
    }

    return {
      taskId: task.id,
      projectPath,
      projectName,
      description: task.description,
      status: task.status,
      startedAt: task.startedAt ?? task.createdAt,
      isAutoMode,
    }
  }

  /**
   * Notify that a task has started (for external callers like AutoModeService)
   *
   * @param task - The task that started
   */
  notifyTaskStarted(task: AgentTask): void {
    const projectPath = task.targetDirectory
    const taskInfo = this.taskToRunningTaskInfo(projectPath, task)
    this.emit('taskStarted', taskInfo)
    this.emitTasksUpdated()
  }

  /**
   * Notify that a task has completed (for external callers like AutoModeService)
   *
   * @param task - The task that completed
   */
  notifyTaskCompleted(task: AgentTask): void {
    const projectPath = task.targetDirectory
    this.emit('taskCompleted', task.id, projectPath)
    this.emitTasksUpdated()
  }

  /**
   * Clean up resources when service is destroyed
   */
  destroy(): void {
    // Clean up all listeners
    for (const cleanup of this.listenerCleanups.values()) {
      cleanup()
    }
    this.listenerCleanups.clear()
    this.executorServices.clear()
    this.autoModeService = null
    this.removeAllListeners()
  }
}
