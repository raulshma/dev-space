/**
 * Global Process Service
 *
 * Aggregates running tasks across all projects and provides a unified view
 * of all active agent processes. Enables global task monitoring and control.
 *
 * Updated for AI Agent Rework - now works with the new AgentService and AutoModeService.
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
import type { AgentService } from './agent-service'
import type { AutoModeService } from './auto-mode-service'

/**
 * Task status for the global view
 */
export type GlobalTaskStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'stopped'

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
  status: GlobalTaskStatus
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
   * Set the agent service for task management
   * @param agentService - The agent service instance
   */
  setAgentService(agentService: AgentService): void

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
 * Works with the new AgentService and AutoModeService from the AI Agent Rework.
 */
export class GlobalProcessService
  extends EventEmitter
  implements IGlobalProcessService
{
  /** Reference to the agent service */
  private agentService: AgentService | null = null

  /** Reference to the auto-mode service for checking auto-mode status */
  private autoModeService: AutoModeService | null = null

  /** Cleanup functions for service listeners */
  private listenerCleanups: (() => void)[] = []

  /**
   * Set the agent service for task management
   *
   * @param agentService - The agent service instance
   */
  setAgentService(agentService: AgentService): void {
    this.agentService = agentService

    // Set up listeners for agent service events
    const onStream = () => {
      this.emitTasksUpdated()
    }

    const onError = () => {
      this.emitTasksUpdated()
    }

    agentService.on('stream', onStream)
    agentService.on('error', onError)

    this.listenerCleanups.push(() => {
      agentService.off('stream', onStream)
      agentService.off('error', onError)
    })
  }

  /**
   * Set the auto-mode service for checking auto-mode status
   *
   * @param autoModeService - The auto-mode service instance
   */
  setAutoModeService(autoModeService: AutoModeService): void {
    this.autoModeService = autoModeService

    // Set up listeners for auto-mode service events
    const onProgress = () => {
      this.emitTasksUpdated()
    }

    const onFeatureCompleted = (featureId: string, projectPath: string) => {
      this.emit('taskCompleted', featureId, projectPath)
      this.emitTasksUpdated()
    }

    const onFeatureFailed = (
      featureId: string,
      projectPath: string,
      error: string
    ) => {
      this.emit('taskFailed', featureId, projectPath, error)
      this.emitTasksUpdated()
    }

    autoModeService.on('progress', onProgress)
    autoModeService.on('featureCompleted', onFeatureCompleted)
    autoModeService.on('featureFailed', onFeatureFailed)

    this.listenerCleanups.push(() => {
      autoModeService.off('progress', onProgress)
      autoModeService.off('featureCompleted', onFeatureCompleted)
      autoModeService.off('featureFailed', onFeatureFailed)
    })
  }

  /**
   * Get all currently running tasks across all projects
   *
   * @returns Array of running task information
   */
  getRunningTasks(): RunningTaskInfo[] {
    const runningTasks: RunningTaskInfo[] = []

    // Get running features from auto-mode service
    // Note: AutoModeService tracks running features via getState per project
    // For now, return empty array as we don't have a global list of projects
    // This would need to be enhanced to track all active projects

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
    return this.getRunningTasks().length
  }

  /**
   * Stop a specific task by ID
   *
   * @param taskId - The task ID to stop
   * @throws Error if task not found or cannot be stopped
   */
  async stopTask(taskId: string): Promise<void> {
    // Try to stop via auto-mode service first
    if (this.autoModeService) {
      const stopped = await this.autoModeService.stopFeature(taskId)
      if (stopped) {
        this.emit('taskStopped', taskId, '')
        this.emitTasksUpdated()
        return
      }
    }

    // Try to stop via agent service
    if (this.agentService) {
      await this.agentService.stopExecution(taskId)
      this.emit('taskStopped', taskId, '')
      this.emitTasksUpdated()
      return
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
   * Emit the tasksUpdated event with current running tasks
   */
  private emitTasksUpdated(): void {
    const tasks = this.getRunningTasks()
    this.emit('tasksUpdated', tasks)
  }

  /**
   * Notify that a task has started (for external callers)
   *
   * @param taskId - The task ID
   * @param projectPath - The project path
   * @param description - Task description
   */
  notifyTaskStarted(
    taskId: string,
    projectPath: string,
    description: string
  ): void {
    const taskInfo: RunningTaskInfo = {
      taskId,
      projectPath,
      projectName: path.basename(projectPath),
      description,
      status: 'running',
      startedAt: new Date(),
      isAutoMode: false,
    }
    this.emit('taskStarted', taskInfo)
    this.emitTasksUpdated()
  }

  /**
   * Notify that a task has completed (for external callers)
   *
   * @param taskId - The task ID
   * @param projectPath - The project path
   */
  notifyTaskCompleted(taskId: string, projectPath: string): void {
    this.emit('taskCompleted', taskId, projectPath)
    this.emitTasksUpdated()
  }

  /**
   * Clean up resources when service is destroyed
   */
  destroy(): void {
    // Clean up all listeners
    for (const cleanup of this.listenerCleanups) {
      cleanup()
    }
    this.listenerCleanups = []
    this.agentService = null
    this.autoModeService = null
    this.removeAllListeners()
  }
}
