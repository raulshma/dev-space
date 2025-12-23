/**
 * Auto Mode Service V2
 *
 * Manages autonomous feature execution using the Claude Agent SDK.
 * Provides feature queue management, planning mode support, and
 * worktree-based isolation for parallel feature development.
 *
 * Implements Requirements:
 * - 4.1: Maintain a queue of pending features for execution
 * - 4.2: Continuously process pending features up to concurrency limit
 * - 4.3: Support worktree-based isolation for parallel feature development
 * - 4.4: Update feature status through lifecycle (pending → in_progress → waiting_approval → completed/failed)
 * - 4.5: Emit progress events for real-time UI updates
 * - 4.6: Mark failed features and continue with next feature
 * - 4.7: Support stopping individual features or entire auto mode loop
 * - 5.1: Support four planning modes: skip, lite, spec, full
 * - 5.2: Generate brief planning outline for lite mode
 * - 5.3: Generate detailed specification for spec mode
 * - 5.4: Generate comprehensive specification for full mode
 * - 5.5: Pause execution and emit awaiting_approval event when plan needs approval
 * - 5.6: Continue with implementation when plan is approved
 * - 5.7: Regenerate plan with feedback when rejected
 * - 9.3: Save agent output to feature directory
 * - 10.1: Handle rate limit errors with wait and retry
 * - 10.2: Handle abort errors without marking task as failed
 * - 10.3: Classify errors by type for appropriate handling
 *
 * @module auto-mode-service-v2
 */

import { EventEmitter } from 'node:events'
import { ProviderFactory } from './providers/provider-factory'
import {
  FeatureLoader,
  type Feature,
  type FeatureStatus,
  type PlanningMode,
  type PlanSpec,
} from './feature-loader'
import { classifyError } from './agent-service-v2'
import type { ProviderErrorInfo } from './providers/types'
import {
  getPlanningPromptPrefix,
  parseTasksFromSpec,
  hasPlanGenerated,
  needsPlanApproval,
  extractTaskProgress,
  updateTaskStatuses,
} from './agent/planning-prompts'
import { loadContextFiles, combineSystemPrompts } from './agent/context-loader'

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for auto mode
 */
export interface AutoModeConfig {
  /** Maximum concurrent feature executions */
  maxConcurrency: number
  /** Default planning mode for features */
  defaultPlanningMode: PlanningMode
  /** Whether to require plan approval by default */
  defaultRequirePlanApproval: boolean
  /** Whether to use worktrees for isolation */
  useWorktrees: boolean
  /** Buffer time in seconds to add to rate limit wait */
  rateLimitBufferSeconds: number
  /** Interval for early resume attempts during long waits (ms) */
  earlyResumeIntervalMs: number
}

/**
 * State of auto mode for a project
 */
export interface AutoModeState {
  /** Whether auto mode is running */
  isRunning: boolean
  /** Number of features currently executing */
  runningCount: number
  /** Maximum concurrent executions */
  maxConcurrency: number
  /** IDs of features currently executing */
  runningFeatureIds: string[]
  /** ID of last started feature */
  lastStartedFeatureId: string | null
  /** Whether currently waiting for rate limit */
  isWaitingForRateLimit: boolean
  /** Rate limit reset time (ISO 8601) */
  rateLimitResetTime?: string
}

/**
 * Progress event data
 */
export interface FeatureProgressEvent {
  /** Feature ID */
  featureId: string
  /** Current status */
  status: FeatureStatus
  /** Progress message */
  message: string
  /** Output text delta (for streaming) */
  textDelta?: string
  /** Tool use information */
  toolUse?: {
    name: string
    input: unknown
  }
}

/**
 * Events emitted by AutoModeServiceV2
 */
export interface AutoModeServiceV2Events {
  /** Emitted when auto mode starts */
  started: (projectPath: string, state: AutoModeState) => void
  /** Emitted when auto mode stops */
  stopped: (projectPath: string) => void
  /** Emitted when state changes */
  stateChanged: (projectPath: string, state: AutoModeState) => void
  /** Emitted when a feature starts executing */
  featureStarted: (projectPath: string, featureId: string) => void
  /** Emitted when a feature completes */
  featureCompleted: (projectPath: string, featureId: string) => void
  /** Emitted when a feature fails */
  featureFailed: (projectPath: string, featureId: string, error: string) => void
  /** Emitted for feature progress updates */
  featureProgress: (projectPath: string, event: FeatureProgressEvent) => void
  /** Emitted when a plan is generated and needs approval */
  planGenerated: (
    projectPath: string,
    featureId: string,
    plan: PlanSpec
  ) => void
  /** Emitted when waiting for rate limit */
  rateLimitWait: (
    projectPath: string,
    resetTime: string,
    waitSeconds: number
  ) => void
  /** Emitted when no eligible features to process */
  idle: (projectPath: string) => void
  /** Emitted on errors */
  error: (projectPath: string, error: ProviderErrorInfo) => void
}

/**
 * Internal loop state for a project
 */
interface AutoModeLoop {
  projectPath: string
  enabled: boolean
  config: AutoModeConfig
  runningFeatureIds: Set<string>
  lastStartedFeatureId: string | null
  loopInterval: NodeJS.Timeout | null
  isProcessing: boolean
  abortControllers: Map<string, AbortController>
  rateLimitResetTime?: Date
  rateLimitTimer?: NodeJS.Timeout
}

// ============================================================================
// Constants
// ============================================================================

/** Default configuration */
const DEFAULT_CONFIG: AutoModeConfig = {
  maxConcurrency: 1,
  defaultPlanningMode: 'skip',
  defaultRequirePlanApproval: false,
  useWorktrees: false,
  rateLimitBufferSeconds: 60,
  earlyResumeIntervalMs: 30 * 60 * 1000, // 30 minutes
}

/** Loop interval in milliseconds */
const LOOP_INTERVAL_MS = 2000

/** Default model for feature execution */
const DEFAULT_MODEL = 'claude-sonnet-4-20250514'

// ============================================================================
// Valid Status Transitions
// ============================================================================

/**
 * Valid status transitions for features
 */
const VALID_TRANSITIONS: Record<FeatureStatus, FeatureStatus[]> = {
  backlog: ['pending'],
  pending: ['in_progress', 'failed'],
  in_progress: ['waiting_approval', 'completed', 'failed'],
  waiting_approval: ['in_progress', 'failed'],
  completed: [],
  failed: ['pending', 'backlog'],
}

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(
  from: FeatureStatus,
  to: FeatureStatus
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

// ============================================================================
// Auto Mode Service V2
// ============================================================================

/**
 * Auto Mode Service V2
 *
 * Manages autonomous feature execution with the Claude Agent SDK.
 */
export class AutoModeServiceV2 extends EventEmitter {
  /** Feature loader for persistence */
  private featureLoader: FeatureLoader

  /** Active loops by project path */
  private loops: Map<string, AutoModeLoop> = new Map()

  /** Worktree service for isolation (optional) */
  private worktreeService?: {
    createWorktree: (
      projectPath: string,
      branchName: string,
      taskId?: string
    ) => Promise<{ path: string }>
    deleteWorktree: (worktreePath: string) => Promise<void>
  }

  /**
   * Create a new AutoModeServiceV2 instance
   *
   * @param featureLoader - Feature loader for persistence
   * @param worktreeService - Optional worktree service for isolation
   */
  constructor(
    featureLoader?: FeatureLoader,
    worktreeService?: AutoModeServiceV2['worktreeService']
  ) {
    super()
    this.featureLoader = featureLoader || new FeatureLoader()
    this.worktreeService = worktreeService
  }

  // ==========================================================================
  // Auto Mode Control
  // ==========================================================================

  /**
   * Start auto mode for a project
   *
   * @param projectPath - The project path
   * @param config - Optional configuration overrides
   */
  async startAutoLoop(
    projectPath: string,
    config?: Partial<AutoModeConfig>
  ): Promise<void> {
    // Check if already running
    let loop = this.loops.get(projectPath)

    if (loop?.enabled) {
      // Already running, update config if provided
      if (config) {
        loop.config = { ...loop.config, ...config }
      }
      return
    }

    // Create or update loop
    const fullConfig: AutoModeConfig = { ...DEFAULT_CONFIG, ...config }

    if (!loop) {
      loop = {
        projectPath,
        enabled: true,
        config: fullConfig,
        runningFeatureIds: new Set(),
        lastStartedFeatureId: null,
        loopInterval: null,
        isProcessing: false,
        abortControllers: new Map(),
      }
      this.loops.set(projectPath, loop)
    } else {
      loop.enabled = true
      loop.config = fullConfig
    }

    // Start the loop interval
    loop.loopInterval = setInterval(() => {
      this.runLoop(projectPath).catch(err => {
        console.error(`[AutoModeV2] Loop error for ${projectPath}:`, err)
      })
    }, LOOP_INTERVAL_MS)

    // Emit started event
    const state = this.getState(projectPath)
    if (state) {
      this.emit('started', projectPath, state)
    }

    console.log(
      `[AutoModeV2] Started for ${projectPath} with concurrency ${fullConfig.maxConcurrency}`
    )

    // Immediately try to process features
    await this.processNextFeature(projectPath)
  }

  /**
   * Stop auto mode for a project
   *
   * @param projectPath - The project path
   */
  async stopAutoLoop(projectPath: string): Promise<void> {
    const loop = this.loops.get(projectPath)

    if (!loop) {
      return
    }

    // Disable the loop
    loop.enabled = false

    // Clear the interval
    if (loop.loopInterval) {
      clearInterval(loop.loopInterval)
      loop.loopInterval = null
    }

    // Clear rate limit timer
    if (loop.rateLimitTimer) {
      clearTimeout(loop.rateLimitTimer)
      loop.rateLimitTimer = undefined
    }

    // Emit stopped event
    this.emit('stopped', projectPath)

    console.log(
      `[AutoModeV2] Stopped for ${projectPath}. ${loop.runningFeatureIds.size} features still running.`
    )
  }

  /**
   * Check if auto mode is running for a project
   *
   * @param projectPath - The project path
   * @returns true if running
   */
  isRunning(projectPath: string): boolean {
    const loop = this.loops.get(projectPath)
    return loop?.enabled ?? false
  }

  /**
   * Get the current state for a project
   *
   * @param projectPath - The project path
   * @returns The auto mode state or null
   */
  getState(projectPath: string): AutoModeState | null {
    const loop = this.loops.get(projectPath)

    if (!loop) {
      return null
    }

    return {
      isRunning: loop.enabled,
      runningCount: loop.runningFeatureIds.size,
      maxConcurrency: loop.config.maxConcurrency,
      runningFeatureIds: Array.from(loop.runningFeatureIds),
      lastStartedFeatureId: loop.lastStartedFeatureId,
      isWaitingForRateLimit: !!loop.rateLimitResetTime,
      rateLimitResetTime: loop.rateLimitResetTime?.toISOString(),
    }
  }

  /**
   * Update configuration for a project
   *
   * @param projectPath - The project path
   * @param config - Configuration updates
   */
  updateConfig(projectPath: string, config: Partial<AutoModeConfig>): void {
    const loop = this.loops.get(projectPath)

    if (loop) {
      loop.config = { ...loop.config, ...config }
      this.emitStateChanged(projectPath)
    }
  }

  // ==========================================================================
  // Feature Queue Operations
  // ==========================================================================

  /**
   * Get the feature queue for a project
   *
   * @param projectPath - The project path
   * @returns Array of pending features
   */
  async getFeatureQueue(projectPath: string): Promise<Feature[]> {
    return this.featureLoader.getPendingFeatures(projectPath)
  }

  /**
   * Get the queue size for a project
   *
   * @param projectPath - The project path
   * @returns Number of pending features
   */
  async getQueueSize(projectPath: string): Promise<number> {
    const pending = await this.featureLoader.getPendingFeatures(projectPath)
    return pending.length
  }

  /**
   * Add a feature to the queue (set status to pending)
   *
   * @param projectPath - The project path
   * @param featureId - The feature ID
   * @returns The updated feature or null
   */
  async enqueueFeature(
    projectPath: string,
    featureId: string
  ): Promise<Feature | null> {
    const feature = await this.featureLoader.loadFeature(projectPath, featureId)

    if (!feature) {
      return null
    }

    // Validate transition
    if (!isValidStatusTransition(feature.status, 'pending')) {
      console.warn(
        `[AutoModeV2] Invalid transition from ${feature.status} to pending for feature ${featureId}`
      )
      return null
    }

    return this.featureLoader.updateStatus(projectPath, featureId, 'pending')
  }

  /**
   * Remove a feature from the queue (set status to backlog)
   *
   * @param projectPath - The project path
   * @param featureId - The feature ID
   * @returns The updated feature or null
   */
  async dequeueFeature(
    projectPath: string,
    featureId: string
  ): Promise<Feature | null> {
    const feature = await this.featureLoader.loadFeature(projectPath, featureId)

    if (!feature) {
      return null
    }

    // Only dequeue if pending
    if (feature.status !== 'pending') {
      return null
    }

    return this.featureLoader.updateStatus(projectPath, featureId, 'backlog')
  }

  // ==========================================================================
  // Feature Execution Control
  // ==========================================================================

  /**
   * Stop a specific feature execution
   *
   * @param projectPath - The project path
   * @param featureId - The feature ID
   * @returns true if stopped
   */
  async stopFeature(projectPath: string, featureId: string): Promise<boolean> {
    const loop = this.loops.get(projectPath)

    if (!loop) {
      return false
    }

    const controller = loop.abortControllers.get(featureId)
    if (controller) {
      controller.abort()
      loop.abortControllers.delete(featureId)
      loop.runningFeatureIds.delete(featureId)

      // Update feature status to failed with abort message
      await this.featureLoader.updateFeature(projectPath, featureId, {
        status: 'failed',
        error: 'Execution stopped by user',
      })

      this.emitStateChanged(projectPath)
      return true
    }

    return false
  }

  /**
   * Stop all running features for a project
   *
   * @param projectPath - The project path
   */
  async stopAllFeatures(projectPath: string): Promise<void> {
    const loop = this.loops.get(projectPath)

    if (!loop) {
      return
    }

    // Abort all running features
    for (const featureId of loop.runningFeatureIds) {
      await this.stopFeature(projectPath, featureId)
    }
  }

  // ==========================================================================
  // Internal Loop Processing
  // ==========================================================================

  /**
   * Run the auto mode loop
   */
  private async runLoop(projectPath: string): Promise<void> {
    const loop = this.loops.get(projectPath)

    if (!loop || !loop.enabled || loop.isProcessing) {
      return
    }

    // Don't process if waiting for rate limit
    if (loop.rateLimitResetTime && new Date() < loop.rateLimitResetTime) {
      return
    }

    await this.processNextFeature(projectPath)
  }

  /**
   * Process the next eligible feature
   */
  private async processNextFeature(projectPath: string): Promise<void> {
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
      // Check capacity
      if (loop.runningFeatureIds.size >= loop.config.maxConcurrency) {
        return
      }

      // Get pending features
      const pendingFeatures =
        await this.featureLoader.getPendingFeatures(projectPath)

      if (pendingFeatures.length === 0) {
        this.emit('idle', projectPath)
        return
      }

      // Find next eligible feature (not already running)
      const eligibleFeature = pendingFeatures.find(
        f => !loop.runningFeatureIds.has(f.id)
      )

      if (!eligibleFeature) {
        this.emit('idle', projectPath)
        return
      }

      // Start executing the feature
      await this.startFeatureExecution(projectPath, eligibleFeature)
    } finally {
      loop.isProcessing = false
    }
  }

  /**
   * Start executing a feature
   */
  private async startFeatureExecution(
    projectPath: string,
    feature: Feature
  ): Promise<void> {
    const loop = this.loops.get(projectPath)

    if (!loop || !loop.enabled) {
      return
    }

    // Track as running
    loop.runningFeatureIds.add(feature.id)
    loop.lastStartedFeatureId = feature.id

    // Create abort controller
    const abortController = new AbortController()
    loop.abortControllers.set(feature.id, abortController)

    // Update status to in_progress
    await this.featureLoader.updateFeature(projectPath, feature.id, {
      status: 'in_progress',
      startedAt: new Date().toISOString(),
    })

    this.emit('featureStarted', projectPath, feature.id)
    this.emitStateChanged(projectPath)

    // Execute in background
    this.executeFeatureAsync(projectPath, feature, abortController).catch(
      err => {
        console.error(
          `[AutoModeV2] Error executing feature ${feature.id}:`,
          err
        )
      }
    )
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

  // ==========================================================================
  // Plan Approval Workflow
  // ==========================================================================

  /**
   * Approve a generated plan and continue execution
   *
   * @param projectPath - The project path
   * @param featureId - The feature ID
   * @returns The updated feature or null
   */
  async approvePlan(
    projectPath: string,
    featureId: string
  ): Promise<Feature | null> {
    const feature = await this.featureLoader.loadFeature(projectPath, featureId)

    if (!feature) {
      return null
    }

    // Must be in waiting_approval status
    if (feature.status !== 'waiting_approval') {
      console.warn(
        `[AutoModeV2] Cannot approve plan for feature ${featureId} in status ${feature.status}`
      )
      return null
    }

    // Ensure planSpec exists before updating
    if (!feature.planSpec) {
      console.warn(
        `[AutoModeV2] Cannot approve plan for feature ${featureId} - no plan spec found`
      )
      return null
    }

    // Update plan spec status
    const updatedPlanSpec: PlanSpec = {
      ...feature.planSpec,
      status: 'approved',
      approvedAt: new Date().toISOString(),
    }

    // Update feature to in_progress to continue execution
    const updatedFeature = await this.featureLoader.updateFeature(
      projectPath,
      featureId,
      {
        status: 'in_progress',
        planSpec: updatedPlanSpec,
      }
    )

    if (updatedFeature) {
      this.emit('featureProgress', projectPath, {
        featureId,
        status: 'in_progress',
        message: 'Plan approved, continuing with implementation',
      })
    }

    return updatedFeature
  }

  /**
   * Reject a generated plan and request regeneration
   *
   * @param projectPath - The project path
   * @param featureId - The feature ID
   * @param feedback - Feedback for plan regeneration
   * @returns The updated feature or null
   */
  async rejectPlan(
    projectPath: string,
    featureId: string,
    feedback: string
  ): Promise<Feature | null> {
    const feature = await this.featureLoader.loadFeature(projectPath, featureId)

    if (!feature) {
      return null
    }

    // Must be in waiting_approval status
    if (feature.status !== 'waiting_approval') {
      console.warn(
        `[AutoModeV2] Cannot reject plan for feature ${featureId} in status ${feature.status}`
      )
      return null
    }

    // Update plan spec with rejection and increment version
    const currentVersion = feature.planSpec?.version ?? 0
    const updatedPlanSpec: PlanSpec = {
      status: 'rejected',
      version: currentVersion + 1,
      content: feature.planSpec?.content,
    }

    // Update feature to in_progress to regenerate plan
    const updatedFeature = await this.featureLoader.updateFeature(
      projectPath,
      featureId,
      {
        status: 'in_progress',
        planSpec: updatedPlanSpec,
      }
    )

    if (updatedFeature) {
      this.emit('featureProgress', projectPath, {
        featureId,
        status: 'in_progress',
        message: `Plan rejected, regenerating with feedback: ${feedback}`,
      })

      // Re-execute with feedback
      const loop = this.loops.get(projectPath)
      if (loop) {
        const abortController =
          loop.abortControllers.get(featureId) || new AbortController()
        loop.abortControllers.set(featureId, abortController)

        // Re-execute feature with feedback
        this.executeFeatureAsync(
          projectPath,
          {
            ...updatedFeature,
            description: `${updatedFeature.description}\n\nFeedback on previous plan: ${feedback}`,
          },
          abortController
        ).catch((err: Error) => {
          console.error(
            `[AutoModeV2] Error re-executing feature ${featureId}:`,
            err
          )
        })
      }
    }

    return updatedFeature
  }

  /**
   * Get the planning mode for a feature
   *
   * @param feature - The feature
   * @param config - The auto mode config
   * @returns The planning mode to use
   */
  private getPlanningMode(
    feature: Feature,
    config: AutoModeConfig
  ): PlanningMode {
    return feature.planningMode ?? config.defaultPlanningMode
  }

  /**
   * Check if plan approval is required for a feature
   *
   * @param feature - The feature
   * @param config - The auto mode config
   * @returns true if approval is required
   */
  private requiresPlanApproval(
    feature: Feature,
    config: AutoModeConfig
  ): boolean {
    // Explicit feature setting takes precedence
    if (feature.requirePlanApproval !== undefined) {
      return feature.requirePlanApproval
    }

    // Use config default
    return config.defaultRequirePlanApproval
  }

  // ==========================================================================
  // Feature Execution
  // ==========================================================================

  /**
   * Execute a feature (public method for manual execution)
   *
   * @param projectPath - The project path
   * @param featureId - The feature ID
   * @param useWorktrees - Whether to use worktrees for isolation
   * @returns The updated feature or null
   */
  async executeFeature(
    projectPath: string,
    featureId: string,
    useWorktrees?: boolean
  ): Promise<Feature | null> {
    const feature = await this.featureLoader.loadFeature(projectPath, featureId)

    if (!feature) {
      return null
    }

    // Create abort controller
    const abortController = new AbortController()

    // Get or create loop for tracking
    let loop = this.loops.get(projectPath)
    if (!loop) {
      loop = {
        projectPath,
        enabled: false,
        config: { ...DEFAULT_CONFIG, useWorktrees: useWorktrees ?? false },
        runningFeatureIds: new Set(),
        lastStartedFeatureId: null,
        loopInterval: null,
        isProcessing: false,
        abortControllers: new Map(),
      }
      this.loops.set(projectPath, loop)
    }

    loop.abortControllers.set(featureId, abortController)
    loop.runningFeatureIds.add(featureId)

    // Update status
    await this.featureLoader.updateFeature(projectPath, featureId, {
      status: 'in_progress',
      startedAt: new Date().toISOString(),
    })

    this.emit('featureStarted', projectPath, featureId)

    // Execute
    try {
      await this.executeFeatureAsync(projectPath, feature, abortController)
      return this.featureLoader.loadFeature(projectPath, featureId)
    } catch {
      return this.featureLoader.loadFeature(projectPath, featureId)
    }
  }

  /**
   * Execute a feature asynchronously
   */
  private async executeFeatureAsync(
    projectPath: string,
    feature: Feature,
    abortController: AbortController
  ): Promise<void> {
    const loop = this.loops.get(projectPath)
    const config = loop?.config ?? DEFAULT_CONFIG

    let workingDirectory = projectPath

    try {
      // Create worktree if enabled and branch name is provided
      if (config.useWorktrees && this.worktreeService && feature.branchName) {
        try {
          const worktree = await this.worktreeService.createWorktree(
            projectPath,
            feature.branchName,
            feature.id
          )
          workingDirectory = worktree.path
        } catch (err) {
          console.warn(
            `[AutoModeV2] Failed to create worktree, using project directory:`,
            err
          )
        }
      }

      // Get planning mode and build prompt
      const planningMode = this.getPlanningMode(feature, config)
      const requireApproval = this.requiresPlanApproval(feature, config)

      // Build prompt with planning prefix
      const planningPrefix = getPlanningPromptPrefix(
        planningMode,
        requireApproval
      )
      const fullPrompt = planningPrefix + feature.description

      // Load context files from the effective working directory (worktree or project)
      const { formattedPrompt: contextFilesPrompt } = await loadContextFiles({
        projectPath: workingDirectory,
      })
      const combinedSystemPrompt = combineSystemPrompts(
        contextFilesPrompt || undefined
      )

      // Get provider
      const model = feature.model ?? DEFAULT_MODEL
      const provider = ProviderFactory.getProviderForModel(model)

      // Accumulate output for saving
      let outputContent = ''

      // Execute query
      const stream = provider.executeQuery({
        prompt: fullPrompt,
        model,
        cwd: workingDirectory,
        systemPrompt: combinedSystemPrompt,
        abortController,
      })

      // Process stream
      for await (const msg of stream) {
        // Check for abort
        if (abortController.signal.aborted) {
          break
        }

        if (msg.type === 'assistant' && msg.message) {
          for (const block of msg.message.content) {
            if (block.type === 'text' && block.text) {
              outputContent += block.text

              // Emit progress
              this.emit('featureProgress', projectPath, {
                featureId: feature.id,
                status: 'in_progress',
                message: 'Executing...',
                textDelta: block.text,
              })

              // Check for plan generation markers
              if (
                requireApproval &&
                planningMode !== 'skip' &&
                needsPlanApproval(outputContent)
              ) {
                // Parse tasks from spec
                const tasks = parseTasksFromSpec(outputContent)

                // Update feature with plan spec
                const planSpec: PlanSpec = {
                  status: 'generated',
                  content: outputContent,
                  version: (feature.planSpec?.version ?? 0) + 1,
                  generatedAt: new Date().toISOString(),
                  tasks,
                }

                await this.featureLoader.updateFeature(
                  projectPath,
                  feature.id,
                  {
                    status: 'waiting_approval',
                    planSpec,
                  }
                )

                // Emit plan generated event
                this.emit('planGenerated', projectPath, feature.id, planSpec)

                // Save output so far
                await this.featureLoader.saveAgentOutput(
                  projectPath,
                  feature.id,
                  outputContent
                )

                // Stop execution and wait for approval
                return
              }
            } else if (block.type === 'tool_use' && block.name) {
              this.emit('featureProgress', projectPath, {
                featureId: feature.id,
                status: 'in_progress',
                message: `Using tool: ${block.name}`,
                toolUse: {
                  name: block.name,
                  input: block.input,
                },
              })
            }
          }
        } else if (msg.type === 'result') {
          if (msg.subtype === 'success' && msg.result) {
            outputContent = msg.result
          } else if (msg.subtype === 'error' && msg.error) {
            throw new Error(msg.error)
          }
        } else if (msg.type === 'error') {
          throw new Error(msg.error || 'Unknown error')
        }
      }

      // Save agent output
      await this.featureLoader.saveAgentOutput(
        projectPath,
        feature.id,
        outputContent
      )

      // Update task progress if plan was generated
      if (feature.planSpec?.tasks && hasPlanGenerated(outputContent)) {
        const progress = extractTaskProgress(outputContent)
        const updatedTasks = updateTaskStatuses(
          feature.planSpec.tasks,
          progress
        )

        await this.featureLoader.updateFeature(projectPath, feature.id, {
          planSpec: {
            ...feature.planSpec,
            tasks: updatedTasks,
          },
        })
      }

      // Mark as completed
      await this.featureLoader.updateFeature(projectPath, feature.id, {
        status: 'completed',
        summary: outputContent.slice(0, 500),
      })

      this.emit('featureCompleted', projectPath, feature.id)
    } catch (error) {
      // Classify error
      const errorInfo = classifyError(error)

      // Handle rate limit
      if (errorInfo.type === 'rate_limit') {
        await this.handleRateLimit(projectPath, feature.id, errorInfo)
        return
      }

      // Handle abort (don't mark as failed)
      if (errorInfo.isAbort) {
        console.log(`[AutoModeV2] Feature ${feature.id} execution aborted`)
        return
      }

      // Mark as failed
      await this.featureLoader.updateFeature(projectPath, feature.id, {
        status: 'failed',
        error: errorInfo.message,
      })

      this.emit('featureFailed', projectPath, feature.id, errorInfo.message)
      this.emit('error', projectPath, errorInfo)
    } finally {
      // Clean up
      if (loop) {
        loop.abortControllers.delete(feature.id)
        loop.runningFeatureIds.delete(feature.id)
        this.emitStateChanged(projectPath)
      }

      // Trigger next feature if auto mode is running
      if (loop?.enabled) {
        this.processNextFeature(projectPath).catch((err: Error) => {
          console.error(`[AutoModeV2] Error processing next feature:`, err)
        })
      }
    }
  }

  // ==========================================================================
  // Rate Limit Handling
  // ==========================================================================

  /**
   * Handle rate limit error
   */
  private async handleRateLimit(
    projectPath: string,
    featureId: string,
    errorInfo: ProviderErrorInfo
  ): Promise<void> {
    const loop = this.loops.get(projectPath)

    if (!loop) {
      return
    }

    // Parse reset time from error message
    let resetTime: Date
    if (errorInfo.resetTime) {
      resetTime = new Date(errorInfo.resetTime)
    } else {
      // Try to parse from message
      const match = errorInfo.message.match(
        /reset at (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/
      )
      if (match) {
        resetTime = new Date(`${match[1].replace(' ', 'T')}Z`)
      } else {
        // Default to 1 minute from now
        resetTime = new Date(Date.now() + 60 * 1000)
      }
    }

    // Add buffer
    const bufferMs = loop.config.rateLimitBufferSeconds * 1000
    const waitUntil = new Date(resetTime.getTime() + bufferMs)
    const waitSeconds = Math.ceil((waitUntil.getTime() - Date.now()) / 1000)

    // Store rate limit state
    loop.rateLimitResetTime = waitUntil

    // Emit rate limit event
    this.emit(
      'rateLimitWait',
      projectPath,
      waitUntil.toISOString(),
      waitSeconds
    )
    this.emitStateChanged(projectPath)

    console.log(
      `[AutoModeV2] Rate limited, waiting ${waitSeconds}s until ${waitUntil.toISOString()}`
    )

    // Set up timer for resume
    const setupResumeTimer = (delay: number) => {
      loop.rateLimitTimer = setTimeout(async () => {
        // Clear rate limit state
        loop.rateLimitResetTime = undefined
        loop.rateLimitTimer = undefined
        this.emitStateChanged(projectPath)

        // Re-queue the feature
        await this.featureLoader.updateFeature(projectPath, featureId, {
          status: 'pending',
        })

        console.log(`[AutoModeV2] Rate limit wait complete, resuming`)

        // Process next feature
        if (loop.enabled) {
          await this.processNextFeature(projectPath)
        }
      }, delay)
    }

    // For long waits, set up early resume attempts
    const waitMs = waitSeconds * 1000
    if (waitMs > loop.config.earlyResumeIntervalMs) {
      // Try early resume every earlyResumeIntervalMs
      setupResumeTimer(loop.config.earlyResumeIntervalMs)
    } else {
      setupResumeTimer(waitMs)
    }
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Clean up resources
   */
  destroy(): void {
    // Stop all loops
    for (const [, loop] of this.loops) {
      if (loop.loopInterval) {
        clearInterval(loop.loopInterval)
      }
      if (loop.rateLimitTimer) {
        clearTimeout(loop.rateLimitTimer)
      }
      // Abort all running features
      for (const controller of loop.abortControllers.values()) {
        controller.abort()
      }
    }

    this.loops.clear()
    this.removeAllListeners()
  }
}
