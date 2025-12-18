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
 * - 8.1: Spawn background process for coding agent
 * - 8.2: Execute appropriate Python script based on agent type
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
import { join } from 'node:path'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import type { DatabaseService } from './database'
import type {
  ProcessManager,
  ManagedProcess,
  SpawnConfig,
} from './agent/process-manager'
import { buildAgentEnvironment } from './agent/process-manager'
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
} from 'shared/ai-types'
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
  pending: ['queued', 'stopped'],
  queued: ['running', 'pending', 'stopped'],
  running: ['paused', 'completed', 'failed', 'stopped'],
  paused: ['running', 'stopped'],
  completed: [],
  failed: ['pending'],
  stopped: ['pending'],
}

/**
 * Python script paths for different agent types
 */
const AGENT_SCRIPTS = {
  autonomous: 'autonomous-coding/autonomous_agent.py',
  feature: 'feature-coding-agent/feature_agent.py',
} as const

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
  stopTask(taskId: string): Promise<void>

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
  taskStopped: (task: AgentTask) => void
  taskCompleted: (task: AgentTask) => void
  taskFailed: (task: AgentTask, error: string) => void
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
  private taskQueue: TaskQueue
  private outputBuffer: OutputBuffer
  private configService: AgentConfigService
  private gitService: GitService
  private julesService: JulesService | null

  /** Map of task IDs to their managed processes */
  private taskProcesses: Map<string, ManagedProcess> = new Map()

  /** Map of task IDs to Jules polling intervals */
  private julesPollingIntervals: Map<string, NodeJS.Timeout> = new Map()

  /** Base path for agent scripts */
  private agentScriptsBasePath: string

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
    agentScriptsBasePath: string,
    julesService?: JulesService
  ) {
    super()
    this.db = db
    this.processManager = processManager
    this.taskQueue = taskQueue
    this.outputBuffer = outputBuffer
    this.configService = configService
    this.gitService = gitService
    this.agentScriptsBasePath = agentScriptsBasePath
    this.julesService = julesService ?? null
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
   * Sends SIGSTOP to the agent process and updates status to "paused".
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

    const process = this.taskProcesses.get(taskId)
    if (process) {
      process.pause()
    }

    await this.updateTask(taskId, { status: 'paused' })

    const updatedTask = this.db.getAgentTask(taskId)!
    this.emit('taskPaused', updatedTask)
  }

  /**
   * Resume a paused task
   *
   * Sends SIGCONT to the agent process and updates status to "running".
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

    const process = this.taskProcesses.get(taskId)
    if (process) {
      process.resume()
    }

    await this.updateTask(taskId, { status: 'running' })

    const updatedTask = this.db.getAgentTask(taskId)!
    this.emit('taskResumed', updatedTask)
  }

  /**
   * Stop a task
   *
   * Sends SIGTERM to the agent process (with SIGKILL fallback after 10s)
   * and updates status to "stopped".
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

    // Can stop from pending, queued, running, or paused states
    const stoppableStates: TaskStatus[] = [
      'pending',
      'queued',
      'running',
      'paused',
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

    // Kill process if running or paused (Claude Code tasks)
    const process = this.taskProcesses.get(taskId)
    if (process) {
      // Resume first if paused (so SIGTERM can be received)
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

    const updatedTask = this.db.getAgentTask(taskId)!
    this.emit('taskStopped', updatedTask)

    // Process next task in queue
    await this.processNextTask()
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
   * Get the script path for an agent type
   *
   * @param agentType - The agent type
   * @returns Full path to the Python script
   */
  getAgentScriptPath(agentType: 'autonomous' | 'feature'): string {
    return join(this.agentScriptsBasePath, AGENT_SCRIPTS[agentType])
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

    const updatedTask = this.db.getAgentTask(task.id)!
    this.emit('taskStarted', updatedTask)

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

        // Get activities
        const activities = await this.julesService.listActivities(sessionId)

        // Detect current state from activities
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
              outputLine.content + '\n',
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
    }>,
    session: { outputs?: unknown[]; state?: string }
  ): JulesTaskState {
    // Check for completion first
    if (session.outputs && session.outputs.length > 0) {
      return 'completed'
    }

    // Check session state if available
    if (session.state === 'FAILED') {
      return 'failed'
    }

    // Analyze activities to determine state
    let hasPlanGenerated = false
    let hasPlanApproved = false
    let hasProgress = false

    for (const activity of activities) {
      if (activity.planGenerated) {
        hasPlanGenerated = true
      }
      if (activity.planApproved) {
        hasPlanApproved = true
      }
      if (activity.progressUpdated) {
        hasProgress = true
      }
    }

    // Determine state based on activity history
    if (hasPlanGenerated && !hasPlanApproved) {
      return 'awaiting-plan-approval'
    }

    if (hasPlanApproved || hasProgress) {
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
        plan: { id: string; steps: Array<{ id: string; title: string; index?: number }> }
      }
      createTime?: string
    }>,
    session: {
      title?: string
      outputs?: Array<{ pullRequest?: { url: string } }>
    }
  ): JulesSessionStatus {
    const status: JulesSessionStatus = {
      sessionId,
      taskId,
      state,
      title: session.title,
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
    session: { outputs?: Array<{ pullRequest?: { url: string } }> }
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

    const task = this.db.getAgentTask(taskId)!
    this.emit('taskCompleted', task)

    // Process next task
    await this.processNextTask()
  }

  /**
   * Execute a Claude Code task via local Python agent
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

    // Get script path
    const scriptPath = this.getAgentScriptPath(task.agentType)
    if (!existsSync(scriptPath)) {
      throw new AgentExecutorError(
        `Agent script not found: ${scriptPath}`,
        AgentExecutorErrorCode.SCRIPT_NOT_FOUND,
        task.id
      )
    }

    // Build environment variables
    const env = buildAgentEnvironment(
      {},
      {
        anthropicAuthToken: config.anthropicAuthToken,
        anthropicBaseUrl: config.anthropicBaseUrl,
        apiTimeoutMs: config.apiTimeoutMs,
        pythonPath: config.pythonPath,
        customEnvVars: {
          ...config.customEnvVars,
          ...task.parameters.customEnv,
        },
      }
    )

    // Build command arguments
    const args = this.buildAgentArgs(task)

    // Update task status to running
    await this.updateTask(task.id, {
      status: 'running',
      startedAt: new Date(),
    })

    const updatedTask = this.db.getAgentTask(task.id)!
    this.emit('taskStarted', updatedTask)

    // Spawn process
    const spawnConfig: SpawnConfig = {
      script: scriptPath,
      args,
      cwd: task.targetDirectory,
      env,
      onStdout: (data: string) => {
        const line = this.outputBuffer.append(task.id, data, 'stdout')
        this.emit('outputReceived', task.id, line)
      },
      onStderr: (data: string) => {
        const line = this.outputBuffer.append(task.id, data, 'stderr')
        this.emit('outputReceived', task.id, line)
      },
      onExit: async (code: number | null, signal: string | null) => {
        await this.handleProcessExit(task.id, code, signal)
      },
    }

    try {
      const process = await this.processManager.spawn(spawnConfig)
      this.taskProcesses.set(task.id, process)

      // Update task with process ID
      await this.updateTask(task.id, { processId: process.pid })
    } catch (error) {
      throw new AgentExecutorError(
        `Failed to spawn agent process: ${error instanceof Error ? error.message : String(error)}`,
        AgentExecutorErrorCode.PROCESS_SPAWN_FAILED,
        task.id,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Build command line arguments for the agent
   *
   * @param task - The task
   * @returns Array of command line arguments
   */
  private buildAgentArgs(task: AgentTask): string[] {
    const args: string[] = []

    // Add task description
    args.push('--description', task.description)

    // Add target directory
    args.push('--target', task.targetDirectory)

    // Add optional parameters
    if (task.parameters.model) {
      args.push('--model', task.parameters.model)
    }
    if (task.parameters.maxIterations) {
      args.push('--max-iterations', task.parameters.maxIterations.toString())
    }
    if (task.parameters.testCount) {
      args.push('--test-count', task.parameters.testCount.toString())
    }
    if (task.parameters.taskFile) {
      args.push('--task-file', task.parameters.taskFile)
    }

    return args
  }

  /**
   * Handle process exit
   *
   * Updates task status based on exit code and captures file changes.
   *
   * @param taskId - The task ID
   * @param code - Exit code (null if killed by signal)
   * @param signal - Signal that killed the process (null if exited normally)
   */
  private async handleProcessExit(
    taskId: string,
    code: number | null,
    signal: string | null
  ): Promise<void> {
    const task = this.db.getAgentTask(taskId)
    if (!task) {
      return
    }

    // Clean up process reference
    this.taskProcesses.delete(taskId)

    // Clear current task
    if (this.taskQueue.getCurrentTaskId() === taskId) {
      this.taskQueue.setCurrentTask(undefined)
    }

    // Persist output buffer
    await this.outputBuffer.persist(taskId)

    // Determine final status
    const wasStoppedByUser = task.status === 'stopped'
    if (wasStoppedByUser) {
      // Already handled by stopTask
      await this.processNextTask()
      return
    }

    const isSuccess = code === 0
    const newStatus: TaskStatus = isSuccess ? 'completed' : 'failed'

    // Capture file changes for repository tasks
    let fileChanges: FileChangeSummary | undefined
    if (task.agentType === 'feature') {
      fileChanges = await this.captureFileChanges(task.targetDirectory)
    }

    // Update task
    const updates: UpdateAgentTaskInput = {
      status: newStatus,
      exitCode: code ?? undefined,
      completedAt: new Date(),
      fileChanges,
    }

    if (!isSuccess) {
      updates.error = signal
        ? `Killed by signal: ${signal}`
        : `Exit code: ${code}`
    }

    await this.updateTask(taskId, updates)

    const updatedTask = this.db.getAgentTask(taskId)!

    if (isSuccess) {
      this.emit('taskCompleted', updatedTask)
    } else {
      this.emit('taskFailed', updatedTask, updates.error || 'Unknown error')
    }

    // Process next task
    await this.processNextTask()
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

    const task = this.db.getAgentTask(taskId)!
    this.emit('taskFailed', task, errorMessage)

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
   * Get activities for a Jules task
   *
   * @param taskId - The task ID
   * @returns Array of Jules activities
   */
  async getJulesActivities(
    taskId: string
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

    try {
      const activities = await this.julesService.listActivities(
        task.julesSessionId
      )
      return activities
    } catch (error) {
      console.error(`Failed to get Jules activities for task ${taskId}:`, error)
      return []
    }
  }
}
