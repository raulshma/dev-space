/**
 * Agent Executor Service
 *
 * Manages coding agent task execution, including task CRUD operations,
 * execution lifecycle, output streaming, and completion handling.
 *
 * Implements Requirements:
 * - 6.1: Create tasks with description, agent type, and target directory
 * - 6.4: Add confirmed tasks to backlog with "pending" status
 * - 6.5: Validate feature agent target directory contains valid repository
 * - 7.1: Display tasks with status, description, and creation time
 * - 7.2: Move tasks to "implement" status and queue for execution
 * - 7.3: Reorder tasks to update execution priority
 * - 7.4: Cancel pending tasks
 * - 7.5: Edit pending task parameters
 * - 8.1: Execute coding agent via Claude Agent SDK
 * - 8.2: Route to appropriate agent service (Claude SDK or Jules API)
 * - 9.2: Display live output stream with auto-scroll
 * - 9.3: Append new output within 100ms
 * - 9.5: Pause auto-scroll when user scrolls up
 * - 10.1: Display pause and stop buttons
 * - 10.2: Send SIGSTOP to pause agent
 * - 10.3: Send SIGCONT to resume agent
 * - 10.4: Send SIGTERM for graceful shutdown
 * - 11.1: Update task status to "completed" on success
 * - 11.2: Capture file change summary
 * - 11.3: Update status to "failed" on error
 * - 11.4: Show full execution log and duration
 * - 11.5: Display git diff for repository tasks
 *
 * @module agent-executor-service
 */

import { EventEmitter } from 'node:events'
import { existsSync } from 'node:fs'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import type { DatabaseService } from './database'
import type { ProcessManager, ManagedProcess } from './agent/process-manager'
import {
  ClaudeSdkService,
  type ClaudeExecutionConfig,
} from './agent/claude-sdk-service'
import { createAutoModeOptions, MAX_TURNS } from './agent/sdk-options'
import type { TaskQueue } from './agent/task-queue'
import type { OutputBuffer, OutputCallback } from './agent/output-buffer'
import type { AgentConfigService } from './agent/agent-config-service'
import type { JulesService } from './agent/jules-service'
import type { GitService } from './git-service'
import type {
  AgentTask,
  AgentTaskFilter,
  CreateAgentTaskInput,
  UpdateAgentTaskInput,
  TaskStatus,
  FileChangeSummary,
  OutputLine,
  ExecutionStep,
  PlanTask,
} from 'shared/ai-types'
import {
  getPlanningPromptPrefix,
  hasPlanGenerated,
  needsPlanApproval,
  extractTaskProgress,
  updateTaskStatuses,
  parseTasksFromSpec,
} from './agent/planning-prompts'
import { loadContextFiles, combineSystemPrompts } from './agent/context-loader'
import type { WorkingDirectoryService } from './agent/working-directory-service'
import type { WorktreeService, Worktree } from './worktree-service'
import type {
  JulesSessionStatus,
  JulesTaskState,
} from 'shared/notification-types'

const execAsync = promisify(exec)

/**
 * Error codes for agent executor operations
 */
export enum AgentExecutorErrorCode {
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',
  NOT_A_REPOSITORY = 'NOT_A_REPOSITORY',
  INVALID_DIRECTORY = 'INVALID_DIRECTORY',
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  PROCESS_SPAWN_FAILED = 'PROCESS_SPAWN_FAILED',
  SCRIPT_NOT_FOUND = 'SCRIPT_NOT_FOUND',
  JULES_API_ERROR = 'JULES_API_ERROR',
  JULES_SOURCE_REQUIRED = 'JULES_SOURCE_REQUIRED',
}

/**
 * Custom error class for agent executor operations
 */
export class AgentExecutorError extends Error {
  constructor(
    message: string,
    public code: AgentExecutorErrorCode,
    public taskId?: string,
    public cause?: Error
  ) {
    super(message)
    this.name = 'AgentExecutorError'
  }
}

/**
 * Valid state transitions for agent tasks
 */
const VALID_STATE_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ['queued', 'stopped', 'completed'],
  queued: ['running', 'pending', 'stopped', 'completed', 'archived'],
  running: [
    'paused',
    'awaiting_approval',
    'review',
    'completed',
    'failed',
    'stopped',
  ],
  paused: ['running', 'stopped', 'completed'],
  awaiting_approval: ['running', 'stopped', 'failed'],
  review: ['queued', 'running', 'completed', 'stopped'],
  completed: ['pending', 'archived'],
  failed: ['pending', 'queued', 'archived'],
  stopped: ['pending', 'queued', 'archived'],
  archived: ['pending'],
}

/**
 * Interface for the Agent Executor Service
 */
export interface IAgentExecutorService {
  // Task CRUD operations
  createTask(params: CreateAgentTaskInput): Promise<AgentTask>
  getTask(taskId: string): AgentTask | undefined
  getTasks(filter?: AgentTaskFilter): AgentTask[]
  updateTask(taskId: string, updates: UpdateAgentTaskInput): Promise<AgentTask>
  deleteTask(taskId: string): Promise<void>

  // Execution control
  startTask(taskId: string): Promise<void>
  pauseTask(taskId: string): Promise<void>
  resumeTask(taskId: string): Promise<void>
  restartTask(
    taskId: string,
    resumeSession?: boolean,
    forkSession?: boolean
  ): Promise<{ sessionId?: string }>
  restartTaskWithFeedback(
    taskId: string,
    feedback: string
  ): Promise<{ sessionId?: string }>
  stopTask(taskId: string): Promise<void>

  // Plan approval workflow
  approvePlan(taskId: string): Promise<AgentTask>
  rejectPlan(taskId: string, feedback: string): Promise<AgentTask>

  // Output streaming
  getTaskOutput(taskId: string): OutputLine[]
  subscribeToOutput(taskId: string, callback: OutputCallback): () => void

  // Backlog management
  getBacklogSize(): number
  reorderBacklog(taskIds: string[]): void
}

/**
 * Events emitted by the AgentExecutorService
 */
export interface AgentExecutorEvents {
  taskCreated: (task: AgentTask) => void
  taskUpdated: (task: AgentTask) => void
  taskDeleted: (taskId: string) => void
  taskStarted: (task: AgentTask) => void
  taskPaused: (task: AgentTask) => void
  taskResumed: (task: AgentTask) => void
  taskRestarted: (task: AgentTask, resumedSession: boolean) => void
  taskStopped: (task: AgentTask) => void
  taskEnteredReview: (task: AgentTask) => void
  taskCompleted: (task: AgentTask) => void
  taskFailed: (task: AgentTask, error: string) => void
  taskAwaitingApproval: (task: AgentTask) => void
  planApproved: (task: AgentTask) => void
  planRejected: (task: AgentTask, feedback: string) => void
  planAutoApproved: (task: AgentTask) => void
  subTaskStarted: (
    task: AgentTask,
    subTask: PlanTask,
    index: number,
    total: number
  ) => void
  subTaskCompleted: (
    task: AgentTask,
    subTask: PlanTask,
    index: number,
    total: number
  ) => void
  phaseCompleted: (task: AgentTask, phaseNumber: number) => void
  outputReceived: (taskId: string, line: OutputLine) => void
}

/**
 * Agent Executor Service
 *
 * Manages the full lifecycle of coding agent tasks including creation,
 * execution, output streaming, and completion handling.
 */
export class AgentExecutorService
  extends EventEmitter
  implements IAgentExecutorService
{
  private db: DatabaseService
  private processManager: ProcessManager
  private claudeSdkService: ClaudeSdkService
  private taskQueue: TaskQueue
  private outputBuffer: OutputBuffer
  private configService: AgentConfigService
  private gitService: GitService
  private julesService: JulesService | null
  private workingDirectoryService: WorkingDirectoryService | null
  private worktreeService: WorktreeService | null

  /** Map of task IDs to their managed processes (legacy, kept for compatibility) */
  private taskProcesses: Map<string, ManagedProcess> = new Map()

  /** Map of task IDs to Jules polling intervals */
  private julesPollingIntervals: Map<string, NodeJS.Timeout> = new Map()

  /** Cache of Jules activities by task ID */
  private julesActivitiesCache: Map<
    string,
    {
      activities: import('./agent/jules-service').JulesActivity[]
      lastFetchTime: number
    }
  > = new Map()

  /** Whether the service has been initialized */
  private initialized = false

  /**
   * Create a new AgentExecutorService instance
   */
  constructor(
    db: DatabaseService,
    processManager: ProcessManager,
    taskQueue: TaskQueue,
    outputBuffer: OutputBuffer,
    configService: AgentConfigService,
    gitService: GitService,
    julesService?: JulesService,
    workingDirectoryService?: WorkingDirectoryService,
    worktreeService?: WorktreeService
  ) {
    super()
    this.db = db
    this.processManager = processManager
    this.claudeSdkService = new ClaudeSdkService()
    this.taskQueue = taskQueue
    this.outputBuffer = outputBuffer
    this.configService = configService
    this.gitService = gitService
    this.julesService = julesService ?? null
    this.workingDirectoryService = workingDirectoryService ?? null
    this.worktreeService = worktreeService ?? null
  }

  /**
   * Update the execution step for a task and emit output
   */
  private async updateExecutionStep(
    taskId: string,
    step: ExecutionStep,
    message?: string
  ): Promise<void> {
    await this.updateTask(taskId, { executionStep: step })

    if (message) {
      const line = this.outputBuffer.append(
        taskId,
        `[Mira] ${message}\n`,
        'stdout'
      )
      this.emit('outputReceived', taskId, line)
    }
  }

  /**
   * Initialize the service and recover from previous session
   *
   * Called after database is initialized. Recovers tasks that were
   * interrupted by a previous shutdown (running/queued/paused tasks
   * are reset to stopped status).
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    console.log('Initializing Agent Executor Service...')

    // Recover interrupted tasks from previous session
    await this.recoverInterruptedTasks()

    this.initialized = true
    console.log('Agent Executor Service initialized')
  }

  /**
   * Recover tasks that were interrupted by app shutdown
   *
   * - Jules tasks: Fetch latest status from Google Jules API (they run in the cloud)
   * - Claude Code tasks: Mark as stopped (can be auto-resumed based on setting)
   */
  private async recoverInterruptedTasks(): Promise<void> {
    const interruptedStatuses: TaskStatus[] = ['running', 'queued', 'paused']

    for (const status of interruptedStatuses) {
      const tasks = this.db.getAgentTasks({ status })

      for (const task of tasks) {
        console.log(
          `Recovering interrupted task ${task.id} (was ${task.status})`
        )

        // Handle Jules tasks differently - they run in the cloud
        if (task.serviceType === 'google-jules' && task.julesSessionId) {
          await this.recoverJulesTask(task)
        } else {
          // Claude Code tasks - mark as stopped (local process no longer exists)
          this.db.updateAgentTask(task.id, {
            status: 'stopped',
            error: `Task was interrupted by application shutdown (was ${task.status})`,
            completedAt: new Date(),
          })
        }

        // Persist any buffered output that might exist
        await this.outputBuffer.persist(task.id)
      }
    }
  }

  /**
   * Recover a Jules task by fetching its current status from the API
   *
   * Jules tasks run in Google's cloud, so they continue even when the app is closed.
   * We fetch the latest status and resume polling if still active.
   */
  private async recoverJulesTask(task: AgentTask): Promise<void> {
    if (!this.julesService || !task.julesSessionId) {
      // Can't recover without Jules service or session ID
      this.db.updateAgentTask(task.id, {
        status: 'stopped',
        error: 'Unable to recover Jules task: missing service or session ID',
        completedAt: new Date(),
      })
      return
    }

    try {
      console.log(`Fetching Jules session status for task ${task.id}`)
      const session = await this.julesService.getSession(task.julesSessionId)

      // Check if session has completed (has outputs)
      if (session.outputs && session.outputs.length > 0) {
        // Session completed while app was closed
        const line = this.outputBuffer.append(
          task.id,
          `\n[Jules] Session recovered - task completed while app was closed\n`,
          'stdout'
        )
        this.emit('outputReceived', task.id, line)

        for (const output of session.outputs) {
          if (output.pullRequest) {
            const prLine = this.outputBuffer.append(
              task.id,
              `[Jules] Pull Request: ${output.pullRequest.url}\n`,
              'stdout'
            )
            this.emit('outputReceived', task.id, prLine)
          }
        }

        this.db.updateAgentTask(task.id, {
          status: 'completed',
          completedAt: new Date(),
        })
      } else {
        // Session still active - resume polling
        console.log(`Resuming Jules polling for task ${task.id}`)
        const line = this.outputBuffer.append(
          task.id,
          `\n[Jules] Session recovered - resuming monitoring\n`,
          'stdout'
        )
        this.emit('outputReceived', task.id, line)

        // Keep status as running and start polling
        this.db.updateAgentTask(task.id, {
          status: 'running',
        })
        this.taskQueue.setCurrentTask(task.id)
        this.startJulesPolling(task.id, task.julesSessionId)
      }
    } catch (error) {
      console.error(`Failed to recover Jules task ${task.id}:`, error)
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      this.db.updateAgentTask(task.id, {
        status: 'failed',
        error: `Failed to recover Jules session: ${errorMessage}`,
        completedAt: new Date(),
      })
    }
  }

  /**
   * Auto-resume interrupted Claude Code tasks
   *
   * Called after initialization if auto-resume is enabled.
   * Restarts stopped tasks that were interrupted by shutdown.
   */
  async autoResumeInterruptedTasks(): Promise<number> {
    const stoppedTasks = this.db.getAgentTasks({ status: 'stopped' })

    // Filter to only tasks that were interrupted by shutdown (not manually stopped)
    const interruptedTasks = stoppedTasks.filter(
      task =>
        task.error?.includes('interrupted by application shutdown') &&
        task.serviceType !== 'google-jules' // Jules tasks are handled separately
    )

    let resumedCount = 0

    for (const task of interruptedTasks) {
      try {
        console.log(`Auto-resuming interrupted task ${task.id}`)

        // Reset task to pending status
        this.db.updateAgentTask(task.id, {
          status: 'pending',
          error: undefined,
          completedAt: undefined,
        })

        // Clear old output and start fresh
        this.outputBuffer.clear(task.id)
        const line = this.outputBuffer.append(
          task.id,
          `[Mira] Task auto-resumed after application restart\n`,
          'stdout'
        )
        this.emit('outputReceived', task.id, line)

        // Start the task
        await this.startTask(task.id)
        resumedCount++
      } catch (error) {
        console.error(`Failed to auto-resume task ${task.id}:`, error)
      }
    }

    return resumedCount
  }

  /**
   * Load persisted output for a task into the buffer
   *
   * Called when viewing task details to restore output from database.
   *
   * @param taskId - The task ID
   * @returns Array of output lines
   */
  async loadTaskOutput(taskId: string): Promise<OutputLine[]> {
    return this.outputBuffer.load(taskId)
  }

  // ============================================================================
  // TASK CRUD OPERATIONS
  // ============================================================================

  /**
   * Create a new agent task
   *
   * Validates the target directory for feature agents (must be a git repository).
   * Creates the task with "pending" status and adds it to the backlog.
   *
   * @param params - Task creation parameters
   * @returns The created task
   * @throws AgentExecutorError if validation fails
   */
  async createTask(params: CreateAgentTaskInput): Promise<AgentTask> {
    const serviceType = params.serviceType ?? 'claude-code'

    // Validation based on service type
    if (serviceType === 'claude-code') {
      // Validate target directory exists
      if (!existsSync(params.targetDirectory)) {
        throw new AgentExecutorError(
          `Target directory does not exist: ${params.targetDirectory}`,
          AgentExecutorErrorCode.INVALID_DIRECTORY
        )
      }

      // For feature agents, validate that target is a git repository
      if (params.agentType === 'feature') {
        const isRepo = await this.gitService.isGitRepo(params.targetDirectory)
        if (!isRepo) {
          throw new AgentExecutorError(
            `Target directory is not a valid git repository: ${params.targetDirectory}`,
            AgentExecutorErrorCode.NOT_A_REPOSITORY
          )
        }
      }
    } else if (serviceType === 'google-jules') {
      // Validate Jules source is provided
      if (!params.julesParams?.source) {
        throw new AgentExecutorError(
          'Jules source (GitHub repository) is required',
          AgentExecutorErrorCode.JULES_SOURCE_REQUIRED
        )
      }
    }

    // Create task in database with "pending" status
    const task = this.db.createAgentTask(params)

    this.emit('taskCreated', task)

    return task
  }

  /**
   * Get a task by ID
   *
   * @param taskId - The task ID
   * @returns The task or undefined if not found
   */
  getTask(taskId: string): AgentTask | undefined {
    return this.db.getAgentTask(taskId) ?? undefined
  }

  /**
   * Get tasks with optional filtering
   *
   * @param filter - Optional filter criteria
   * @returns Array of tasks matching the filter
   */
  getTasks(filter?: AgentTaskFilter): AgentTask[] {
    return this.db.getAgentTasks(filter)
  }

  /**
   * Update a task
   *
   * Only allows updating pending tasks (except for status changes during execution).
   *
   * @param taskId - The task ID
   * @param updates - Fields to update
   * @returns The updated task
   * @throws AgentExecutorError if task not found
   */
  async updateTask(
    taskId: string,
    updates: UpdateAgentTaskInput
  ): Promise<AgentTask> {
    const existingTask = this.db.getAgentTask(taskId)
    if (!existingTask) {
      throw new AgentExecutorError(
        `Task not found: ${taskId}`,
        AgentExecutorErrorCode.TASK_NOT_FOUND,
        taskId
      )
    }

    // Validate state transition if status is being updated
    if (updates.status && updates.status !== existingTask.status) {
      if (!this.isValidStateTransition(existingTask.status, updates.status)) {
        throw new AgentExecutorError(
          `Invalid state transition from ${existingTask.status} to ${updates.status}`,
          AgentExecutorErrorCode.INVALID_STATE_TRANSITION,
          taskId
        )
      }
    }

    const updatedTask = this.db.updateAgentTask(taskId, updates)
    if (!updatedTask) {
      throw new AgentExecutorError(
        `Failed to update task: ${taskId}`,
        AgentExecutorErrorCode.TASK_NOT_FOUND,
        taskId
      )
    }

    this.emit('taskUpdated', updatedTask)

    return updatedTask
  }

  /**
   * Delete a task
   *
   * Only allows deleting tasks that are not currently running.
   *
   * @param taskId - The task ID
   * @throws AgentExecutorError if task not found or is running
   */
  async deleteTask(taskId: string): Promise<void> {
    const task = this.db.getAgentTask(taskId)
    if (!task) {
      throw new AgentExecutorError(
        `Task not found: ${taskId}`,
        AgentExecutorErrorCode.TASK_NOT_FOUND,
        taskId
      )
    }

    // Cannot delete running or paused tasks
    if (task.status === 'running' || task.status === 'paused') {
      throw new AgentExecutorError(
        `Cannot delete task in ${task.status} state. Stop the task first.`,
        AgentExecutorErrorCode.INVALID_STATE_TRANSITION,
        taskId
      )
    }

    // Remove from queue if queued
    if (task.status === 'queued') {
      this.taskQueue.remove(taskId)
    }

    // Clear output buffer
    this.outputBuffer.clear(taskId)

    // Delete from database
    this.db.deleteAgentTask(taskId)

    this.emit('taskDeleted', taskId)
  }

  // ============================================================================
  // EXECUTION CONTROL
  // ============================================================================

  /**
   * Start a task
   *
   * Moves the task to "queued" status and adds it to the task queue.
   * If no other task is running, starts execution immediately.
   *
   * @param taskId - The task ID
   * @throws AgentExecutorError if task not found or invalid state
   */
  async startTask(taskId: string): Promise<void> {
    const task = this.db.getAgentTask(taskId)
    if (!task) {
      throw new AgentExecutorError(
        `Task not found: ${taskId}`,
        AgentExecutorErrorCode.TASK_NOT_FOUND,
        taskId
      )
    }

    // Validate state transition
    if (!this.isValidStateTransition(task.status, 'queued')) {
      throw new AgentExecutorError(
        `Cannot start task in ${task.status} state`,
        AgentExecutorErrorCode.INVALID_STATE_TRANSITION,
        taskId
      )
    }

    // Validate configuration
    const isConfigured = await this.configService.isConfigured()
    if (!isConfigured) {
      throw new AgentExecutorError(
        'Agent environment is not properly configured',
        AgentExecutorErrorCode.INVALID_CONFIGURATION,
        taskId
      )
    }

    // Update status to queued
    await this.updateTask(taskId, { status: 'queued' })

    // Add to queue
    this.taskQueue.enqueue(taskId)

    // If no task is currently running, start this one
    if (!this.taskQueue.isProcessing()) {
      await this.processNextTask()
    }
  }

  /**
   * Pause a running task
   *
   * Pauses the Claude SDK execution and updates status to "paused".
   *
   * @param taskId - The task ID
   * @throws AgentExecutorError if task not found or not running
   */
  async pauseTask(taskId: string): Promise<void> {
    const task = this.db.getAgentTask(taskId)
    if (!task) {
      throw new AgentExecutorError(
        `Task not found: ${taskId}`,
        AgentExecutorErrorCode.TASK_NOT_FOUND,
        taskId
      )
    }

    if (task.status !== 'running') {
      throw new AgentExecutorError(
        `Cannot pause task in ${task.status} state`,
        AgentExecutorErrorCode.INVALID_STATE_TRANSITION,
        taskId
      )
    }

    // Pause Claude SDK execution
    if (this.claudeSdkService.isExecuting(taskId)) {
      this.claudeSdkService.pause(taskId)
    }

    // Legacy: pause process if exists
    const process = this.taskProcesses.get(taskId)
    if (process) {
      process.pause()
    }

    await this.updateTask(taskId, { status: 'paused' })

    const updatedTask = this.db.getAgentTask(taskId)
    if (updatedTask) {
      this.emit('taskPaused', updatedTask)
    }
  }

  /**
   * Resume a paused task
   *
   * Resumes the Claude SDK execution and updates status to "running".
   *
   * @param taskId - The task ID
   * @throws AgentExecutorError if task not found or not paused
   */
  async resumeTask(taskId: string): Promise<void> {
    const task = this.db.getAgentTask(taskId)
    if (!task) {
      throw new AgentExecutorError(
        `Task not found: ${taskId}`,
        AgentExecutorErrorCode.TASK_NOT_FOUND,
        taskId
      )
    }

    if (task.status !== 'paused') {
      throw new AgentExecutorError(
        `Cannot resume task in ${task.status} state`,
        AgentExecutorErrorCode.INVALID_STATE_TRANSITION,
        taskId
      )
    }

    // Resume Claude SDK execution
    if (this.claudeSdkService.isPaused(taskId)) {
      this.claudeSdkService.resume(taskId)
    }

    // Legacy: resume process if exists
    const process = this.taskProcesses.get(taskId)
    if (process) {
      process.resume()
    }

    await this.updateTask(taskId, { status: 'running' })

    const updatedTask = this.db.getAgentTask(taskId)
    if (updatedTask) {
      this.emit('taskResumed', updatedTask)
    }
  }

  /**
   * Restart a stopped or failed task
   *
   * Restarts the task, optionally resuming from the previous Claude SDK session.
   * This allows continuing work from where the agent left off.
   *
   * @param taskId - The task ID
   * @param resumeSession - Whether to resume from the previous session (default: true if session exists)
   * @param forkSession - Whether to fork the session instead of continuing it
   * @returns Object containing the new session ID if created
   * @throws AgentExecutorError if task not found or invalid state
   */
  async restartTask(
    taskId: string,
    resumeSession = true,
    forkSession = false
  ): Promise<{ sessionId?: string }> {
    const task = this.db.getAgentTask(taskId)
    if (!task) {
      throw new AgentExecutorError(
        `Task not found: ${taskId}`,
        AgentExecutorErrorCode.TASK_NOT_FOUND,
        taskId
      )
    }

    // Can restart from stopped, failed, or completed states
    const restartableStates: TaskStatus[] = ['stopped', 'failed', 'completed']
    if (!restartableStates.includes(task.status)) {
      throw new AgentExecutorError(
        `Cannot restart task in ${task.status} state. Task must be stopped, failed, or completed.`,
        AgentExecutorErrorCode.INVALID_STATE_TRANSITION,
        taskId
      )
    }

    // Validate configuration
    const isConfigured = await this.configService.isConfigured()
    if (!isConfigured) {
      throw new AgentExecutorError(
        'Agent environment is not properly configured',
        AgentExecutorErrorCode.INVALID_CONFIGURATION,
        taskId
      )
    }

    // Check if we have a session to resume
    const hasSession = !!task.parameters.sessionId
    const willResumeSession = resumeSession && hasSession

    // Log the restart action
    const resumeInfo = willResumeSession
      ? forkSession
        ? `forking from session ${task.parameters.sessionId}`
        : `resuming session ${task.parameters.sessionId}`
      : 'starting fresh (no previous session)'

    const line = this.outputBuffer.append(
      taskId,
      `[Mira] Restarting task - ${resumeInfo}\n`,
      'stdout'
    )
    this.emit('outputReceived', taskId, line)

    // Update task parameters for session resume
    if (willResumeSession) {
      // The sessionId is already stored, just need to set forkSession flag if needed
      await this.updateTask(taskId, {
        parameters: {
          ...task.parameters,
          // Store fork preference for the execution
        },
      })
    }

    // Clear error state
    await this.updateTask(taskId, {
      status: 'queued',
      error: undefined,
      completedAt: undefined,
      exitCode: undefined,
    })

    // Add to queue
    this.taskQueue.enqueue(taskId)

    const updatedTask = this.db.getAgentTask(taskId)
    if (updatedTask) {
      this.emit('taskRestarted', updatedTask, willResumeSession)
    }

    // If no task is currently running, start this one
    if (!this.taskQueue.isProcessing()) {
      await this.processNextTask()
    }

    return { sessionId: task.parameters.sessionId }
  }

  /**
   * Restart a task with feedback context
   *
   * Restarts the agent with user feedback as additional context.
   * This is used during the review workflow when a user submits feedback.
   * The task transitions from "review" to "running" status.
   *
   * Implements Requirements:
   * - 4.2: Restart agent with feedback as additional context
   * - 4.3: Update task status to "running" when restarting
   * - 4.4: Return to "review" status on completion
   *
   * @param taskId - The task ID
   * @param feedback - The user feedback to include as context
   * @returns Object containing the session ID
   * @throws AgentExecutorError if task not found or not in review status
   */
  async restartTaskWithFeedback(
    taskId: string,
    feedback: string
  ): Promise<{ sessionId?: string }> {
    const task = this.db.getAgentTask(taskId)
    if (!task) {
      throw new AgentExecutorError(
        `Task not found: ${taskId}`,
        AgentExecutorErrorCode.TASK_NOT_FOUND,
        taskId
      )
    }

    // Can only restart with feedback from review status
    if (task.status !== 'review') {
      throw new AgentExecutorError(
        `Cannot restart task with feedback in ${task.status} state. Task must be in review status.`,
        AgentExecutorErrorCode.INVALID_STATE_TRANSITION,
        taskId
      )
    }

    // Validate configuration
    const isConfigured = await this.configService.isConfigured()
    if (!isConfigured) {
      throw new AgentExecutorError(
        'Agent environment is not properly configured',
        AgentExecutorErrorCode.INVALID_CONFIGURATION,
        taskId
      )
    }

    // Build the feedback prompt to prepend to the original description
    const feedbackPrompt = `\n\n---\nUser Review Feedback:\n${feedback}\n\nPlease address the feedback above and continue working on the task.\n---\n\n`

    // Log the restart action
    const line = this.outputBuffer.append(
      taskId,
      `[Mira] Restarting task with user feedback\n` +
        `[Mira] Feedback: ${feedback.substring(0, 100)}${feedback.length > 100 ? '...' : ''}\n`,
      'stdout'
    )
    this.emit('outputReceived', taskId, line)

    // Update task with feedback context appended to description
    // The original description is preserved, feedback is added as context
    const updatedDescription = task.description + feedbackPrompt

    // Increment review iterations counter
    const reviewIterations = (task.reviewIterations ?? 0) + 1

    // Update task to running status with feedback context
    await this.updateTask(taskId, {
      status: 'queued',
      description: updatedDescription,
      reviewIterations,
      error: undefined,
      completedAt: undefined,
      exitCode: undefined,
    })

    // Add to queue
    this.taskQueue.enqueue(taskId)

    const updatedTask = this.db.getAgentTask(taskId)
    if (updatedTask) {
      this.emit('taskRestarted', updatedTask, true)
    }

    // If no task is currently running, start this one
    if (!this.taskQueue.isProcessing()) {
      await this.processNextTask()
    }

    return { sessionId: task.parameters.sessionId }
  }

  /**
   * Stop a task
   *
   * Stops the Claude SDK execution and updates status to "stopped".
   *
   * @param taskId - The task ID
   * @throws AgentExecutorError if task not found
   */
  async stopTask(taskId: string): Promise<void> {
    const task = this.db.getAgentTask(taskId)
    if (!task) {
      throw new AgentExecutorError(
        `Task not found: ${taskId}`,
        AgentExecutorErrorCode.TASK_NOT_FOUND,
        taskId
      )
    }

    // Can stop from pending, queued, running, paused, or awaiting_approval states
    const stoppableStates: TaskStatus[] = [
      'pending',
      'queued',
      'running',
      'paused',
      'awaiting_approval',
    ]
    if (!stoppableStates.includes(task.status)) {
      throw new AgentExecutorError(
        `Cannot stop task in ${task.status} state`,
        AgentExecutorErrorCode.INVALID_STATE_TRANSITION,
        taskId
      )
    }

    // Remove from queue if queued
    if (task.status === 'queued') {
      this.taskQueue.remove(taskId)
    }

    // Stop Claude SDK execution
    if (this.claudeSdkService.isExecuting(taskId)) {
      this.claudeSdkService.stop(taskId)
    }

    // Legacy: Kill process if running or paused
    const process = this.taskProcesses.get(taskId)
    if (process) {
      if (task.status === 'paused') {
        process.resume()
      }
      process.kill('SIGTERM')
      this.taskProcesses.delete(taskId)
    }

    // Stop Jules polling if this is a Jules task
    this.stopJulesPolling(taskId)

    // Clear current task if this was the running task
    if (this.taskQueue.getCurrentTaskId() === taskId) {
      this.taskQueue.setCurrentTask(undefined)
    }

    await this.updateTask(taskId, {
      status: 'stopped',
      completedAt: new Date(),
    })

    const updatedTask = this.db.getAgentTask(taskId)
    if (updatedTask) {
      this.emit('taskStopped', updatedTask)
    }

    // Process next task in queue
    await this.processNextTask()
  }

  // ============================================================================
  // PLAN APPROVAL WORKFLOW
  // ============================================================================

  /**
   * Approve a generated plan and continue execution
   *
   * When a task is in 'awaiting_approval' status, this method approves the plan
   * and resumes execution. The agent will receive an 'approved' message to continue.
   *
   * @param taskId - The task ID
   * @returns The updated task
   * @throws AgentExecutorError if task not found or not awaiting approval
   */
  async approvePlan(taskId: string): Promise<AgentTask> {
    const task = this.db.getAgentTask(taskId)
    if (!task) {
      throw new AgentExecutorError(
        `Task not found: ${taskId}`,
        AgentExecutorErrorCode.TASK_NOT_FOUND,
        taskId
      )
    }

    if (task.status !== 'awaiting_approval') {
      throw new AgentExecutorError(
        `Cannot approve plan for task in ${task.status} state`,
        AgentExecutorErrorCode.INVALID_STATE_TRANSITION,
        taskId
      )
    }

    // Update plan spec status to approved
    const updatedPlanSpec = task.planSpec
      ? {
          ...task.planSpec,
          status: 'approved' as const,
          approvedAt: new Date(),
        }
      : undefined

    // Add approval message to output
    const line = this.outputBuffer.append(
      taskId,
      '\n[Mira] Plan approved. Proceeding with implementation...\n',
      'stdout'
    )
    this.emit('outputReceived', taskId, line)

    // Check if the SDK execution is still active (paused)
    if (this.claudeSdkService.isPaused(taskId)) {
      // SDK is still running, just resume it
      await this.updateTask(taskId, {
        status: 'running',
        planSpec: updatedPlanSpec,
      })
      this.claudeSdkService.resume(taskId)
    } else {
      // SDK execution has completed, need to restart with continuation context
      // Store approved plan content so execution knows to proceed with implementation
      
      // Check if we have parsed tasks for multi-task execution
      const parsedTasks = task.planSpec?.tasks || []
      const useMultiTaskExecution = parsedTasks.length > 0
      
      await this.updateTask(taskId, {
        status: 'queued',
        planSpec: updatedPlanSpec,
        parameters: {
          ...task.parameters,
          continuationMode: 'post-approval',
          approvedPlanContent: task.planSpec?.content,
          // Enable multi-task mode if we have parsed tasks
          useMultiTaskExecution,
        },
      })

      // Add to queue to continue execution with continuation context
      this.taskQueue.enqueue(taskId)

      // If no task is currently running, start processing
      if (!this.taskQueue.isProcessing()) {
        // Use setImmediate to avoid blocking the current call
        setImmediate(() => {
          this.processNextTask().catch(err => {
            console.error(
              'Failed to process next task after plan approval:',
              err
            )
          })
        })
      }
    }

    const updatedTask = this.db.getAgentTask(taskId)
    if (!updatedTask) {
      throw new AgentExecutorError(
        `Failed to retrieve updated task: ${taskId}`,
        AgentExecutorErrorCode.TASK_NOT_FOUND,
        taskId
      )
    }

    this.emit('planApproved', updatedTask)

    return updatedTask
  }

  /**
   * Reject a generated plan with feedback
   *
   * When a task is in 'awaiting_approval' status, this method rejects the plan
   * and sends feedback to the agent for regeneration.
   *
   * @param taskId - The task ID
   * @param feedback - Feedback for plan revision
   * @returns The updated task
   * @throws AgentExecutorError if task not found or not awaiting approval
   */
  async rejectPlan(taskId: string, feedback: string): Promise<AgentTask> {
    const task = this.db.getAgentTask(taskId)
    if (!task) {
      throw new AgentExecutorError(
        `Task not found: ${taskId}`,
        AgentExecutorErrorCode.TASK_NOT_FOUND,
        taskId
      )
    }

    if (task.status !== 'awaiting_approval') {
      throw new AgentExecutorError(
        `Cannot reject plan for task in ${task.status} state`,
        AgentExecutorErrorCode.INVALID_STATE_TRANSITION,
        taskId
      )
    }

    // Update plan spec with rejection feedback and increment version
    const updatedPlanSpec = task.planSpec
      ? {
          ...task.planSpec,
          status: 'rejected' as const,
          feedback,
          version: task.planSpec.version + 1,
        }
      : {
          status: 'rejected' as const,
          feedback,
          version: 1,
        }

    // Add rejection message with feedback to output
    const line = this.outputBuffer.append(
      taskId,
      `\n[Mira] Plan rejected. Please revise based on feedback:\n${feedback}\n`,
      'stdout'
    )
    this.emit('outputReceived', taskId, line)

    // Check if the SDK execution is still active (paused)
    if (this.claudeSdkService.isPaused(taskId)) {
      // SDK is still running, just resume it
      await this.updateTask(taskId, {
        status: 'running',
        planSpec: updatedPlanSpec,
      })
      this.claudeSdkService.resume(taskId)
    } else {
      // SDK execution has completed, need to restart with revision context
      // Store rejected plan and feedback so execution knows to revise the plan
      await this.updateTask(taskId, {
        status: 'queued',
        planSpec: updatedPlanSpec,
        parameters: {
          ...task.parameters,
          continuationMode: 'plan-revision',
          previousPlanContent: task.planSpec?.content,
          rejectionFeedback: feedback,
        },
      })

      // Add to queue to continue execution with revision context
      this.taskQueue.enqueue(taskId)

      // If no task is currently running, start processing
      if (!this.taskQueue.isProcessing()) {
        setImmediate(() => {
          this.processNextTask().catch(err => {
            console.error(
              'Failed to process next task after plan rejection:',
              err
            )
          })
        })
      }
    }

    const updatedTask = this.db.getAgentTask(taskId)
    if (!updatedTask) {
      throw new AgentExecutorError(
        `Failed to retrieve updated task: ${taskId}`,
        AgentExecutorErrorCode.TASK_NOT_FOUND,
        taskId
      )
    }

    this.emit('planRejected', updatedTask, feedback)

    return updatedTask
  }

  /**
   * Set task to awaiting approval status
   *
   * Called when a plan is generated and approval is required.
   *
   * @param taskId - The task ID
   * @param planContent - The generated plan content
   */
  async setAwaitingApproval(
    taskId: string,
    planContent: string
  ): Promise<void> {
    const task = this.db.getAgentTask(taskId)
    if (!task) {
      return
    }

    // Parse tasks from the plan content
    const { parseTasksFromSpec } = await import('./agent/planning-prompts')
    const parsedTasks = parseTasksFromSpec(planContent)

    // Create plan spec
    const planSpec = {
      status: 'generated' as const,
      content: planContent,
      version: task.planSpec?.version ?? 1,
      generatedAt: new Date(),
      tasks: parsedTasks,
    }

    // Persist output buffer before changing status
    // This ensures output is available after app reload
    await this.outputBuffer.persist(taskId)

    // Update task status to awaiting approval
    await this.updateTask(taskId, {
      status: 'awaiting_approval',
      planSpec,
    })

    const updatedTask = this.db.getAgentTask(taskId)
    if (updatedTask) {
      this.emit('taskAwaitingApproval', updatedTask)
    }
  }

  /**
   * Update task progress based on task markers in output
   *
   * Called when TASK_START, TASK_COMPLETE, or PHASE_COMPLETE markers are detected.
   *
   * @param taskId - The task ID
   * @param progress - The extracted progress information
   */
  private async updateTaskProgress(
    taskId: string,
    progress: ReturnType<typeof extractTaskProgress>
  ): Promise<void> {
    const task = this.db.getAgentTask(taskId)
    if (!task || !task.planSpec?.tasks) {
      return
    }

    // Update task statuses based on progress
    const updatedTasks = updateTaskStatuses(task.planSpec.tasks, progress)

    // Update plan spec with new task statuses
    const updatedPlanSpec = {
      ...task.planSpec,
      tasks: updatedTasks,
    }

    await this.updateTask(taskId, {
      planSpec: updatedPlanSpec,
    })
  }

  // ============================================================================
  // OUTPUT STREAMING
  // ============================================================================

  /**
   * Get output lines for a task
   *
   * @param taskId - The task ID
   * @returns Array of output lines
   */
  getTaskOutput(taskId: string): OutputLine[] {
    return this.outputBuffer.getLines(taskId)
  }

  /**
   * Subscribe to output updates for a task
   *
   * @param taskId - The task ID
   * @param callback - Callback for new output lines
   * @returns Unsubscribe function
   */
  subscribeToOutput(taskId: string, callback: OutputCallback): () => void {
    return this.outputBuffer.subscribe(taskId, callback)
  }

  // ============================================================================
  // BACKLOG MANAGEMENT
  // ============================================================================

  /**
   * Get the number of tasks in the backlog (pending + queued)
   *
   * @returns The backlog size
   */
  getBacklogSize(): number {
    const pendingTasks = this.db.getAgentTasks({ status: 'pending' })
    const queuedTasks = this.db.getAgentTasks({ status: 'queued' })
    return pendingTasks.length + queuedTasks.length
  }

  /**
   * Reorder tasks in the queue
   *
   * @param taskIds - Array of task IDs in the new order
   */
  reorderBacklog(taskIds: string[]): void {
    this.taskQueue.reorder(taskIds)
  }

  // ============================================================================
  // INTERNAL METHODS
  // ============================================================================

  /**
   * Check if a state transition is valid
   *
   * @param from - Current state
   * @param to - Target state
   * @returns True if transition is valid
   */
  private isValidStateTransition(from: TaskStatus, to: TaskStatus): boolean {
    return VALID_STATE_TRANSITIONS[from]?.includes(to) ?? false
  }

  /**
   * Process the next task in the queue
   *
   * Dequeues the next task and starts execution.
   */
  private async processNextTask(): Promise<void> {
    // Don't start if already processing
    if (this.taskQueue.isProcessing()) {
      return
    }

    // Get next task from queue
    const taskId = this.taskQueue.dequeue()
    if (!taskId) {
      return
    }

    const task = this.db.getAgentTask(taskId)
    if (!task) {
      // Task was deleted, try next
      await this.processNextTask()
      return
    }

    // Mark as current task
    this.taskQueue.setCurrentTask(taskId)

    try {
      await this.executeTask(task)
    } catch (error) {
      // Handle execution error
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      await this.handleTaskFailure(taskId, errorMessage)
    }
  }

  /**
   * Execute a task
   *
   * Routes to appropriate execution method based on service type.
   *
   * @param task - The task to execute
   */
  private async executeTask(task: AgentTask): Promise<void> {
    const serviceType = task.serviceType ?? 'claude-code'

    if (serviceType === 'google-jules') {
      await this.executeJulesTask(task)
    } else {
      await this.executeClaudeCodeTask(task)
    }
  }

  /**
   * Execute a Jules task via Google Jules API
   *
   * @param task - The task to execute
   */
  private async executeJulesTask(task: AgentTask): Promise<void> {
    if (!this.julesService) {
      throw new AgentExecutorError(
        'Jules service is not available',
        AgentExecutorErrorCode.JULES_API_ERROR,
        task.id
      )
    }

    if (!task.julesParams?.source) {
      throw new AgentExecutorError(
        'Jules source is required',
        AgentExecutorErrorCode.JULES_SOURCE_REQUIRED,
        task.id
      )
    }

    // Update task status to running
    await this.updateTask(task.id, {
      status: 'running',
      startedAt: new Date(),
    })

    const updatedTask = this.db.getAgentTask(task.id)
    if (updatedTask) {
      this.emit('taskStarted', updatedTask)
    }

    try {
      // Create Jules session
      const session = await this.julesService.createSession({
        prompt: task.description,
        source: task.julesParams.source,
        startingBranch: task.julesParams.startingBranch,
        automationMode: task.julesParams.automationMode,
        requirePlanApproval: task.julesParams.requirePlanApproval,
        title: task.julesParams.title || task.description.slice(0, 100),
      })

      // Store session ID
      await this.updateTask(task.id, {
        julesSessionId: session.id,
      })

      // Add initial output
      const line = this.outputBuffer.append(
        task.id,
        `[Jules] Session created: ${session.id}\n[Jules] Prompt: ${task.description}\n`,
        'stdout'
      )
      this.emit('outputReceived', task.id, line)

      // Start polling for updates
      this.startJulesPolling(task.id, session.id)
    } catch (error) {
      throw new AgentExecutorError(
        `Failed to create Jules session: ${error instanceof Error ? error.message : String(error)}`,
        AgentExecutorErrorCode.JULES_API_ERROR,
        task.id,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Start polling Jules API for task updates
   */
  private startJulesPolling(taskId: string, sessionId: string): void {
    let lastActivityCount = 0
    let lastState: JulesTaskState = 'initializing'

    const pollInterval = setInterval(async () => {
      try {
        if (!this.julesService) {
          this.stopJulesPolling(taskId)
          return
        }

        // Get session status
        const session = await this.julesService.getSession(sessionId)

        // Get activities (fetches all pages)
        const activities = await this.julesService.listActivities(sessionId)

        // Sync activities to database
        if (activities.length > 0) {
          this.db.upsertJulesActivities(taskId, sessionId, activities)
          this.db.updateJulesSyncState(
            taskId,
            sessionId,
            null,
            activities.length
          )
        }

        // Update the in-memory cache
        this.julesActivitiesCache.set(taskId, {
          activities,
          lastFetchTime: Date.now(),
        })

        // Detect current state from activities and session
        const currentState = this.detectJulesState(activities, session)

        // Emit status update if state changed
        if (currentState !== lastState) {
          lastState = currentState
          const status = this.buildJulesStatus(
            taskId,
            sessionId,
            currentState,
            activities,
            session
          )
          this.emit('julesStatusUpdate', taskId, status)
        }

        // Process new activities
        if (activities.length > lastActivityCount) {
          const newActivities = activities.slice(lastActivityCount)
          const outputLines = this.julesService.activitiesToOutputLines(
            taskId,
            newActivities
          )

          for (const outputLine of outputLines) {
            const line = this.outputBuffer.append(
              taskId,
              `${outputLine.content}\n`,
              outputLine.stream
            )
            this.emit('outputReceived', taskId, line)
          }

          lastActivityCount = activities.length
        }

        // Check for completion
        if (session.outputs && session.outputs.length > 0) {
          // Session has outputs (e.g., PR created)
          for (const output of session.outputs) {
            if (output.pullRequest) {
              const line = this.outputBuffer.append(
                taskId,
                `\n[Jules] Pull Request created: ${output.pullRequest.url}\n` +
                  `  Title: ${output.pullRequest.title}\n` +
                  `  Description: ${output.pullRequest.description}\n`,
                'stdout'
              )
              this.emit('outputReceived', taskId, line)
            }
          }

          // Emit completed status
          const completedStatus = this.buildJulesStatus(
            taskId,
            sessionId,
            'completed',
            activities,
            session
          )
          this.emit('julesStatusUpdate', taskId, completedStatus)

          // Mark as completed
          this.stopJulesPolling(taskId)
          await this.handleJulesCompletion(taskId, session)
        }
      } catch (error) {
        console.error(`Jules polling error for task ${taskId}:`, error)
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        const line = this.outputBuffer.append(
          taskId,
          `[Jules] Error: ${errorMessage}\n`,
          'stderr'
        )
        this.emit('outputReceived', taskId, line)

        // Check for fatal errors that should stop polling and fail the task
        const isFatalError =
          (error as { statusCode?: number })?.statusCode === 404 ||
          (error as { code?: string })?.code === 'API_ERROR' ||
          errorMessage.includes('NOT_FOUND') ||
          errorMessage.includes('not found')

        if (isFatalError) {
          // Emit failed status
          const failedStatus: JulesSessionStatus = {
            sessionId,
            taskId,
            state: 'failed',
          }
          this.emit('julesStatusUpdate', taskId, failedStatus)

          this.stopJulesPolling(taskId)
          await this.handleTaskFailure(
            taskId,
            `Jules API error: ${errorMessage}`
          )
        }
      }
    }, 5000) // Poll every 5 seconds

    this.julesPollingIntervals.set(taskId, pollInterval)
  }

  /**
   * Detect the current Jules task state from activities
   */
  private detectJulesState(
    activities: Array<{
      planGenerated?: { plan: { id: string } }
      planApproved?: { planId: string }
      progressUpdated?: { title: string }
      userMessageRequested?: { prompt?: string }
    }>,
    session: { outputs?: unknown[]; state?: string }
  ): JulesTaskState {
    // Check for completion first
    if (session.outputs && session.outputs.length > 0) {
      return 'completed'
    }

    // Map Jules API states directly when available
    // Jules API states: STATE_UNSPECIFIED, QUEUED, PLANNING, AWAITING_PLAN_APPROVAL,
    // AWAITING_USER_FEEDBACK, IN_PROGRESS, PAUSED, FAILED, COMPLETED
    if (session.state) {
      switch (session.state) {
        case 'COMPLETED':
          return 'completed'
        case 'FAILED':
          return 'failed'
        case 'AWAITING_PLAN_APPROVAL':
          return 'awaiting-plan-approval'
        case 'AWAITING_USER_FEEDBACK':
          return 'awaiting-reply'
        case 'IN_PROGRESS':
          return 'executing'
        case 'PLANNING':
          return 'planning'
        case 'QUEUED':
        case 'STATE_UNSPECIFIED':
          return 'initializing'
        case 'PAUSED':
          return 'executing' // Treat paused as executing for now
      }
    }

    // Fallback: Analyze activities to determine state if session.state is not available
    let hasPlanGenerated = false
    let hasPlanApproved = false
    let hasProgress = false
    let planGeneratedIndex = -1

    for (let i = 0; i < activities.length; i++) {
      const activity = activities[i]
      if (activity.planGenerated) {
        hasPlanGenerated = true
        planGeneratedIndex = i
      }
      if (activity.planApproved) {
        hasPlanApproved = true
      }
      if (activity.progressUpdated) {
        hasProgress = true
      }
    }

    // Auto-detect plan approval: if there are activities after planGenerated, consider it approved
    // Jules sometimes auto-approves plans and continues without explicit planApproved activity
    const hasActivitiesAfterPlan =
      hasPlanGenerated &&
      planGeneratedIndex >= 0 &&
      planGeneratedIndex < activities.length - 1
    if (hasActivitiesAfterPlan) {
      hasPlanApproved = true
    }

    // Check if the last activity is userMessageRequested (agent waiting for reply)
    const lastActivity = activities[activities.length - 1]
    if (lastActivity?.userMessageRequested) {
      return 'awaiting-reply'
    }

    // If there's progress, the agent is executing (regardless of plan approval status)
    if (hasProgress) {
      return 'executing'
    }

    // Determine state based on activity history
    if (hasPlanGenerated && !hasPlanApproved) {
      return 'awaiting-plan-approval'
    }

    if (hasPlanApproved) {
      return 'executing'
    }

    if (activities.length === 0) {
      return 'initializing'
    }

    return 'planning'
  }

  /**
   * Build a JulesSessionStatus object
   */
  private buildJulesStatus(
    taskId: string,
    sessionId: string,
    state: JulesTaskState,
    activities: Array<{
      planGenerated?: {
        plan: {
          id: string
          steps: Array<{ id: string; title: string; index?: number }>
        }
      }
      createTime?: string
    }>,
    session: {
      title?: string
      prompt?: string
      createTime?: string
      updateTime?: string
      url?: string
      sourceContext?: {
        source: string
        githubRepoContext?: {
          startingBranch: string
        }
      }
      outputs?: Array<{ pullRequest?: { url: string } }>
    }
  ): JulesSessionStatus {
    const status: JulesSessionStatus = {
      sessionId,
      taskId,
      state,
      title: session.title,
      prompt: session.prompt,
      createTime: session.createTime,
      updateTime: session.updateTime,
      webUrl: session.url,
      sourceContext: session.sourceContext,
    }

    // Add pending plan if awaiting approval
    if (state === 'awaiting-plan-approval') {
      const planActivity = activities.find(a => a.planGenerated)
      if (planActivity?.planGenerated) {
        status.pendingPlan = planActivity.planGenerated.plan
      }
    }

    // Add last activity timestamp
    if (activities.length > 0) {
      const lastActivity = activities[activities.length - 1]
      if (lastActivity.createTime) {
        status.lastActivityAt = new Date(lastActivity.createTime)
      }
    }

    // Add PR URL if completed
    if (state === 'completed' && session.outputs) {
      for (const output of session.outputs) {
        if (output.pullRequest?.url) {
          status.pullRequestUrl = output.pullRequest.url
          break
        }
      }
    }

    return status
  }

  /**
   * Stop polling for a Jules task
   */
  private stopJulesPolling(taskId: string): void {
    const interval = this.julesPollingIntervals.get(taskId)
    if (interval) {
      clearInterval(interval)
      this.julesPollingIntervals.delete(taskId)
    }
  }

  /**
   * Handle Jules task completion
   */
  private async handleJulesCompletion(
    taskId: string,
    _session: { outputs?: Array<{ pullRequest?: { url: string } }> }
  ): Promise<void> {
    // Clear current task
    if (this.taskQueue.getCurrentTaskId() === taskId) {
      this.taskQueue.setCurrentTask(undefined)
    }

    // Persist output buffer
    await this.outputBuffer.persist(taskId)

    // Update task status
    await this.updateTask(taskId, {
      status: 'completed',
      completedAt: new Date(),
    })

    const task = this.db.getAgentTask(taskId)
    if (task) {
      this.emit('taskCompleted', task)
    }

    // Process next task
    await this.processNextTask()
  }

  /**
   * Execute a Claude Code task via Claude Agent SDK
   *
   * @param task - The task to execute
   */
  private async executeClaudeCodeTask(task: AgentTask): Promise<void> {
    // Get agent configuration
    const config = await this.configService.getConfig()

    // Validate configuration
    const validation = this.configService.validateConfig(config)
    if (!validation.isValid) {
      throw new AgentExecutorError(
        `Invalid configuration: ${validation.errors.map(e => e.message).join(', ')}`,
        AgentExecutorErrorCode.INVALID_CONFIGURATION,
        task.id
      )
    }

    // Update task status to running
    await this.updateTask(task.id, {
      status: 'running',
      startedAt: new Date(),
      executionStep: 'copying-project',
    })

    const updatedTask = this.db.getAgentTask(task.id)
    if (updatedTask) {
      this.emit('taskStarted', updatedTask)
    }

    // Determine working directory - use worktree if branchName is provided, otherwise copy
    let workingDirectory = task.targetDirectory
    let worktree: Worktree | null = null

    // Check if task already has a worktree path (for restarts)
    if (task.worktreePath && existsSync(task.worktreePath)) {
      workingDirectory = task.worktreePath
      worktree = this.worktreeService?.getWorktreeForTask(task.id) ?? null

      const line = this.outputBuffer.append(
        task.id,
        `[Mira] Reusing existing worktree: ${workingDirectory}\n` +
          `[Mira] Branch: ${worktree?.branch ?? task.branchName ?? 'unknown'}\n`,
        'stdout'
      )
      this.emit('outputReceived', task.id, line)
    }
    // Use worktree if branchName is provided and worktreeService is available
    else if (task.branchName && this.worktreeService) {
      try {
        await this.updateExecutionStep(
          task.id,
          'copying-project',
          `Creating git worktree for branch: ${task.branchName}...`
        )

        // Check if a worktree already exists for this branch
        const existingWorktree =
          await this.worktreeService.findWorktreeForBranch(
            task.targetDirectory,
            task.branchName
          )

        if (existingWorktree) {
          // Reuse existing worktree and associate with this task
          worktree = existingWorktree
          workingDirectory = existingWorktree.path

          // Associate task with existing worktree if not already associated
          if (existingWorktree.taskId !== task.id) {
            await this.worktreeService.associateTask(
              existingWorktree.path,
              task.id
            )
          }

          const line = this.outputBuffer.append(
            task.id,
            `[Mira] Reusing existing worktree for branch '${task.branchName}'\n` +
              `[Mira] Worktree path: ${workingDirectory}\n`,
            'stdout'
          )
          this.emit('outputReceived', task.id, line)
        } else {
          // Create new worktree
          worktree = await this.worktreeService.createWorktree(
            task.targetDirectory,
            task.branchName,
            task.id
          )
          workingDirectory = worktree.path

          const line = this.outputBuffer.append(
            task.id,
            `[Mira] Created git worktree for branch '${task.branchName}'\n` +
              `[Mira] Worktree path: ${workingDirectory}\n`,
            'stdout'
          )
          this.emit('outputReceived', task.id, line)
        }

        // Update task with worktree path
        await this.updateTask(task.id, {
          workingDirectory,
          worktreePath: workingDirectory,
        })
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        const line = this.outputBuffer.append(
          task.id,
          `[Mira] Warning: Could not create worktree, falling back to copy: ${errorMessage}\n`,
          'stderr'
        )
        this.emit('outputReceived', task.id, line)

        // Fall back to working directory copy
        workingDirectory = await this.copyToWorkingDirectory(task)
      }
    }
    // Fall back to copying project to working directory
    else if (this.workingDirectoryService) {
      workingDirectory = await this.copyToWorkingDirectory(task)
    }

    // Load project context files from .mira/context
    // Do this as early as possible so multi-task and continuation flows both receive it.
    const { formattedPrompt: contextFilesPrompt } = await loadContextFiles({
      projectPath: workingDirectory,
    })
    const combinedSystemPrompt = combineSystemPrompts(
      contextFilesPrompt || undefined
    )

    // Update step to initializing
    await this.updateExecutionStep(
      task.id,
      'initializing',
      'Setting up Claude Agent SDK...'
    )

    // Build task description with planning prompt prefix
    // Check if this is a continuation after plan approval
    let prompt: string
    let useMultiTask = false
    
    if (task.parameters.continuationMode === 'post-approval') {
      // Check if multi-task execution is enabled and we have parsed tasks
      const parsedTasks = task.planSpec?.tasks || []
      useMultiTask = task.parameters.useMultiTaskExecution === true && parsedTasks.length > 0
      
      if (useMultiTask) {
        // Multi-task execution will be handled separately after SDK setup
        // Log that we're using multi-task mode
        const line = this.outputBuffer.append(
          task.id,
          `[Mira] Continuing with multi-task execution (${parsedTasks.length} sub-tasks)...\n`,
          'stdout'
        )
        this.emit('outputReceived', task.id, line)
        
        // Execute multi-task plan
        await this.executeMultiTaskPlan(
          task,
          parsedTasks,
          task.parameters.approvedPlanContent || task.planSpec?.content || '',
          workingDirectory,
          config,
          undefined,
          combinedSystemPrompt
        )
        
        // Handle completion after multi-task execution
        await this.handleClaudeSdkCompletion(
          task.id,
          true, // success
          undefined, // no error
          workingDirectory,
          undefined // no cost tracking for multi-task yet
        )
        return
      }
      
      // Single-agent execution (fallback or when no tasks parsed)
      const approvedPlan =
        task.parameters.approvedPlanContent ||
        task.planSpec?.content ||
        task.description
      prompt = `The plan/specification has been approved. Now implement it.

## Approved Plan

${approvedPlan}

## Instructions

Implement all the changes described in the plan above. Execute tasks sequentially.
For each task:
1. BEFORE starting, output: "[TASK_START] T###: Description"
2. Implement the task
3. AFTER completing, output: "[TASK_COMPLETE] T###: Brief summary"

After completing all tasks in a phase, output:
"[PHASE_COMPLETE] Phase N complete"

This allows real-time progress tracking during implementation.`

      // Log that we're in continuation mode
      const line = this.outputBuffer.append(
        task.id,
        '[Mira] Continuing with implementation after plan approval...\n',
        'stdout'
      )
      this.emit('outputReceived', task.id, line)
    } else if (task.parameters.continuationMode === 'plan-revision') {
      // Plan was rejected, need to revise based on feedback
      const previousPlan = task.parameters.previousPlanContent || ''
      const feedback = task.parameters.rejectionFeedback || 'Please revise the plan.'

      prompt = `The user has requested revisions to the plan/specification.

## Previous Plan
${previousPlan}

## User Feedback
${feedback}

## Instructions
Please regenerate the specification incorporating the user's feedback.
Keep the same format with the \`\`\`tasks block for task definitions.
After generating the revised spec, output on its own line:
"[SPEC_GENERATED] Please review the revised specification above. Reply with 'approved' to proceed or provide feedback for revisions."

DO NOT proceed with implementation until you receive explicit approval.`

      // Log that we're in revision mode
      const line = this.outputBuffer.append(
        task.id,
        '[Mira] Revising plan based on user feedback...\n',
        'stdout'
      )
      this.emit('outputReceived', task.id, line)
    } else {
      // Normal flow: build prompt with planning phase if applicable
      prompt = this.buildTaskDescription(task)
    }

    // Build execution config for Claude SDK
    const executionConfig: ClaudeExecutionConfig = {
      prompt,
      workingDirectory,
      model: task.parameters.model || 'claude-sonnet-4-5',
      permissionMode: 'acceptEdits',
      apiKey: config.anthropicAuthToken,
      systemPrompt: combinedSystemPrompt,
      customEnvVars: {
        ...config.customEnvVars,
        ...task.parameters.customEnv,
      },
      // Resume from previous session if available (for interrupted tasks)
      // Note: We use session resume even for continuation mode to maintain context
      resumeSessionId: task.parameters.sessionId,
      // Apply tool restrictions if specified in task parameters
      allowedTools: task.parameters.allowedTools,
      disallowedTools: task.parameters.disallowedTools,
      // Apply budget limit if specified
      maxBudgetUsd: task.parameters.maxBudgetUsd,
      // Set max turns based on agent type (autonomous needs more, feature needs fewer)
      // Set max turns based on agent type (autonomous needs more, feature needs fewer)
      maxTurns: task.agentType === 'autonomous' ? 1000 : 500,
    }

    // Update step to running
    await this.updateExecutionStep(
      task.id,
      'running',
      'Starting Claude Agent SDK execution...'
    )

    // Track accumulated output for plan detection
    let accumulatedOutput = ''
    let planDetected = false
    let lastTaskProgress = {
      startedTasks: [] as string[],
      completedTasks: [] as string[],
      completedPhases: [] as string[],
    }

    // Set up event handlers for Claude SDK
    const handleOutput = (data: string, stream: 'stdout' | 'stderr') => {
      const line = this.outputBuffer.append(task.id, data, stream)
      this.emit('outputReceived', task.id, line)

      if (stream === 'stdout') {
        // Accumulate output for plan detection
        accumulatedOutput += data

        // Check for plan generation if approval is required and not yet detected
        // Also detect plans for progress tracking even when approval is not required
        if (
          !planDetected &&
          task.planningMode !== 'skip' &&
          hasPlanGenerated(accumulatedOutput)
        ) {
          planDetected = true

          // Only pause and request approval if:
          // 1. requirePlanApproval is explicitly true
          // 2. The output contains SPEC_GENERATED marker (not PLAN_GENERATED)
          // Note: _without_approval prompts use PLAN_GENERATED which doesn't trigger this
          if (task.requirePlanApproval && needsPlanApproval(accumulatedOutput)) {
            // Pause the SDK execution
            this.claudeSdkService.pause(task.id)

            // Set task to awaiting approval with the plan content
            this.setAwaitingApproval(task.id, accumulatedOutput).catch(err => {
              console.error('Failed to set awaiting approval:', err)
            })
          } else if (!task.requirePlanApproval && hasPlanGenerated(accumulatedOutput)) {
            // Plan was auto-approved - emit event for UI notification
            const currentTask = this.db.getAgentTask(task.id)
            if (currentTask) {
              this.emit('planAutoApproved', currentTask)
              
              // Parse tasks from the auto-approved plan for progress tracking
              const planContent = accumulatedOutput
              const tasks = parseTasksFromSpec(planContent)
              if (tasks.length > 0) {
                this.updateTask(task.id, {
                  planSpec: {
                    status: 'approved',
                    content: planContent,
                    version: 1,
                    generatedAt: new Date(),
                    approvedAt: new Date(),
                    tasks,
                  },
                }).catch(err => {
                  console.error('Failed to update plan spec for auto-approval:', err)
                })
              }
            }
          }
          // If requirePlanApproval is false, let the agent continue automatically
          // The _without_approval prompts tell it to proceed with implementation
        }

        // Track task progress if we have a plan with tasks
        if (planDetected || task.planSpec?.tasks) {
          const currentProgress = extractTaskProgress(accumulatedOutput)

          // Check if progress has changed
          const hasNewProgress =
            currentProgress.startedTasks.length >
              lastTaskProgress.startedTasks.length ||
            currentProgress.completedTasks.length >
              lastTaskProgress.completedTasks.length ||
            currentProgress.completedPhases.length >
              lastTaskProgress.completedPhases.length

          if (hasNewProgress) {
            lastTaskProgress = currentProgress

            // Update task's plan spec with progress
            this.updateTaskProgress(task.id, currentProgress).catch(err => {
              console.error('Failed to update task progress:', err)
            })
          }
        }
      }
    }

    // Register event handlers
    this.claudeSdkService.on('output', handleOutput)

    try {
      // Execute using Claude SDK
      const result = await this.claudeSdkService.execute(
        task.id,
        executionConfig
      )

      // Clean up event handlers
      this.claudeSdkService.off('output', handleOutput)

      // Store session ID for potential future resume
      // Clear continuation mode parameters as they were consumed
      if (result.sessionId) {
        const { continuationMode, approvedPlanContent, previousPlanContent, rejectionFeedback, ...cleanParams } = task.parameters
        await this.updateTask(task.id, {
          parameters: {
            ...cleanParams,
            sessionId: result.sessionId,
          },
        })
      } else if (task.parameters.continuationMode) {
        // Even if no new session ID, clear the continuation mode
        const { continuationMode, approvedPlanContent, previousPlanContent, rejectionFeedback, ...cleanParams } = task.parameters
        await this.updateTask(task.id, {
          parameters: cleanParams,
        })
      }

      // Handle completion
      await this.handleClaudeSdkCompletion(
        task.id,
        result.success,
        result.error,
        workingDirectory,
        result.totalCost
      )
    } catch (error) {
      // Clean up event handlers
      this.claudeSdkService.off('output', handleOutput)

      throw new AgentExecutorError(
        `Claude SDK execution failed: ${error instanceof Error ? error.message : String(error)}`,
        AgentExecutorErrorCode.PROCESS_SPAWN_FAILED,
        task.id,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Handle Claude SDK execution completion
   *
   * On successful completion, transitions to "review" status instead of "completed"
   * to allow user review before changes are copied to the original project.
   * The working directory is preserved for review.
   *
   * Implements Requirements:
   * - 1.1: Update task status to "review" instead of "completed"
   * - 1.2: Preserve working directory with all agent changes intact
   * - 1.4: Update status to "failed" on error (not "review")
   */
  private async handleClaudeSdkCompletion(
    taskId: string,
    success: boolean,
    errorMessage: string | undefined,
    workingDirectory: string,
    totalCost?: number
  ): Promise<void> {
    const task = this.db.getAgentTask(taskId)
    if (!task) {
      return
    }

    // Log cost if available
    if (totalCost !== undefined && totalCost > 0) {
      const line = this.outputBuffer.append(
        taskId,
        `[Claude] Total cost: $${totalCost.toFixed(4)}\n`,
        'stdout'
      )
      this.emit('outputReceived', taskId, line)
    }

    // Clear current task
    if (this.taskQueue.getCurrentTaskId() === taskId) {
      this.taskQueue.setCurrentTask(undefined)
    }

    // Persist output buffer
    await this.outputBuffer.persist(taskId)

    // Check if stopped by user
    const wasStoppedByUser = task.status === 'stopped'
    if (wasStoppedByUser) {
      // Only clean up working directories, not worktrees (worktrees should be preserved)
      const isUsingWorktree =
        !!task.worktreePath && task.worktreePath === workingDirectory
      if (
        !isUsingWorktree &&
        workingDirectory &&
        workingDirectory !== task.targetDirectory &&
        this.workingDirectoryService
      ) {
        try {
          await this.workingDirectoryService.cleanup(workingDirectory)
        } catch {
          // Ignore cleanup errors
        }
      }
      await this.processNextTask()
      return
    }

    const newStatus: TaskStatus = success ? 'review' : 'failed'

    // Check if task is using a worktree (worktrees don't need sync/cleanup)
    const isUsingWorktree =
      !!task.worktreePath && task.worktreePath === workingDirectory

    // Capture file changes
    await this.updateExecutionStep(
      taskId,
      'capturing-changes',
      'Capturing file changes...'
    )

    const effectiveWorkingDir =
      workingDirectory || task.workingDirectory || task.targetDirectory
    let fileChanges: FileChangeSummary | undefined

    if (task.agentType === 'feature') {
      fileChanges = await this.captureFileChanges(effectiveWorkingDir)
    }

    // For worktrees: changes are already in the worktree branch, no sync needed
    if (isUsingWorktree) {
      const line = this.outputBuffer.append(
        taskId,
        `[Mira] Changes committed to worktree branch: ${task.branchName}\n` +
          `[Mira] Worktree preserved at: ${task.worktreePath}\n`,
        'stdout'
      )
      this.emit('outputReceived', taskId, line)
    }
    // For review workflow: preserve working directory for user review
    // Changes will be synced when user approves via ReviewService
    else if (
      success &&
      this.workingDirectoryService &&
      effectiveWorkingDir !== task.targetDirectory
    ) {
      const line = this.outputBuffer.append(
        taskId,
        `[Mira] Task entering review status\n` +
          `[Mira] Working directory preserved at: ${effectiveWorkingDir}\n` +
          `[Mira] Review the changes and approve to copy them to your project\n`,
        'stdout'
      )
      this.emit('outputReceived', taskId, line)
    }

    // Working directory cleanup is now handled by ReviewService after user approval
    // Do NOT clean up on success - preserve for review workflow
    // Only clean up on failure if needed
    if (
      !success &&
      !isUsingWorktree &&
      this.workingDirectoryService &&
      effectiveWorkingDir !== task.targetDirectory
    ) {
      try {
        await this.workingDirectoryService.cleanup(effectiveWorkingDir)
        const line = this.outputBuffer.append(
          taskId,
          `[Mira] Working directory cleaned up after failure\n`,
          'stdout'
        )
        this.emit('outputReceived', taskId, line)
      } catch {
        // Ignore cleanup errors
      }
    }

    // Update task
    const updates: UpdateAgentTaskInput = {
      status: newStatus,
      completedAt: new Date(),
      fileChanges,
      // Use 'review' execution step for successful tasks entering review status
      executionStep: success ? 'review' : 'failed',
    }

    if (!success && errorMessage) {
      updates.error = errorMessage
    }

    await this.updateTask(taskId, updates)

    const finalTask = this.db.getAgentTask(taskId)
    if (!finalTask) {
      console.error(`Task ${taskId} not found after update`)
      await this.processNextTask()
      return
    }

    if (success) {
      // Emit taskEnteredReview for tasks entering review status
      // taskCompleted will be emitted by ReviewService when user approves changes
      this.emit('taskEnteredReview', finalTask)
    } else {
      this.emit('taskFailed', finalTask, updates.error || 'Unknown error')
    }

    // Process next task
    await this.processNextTask()
  }

  /**
   * Copy project to an isolated working directory
   *
   * Helper method to copy the project when worktrees are not used.
   *
   * @param task - The task
   * @returns The working directory path
   */
  private async copyToWorkingDirectory(task: AgentTask): Promise<string> {
    if (!this.workingDirectoryService) {
      return task.targetDirectory
    }

    try {
      await this.updateExecutionStep(
        task.id,
        'copying-project',
        `Copying project to isolated working directory...`
      )

      const copyResult =
        await this.workingDirectoryService.copyToWorkingDirectory(
          task.targetDirectory,
          task.id,
          message => {
            const line = this.outputBuffer.append(
              task.id,
              `[Mira] ${message}\n`,
              'stdout'
            )
            this.emit('outputReceived', task.id, line)
          }
        )

      const workingDirectory = copyResult.workingDirectory

      await this.updateTask(task.id, { workingDirectory })

      const line = this.outputBuffer.append(
        task.id,
        `[Mira] Project copied to: ${workingDirectory}\n` +
          `[Mira] Files copied: ${copyResult.filesCopied}\n`,
        'stdout'
      )
      this.emit('outputReceived', task.id, line)

      return workingDirectory
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      const line = this.outputBuffer.append(
        task.id,
        `[Mira] Warning: Could not create working directory, running in original location: ${errorMessage}\n`,
        'stderr'
      )
      this.emit('outputReceived', task.id, line)

      return task.targetDirectory
    }
  }

  /**
   * Build the task description with planning prompt prefix if applicable
   *
   * @param task - The task
   * @returns The task description with planning prompt prefix
   */
  private buildTaskDescription(task: AgentTask): string {
    const planningMode = task.planningMode ?? 'skip'
    const requirePlanApproval = task.requirePlanApproval ?? false

    // Get planning prompt prefix based on mode
    const planningPrefix = getPlanningPromptPrefix(
      planningMode,
      requirePlanApproval
    )

    // If no planning prefix, return original description
    if (!planningPrefix) {
      return task.description
    }

    // Prepend planning prompt to description
    return planningPrefix + task.description
  }

  /**
   * Build a focused prompt for executing a single sub-task
   *
  * Each sub-task gets a focused prompt with context about the overall plan
   * Each sub-task gets a focused prompt with context about the overall plan
   * and progress on other tasks.
   *
   * @param subTask - The sub-task to execute
   * @param allTasks - All tasks in the plan
   * @param taskIndex - Current task index (0-based)
   * @param approvedPlan - The approved plan content
   * @param userFeedback - Optional user feedback from approval
   * @returns The focused prompt for this sub-task
   */
  private buildSubTaskPrompt(
    subTask: PlanTask,
    allTasks: PlanTask[],
    taskIndex: number,
    approvedPlan: string,
    userFeedback?: string
  ): string {
    const completedTasks = allTasks.slice(0, taskIndex)
    const remainingTasks = allTasks.slice(taskIndex + 1)

    let prompt = `## Sub-Task Execution

You are implementing a specific task as part of a larger plan.

### Current Task
**ID:** ${subTask.id}
**Description:** ${subTask.description}
${subTask.filePath ? `**Target File:** ${subTask.filePath}` : ''}
${subTask.phase ? `**Phase:** ${subTask.phase}` : ''}

### Overall Plan Context
The following is the approved plan for reference:

${approvedPlan}

`

    if (userFeedback) {
      prompt += `### User Feedback
The user provided this feedback when approving the plan:
${userFeedback}

`
    }

    if (completedTasks.length > 0) {
      prompt += `### Completed Tasks
The following tasks have already been completed:
${completedTasks.map(t => `- [x] ${t.id}: ${t.description}`).join('\n')}

`
    }

    if (remainingTasks.length > 0) {
      prompt += `### Remaining Tasks
The following tasks will be executed after this one:
${remainingTasks.map(t => `- [ ] ${t.id}: ${t.description}`).join('\n')}

`
    }

    prompt += `### Instructions

Focus ONLY on completing the current task: **${subTask.description}**

1. Implement the specific changes required for this task
2. Do not implement tasks that are marked as remaining
3. Ensure your changes are complete and working
4. Report when the task is complete

Begin implementing the current task now.`

    return prompt
  }

  /**
   * Execute a multi-task plan using dedicated agent calls per sub-task
   *
  * Each parsed task from the specification gets its own focused agent call.
   *
   * @param task - The main task
   * @param parsedTasks - Array of sub-tasks parsed from the plan
   * @param approvedPlan - The approved plan content
   * @param workingDirectory - Working directory for execution
   * @param config - Agent configuration
   * @param userFeedback - Optional user feedback from approval
   */
  private async executeMultiTaskPlan(
    task: AgentTask,
    parsedTasks: PlanTask[],
    approvedPlan: string,
    workingDirectory: string,
    config: { anthropicAuthToken?: string; customEnvVars?: Record<string, string> },
    userFeedback?: string,
    systemPrompt?: string
  ): Promise<void> {
    const line = this.outputBuffer.append(
      task.id,
      `[Mira] Starting multi-task execution: ${parsedTasks.length} sub-tasks\n`,
      'stdout'
    )
    this.emit('outputReceived', task.id, line)

    let lastPhase: string | undefined

    for (let taskIndex = 0; taskIndex < parsedTasks.length; taskIndex++) {
      const subTask = parsedTasks[taskIndex]

      // Check if task was stopped
      const currentTask = this.db.getAgentTask(task.id)
      if (!currentTask || currentTask.status === 'stopped') {
        const stopLine = this.outputBuffer.append(
          task.id,
          `[Mira] Multi-task execution stopped by user\n`,
          'stdout'
        )
        this.emit('outputReceived', task.id, stopLine)
        return
      }

      // Emit sub-task started event
      this.emit('subTaskStarted', task, subTask, taskIndex, parsedTasks.length)

      const startLine = this.outputBuffer.append(
        task.id,
        `\n[Mira] Starting sub-task ${taskIndex + 1}/${parsedTasks.length}: ${subTask.id}\n` +
          `[Mira] Description: ${subTask.description}\n`,
        'stdout'
      )
      this.emit('outputReceived', task.id, startLine)

      // Update sub-task status to in_progress
      const updatedTasks = [...parsedTasks]
      updatedTasks[taskIndex] = { ...subTask, status: 'in_progress' }
      await this.updateTask(task.id, {
        planSpec: {
          ...task.planSpec!,
          tasks: updatedTasks,
        },
      })

      // Build focused prompt for this sub-task
      const subTaskPrompt = this.buildSubTaskPrompt(
        subTask,
        parsedTasks,
        taskIndex,
        approvedPlan,
        userFeedback
      )

      // Build execution config for sub-task
      const subTaskConfig: ClaudeExecutionConfig = {
        prompt: subTaskPrompt,
        workingDirectory,
        model: task.parameters.model || 'claude-sonnet-4-5',
        permissionMode: 'acceptEdits',
        apiKey: config.anthropicAuthToken,
        customEnvVars: config.customEnvVars,
        systemPrompt,
        // Apply tool restrictions if specified in task parameters
        allowedTools: task.parameters.allowedTools,
        disallowedTools: task.parameters.disallowedTools,
        // Apply budget limit if specified
        maxBudgetUsd: task.parameters.maxBudgetUsd,
        // Limit turns per sub-task so individual calls stay focused
        maxTurns: Math.min(task.agentType === 'autonomous' ? 1000 : 500, 100),
        // Resume from same session to maintain context
        resumeSessionId: task.parameters.sessionId,
      }

      // Execute sub-task
      try {
        const handleSubTaskOutput = (data: string, stream: 'stdout' | 'stderr') => {
          const outputLine = this.outputBuffer.append(task.id, data, stream)
          this.emit('outputReceived', task.id, outputLine)
        }

        this.claudeSdkService.on('output', handleSubTaskOutput)

        const result = await this.claudeSdkService.execute(task.id, subTaskConfig)

        this.claudeSdkService.off('output', handleSubTaskOutput)

        if (!result.success) {
          // Sub-task failed - mark as failed but continue with others
          updatedTasks[taskIndex] = { ...subTask, status: 'failed' }
          await this.updateTask(task.id, {
            planSpec: {
              ...task.planSpec!,
              tasks: updatedTasks,
            },
          })

          const failLine = this.outputBuffer.append(
            task.id,
            `[Mira] Sub-task ${subTask.id} failed: ${result.error}\n`,
            'stderr'
          )
          this.emit('outputReceived', task.id, failLine)

          // Continue with next sub-task (don't fail the entire plan)
          continue
        }

        // Update session ID if returned
        if (result.sessionId && result.sessionId !== task.parameters.sessionId) {
          await this.updateTask(task.id, {
            parameters: {
              ...task.parameters,
              sessionId: result.sessionId,
            },
          })
        }

        // Mark sub-task as completed
        updatedTasks[taskIndex] = { ...subTask, status: 'completed' }
        await this.updateTask(task.id, {
          planSpec: {
            ...task.planSpec!,
            tasks: updatedTasks,
          },
        })

        // Emit sub-task completed event
        this.emit('subTaskCompleted', task, subTask, taskIndex, parsedTasks.length)

        const completeLine = this.outputBuffer.append(
          task.id,
          `[Mira] Sub-task ${subTask.id} completed\n`,
          'stdout'
        )
        this.emit('outputReceived', task.id, completeLine)

        // Check for phase completion
        if (subTask.phase && subTask.phase !== lastPhase) {
          // Phase changed - check if previous phase is complete
          if (lastPhase) {
            const prevPhaseTasks = parsedTasks.filter(t => t.phase === lastPhase)
            const allComplete = prevPhaseTasks.every(
              t => updatedTasks.find(ut => ut.id === t.id)?.status === 'completed'
            )
            if (allComplete) {
              const phaseMatch = lastPhase.match(/Phase\s*(\d+)/i)
              if (phaseMatch) {
                const phaseNumber = parseInt(phaseMatch[1], 10)
                this.emit('phaseCompleted', task, phaseNumber)

                const phaseLine = this.outputBuffer.append(
                  task.id,
                  `[Mira] Phase ${phaseNumber} completed\n`,
                  'stdout'
                )
                this.emit('outputReceived', task.id, phaseLine)
              }
            }
          }
          lastPhase = subTask.phase
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        updatedTasks[taskIndex] = { ...subTask, status: 'failed' }
        await this.updateTask(task.id, {
          planSpec: {
            ...task.planSpec!,
            tasks: updatedTasks,
          },
        })

        const errorLine = this.outputBuffer.append(
          task.id,
          `[Mira] Sub-task ${subTask.id} error: ${errorMsg}\n`,
          'stderr'
        )
        this.emit('outputReceived', task.id, errorLine)
      }
    }

    // Final phase completion check
    if (lastPhase) {
      const lastPhaseTasks = parsedTasks.filter(t => t.phase === lastPhase)
      const updatedTasks = task.planSpec?.tasks || parsedTasks
      const allComplete = lastPhaseTasks.every(
        t => updatedTasks.find(ut => ut.id === t.id)?.status === 'completed'
      )
      if (allComplete) {
        const phaseMatch = lastPhase.match(/Phase\s*(\d+)/i)
        if (phaseMatch) {
          const phaseNumber = parseInt(phaseMatch[1], 10)
          this.emit('phaseCompleted', task, phaseNumber)
        }
      }
    }

    const completedCount = (task.planSpec?.tasks || parsedTasks).filter(
      t => t.status === 'completed'
    ).length
    const finalLine = this.outputBuffer.append(
      task.id,
      `[Mira] Multi-task execution completed: ${completedCount}/${parsedTasks.length} sub-tasks successful\n`,
      'stdout'
    )
    this.emit('outputReceived', task.id, finalLine)
  }

  /**
   * Handle task failure
   *
   * Updates task status to failed and emits failure event.
   *
   * @param taskId - The task ID
   * @param errorMessage - Error message
   */
  private async handleTaskFailure(
    taskId: string,
    errorMessage: string
  ): Promise<void> {
    // Clean up
    this.taskProcesses.delete(taskId)
    if (this.taskQueue.getCurrentTaskId() === taskId) {
      this.taskQueue.setCurrentTask(undefined)
    }

    await this.updateTask(taskId, {
      status: 'failed',
      error: errorMessage,
      completedAt: new Date(),
    })

    const task = this.db.getAgentTask(taskId)
    if (task) {
      this.emit('taskFailed', task, errorMessage)
    }

    // Process next task
    await this.processNextTask()
  }

  /**
   * Capture file changes in a git repository
   *
   * Uses git status and git diff to determine what files were changed.
   *
   * @param directory - The repository directory
   * @returns File change summary
   */
  private async captureFileChanges(
    directory: string
  ): Promise<FileChangeSummary> {
    const summary: FileChangeSummary = {
      created: [],
      modified: [],
      deleted: [],
    }

    try {
      // Get git status
      const { stdout: statusOutput } = await execAsync(
        'git status --porcelain',
        {
          cwd: directory,
          timeout: 10000,
        }
      )

      const lines = statusOutput.split('\n').filter(line => line.trim())

      for (const line of lines) {
        const status = line.substring(0, 2)
        const filePath = line.substring(3).trim()

        // Handle renamed files (R status shows "old -> new")
        const actualPath = filePath.includes(' -> ')
          ? filePath.split(' -> ')[1]
          : filePath

        if (status.includes('A') || status === '??') {
          summary.created.push(actualPath)
        } else if (status.includes('M')) {
          summary.modified.push(actualPath)
        } else if (status.includes('D')) {
          summary.deleted.push(actualPath)
        }
      }

      // Get git diff
      const { stdout: diffOutput } = await execAsync('git diff HEAD', {
        cwd: directory,
        timeout: 30000,
      })

      if (diffOutput.trim()) {
        summary.gitDiff = diffOutput
      }
    } catch (error) {
      // Log error but don't fail - file changes are optional
      console.error('Failed to capture file changes:', error)
    }

    return summary
  }

  /**
   * Gracefully shutdown all running tasks
   *
   * Called when the application is closing.
   */
  async shutdown(): Promise<void> {
    // Stop all Jules polling intervals
    for (const [taskId] of this.julesPollingIntervals) {
      this.stopJulesPolling(taskId)
    }

    // Stop all running tasks
    const runningTasks = this.db.getAgentTasks({ status: 'running' })
    const pausedTasks = this.db.getAgentTasks({ status: 'paused' })

    for (const task of [...runningTasks, ...pausedTasks]) {
      try {
        await this.stopTask(task.id)
      } catch (error) {
        console.error(`Failed to stop task ${task.id}:`, error)
      }
    }

    // Persist all output buffers
    await this.outputBuffer.persistAll()

    // Kill all processes
    await this.processManager.killAll()
  }

  /**
   * Get the currently running task
   *
   * @returns The running task or undefined
   */
  getCurrentTask(): AgentTask | undefined {
    const taskId = this.taskQueue.getCurrentTaskId()
    if (!taskId) {
      return undefined
    }
    return this.db.getAgentTask(taskId) ?? undefined
  }

  /**
   * Check if any task is currently running
   *
   * @returns True if a task is running
   */
  isRunning(): boolean {
    return this.taskQueue.isProcessing()
  }

  /**
   * Resync a Jules task by fetching latest status from the API
   *
   * @param taskId - The task ID
   * @returns The current Jules session status
   */
  async resyncJulesTask(taskId: string): Promise<JulesSessionStatus | null> {
    const task = this.db.getAgentTask(taskId)
    if (!task) {
      throw new AgentExecutorError(
        `Task not found: ${taskId}`,
        AgentExecutorErrorCode.TASK_NOT_FOUND,
        taskId
      )
    }

    if (task.serviceType !== 'google-jules' || !task.julesSessionId) {
      return null
    }

    if (!this.julesService) {
      throw new AgentExecutorError(
        'Jules service not available',
        AgentExecutorErrorCode.JULES_API_ERROR,
        taskId
      )
    }

    try {
      const session = await this.julesService.getSession(task.julesSessionId)
      const activities = await this.julesService.listActivities(
        task.julesSessionId
      )

      const state = this.detectJulesState(activities, session)
      const status = this.buildJulesStatus(
        taskId,
        task.julesSessionId,
        state,
        activities,
        session
      )

      // Emit the status update
      this.emit('julesStatusUpdate', taskId, status)

      // If task was stopped but session is still active, restart polling
      if (
        task.status === 'stopped' &&
        state !== 'completed' &&
        state !== 'failed'
      ) {
        // Update task status back to running
        this.db.updateAgentTask(taskId, {
          status: 'running',
          error: undefined,
          completedAt: undefined,
        })

        // Restart polling
        this.taskQueue.setCurrentTask(taskId)
        this.startJulesPolling(taskId, task.julesSessionId)

        const line = this.outputBuffer.append(
          taskId,
          `\n[Jules] Task resynced - resuming monitoring\n`,
          'stdout'
        )
        this.emit('outputReceived', taskId, line)
      }

      return status
    } catch (error) {
      console.error(`Failed to resync Jules task ${taskId}:`, error)
      throw error
    }
  }

  /**
   * Get the current status of a Jules task
   *
   * @param taskId - The task ID
   * @returns The current Jules session status or null
   */
  async getJulesTaskStatus(taskId: string): Promise<JulesSessionStatus | null> {
    const task = this.db.getAgentTask(taskId)
    if (!task) {
      return null
    }

    if (task.serviceType !== 'google-jules' || !task.julesSessionId) {
      return null
    }

    if (!this.julesService) {
      return null
    }

    try {
      const session = await this.julesService.getSession(task.julesSessionId)
      const activities = await this.julesService.listActivities(
        task.julesSessionId
      )

      const state = this.detectJulesState(activities, session)
      return this.buildJulesStatus(
        taskId,
        task.julesSessionId,
        state,
        activities,
        session
      )
    } catch (error) {
      console.error(`Failed to get Jules task status ${taskId}:`, error)
      return null
    }
  }

  /**
   * Get activities for a Jules task (uses cache if available and fresh)
   *
   * @param taskId - The task ID
   * @param forceRefresh - Force a refresh from the API
   * @returns Array of Jules activities
   */
  async getJulesActivities(
    taskId: string,
    forceRefresh = false
  ): Promise<import('shared/ipc-types').JulesActivity[]> {
    const task = this.db.getAgentTask(taskId)
    if (!task) {
      return []
    }

    if (task.serviceType !== 'google-jules' || !task.julesSessionId) {
      return []
    }

    if (!this.julesService) {
      return []
    }

    // Check in-memory cache first (valid for 3 seconds unless force refresh)
    const cached = this.julesActivitiesCache.get(taskId)
    const cacheAge = cached ? Date.now() - cached.lastFetchTime : Infinity
    const cacheValid = cacheAge < 3000 && !forceRefresh

    if (cached && cacheValid) {
      return cached.activities
    }

    try {
      // Sync activities from API (incremental)
      await this.syncJulesActivities(taskId, task.julesSessionId)

      // Get activities from database
      const activities = this.db.getJulesActivities(taskId)

      // Update in-memory cache
      this.julesActivitiesCache.set(taskId, {
        activities,
        lastFetchTime: Date.now(),
      })

      return activities
    } catch (error) {
      console.error(`Failed to get Jules activities for task ${taskId}:`, error)
      // Return cached data or DB data if available
      if (cached?.activities) {
        return cached.activities
      }
      // Try to get from DB as fallback
      return this.db.getJulesActivities(taskId)
    }
  }

  /**
   * Sync Jules activities from API to database (incremental)
   * Uses pagination tokens to only fetch new activities since last sync
   */
  private async syncJulesActivities(
    taskId: string,
    sessionId: string
  ): Promise<void> {
    if (!this.julesService) return

    // Get sync state from DB
    const syncState = this.db.getJulesSyncState(taskId)
    const dbActivityCount = this.db.getJulesActivityCount(taskId)

    // If we have a sync state with a page token and DB count matches, try incremental fetch
    // This means we previously fetched all pages and have a token for the "next" page
    if (
      syncState?.lastPageToken &&
      syncState.lastActivityCount === dbActivityCount
    ) {
      // Continue from where we left off using the stored page token
      // This fetches only new activities that appeared after our last sync
      let pageToken: string | undefined = syncState.lastPageToken
      const newActivities: import('./agent/jules-service').JulesActivity[] = []

      // Fetch all new pages starting from the stored token
      while (pageToken) {
        const { activities, nextPageToken } =
          await this.julesService.listActivitiesPage(sessionId, 50, pageToken)

        if (activities.length > 0) {
          newActivities.push(...activities)
        }

        pageToken = nextPageToken
      }

      if (newActivities.length > 0) {
        // Upsert new activities to DB
        this.db.upsertJulesActivities(taskId, sessionId, newActivities)
      }

      // Update sync state - fetch the last page to get the current nextPageToken
      // We need to know where to continue from next time
      const { nextPageToken: latestToken } =
        await this.julesService.listActivitiesPage(sessionId, 50)
      const newCount = this.db.getJulesActivityCount(taskId)
      this.db.updateJulesSyncState(
        taskId,
        sessionId,
        latestToken ?? null,
        newCount
      )
    } else if (syncState && syncState.lastActivityCount === dbActivityCount) {
      // We have sync state but no page token - check if there are new activities
      // by fetching the first page and comparing
      const { activities, nextPageToken } =
        await this.julesService.listActivitiesPage(sessionId, 50)

      if (activities.length > 0) {
        // Get existing activity IDs to filter out duplicates
        const existingIds = new Set(
          this.db.getJulesActivities(taskId).map(a => a.id)
        )
        const newActivities = activities.filter(a => !existingIds.has(a.id))

        // If there are new activities, we need to fetch all pages
        if (newActivities.length > 0 || nextPageToken) {
          // Fetch remaining pages if any
          let pageToken = nextPageToken
          const allNewActivities = [...newActivities]

          while (pageToken) {
            const { activities: pageActivities, nextPageToken: nextToken } =
              await this.julesService.listActivitiesPage(
                sessionId,
                50,
                pageToken
              )

            const filteredActivities = pageActivities.filter(
              a => !existingIds.has(a.id)
            )
            allNewActivities.push(...filteredActivities)
            pageToken = nextToken
          }

          if (allNewActivities.length > 0) {
            this.db.upsertJulesActivities(taskId, sessionId, allNewActivities)
          }
        }

        // Update sync state with the latest page token
        const newCount = this.db.getJulesActivityCount(taskId)
        this.db.updateJulesSyncState(
          taskId,
          sessionId,
          nextPageToken ?? null,
          newCount
        )
      }
    } else {
      // Full sync - no sync state or DB count mismatch
      // Fetch all activities from scratch
      const allActivities = await this.julesService.listActivities(sessionId)

      if (allActivities.length > 0) {
        // Upsert all activities to DB
        this.db.upsertJulesActivities(taskId, sessionId, allActivities)
      }

      // Get the last page token for future incremental syncs
      const { nextPageToken } = await this.julesService.listActivitiesPage(
        sessionId,
        50
      )

      // Update sync state
      this.db.updateJulesSyncState(
        taskId,
        sessionId,
        nextPageToken ?? null,
        allActivities.length
      )
    }
  }

  /**
   * Clear the activities cache for a task
   */
  clearJulesActivitiesCache(taskId: string): void {
    this.julesActivitiesCache.delete(taskId)
  }

  /**
   * Clear all activities caches
   */
  clearAllJulesActivitiesCaches(): void {
    this.julesActivitiesCache.clear()
  }

  /**
   * Clear Jules data for a task (cache, DB activities, sync state)
   */
  clearJulesData(taskId: string): void {
    this.julesActivitiesCache.delete(taskId)
    this.db.clearJulesActivities(taskId)
    this.db.clearJulesSyncState(taskId)
  }
}
