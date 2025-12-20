/**
 * Review Service
 *
 * Manages the task review workflow for the AI Agent system.
 * When an agent task completes, it enters a "review" status instead of
 * immediately copying changes. This allows users to:
 * - Run the project in the workspace to test changes
 * - Open a terminal in the workspace directory
 * - Provide feedback to the agent for additional work
 * - Approve changes for copying to the original project
 * - Discard changes if not satisfied
 *
 * Implements Requirements:
 * - 1.1: Update task status to "review" instead of "completed"
 * - 1.2: Preserve working directory with all agent changes intact
 * - 2.2: Execute configured dev command in working directory
 * - 2.4: Terminate running process gracefully
 * - 2.5: Detect and offer available scripts from package.json
 * - 3.2: Open terminal session in working directory
 * - 3.3: Set current working directory to task's working directory
 * - 4.2: Restart agent with feedback as additional context
 * - 4.5: Preserve feedback history for the task
 * - 5.2: Copy changed files from working directory to target directory
 * - 5.4: Update task status to "completed" after copying
 * - 6.1: Delete working directory after changes are copied
 * - 6.4: Allow cleanup without copying changes (discard changes)
 *
 * @module review-service
 */

import { EventEmitter } from 'node:events'
import { existsSync } from 'node:fs'
import type { DatabaseService } from './database'
import type {
  FileCopyService,
  CopyResult,
  FileConflict,
} from './file-copy-service'
import type { CleanupService } from './cleanup-service'
import type { ScriptsService } from './scripts-service'
import type { PTYManager } from './pty-manager'
import type {
  AgentTask,
  TaskStatus,
  TaskFeedback,
  FileChangeSummary,
} from 'shared/ai-types'

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Review status information for a task
 */
export interface ReviewStatus {
  taskId: string
  status: TaskStatus
  feedbackCount: number
  hasRunningProcess: boolean
  openTerminalCount: number
  workingDirectory?: string
  fileChanges?: FileChangeSummary
}

/**
 * Result of an approval operation
 */
export interface ApprovalResult {
  success: boolean
  copiedFiles: string[]
  conflicts?: FileConflict[]
  error?: string
}

/**
 * Information about a running process
 */
export interface RunningProcess {
  pid: number
  script: string
  startedAt: Date
  ptyId: string
}

/**
 * Information about a terminal session
 */
export interface TerminalSession {
  id: string
  taskId: string
  workingDirectory: string
  createdAt: Date
  ptyId: string
}

/**
 * Script information for project execution
 */
export interface ScriptInfo {
  name: string
  command: string
  description?: string
}

/**
 * Error codes for review service operations
 */
export enum ReviewErrorCode {
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  INVALID_STATUS = 'INVALID_STATUS',
  WORKING_DIR_NOT_FOUND = 'WORKING_DIR_NOT_FOUND',
  COPY_FAILED = 'COPY_FAILED',
  CLEANUP_FAILED = 'CLEANUP_FAILED',
  PROCESS_START_FAILED = 'PROCESS_START_FAILED',
  TERMINAL_OPEN_FAILED = 'TERMINAL_OPEN_FAILED',
  FEEDBACK_SAVE_FAILED = 'FEEDBACK_SAVE_FAILED',
  FILE_CONFLICT = 'FILE_CONFLICT',
}

/**
 * Custom error class for review service operations
 */
export class ReviewServiceError extends Error {
  constructor(
    message: string,
    public code: ReviewErrorCode,
    public taskId?: string,
    public cause?: Error
  ) {
    super(message)
    this.name = 'ReviewServiceError'
  }
}

/**
 * Interface for the Review Service
 */
export interface IReviewService {
  // Status management
  transitionToReview(taskId: string): Promise<void>
  getReviewStatus(taskId: string): ReviewStatus

  // Feedback management
  submitFeedback(taskId: string, feedback: string): Promise<void>
  getFeedbackHistory(taskId: string): TaskFeedback[]

  // Approval workflow
  approveChanges(taskId: string): Promise<ApprovalResult>
  discardChanges(taskId: string): Promise<void>

  // Project execution
  runProject(taskId: string, script?: string): Promise<RunningProcess>
  stopProject(taskId: string): Promise<void>
  getAvailableScripts(taskId: string): Promise<ScriptInfo[]>

  // Terminal management
  openTerminal(taskId: string): Promise<TerminalSession>
  getOpenTerminals(taskId: string): TerminalSession[]
}

/**
 * Events emitted by the ReviewService
 */
export interface ReviewServiceEvents {
  taskTransitionedToReview: (task: AgentTask) => void
  feedbackSubmitted: (taskId: string, feedback: TaskFeedback) => void
  changesApproved: (taskId: string, result: ApprovalResult) => void
  changesDiscarded: (taskId: string) => void
  projectStarted: (taskId: string, process: RunningProcess) => void
  projectStopped: (taskId: string) => void
  terminalOpened: (taskId: string, session: TerminalSession) => void
  terminalClosed: (taskId: string, terminalId: string) => void
}

// ============================================================================
// Review Service Implementation
// ============================================================================

/**
 * Review Service
 *
 * Manages the task review workflow including status transitions,
 * feedback management, approval/discard, project execution, and terminal access.
 */
export class ReviewService extends EventEmitter implements IReviewService {
  private db: DatabaseService
  private fileCopyService: FileCopyService
  private cleanupService: CleanupService
  private scriptsService: ScriptsService
  private ptyManager: PTYManager

  /** Map of task IDs to their running processes */
  private runningProcesses: Map<string, RunningProcess> = new Map()

  /** Map of task IDs to their open terminal sessions */
  private openTerminalSessions: Map<string, TerminalSession[]> = new Map()

  /** Callback for restarting agent with feedback */
  private onRestartAgentWithFeedback?: (
    taskId: string,
    feedback: string
  ) => Promise<void>

  constructor(
    db: DatabaseService,
    fileCopyService: FileCopyService,
    cleanupService: CleanupService,
    scriptsService: ScriptsService,
    ptyManager: PTYManager
  ) {
    super()
    this.db = db
    this.fileCopyService = fileCopyService
    this.cleanupService = cleanupService
    this.scriptsService = scriptsService
    this.ptyManager = ptyManager
  }

  /**
   * Set the callback for restarting agent with feedback
   * This is called by the agent executor service to wire up the restart functionality
   */
  setRestartAgentCallback(
    callback: (taskId: string, feedback: string) => Promise<void>
  ): void {
    this.onRestartAgentWithFeedback = callback
  }

  // ============================================================================
  // STATUS MANAGEMENT
  // ============================================================================

  /**
   * Transition a task to review status
   *
   * Called when an agent task completes successfully. Updates the task status
   * to "review" and preserves the working directory.
   *
   * @param taskId - The task ID
   * @throws ReviewServiceError if task not found or invalid status
   */
  async transitionToReview(taskId: string): Promise<void> {
    const task = this.db.getAgentTask(taskId)
    if (!task) {
      throw new ReviewServiceError(
        `Task not found: ${taskId}`,
        ReviewErrorCode.TASK_NOT_FOUND,
        taskId
      )
    }

    // Only allow transition from running status
    if (task.status !== 'running') {
      throw new ReviewServiceError(
        `Cannot transition to review from ${task.status} status`,
        ReviewErrorCode.INVALID_STATUS,
        taskId
      )
    }

    // Verify working directory exists
    const workingDir = task.workingDirectory || task.worktreePath
    if (workingDir && !existsSync(workingDir)) {
      throw new ReviewServiceError(
        `Working directory not found: ${workingDir}`,
        ReviewErrorCode.WORKING_DIR_NOT_FOUND,
        taskId
      )
    }

    // Update task status to review
    const updatedTask = this.db.updateAgentTask(taskId, {
      status: 'review',
      completedAt: new Date(),
    })

    if (updatedTask) {
      this.emit('taskTransitionedToReview', updatedTask)
    }
  }

  /**
   * Get the review status for a task
   *
   * Returns comprehensive status information including feedback count,
   * running process status, and open terminal count.
   *
   * @param taskId - The task ID
   * @returns Review status information
   * @throws ReviewServiceError if task not found
   */
  getReviewStatus(taskId: string): ReviewStatus {
    const task = this.db.getAgentTask(taskId)
    if (!task) {
      throw new ReviewServiceError(
        `Task not found: ${taskId}`,
        ReviewErrorCode.TASK_NOT_FOUND,
        taskId
      )
    }

    const feedbackCount = this.db.getTaskFeedbackCount(taskId)
    const hasRunningProcess = this.runningProcesses.has(taskId)
    const openTerminals = this.openTerminalSessions.get(taskId) || []

    return {
      taskId,
      status: task.status,
      feedbackCount,
      hasRunningProcess,
      openTerminalCount: openTerminals.length,
      workingDirectory: task.workingDirectory || task.worktreePath,
      fileChanges: task.fileChanges,
    }
  }

  // ============================================================================
  // FEEDBACK MANAGEMENT
  // ============================================================================

  /**
   * Submit feedback for a task in review
   *
   * Saves the feedback to the database and restarts the agent with
   * the feedback as additional context.
   *
   * @param taskId - The task ID
   * @param feedback - The feedback content
   * @throws ReviewServiceError if task not found or not in review status
   */
  async submitFeedback(taskId: string, feedback: string): Promise<void> {
    const task = this.db.getAgentTask(taskId)
    if (!task) {
      throw new ReviewServiceError(
        `Task not found: ${taskId}`,
        ReviewErrorCode.TASK_NOT_FOUND,
        taskId
      )
    }

    // Only allow feedback submission for tasks in review status
    if (task.status !== 'review') {
      throw new ReviewServiceError(
        `Cannot submit feedback for task in ${task.status} status`,
        ReviewErrorCode.INVALID_STATUS,
        taskId
      )
    }

    // Get the next iteration number
    const currentMaxIteration = this.db.getTaskFeedbackMaxIteration(taskId)
    const nextIteration = currentMaxIteration + 1

    // Save feedback to database
    const feedbackEntry = this.db.createTaskFeedback(
      taskId,
      feedback,
      nextIteration
    )

    // Convert to TaskFeedback type
    const taskFeedback: TaskFeedback = {
      id: feedbackEntry.id,
      taskId: feedbackEntry.taskId,
      content: feedbackEntry.content,
      iteration: feedbackEntry.iteration,
      submittedAt: feedbackEntry.submittedAt,
    }

    this.emit('feedbackSubmitted', taskId, taskFeedback)

    // Restart agent with feedback if callback is set
    if (this.onRestartAgentWithFeedback) {
      try {
        await this.onRestartAgentWithFeedback(taskId, feedback)
      } catch (error) {
        throw new ReviewServiceError(
          `Failed to restart agent with feedback: ${error instanceof Error ? error.message : String(error)}`,
          ReviewErrorCode.FEEDBACK_SAVE_FAILED,
          taskId,
          error instanceof Error ? error : undefined
        )
      }
    }
  }

  /**
   * Get the feedback history for a task
   *
   * Returns all feedback entries in chronological order (oldest first).
   *
   * @param taskId - The task ID
   * @returns Array of feedback entries
   * @throws ReviewServiceError if task not found
   */
  getFeedbackHistory(taskId: string): TaskFeedback[] {
    const task = this.db.getAgentTask(taskId)
    if (!task) {
      throw new ReviewServiceError(
        `Task not found: ${taskId}`,
        ReviewErrorCode.TASK_NOT_FOUND,
        taskId
      )
    }

    const feedbackRows = this.db.getTaskFeedbackHistory(taskId)

    return feedbackRows.map(row => ({
      id: row.id,
      taskId: row.taskId,
      content: row.content,
      iteration: row.iteration,
      submittedAt: row.submittedAt,
    }))
  }

  // ============================================================================
  // APPROVAL WORKFLOW
  // ============================================================================

  /**
   * Approve changes and copy them to the original project
   *
   * Copies all changed files from the working directory to the target directory,
   * then cleans up the working directory.
   *
   * @param taskId - The task ID
   * @returns Approval result with copied files and any conflicts
   * @throws ReviewServiceError if task not found or not in review status
   */
  async approveChanges(taskId: string): Promise<ApprovalResult> {
    const task = this.db.getAgentTask(taskId)
    if (!task) {
      throw new ReviewServiceError(
        `Task not found: ${taskId}`,
        ReviewErrorCode.TASK_NOT_FOUND,
        taskId
      )
    }

    // Only allow approval for tasks in review status
    if (task.status !== 'review') {
      throw new ReviewServiceError(
        `Cannot approve changes for task in ${task.status} status`,
        ReviewErrorCode.INVALID_STATUS,
        taskId
      )
    }

    const workingDir = task.workingDirectory || task.worktreePath
    if (!workingDir || !existsSync(workingDir)) {
      throw new ReviewServiceError(
        `Working directory not found: ${workingDir}`,
        ReviewErrorCode.WORKING_DIR_NOT_FOUND,
        taskId
      )
    }

    // Stop any running processes first
    if (this.runningProcesses.has(taskId)) {
      await this.stopProject(taskId)
    }

    // Close all open terminals
    const terminals = this.openTerminalSessions.get(taskId) || []
    for (const terminal of terminals) {
      try {
        this.ptyManager.kill(terminal.ptyId)
        this.db.closeTaskTerminal(terminal.id)
      } catch {
        // Ignore errors closing terminals
      }
    }
    this.openTerminalSessions.delete(taskId)

    let copyResult: CopyResult | undefined
    const result: ApprovalResult = {
      success: false,
      copiedFiles: [],
    }

    // Copy changes if we have file changes recorded
    if (task.fileChanges) {
      // Detect conflicts first
      const conflicts = await this.fileCopyService.detectConflicts(
        workingDir,
        task.targetDirectory,
        task.fileChanges
      )

      if (conflicts.length > 0) {
        result.conflicts = conflicts
        result.error = `${conflicts.length} file conflict(s) detected`
        this.emit('changesApproved', taskId, result)
        return result
      }

      // Copy the changes
      copyResult = await this.fileCopyService.copyChanges(
        workingDir,
        task.targetDirectory,
        task.fileChanges
      )

      if (!copyResult.success) {
        result.error = copyResult.errors.map(e => e.error).join(', ')
        throw new ReviewServiceError(
          `Failed to copy changes: ${result.error}`,
          ReviewErrorCode.COPY_FAILED,
          taskId
        )
      }

      result.copiedFiles = copyResult.copiedFiles
    }

    // Clean up working directory (but not worktrees - they should be preserved)
    const isWorktree = task.worktreePath === workingDir
    if (!isWorktree) {
      const cleanupResult = await this.cleanupService.cleanup(workingDir)
      if (!cleanupResult.success) {
        // Log warning but don't fail the approval
        console.warn(
          `Warning: Failed to cleanup working directory: ${cleanupResult.error}`
        )
      }
    }

    // Update task status to completed
    this.db.updateAgentTask(taskId, {
      status: 'completed',
    })

    result.success = true
    this.emit('changesApproved', taskId, result)

    return result
  }

  /**
   * Discard changes and clean up without copying
   *
   * Cleans up the working directory without copying any changes.
   *
   * @param taskId - The task ID
   * @throws ReviewServiceError if task not found or not in review status
   */
  async discardChanges(taskId: string): Promise<void> {
    const task = this.db.getAgentTask(taskId)
    if (!task) {
      throw new ReviewServiceError(
        `Task not found: ${taskId}`,
        ReviewErrorCode.TASK_NOT_FOUND,
        taskId
      )
    }

    // Only allow discard for tasks in review status
    if (task.status !== 'review') {
      throw new ReviewServiceError(
        `Cannot discard changes for task in ${task.status} status`,
        ReviewErrorCode.INVALID_STATUS,
        taskId
      )
    }

    const workingDir = task.workingDirectory || task.worktreePath

    // Stop any running processes first
    if (this.runningProcesses.has(taskId)) {
      await this.stopProject(taskId)
    }

    // Close all open terminals
    const terminals = this.openTerminalSessions.get(taskId) || []
    for (const terminal of terminals) {
      try {
        this.ptyManager.kill(terminal.ptyId)
        this.db.closeTaskTerminal(terminal.id)
      } catch {
        // Ignore errors closing terminals
      }
    }
    this.openTerminalSessions.delete(taskId)

    // Clean up working directory (but not worktrees)
    if (workingDir && existsSync(workingDir)) {
      const isWorktree = task.worktreePath === workingDir
      if (!isWorktree) {
        const cleanupResult = await this.cleanupService.cleanup(workingDir)
        if (!cleanupResult.success) {
          throw new ReviewServiceError(
            `Failed to cleanup working directory: ${cleanupResult.error}`,
            ReviewErrorCode.CLEANUP_FAILED,
            taskId
          )
        }
      }
    }

    // Update task status to stopped (discarded)
    this.db.updateAgentTask(taskId, {
      status: 'stopped',
      error: 'Changes discarded by user',
    })

    this.emit('changesDiscarded', taskId)
  }

  // ============================================================================
  // PROJECT EXECUTION
  // ============================================================================

  /**
   * Run a project script in the working directory
   *
   * Executes the specified script (or default dev script) in the task's
   * working directory using a PTY for proper terminal emulation.
   *
   * @param taskId - The task ID
   * @param script - Optional script name to run (defaults to 'dev' or 'start')
   * @returns Running process information
   * @throws ReviewServiceError if task not found or not in review status
   */
  async runProject(taskId: string, script?: string): Promise<RunningProcess> {
    const task = this.db.getAgentTask(taskId)
    if (!task) {
      throw new ReviewServiceError(
        `Task not found: ${taskId}`,
        ReviewErrorCode.TASK_NOT_FOUND,
        taskId
      )
    }

    // Only allow running project for tasks in review status
    if (task.status !== 'review') {
      throw new ReviewServiceError(
        `Cannot run project for task in ${task.status} status`,
        ReviewErrorCode.INVALID_STATUS,
        taskId
      )
    }

    const workingDir = task.workingDirectory || task.worktreePath
    if (!workingDir || !existsSync(workingDir)) {
      throw new ReviewServiceError(
        `Working directory not found: ${workingDir}`,
        ReviewErrorCode.WORKING_DIR_NOT_FOUND,
        taskId
      )
    }

    // Stop any existing running process
    if (this.runningProcesses.has(taskId)) {
      await this.stopProject(taskId)
    }

    // Get available scripts
    const scriptsResult = this.scriptsService.getScripts(workingDir)

    // Determine which script to run
    let scriptToRun = script
    if (!scriptToRun) {
      // Default to 'dev' or 'start' if available
      const hasDevScript = scriptsResult.scripts.some(s => s.name === 'dev')
      const hasStartScript = scriptsResult.scripts.some(s => s.name === 'start')
      scriptToRun = hasDevScript ? 'dev' : hasStartScript ? 'start' : undefined
    }

    if (!scriptToRun) {
      throw new ReviewServiceError(
        'No script specified and no default dev/start script found',
        ReviewErrorCode.PROCESS_START_FAILED,
        taskId
      )
    }

    // Build the run command
    const command = this.scriptsService.buildRunCommand(
      scriptToRun,
      scriptsResult.packageManager
    )

    try {
      // Create PTY for the process
      const ptyId = this.ptyManager.create({
        cwd: workingDir,
      })

      // Write the command to the PTY
      this.ptyManager.write(ptyId, `${command}\r`)

      const runningProcess: RunningProcess = {
        pid: 0, // PTY doesn't expose PID directly
        script: scriptToRun,
        startedAt: new Date(),
        ptyId,
      }

      this.runningProcesses.set(taskId, runningProcess)
      this.emit('projectStarted', taskId, runningProcess)

      return runningProcess
    } catch (error) {
      throw new ReviewServiceError(
        `Failed to start project: ${error instanceof Error ? error.message : String(error)}`,
        ReviewErrorCode.PROCESS_START_FAILED,
        taskId,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Stop a running project
   *
   * Terminates the running process gracefully.
   *
   * @param taskId - The task ID
   * @throws ReviewServiceError if task not found or no running process
   */
  async stopProject(taskId: string): Promise<void> {
    const task = this.db.getAgentTask(taskId)
    if (!task) {
      throw new ReviewServiceError(
        `Task not found: ${taskId}`,
        ReviewErrorCode.TASK_NOT_FOUND,
        taskId
      )
    }

    const runningProcess = this.runningProcesses.get(taskId)
    if (!runningProcess) {
      // No running process - nothing to do
      return
    }

    try {
      // Kill the PTY process
      this.ptyManager.kill(runningProcess.ptyId)
    } catch {
      // Ignore errors - process might already be dead
    }

    this.runningProcesses.delete(taskId)
    this.emit('projectStopped', taskId)
  }

  /**
   * Get available scripts from the working directory
   *
   * Detects scripts from package.json in the working directory.
   *
   * @param taskId - The task ID
   * @returns Array of available scripts
   * @throws ReviewServiceError if task not found
   */
  async getAvailableScripts(taskId: string): Promise<ScriptInfo[]> {
    const task = this.db.getAgentTask(taskId)
    if (!task) {
      throw new ReviewServiceError(
        `Task not found: ${taskId}`,
        ReviewErrorCode.TASK_NOT_FOUND,
        taskId
      )
    }

    const workingDir = task.workingDirectory || task.worktreePath
    if (!workingDir || !existsSync(workingDir)) {
      return []
    }

    const scriptsResult = this.scriptsService.getScripts(workingDir)

    return scriptsResult.scripts.map(script => ({
      name: script.name,
      command: script.command,
    }))
  }

  // ============================================================================
  // TERMINAL MANAGEMENT
  // ============================================================================

  /**
   * Open a terminal in the working directory
   *
   * Creates a new terminal session with the current working directory
   * set to the task's working directory.
   *
   * @param taskId - The task ID
   * @returns Terminal session information
   * @throws ReviewServiceError if task not found or not in review status
   */
  async openTerminal(taskId: string): Promise<TerminalSession> {
    const task = this.db.getAgentTask(taskId)
    if (!task) {
      throw new ReviewServiceError(
        `Task not found: ${taskId}`,
        ReviewErrorCode.TASK_NOT_FOUND,
        taskId
      )
    }

    // Only allow opening terminal for tasks in review status
    if (task.status !== 'review') {
      throw new ReviewServiceError(
        `Cannot open terminal for task in ${task.status} status`,
        ReviewErrorCode.INVALID_STATUS,
        taskId
      )
    }

    const workingDir = task.workingDirectory || task.worktreePath
    if (!workingDir || !existsSync(workingDir)) {
      throw new ReviewServiceError(
        `Working directory not found: ${workingDir}`,
        ReviewErrorCode.WORKING_DIR_NOT_FOUND,
        taskId
      )
    }

    try {
      // Create PTY for the terminal
      const ptyId = this.ptyManager.create({
        cwd: workingDir,
      })

      // Create terminal record in database
      const terminalRecord = this.db.createTaskTerminal(taskId, workingDir)

      const session: TerminalSession = {
        id: terminalRecord.id,
        taskId,
        workingDirectory: workingDir,
        createdAt: terminalRecord.createdAt,
        ptyId,
      }

      // Track the session
      const sessions = this.openTerminalSessions.get(taskId) || []
      sessions.push(session)
      this.openTerminalSessions.set(taskId, sessions)

      this.emit('terminalOpened', taskId, session)

      return session
    } catch (error) {
      throw new ReviewServiceError(
        `Failed to open terminal: ${error instanceof Error ? error.message : String(error)}`,
        ReviewErrorCode.TERMINAL_OPEN_FAILED,
        taskId,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get all open terminals for a task
   *
   * Returns all active terminal sessions for the specified task.
   *
   * @param taskId - The task ID
   * @returns Array of terminal sessions
   * @throws ReviewServiceError if task not found
   */
  getOpenTerminals(taskId: string): TerminalSession[] {
    const task = this.db.getAgentTask(taskId)
    if (!task) {
      throw new ReviewServiceError(
        `Task not found: ${taskId}`,
        ReviewErrorCode.TASK_NOT_FOUND,
        taskId
      )
    }

    return this.openTerminalSessions.get(taskId) || []
  }

  /**
   * Close a terminal session
   *
   * @param taskId - The task ID
   * @param terminalId - The terminal session ID
   */
  closeTerminal(taskId: string, terminalId: string): void {
    const sessions = this.openTerminalSessions.get(taskId) || []
    const sessionIndex = sessions.findIndex(s => s.id === terminalId)

    if (sessionIndex === -1) {
      return
    }

    const session = sessions[sessionIndex]

    try {
      // Kill the PTY
      this.ptyManager.kill(session.ptyId)
    } catch {
      // Ignore errors - PTY might already be dead
    }

    // Update database
    this.db.closeTaskTerminal(terminalId)

    // Remove from tracking
    sessions.splice(sessionIndex, 1)
    if (sessions.length === 0) {
      this.openTerminalSessions.delete(taskId)
    } else {
      this.openTerminalSessions.set(taskId, sessions)
    }

    this.emit('terminalClosed', taskId, terminalId)
  }

  /**
   * Check if a task has a running process
   *
   * @param taskId - The task ID
   * @returns True if the task has a running process
   */
  hasRunningProcess(taskId: string): boolean {
    return this.runningProcesses.has(taskId)
  }

  /**
   * Get the running process for a task
   *
   * @param taskId - The task ID
   * @returns The running process or undefined
   */
  getRunningProcess(taskId: string): RunningProcess | undefined {
    return this.runningProcesses.get(taskId)
  }
}
