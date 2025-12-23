/**
 * Auto Mode Service
 *
 * Manages autonomous feature execution using the Claude Agent SDK.
 * Provides feature queue management, planning mode support, and
 * real-time progress events.
 *
 * Implements Requirements:
 * - 4.1: Maintain a queue of pending features for execution
 * - 4.2: Continuously process pending features up to concurrency limit
 * - 4.3: Emit progress events for real-time UI updates
 * - 4.4: Update feature status through lifecycle (pending → in_progress → completed/failed)
 * - 4.5: Mark failed features and continue with next feature
 * - 4.6: Support stopping individual features or entire auto mode loop
 * - 4.7: Save agent output to feature directory
 * - 5.1: Support four planning modes: skip, lite, spec, full
 * - 5.2: Generate brief planning outline for lite mode
 * - 5.3: Generate detailed specification for spec mode
 * - 5.4: Generate comprehensive specification for full mode
 * - 5.5: Pause execution and emit awaiting_approval event when plan needs approval
 * - 5.6: Continue with implementation when plan is approved
 * - 5.7: Regenerate plan with feedback when rejected
 * - 9.3: Save agent output to feature directory
 * - 10.1: Handle rate limit errors with event emission
 * - 10.2: Handle abort errors without marking task as failed
 * - 10.4: Continue with next feature on error
 *
 * @module auto-mode-service
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
import { classifyError, type ErrorInfo } from './utils/error-handler'
import type { ProviderErrorInfo } from './providers/types'
import { loadContextFiles, combineSystemPrompts } from './context-loader'

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
  /** Buffer time in seconds to add to rate limit wait */
  rateLimitBufferSeconds: number
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
 * Running feature tracking
 */
interface RunningFeature {
  featureId: string
  projectPath: string
  abortController: AbortController
  transcript: string
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

/**
 * Pending plan approval entry
 */
interface PendingApproval {
  projectPath: string
  resolve: (value: { approved: boolean; feedback?: string }) => void
  reject: (error: Error) => void
}

// ============================================================================
// Constants
// ============================================================================

/** Default configuration */
const DEFAULT_CONFIG: AutoModeConfig = {
  maxConcurrency: 1,
  defaultPlanningMode: 'skip',
  defaultRequirePlanApproval: false,
  rateLimitBufferSeconds: 60,
}

/** Loop interval in milliseconds */
const LOOP_INTERVAL_MS = 2000

/** Default model for feature execution */
const DEFAULT_MODEL = 'claude-sonnet-4-20250514'

/** Default max turns for agent execution */
const DEFAULT_MAX_TURNS = 100

/** Max turns per individual task in multi-agent execution */
const MAX_TURNS_PER_TASK = 50

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
// Planning Prompts
// ============================================================================

/**
 * Planning prompt templates for each mode
 */
const PLANNING_PROMPTS = {
  lite: `## Planning Phase (Lite Mode)

IMPORTANT: Do NOT output exploration text, tool usage, or thinking before the plan. Start DIRECTLY with the planning outline format below. Silently analyze the codebase first, then output ONLY the structured plan.

Create a brief planning outline:

1. **Goal**: What are we accomplishing? (1 sentence)
2. **Approach**: How will we do it? (2-3 sentences)
3. **Files to Touch**: List files and what changes
4. **Tasks**: Numbered task list (3-7 items)
5. **Risks**: Any gotchas to watch for

After generating the outline, output:
"[PLAN_GENERATED] Planning outline complete."

Then proceed with implementation.`,

  lite_with_approval: `## Planning Phase (Lite Mode)

IMPORTANT: Do NOT output exploration text, tool usage, or thinking before the plan. Start DIRECTLY with the planning outline format below. Silently analyze the codebase first, then output ONLY the structured plan.

Create a brief planning outline:

1. **Goal**: What are we accomplishing? (1 sentence)
2. **Approach**: How will we do it? (2-3 sentences)
3. **Files to Touch**: List files and what changes
4. **Tasks**: Numbered task list (3-7 items)
5. **Risks**: Any gotchas to watch for

After generating the outline, output:
"[SPEC_GENERATED] Please review the planning outline above. Reply with 'approved' to proceed or provide feedback for revisions."

DO NOT proceed with implementation until you receive explicit approval.`,

  spec: `## Specification Phase (Spec Mode)

IMPORTANT: Do NOT output exploration text, tool usage, or thinking before the spec. Start DIRECTLY with the specification format below. Silently analyze the codebase first, then output ONLY the structured specification.

Generate a specification with an actionable task breakdown. WAIT for approval before implementing.

### Specification Format

1. **Problem**: What problem are we solving? (user perspective)

2. **Solution**: Brief approach (1-2 sentences)

3. **Acceptance Criteria**: 3-5 items in GIVEN-WHEN-THEN format
   - GIVEN [context], WHEN [action], THEN [outcome]

4. **Files to Modify**:
   | File | Purpose | Action |
   |------|---------|--------|
   | path/to/file | description | create/modify/delete |

5. **Implementation Tasks**:
   Use this EXACT format for each task (the system will parse these):
   \`\`\`tasks
   - [ ] T001: [Description] | File: [path/to/file]
   - [ ] T002: [Description] | File: [path/to/file]
   - [ ] T003: [Description] | File: [path/to/file]
   \`\`\`

   Task ID rules:
   - Sequential: T001, T002, T003, etc.
   - Description: Clear action (e.g., "Create user model", "Add API endpoint")
   - File: Primary file affected (helps with context)
   - Order by dependencies (foundational tasks first)

6. **Verification**: How to confirm feature works

After generating the spec, output on its own line:
"[SPEC_GENERATED] Please review the specification above. Reply with 'approved' to proceed or provide feedback for revisions."

DO NOT proceed with implementation until you receive explicit approval.

When approved, execute tasks SEQUENTIALLY in order. For each task:
1. BEFORE starting, output: "[TASK_START] T###: Description"
2. Implement the task
3. AFTER completing, output: "[TASK_COMPLETE] T###: Brief summary"

This allows real-time progress tracking during implementation.`,

  spec_with_approval: `## Specification Phase (Spec Mode)

IMPORTANT: Do NOT output exploration text, tool usage, or thinking before the spec. Start DIRECTLY with the specification format below. Silently analyze the codebase first, then output ONLY the structured specification.

Generate a specification with an actionable task breakdown. WAIT for approval before implementing.

### Specification Format

1. **Problem**: What problem are we solving? (user perspective)

2. **Solution**: Brief approach (1-2 sentences)

3. **Acceptance Criteria**: 3-5 items in GIVEN-WHEN-THEN format
   - GIVEN [context], WHEN [action], THEN [outcome]

4. **Files to Modify**:
   | File | Purpose | Action |
   |------|---------|--------|
   | path/to/file | description | create/modify/delete |

5. **Implementation Tasks**:
   Use this EXACT format for each task (the system will parse these):
   \`\`\`tasks
   - [ ] T001: [Description] | File: [path/to/file]
   - [ ] T002: [Description] | File: [path/to/file]
   - [ ] T003: [Description] | File: [path/to/file]
   \`\`\`

   Task ID rules:
   - Sequential: T001, T002, T003, etc.
   - Description: Clear action (e.g., "Create user model", "Add API endpoint")
   - File: Primary file affected (helps with context)
   - Order by dependencies (foundational tasks first)

6. **Verification**: How to confirm feature works

After generating the spec, output on its own line:
"[SPEC_GENERATED] Please review the specification above. Reply with 'approved' to proceed or provide feedback for revisions."

DO NOT proceed with implementation until you receive explicit approval.

When approved, execute tasks SEQUENTIALLY in order. For each task:
1. BEFORE starting, output: "[TASK_START] T###: Description"
2. Implement the task
3. AFTER completing, output: "[TASK_COMPLETE] T###: Brief summary"

This allows real-time progress tracking during implementation.`,

  full: `## Full Specification Phase (Full SDD Mode)

IMPORTANT: Do NOT output exploration text, tool usage, or thinking before the spec. Start DIRECTLY with the specification format below. Silently analyze the codebase first, then output ONLY the structured specification.

Generate a comprehensive specification with phased task breakdown. WAIT for approval before implementing.

### Specification Format

1. **Problem Statement**: 2-3 sentences from user perspective

2. **User Story**: As a [user], I want [goal], so that [benefit]

3. **Acceptance Criteria**: Multiple scenarios with GIVEN-WHEN-THEN
   - **Happy Path**: GIVEN [context], WHEN [action], THEN [expected outcome]
   - **Edge Cases**: GIVEN [edge condition], WHEN [action], THEN [handling]
   - **Error Handling**: GIVEN [error condition], WHEN [action], THEN [error response]

4. **Technical Context**:
   | Aspect | Value |
   |--------|-------|
   | Affected Files | list of files |
   | Dependencies | external libs if any |
   | Constraints | technical limitations |
   | Patterns to Follow | existing patterns in codebase |

5. **Non-Goals**: What this feature explicitly does NOT include

6. **Implementation Tasks**:
   Use this EXACT format for each task (the system will parse these):
   \`\`\`tasks
   ## Phase 1: Foundation
   - [ ] T001: [Description] | File: [path/to/file]
   - [ ] T002: [Description] | File: [path/to/file]

   ## Phase 2: Core Implementation
   - [ ] T003: [Description] | File: [path/to/file]
   - [ ] T004: [Description] | File: [path/to/file]

   ## Phase 3: Integration & Testing
   - [ ] T005: [Description] | File: [path/to/file]
   - [ ] T006: [Description] | File: [path/to/file]
   \`\`\`

   Task ID rules:
   - Sequential across all phases: T001, T002, T003, etc.
   - Description: Clear action verb + target
   - File: Primary file affected
   - Order by dependencies within each phase
   - Phase structure helps organize complex work

7. **Success Metrics**: How we know it's done (measurable criteria)

8. **Risks & Mitigations**:
   | Risk | Mitigation |
   |------|------------|
   | description | approach |

After generating the spec, output on its own line:
"[SPEC_GENERATED] Please review the comprehensive specification above. Reply with 'approved' to proceed or provide feedback for revisions."

DO NOT proceed with implementation until you receive explicit approval.

When approved, execute tasks SEQUENTIALLY by phase. For each task:
1. BEFORE starting, output: "[TASK_START] T###: Description"
2. Implement the task
3. AFTER completing, output: "[TASK_COMPLETE] T###: Brief summary"

After completing all tasks in a phase, output:
"[PHASE_COMPLETE] Phase N complete"

This allows real-time progress tracking during implementation.`,

  full_with_approval: `## Full Specification Phase (Full SDD Mode)

IMPORTANT: Do NOT output exploration text, tool usage, or thinking before the spec. Start DIRECTLY with the specification format below. Silently analyze the codebase first, then output ONLY the structured specification.

Generate a comprehensive specification with phased task breakdown. WAIT for approval before implementing.

### Specification Format

1. **Problem Statement**: 2-3 sentences from user perspective

2. **User Story**: As a [user], I want [goal], so that [benefit]

3. **Acceptance Criteria**: Multiple scenarios with GIVEN-WHEN-THEN
   - **Happy Path**: GIVEN [context], WHEN [action], THEN [expected outcome]
   - **Edge Cases**: GIVEN [edge condition], WHEN [action], THEN [handling]
   - **Error Handling**: GIVEN [error condition], WHEN [action], THEN [error response]

4. **Technical Context**:
   | Aspect | Value |
   |--------|-------|
   | Affected Files | list of files |
   | Dependencies | external libs if any |
   | Constraints | technical limitations |
   | Patterns to Follow | existing patterns in codebase |

5. **Non-Goals**: What this feature explicitly does NOT include

6. **Implementation Tasks**:
   Use this EXACT format for each task (the system will parse these):
   \`\`\`tasks
   ## Phase 1: Foundation
   - [ ] T001: [Description] | File: [path/to/file]
   - [ ] T002: [Description] | File: [path/to/file]

   ## Phase 2: Core Implementation
   - [ ] T003: [Description] | File: [path/to/file]
   - [ ] T004: [Description] | File: [path/to/file]

   ## Phase 3: Integration & Testing
   - [ ] T005: [Description] | File: [path/to/file]
   - [ ] T006: [Description] | File: [path/to/file]
   \`\`\`

   Task ID rules:
   - Sequential across all phases: T001, T002, T003, etc.
   - Description: Clear action verb + target
   - File: Primary file affected
   - Order by dependencies within each phase
   - Phase structure helps organize complex work

7. **Success Metrics**: How we know it's done (measurable criteria)

8. **Risks & Mitigations**:
   | Risk | Mitigation |
   |------|------------|
   | description | approach |

After generating the spec, output on its own line:
"[SPEC_GENERATED] Please review the comprehensive specification above. Reply with 'approved' to proceed or provide feedback for revisions."

DO NOT proceed with implementation until you receive explicit approval.

When approved, execute tasks SEQUENTIALLY by phase. For each task:
1. BEFORE starting, output: "[TASK_START] T###: Description"
2. Implement the task
3. AFTER completing, output: "[TASK_COMPLETE] T###: Brief summary"

After completing all tasks in a phase, output:
"[PHASE_COMPLETE] Phase N complete"

This allows real-time progress tracking during implementation.`,
} as const

/**
 * Planning markers for parsing
 */
const PLANNING_MARKERS = {
  PLAN_GENERATED: '[PLAN_GENERATED]',
  SPEC_GENERATED: '[SPEC_GENERATED]',
  TASK_START: '[TASK_START]',
  TASK_COMPLETE: '[TASK_COMPLETE]',
  PHASE_COMPLETE: '[PHASE_COMPLETE]',
} as const

// ============================================================================
// Task Parsing (Multi-Agent Execution Support)
// ============================================================================

/**
 * Parsed task from spec content
 */
interface ParsedTask {
  /** Task ID (e.g., T001) */
  id: string
  /** Task description */
  description: string
  /** Primary file path (optional) */
  filePath?: string
  /** Phase this task belongs to (optional) */
  phase?: string
  /** Task status */
  status: 'pending' | 'in_progress' | 'completed'
}

/**
 * Parse tasks from generated spec content
 * Looks for the ```tasks code block and extracts task lines
 * Format: - [ ] T###: Description | File: path/to/file
 */
function parseTasksFromSpec(specContent: string): ParsedTask[] {
  const tasks: ParsedTask[] = []

  // Extract content within ```tasks ... ``` block
  const tasksBlockMatch = specContent.match(/```tasks\s*([\s\S]*?)```/)
  if (!tasksBlockMatch) {
    // Try fallback: look for task lines anywhere in content
    const taskLines = specContent.match(/- \[ \] T\d{3}:.*$/gm)
    if (!taskLines) {
      return tasks
    }
    // Parse fallback task lines
    let currentPhase: string | undefined
    for (const line of taskLines) {
      const parsed = parseTaskLine(line, currentPhase)
      if (parsed) {
        tasks.push(parsed)
      }
    }
    return tasks
  }

  const tasksContent = tasksBlockMatch[1]
  const lines = tasksContent.split('\n')

  let currentPhase: string | undefined

  for (const line of lines) {
    const trimmedLine = line.trim()

    // Check for phase header (e.g., "## Phase 1: Foundation")
    const phaseMatch = trimmedLine.match(/^##\s*(.+)$/)
    if (phaseMatch) {
      currentPhase = phaseMatch[1].trim()
      continue
    }

    // Check for task line
    if (trimmedLine.startsWith('- [ ]')) {
      const parsed = parseTaskLine(trimmedLine, currentPhase)
      if (parsed) {
        tasks.push(parsed)
      }
    }
  }

  return tasks
}

/**
 * Parse a single task line
 * Format: - [ ] T###: Description | File: path/to/file
 */
function parseTaskLine(line: string, currentPhase?: string): ParsedTask | null {
  // Match pattern: - [ ] T###: Description | File: path
  const taskMatch = line.match(
    /- \[ \] (T\d{3}):\s*([^|]+)(?:\|\s*File:\s*(.+))?$/
  )
  if (!taskMatch) {
    // Try simpler pattern without file
    const simpleMatch = line.match(/- \[ \] (T\d{3}):\s*(.+)$/)
    if (simpleMatch) {
      return {
        id: simpleMatch[1],
        description: simpleMatch[2].trim(),
        phase: currentPhase,
        status: 'pending',
      }
    }
    return null
  }

  return {
    id: taskMatch[1],
    description: taskMatch[2].trim(),
    filePath: taskMatch[3]?.trim(),
    phase: currentPhase,
    status: 'pending',
  }
}

/**
 * Build a focused prompt for executing a single task.
 * Each task gets minimal context to keep the agent focused.
 */
function buildTaskPrompt(
  task: ParsedTask,
  allTasks: ParsedTask[],
  taskIndex: number,
  planContent: string,
  userFeedback?: string
): string {
  const completedTasks = allTasks.slice(0, taskIndex)
  const remainingTasks = allTasks.slice(taskIndex + 1)

  let prompt = `# Task Execution: ${task.id}

You are executing a specific task as part of a larger feature implementation.

## Your Current Task

**Task ID:** ${task.id}
**Description:** ${task.description}
${task.filePath ? `**Primary File:** ${task.filePath}` : ''}
${task.phase ? `**Phase:** ${task.phase}` : ''}

## Context

`

  // Show what's already done
  if (completedTasks.length > 0) {
    prompt += `### Already Completed (${completedTasks.length} tasks)
${completedTasks.map(t => `- [x] ${t.id}: ${t.description}`).join('\n')}

`
  }

  // Show remaining tasks
  if (remainingTasks.length > 0) {
    prompt += `### Coming Up Next (${remainingTasks.length} tasks remaining)
${remainingTasks
  .slice(0, 3)
  .map(t => `- [ ] ${t.id}: ${t.description}`)
  .join('\n')}
${remainingTasks.length > 3 ? `... and ${remainingTasks.length - 3} more tasks` : ''}

`
  }

  // Add user feedback if any
  if (userFeedback) {
    prompt += `### User Feedback
${userFeedback}

`
  }

  // Add relevant excerpt from plan (just the task-related part to save context)
  prompt += `### Reference: Full Plan
<details>
${planContent}
</details>

## Instructions

1. Focus ONLY on completing task ${task.id}: "${task.description}"
2. Do not work on other tasks
3. Use the existing codebase patterns
4. When done, summarize what you implemented

Begin implementing task ${task.id} now.`

  return prompt
}

/**
 * Get the planning prompt prefix for a given planning mode
 */
function getPlanningPromptPrefix(
  planningMode: PlanningMode,
  requirePlanApproval: boolean
): string {
  if (planningMode === 'skip') {
    return ''
  }

  let promptKey: keyof typeof PLANNING_PROMPTS

  if (planningMode === 'lite') {
    promptKey = requirePlanApproval ? 'lite_with_approval' : 'lite'
  } else if (planningMode === 'spec') {
    promptKey = requirePlanApproval ? 'spec_with_approval' : 'spec'
  } else if (planningMode === 'full') {
    promptKey = requirePlanApproval ? 'full_with_approval' : 'full'
  } else {
    return ''
  }

  const planningPrompt = PLANNING_PROMPTS[promptKey]
  if (!planningPrompt) {
    return ''
  }

  return `${planningPrompt}\n\n---\n\n## Task Request\n\n`
}

/**
 * Check if content indicates plan approval is needed
 */
function needsPlanApproval(content: string): boolean {
  return content.includes(PLANNING_MARKERS.SPEC_GENERATED)
}

/**
 * Convert ErrorInfo to ProviderErrorInfo for event emission
 */
function toProviderErrorInfo(errorInfo: ErrorInfo): ProviderErrorInfo {
  return {
    type: errorInfo.type,
    message: errorInfo.message,
    isAbort: errorInfo.isAbort,
    retryable: errorInfo.retryable,
    resetTime: errorInfo.resetTimeMs
      ? new Date(Date.now() + errorInfo.resetTimeMs).toISOString()
      : undefined,
    originalError:
      errorInfo.originalError instanceof Error
        ? errorInfo.originalError
        : undefined,
  }
}

// ============================================================================
// Auto Mode Service
// ============================================================================

/**
 * Auto Mode Service
 *
 * Manages autonomous feature execution with the Claude Agent SDK.
 * Provides feature queue management, planning mode support, and
 * real-time progress events.
 */
export class AutoModeService extends EventEmitter {
  /** Feature loader for persistence */
  private featureLoader: FeatureLoader

  /** Active loops by project path */
  private loops: Map<string, AutoModeLoop> = new Map()

  /** Running features by feature ID */
  private runningFeatures: Map<string, RunningFeature> = new Map()

  /** Pending plan approvals (featureId -> resolver) */
  private pendingPlanApprovals: Map<string, PendingApproval> = new Map()

  /**
   * Create a new AutoModeService instance
   *
   * @param featureLoader - Feature loader for persistence
   */
  constructor(featureLoader?: FeatureLoader) {
    super()
    this.featureLoader = featureLoader || new FeatureLoader()
  }

  // ==========================================================================
  // Auto Mode Control (Requirements 4.1, 4.2, 4.6)
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
        console.error(`[AutoModeService] Loop error for ${projectPath}:`, err)
      })
    }, LOOP_INTERVAL_MS)

    // Emit started event
    const state = this.getState(projectPath)
    if (state) {
      this.emit('started', projectPath, state)
    }

    console.log(
      `[AutoModeService] Started for ${projectPath} with concurrency ${fullConfig.maxConcurrency}`
    )

    // Immediately try to process features
    await this.processNextFeature(projectPath)
  }

  /**
   * Stop auto mode for a project
   *
   * @param projectPath - The project path
   * @returns Number of features that were still running
   */
  async stopAutoLoop(projectPath: string): Promise<number> {
    const loop = this.loops.get(projectPath)

    if (!loop) {
      return 0
    }

    const runningCount = loop.runningFeatureIds.size

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
      `[AutoModeService] Stopped for ${projectPath}. ${runningCount} features still running.`
    )

    return runningCount
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
  // Feature Queue Operations (Requirement 4.1)
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
        `[AutoModeService] Invalid transition from ${feature.status} to pending for feature ${featureId}`
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
  // Feature Execution Control (Requirements 4.6, 4.7)
  // ==========================================================================

  /**
   * Stop a specific feature execution
   *
   * @param featureId - The feature ID
   * @returns true if stopped
   */
  async stopFeature(featureId: string): Promise<boolean> {
    const running = this.runningFeatures.get(featureId)

    if (!running) {
      return false
    }

    // Abort the execution
    running.abortController.abort()

    // Clean up from loop tracking
    const loop = this.loops.get(running.projectPath)
    if (loop) {
      loop.abortControllers.delete(featureId)
      loop.runningFeatureIds.delete(featureId)
      this.emitStateChanged(running.projectPath)
    }

    // Remove from running features
    this.runningFeatures.delete(featureId)

    // Note: We don't mark as failed for abort (Requirement 10.2)
    console.log(`[AutoModeService] Feature ${featureId} execution stopped`)

    return true
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
      await this.stopFeature(featureId)
    }
  }

  /**
   * Execute a feature (public method for manual execution)
   *
   * @param projectPath - The project path
   * @param featureId - The feature ID
   * @returns The updated feature or null
   */
  async executeFeature(
    projectPath: string,
    featureId: string
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
        config: { ...DEFAULT_CONFIG },
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

    // Track running feature
    this.runningFeatures.set(featureId, {
      featureId,
      projectPath,
      abortController,
      transcript: '',
    })

    // Update status
    await this.featureLoader.updateFeature(projectPath, featureId, {
      status: 'in_progress',
      startedAt: new Date().toISOString(),
    })

    this.emit('featureStarted', projectPath, featureId)
    this.emitStateChanged(projectPath)

    // Execute
    try {
      await this.executeFeatureAsync(projectPath, feature, abortController)
      return this.featureLoader.loadFeature(projectPath, featureId)
    } catch {
      return this.featureLoader.loadFeature(projectPath, featureId)
    }
  }

  // ==========================================================================
  // Feature Resumption (Recovery from interruptions)
  // ==========================================================================

  /**
   * Check if a feature has existing context (agent output) that can be resumed
   *
   * @param projectPath - The project path
   * @param featureId - The feature ID
   * @returns true if context exists
   */
  async contextExists(
    projectPath: string,
    featureId: string
  ): Promise<boolean> {
    const agentOutput = await this.featureLoader.getAgentOutput(
      projectPath,
      featureId
    )
    return agentOutput !== null && agentOutput.length > 0
  }

  /**
   * Resume a feature from existing context
   *
   * If the feature has previous agent output, it will be loaded and used
   * to continue the implementation. Otherwise, starts fresh.
   *
   * @param projectPath - The project path
   * @param featureId - The feature ID
   * @returns The updated feature or null
   */
  async resumeFeature(
    projectPath: string,
    featureId: string
  ): Promise<Feature | null> {
    // Check if already running
    if (this.runningFeatures.has(featureId)) {
      console.warn(`[AutoModeService] Feature ${featureId} is already running`)
      return null
    }

    // Check if context exists
    const hasContext = await this.contextExists(projectPath, featureId)

    if (hasContext) {
      // Load previous context and continue
      const context = await this.featureLoader.getAgentOutput(
        projectPath,
        featureId
      )

      if (context) {
        console.log(
          `[AutoModeService] Resuming feature ${featureId} with existing context`
        )
        return this.executeFeatureWithContext(projectPath, featureId, context)
      }
    }

    // No context, start fresh
    console.log(
      `[AutoModeService] No context found for feature ${featureId}, starting fresh`
    )
    return this.executeFeature(projectPath, featureId)
  }

  /**
   * Execute a feature with existing context (continuation)
   *
   * @param projectPath - The project path
   * @param featureId - The feature ID
   * @param context - Previous agent output to continue from
   * @returns The updated feature or null
   */
  private async executeFeatureWithContext(
    projectPath: string,
    featureId: string,
    context: string
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
        config: { ...DEFAULT_CONFIG },
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

    // Track running feature with previous context
    this.runningFeatures.set(featureId, {
      featureId,
      projectPath,
      abortController,
      transcript: context, // Start with previous context
    })

    // Update status
    await this.featureLoader.updateFeature(projectPath, featureId, {
      status: 'in_progress',
      startedAt: new Date().toISOString(),
    })

    this.emit('featureStarted', projectPath, featureId)
    this.emit('featureProgress', projectPath, {
      featureId,
      status: 'in_progress',
      message: 'Resuming from previous context...',
    })
    this.emitStateChanged(projectPath)

    // Build continuation prompt
    const continuationPrompt = this.buildContinuationPrompt(feature, context)

    // Execute with continuation
    try {
      await this.executeFeatureAsyncWithPrompt(
        projectPath,
        feature,
        abortController,
        continuationPrompt
      )
      return this.featureLoader.loadFeature(projectPath, featureId)
    } catch {
      return this.featureLoader.loadFeature(projectPath, featureId)
    }
  }

  /**
   * Build a continuation prompt from previous context
   */
  private buildContinuationPrompt(feature: Feature, context: string): string {
    return `## Continuing Feature Implementation

**Feature:** ${feature.title}
**Description:** ${feature.description}

## Previous Context
The following is the output from a previous implementation attempt. Continue from where you left off:

${context}

## Instructions
Review the previous work and continue the implementation. If the feature appears complete, verify it works correctly and summarize what was done.`
  }

  // ==========================================================================
  // Plan Approval Workflow (Requirements 5.5, 5.6, 5.7)
  // ==========================================================================

  /**
   * Wait for user plan approval/rejection
   */
  private waitForPlanApproval(
    featureId: string,
    projectPath: string
  ): Promise<{ approved: boolean; feedback?: string }> {
    return new Promise((resolve, reject) => {
      this.pendingPlanApprovals.set(featureId, {
        projectPath,
        resolve,
        reject,
      })
    })
  }

  /**
   * Resolve a pending plan approval
   */
  private resolvePlanApproval(
    featureId: string,
    approved: boolean,
    feedback?: string
  ): boolean {
    const pending = this.pendingPlanApprovals.get(featureId)
    if (!pending) return false
    pending.resolve({ approved, feedback })
    this.pendingPlanApprovals.delete(featureId)
    return true
  }

  /**
   * Approve a generated plan and continue execution
   *
   * Supports recovery: If the server restarted while waiting for approval,
   * this method will restart execution with the approved plan.
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
        `[AutoModeService] Cannot approve plan for feature ${featureId} in status ${feature.status}`
      )
      return null
    }

    // Ensure planSpec exists
    if (!feature.planSpec) {
      console.warn(
        `[AutoModeService] Cannot approve plan for feature ${featureId} - no plan spec found`
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

      // Try to wake the execution loop if it's currently waiting for approval
      const resolved = this.resolvePlanApproval(featureId, true)

      // RECOVERY: If no pending approval in memory (server restarted),
      // restart execution with the approved plan
      if (!resolved && feature.planSpec?.content) {
        console.log(
          `[AutoModeService] Recovery: No pending approval found for ${featureId}, restarting execution with approved plan`
        )

        // Build continuation prompt with approved plan
        const continuationPrompt = `The plan/specification for the following feature has been APPROVED.

**Feature:** ${feature.title}
**Description:** ${feature.description}

## Approved Plan/Specification

${feature.planSpec.content}

## Instructions
Now proceed with implementation. Do not regenerate the plan; implement it according to the approved specification.`

        // Start execution with the continuation prompt
        this.executeFeatureWithContinuationPrompt(
          projectPath,
          featureId,
          continuationPrompt
        ).catch(err => {
          console.error(
            `[AutoModeService] Recovery execution failed for ${featureId}:`,
            err
          )
        })
      }
    }

    return updatedFeature
  }

  /**
   * Execute a feature with a specific continuation prompt (for recovery)
   */
  private async executeFeatureWithContinuationPrompt(
    projectPath: string,
    featureId: string,
    continuationPrompt: string
  ): Promise<Feature | null> {
    const feature = await this.featureLoader.loadFeature(projectPath, featureId)

    if (!feature) {
      return null
    }

    // Check if already running
    if (this.runningFeatures.has(featureId)) {
      console.warn(`[AutoModeService] Feature ${featureId} is already running`)
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
        config: { ...DEFAULT_CONFIG },
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

    // Track running feature
    const existingOutput = await this.featureLoader.getAgentOutput(
      projectPath,
      featureId
    )
    this.runningFeatures.set(featureId, {
      featureId,
      projectPath,
      abortController,
      transcript: existingOutput || '',
    })

    this.emit('featureStarted', projectPath, featureId)
    this.emitStateChanged(projectPath)

    // Execute with continuation prompt
    try {
      await this.executeFeatureAsyncWithPrompt(
        projectPath,
        feature,
        abortController,
        continuationPrompt
      )
      return this.featureLoader.loadFeature(projectPath, featureId)
    } catch {
      return this.featureLoader.loadFeature(projectPath, featureId)
    }
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
        `[AutoModeService] Cannot reject plan for feature ${featureId} in status ${feature.status}`
      )
      return null
    }

    // Mark rejected
    const updatedPlanSpec: PlanSpec = {
      ...(feature.planSpec ?? {
        status: 'generated',
        version: 0,
        content: undefined,
      }),
      status: 'rejected',
    }

    const updatedFeature = await this.featureLoader.updateFeature(
      projectPath,
      featureId,
      {
        planSpec: updatedPlanSpec,
      }
    )

    if (updatedFeature) {
      this.emit('featureProgress', projectPath, {
        featureId,
        status: 'waiting_approval',
        message: `Plan rejected, regenerating with feedback: ${feedback}`,
      })

      // Wake the execution loop with rejection
      this.resolvePlanApproval(featureId, false, feedback)
    }

    return updatedFeature
  }

  /**
   * Get the planning mode for a feature
   */
  private getPlanningMode(
    feature: Feature,
    config: AutoModeConfig
  ): PlanningMode {
    return feature.planningMode ?? config.defaultPlanningMode
  }

  /**
   * Check if plan approval is required for a feature
   */
  private requiresPlanApproval(
    feature: Feature,
    config: AutoModeConfig
  ): boolean {
    if (feature.requirePlanApproval !== undefined) {
      return feature.requirePlanApproval
    }
    return config.defaultRequirePlanApproval
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

    // Track running feature
    this.runningFeatures.set(feature.id, {
      featureId: feature.id,
      projectPath,
      abortController,
      transcript: '',
    })

    // Update status to in_progress (Requirement 4.4)
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
          `[AutoModeService] Error executing feature ${feature.id}:`,
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
  // Feature Execution (Requirements 4.3, 4.5, 4.7, 9.3)
  // ==========================================================================

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
    const running = this.runningFeatures.get(feature.id)

    try {
      // Get planning mode and build prompt
      const planningMode = this.getPlanningMode(feature, config)
      const requireApproval = this.requiresPlanApproval(feature, config)

      // Load context files
      const { formattedPrompt: contextFilesPrompt } = await loadContextFiles({
        projectPath,
      })
      const combinedSystemPrompt = combineSystemPrompts(
        contextFilesPrompt || undefined
      )

      // Get provider
      const model = feature.model ?? DEFAULT_MODEL
      const provider = ProviderFactory.getProviderForModel(model)

      // Helper to append text and emit progress
      const appendText = (text: string, status: FeatureStatus) => {
        if (running) {
          running.transcript += text
        }
        this.emit('featureProgress', projectPath, {
          featureId: feature.id,
          status,
          message:
            status === 'waiting_approval'
              ? 'Waiting for approval...'
              : 'Executing...',
          textDelta: text,
        })
      }

      // Helper to run a prompt
      const runPrompt = async (opts: {
        prompt: string
        phaseStatus: FeatureStatus
        stopOnSpecMarker?: boolean
        maxTurns?: number
      }): Promise<{ runOutput: string; stoppedOnSpec: boolean }> => {
        let runOutput = ''
        let stoppedOnSpec = false

        const stream = provider.executeQuery({
          prompt: opts.prompt,
          model,
          cwd: projectPath,
          systemPrompt: combinedSystemPrompt,
          abortController,
          maxTurns: opts.maxTurns ?? DEFAULT_MAX_TURNS,
        })

        try {
          for await (const msg of stream) {
            if (abortController.signal.aborted) break

            if (msg.type === 'assistant' && msg.message) {
              for (const block of msg.message.content) {
                if (block.type === 'text' && block.text) {
                  runOutput += block.text
                  appendText(block.text, opts.phaseStatus)

                  if (opts.stopOnSpecMarker && needsPlanApproval(runOutput)) {
                    stoppedOnSpec = true
                    abortController.abort()
                    break
                  }
                } else if (block.type === 'tool_use' && block.name) {
                  this.emit('featureProgress', projectPath, {
                    featureId: feature.id,
                    status: opts.phaseStatus,
                    message: `Using tool: ${block.name}`,
                    toolUse: {
                      name: block.name,
                      input: block.input,
                    },
                  })
                }
              }
            } else if (msg.type === 'result') {
              if (msg.subtype === 'error' && msg.error) {
                throw new Error(msg.error)
              }
            } else if (msg.type === 'error') {
              throw new Error(msg.error || 'Unknown error')
            }
          }
        } catch (err) {
          const info = classifyError(err)
          if (!info.isAbort) throw err
        }

        return { runOutput, stoppedOnSpec }
      }

      // === Planning + approval loop (Requirements 5.1-5.7) ===
      let approvedPlanContent: string | undefined
      let planVersion = (feature.planSpec?.version ?? 0) + 1
      let pendingFeedback: string | undefined

      if (planningMode !== 'skip' && requireApproval) {
        const planningPrefix = getPlanningPromptPrefix(planningMode, true)

        while (!approvedPlanContent) {
          if (pendingFeedback && running) {
            running.transcript += `\n\n---\n\n`
          }

          const prompt =
            planningPrefix +
            feature.description +
            (pendingFeedback
              ? `\n\nUser feedback for plan revisions:\n${pendingFeedback}\n\nRegenerate the plan/spec incorporating this feedback.`
              : '')

          const planRun = await runPrompt({
            prompt,
            phaseStatus: 'in_progress',
            stopOnSpecMarker: true,
          })

          const planSpec: PlanSpec = {
            status: 'generated',
            content: planRun.runOutput,
            version: planVersion,
            generatedAt: new Date().toISOString(),
          }

          // Register pending approval BEFORE emitting
          const approvalPromise = this.waitForPlanApproval(
            feature.id,
            projectPath
          )

          await this.featureLoader.updateFeature(projectPath, feature.id, {
            status: 'waiting_approval',
            planSpec,
          })
          this.emit('planGenerated', projectPath, feature.id, planSpec)

          // Save transcript so far (Requirement 9.3)
          if (running) {
            await this.featureLoader.saveAgentOutput(
              projectPath,
              feature.id,
              running.transcript
            )
          }

          const decision = await approvalPromise

          if (decision.approved) {
            approvedPlanContent = planRun.runOutput
            await this.featureLoader.updateFeature(projectPath, feature.id, {
              status: 'in_progress',
              planSpec: {
                ...planSpec,
                status: 'approved',
                approvedAt: new Date().toISOString(),
              },
            })
            this.emit('featureProgress', projectPath, {
              featureId: feature.id,
              status: 'in_progress',
              message: 'Plan approved, continuing with implementation',
            })
            break
          }

          // Rejected: loop and regenerate (Requirement 5.7)
          pendingFeedback = decision.feedback || 'No feedback provided.'
          planVersion += 1
          await this.featureLoader.updateFeature(projectPath, feature.id, {
            planSpec: {
              ...planSpec,
              status: 'rejected',
            },
          })
        }

        // Continue with implementation after approval
        const parsedTasks = parseTasksFromSpec(approvedPlanContent)

        if (parsedTasks.length > 0) {
          // Multi-agent task execution: each task gets its own focused agent call
          console.log(
            `[AutoModeService] Starting multi-agent execution: ${parsedTasks.length} tasks for feature ${feature.id}`
          )

          for (let taskIndex = 0; taskIndex < parsedTasks.length; taskIndex++) {
            const task = parsedTasks[taskIndex]

            // Check for abort
            if (abortController.signal.aborted) {
              throw new Error('Feature execution aborted')
            }

            // Emit task started
            console.log(
              `[AutoModeService] Starting task ${task.id}: ${task.description}`
            )
            this.emit('featureProgress', projectPath, {
              featureId: feature.id,
              status: 'in_progress',
              message: `${PLANNING_MARKERS.TASK_START} ${task.id}: ${task.description}`,
            })

            if (running) {
              running.transcript += `\n\n---\n\n${PLANNING_MARKERS.TASK_START} ${task.id}: ${task.description}\n\n`
            }

            // Build focused prompt for this specific task
            const taskPrompt = buildTaskPrompt(
              task,
              parsedTasks,
              taskIndex,
              approvedPlanContent,
              pendingFeedback
            )

            // Execute task with dedicated agent - use fresh abort controller per task
            const taskAbortController = new AbortController()

            // Link to parent abort controller
            abortController.signal.addEventListener('abort', () => {
              taskAbortController.abort()
            })

            await runPrompt({
              prompt: taskPrompt,
              phaseStatus: 'in_progress',
              maxTurns: MAX_TURNS_PER_TASK,
            })

            // Emit task completed
            console.log(
              `[AutoModeService] Task ${task.id} completed for feature ${feature.id}`
            )
            this.emit('featureProgress', projectPath, {
              featureId: feature.id,
              status: 'in_progress',
              message: `${PLANNING_MARKERS.TASK_COMPLETE} ${task.id}: Completed (${taskIndex + 1}/${parsedTasks.length})`,
            })

            if (running) {
              running.transcript += `\n\n${PLANNING_MARKERS.TASK_COMPLETE} ${task.id}: Completed\n`
            }

            // Check for phase completion
            if (task.phase) {
              const nextTask = parsedTasks[taskIndex + 1]
              if (!nextTask || nextTask.phase !== task.phase) {
                // Phase changed, emit phase complete
                const phaseMatch = task.phase.match(/Phase\s*(\d+)/i)
                if (phaseMatch) {
                  this.emit('featureProgress', projectPath, {
                    featureId: feature.id,
                    status: 'in_progress',
                    message: `${PLANNING_MARKERS.PHASE_COMPLETE} Phase ${phaseMatch[1]} complete`,
                  })

                  if (running) {
                    running.transcript += `\n${PLANNING_MARKERS.PHASE_COMPLETE} Phase ${phaseMatch[1]} complete\n`
                  }
                }
              }
            }

            // Save progress after each task
            if (running) {
              await this.featureLoader.saveAgentOutput(
                projectPath,
                feature.id,
                running.transcript
              )
            }
          }

          console.log(
            `[AutoModeService] All ${parsedTasks.length} tasks completed for feature ${feature.id}`
          )
        } else {
          // No parsed tasks - fall back to single-agent continuation
          console.log(
            `[AutoModeService] No parsed tasks found, using single-agent continuation for feature ${feature.id}`
          )

          const continuationPrompt = `The plan/spec for the following feature has been APPROVED.\n\nFeature:\n${feature.description}\n\nApproved plan/spec:\n\n${approvedPlanContent}\n\nNow proceed with implementation. Do not regenerate the plan; implement it.`

          await runPrompt({
            prompt: continuationPrompt,
            phaseStatus: 'in_progress',
          })
        }
      } else {
        // No approval gate - use planning prompt for chosen mode
        const planningPrefix = getPlanningPromptPrefix(planningMode, false)

        const planResult = await runPrompt({
          prompt: planningPrefix + feature.description,
          phaseStatus: 'in_progress',
        })

        // Try to parse tasks from the output for multi-agent execution
        const parsedTasks = parseTasksFromSpec(planResult.runOutput)

        if (parsedTasks.length > 0 && planningMode !== 'skip') {
          // Multi-agent task execution for non-approval modes
          console.log(
            `[AutoModeService] Found ${parsedTasks.length} tasks in output, executing with multi-agent pattern`
          )

          for (let taskIndex = 0; taskIndex < parsedTasks.length; taskIndex++) {
            const task = parsedTasks[taskIndex]

            if (abortController.signal.aborted) {
              throw new Error('Feature execution aborted')
            }

            console.log(
              `[AutoModeService] Starting task ${task.id}: ${task.description}`
            )
            this.emit('featureProgress', projectPath, {
              featureId: feature.id,
              status: 'in_progress',
              message: `${PLANNING_MARKERS.TASK_START} ${task.id}: ${task.description}`,
            })

            if (running) {
              running.transcript += `\n\n---\n\n${PLANNING_MARKERS.TASK_START} ${task.id}: ${task.description}\n\n`
            }

            const taskPrompt = buildTaskPrompt(
              task,
              parsedTasks,
              taskIndex,
              planResult.runOutput
            )

            await runPrompt({
              prompt: taskPrompt,
              phaseStatus: 'in_progress',
              maxTurns: MAX_TURNS_PER_TASK,
            })

            console.log(`[AutoModeService] Task ${task.id} completed`)
            this.emit('featureProgress', projectPath, {
              featureId: feature.id,
              status: 'in_progress',
              message: `${PLANNING_MARKERS.TASK_COMPLETE} ${task.id}: Completed (${taskIndex + 1}/${parsedTasks.length})`,
            })

            if (running) {
              running.transcript += `\n\n${PLANNING_MARKERS.TASK_COMPLETE} ${task.id}: Completed\n`
            }

            // Check for phase completion
            if (task.phase) {
              const nextTask = parsedTasks[taskIndex + 1]
              if (!nextTask || nextTask.phase !== task.phase) {
                const phaseMatch = task.phase.match(/Phase\s*(\d+)/i)
                if (phaseMatch) {
                  this.emit('featureProgress', projectPath, {
                    featureId: feature.id,
                    status: 'in_progress',
                    message: `${PLANNING_MARKERS.PHASE_COMPLETE} Phase ${phaseMatch[1]} complete`,
                  })

                  if (running) {
                    running.transcript += `\n${PLANNING_MARKERS.PHASE_COMPLETE} Phase ${phaseMatch[1]} complete\n`
                  }
                }
              }
            }

            // Save progress after each task
            if (running) {
              await this.featureLoader.saveAgentOutput(
                projectPath,
                feature.id,
                running.transcript
              )
            }
          }

          console.log(
            `[AutoModeService] All ${parsedTasks.length} tasks completed for feature ${feature.id}`
          )
        }
        // If no tasks found or skip mode, the initial runPrompt already executed the feature
      }

      // Save agent output (Requirement 9.3)
      if (running) {
        await this.featureLoader.saveAgentOutput(
          projectPath,
          feature.id,
          running.transcript
        )
      }

      // Mark as completed (Requirement 4.4)
      await this.featureLoader.updateFeature(projectPath, feature.id, {
        status: 'completed',
        summary: running?.transcript.slice(0, 500),
      })

      this.emit('featureCompleted', projectPath, feature.id)
    } catch (error) {
      // Classify error (Requirement 10.1, 10.2, 10.4)
      const errorInfo = classifyError(error)

      // Handle rate limit (Requirement 10.1)
      if (errorInfo.type === 'rate_limit') {
        await this.handleRateLimit(
          projectPath,
          feature.id,
          toProviderErrorInfo(errorInfo)
        )
        return
      }

      // Handle abort - don't mark as failed (Requirement 10.2)
      if (errorInfo.isAbort) {
        console.log(`[AutoModeService] Feature ${feature.id} execution aborted`)
        return
      }

      // Mark as failed (Requirement 4.5)
      await this.featureLoader.updateFeature(projectPath, feature.id, {
        status: 'failed',
        error: errorInfo.message,
      })

      this.emit('featureFailed', projectPath, feature.id, errorInfo.message)
      this.emit('error', projectPath, toProviderErrorInfo(errorInfo))
    } finally {
      // Clean up
      this.runningFeatures.delete(feature.id)

      if (loop) {
        loop.abortControllers.delete(feature.id)
        loop.runningFeatureIds.delete(feature.id)
        this.emitStateChanged(projectPath)
      }

      // Trigger next feature if auto mode is running (Requirement 10.4)
      if (loop?.enabled) {
        this.processNextFeature(projectPath).catch((err: Error) => {
          console.error(`[AutoModeService] Error processing next feature:`, err)
        })
      }
    }
  }

  /**
   * Execute a feature asynchronously with a specific prompt (for continuation/recovery)
   */
  private async executeFeatureAsyncWithPrompt(
    projectPath: string,
    feature: Feature,
    abortController: AbortController,
    prompt: string
  ): Promise<void> {
    const loop = this.loops.get(projectPath)
    const running = this.runningFeatures.get(feature.id)

    try {
      // Load context files
      const { formattedPrompt: contextFilesPrompt } = await loadContextFiles({
        projectPath,
      })
      const combinedSystemPrompt = combineSystemPrompts(
        contextFilesPrompt || undefined
      )

      // Get provider
      const model = feature.model ?? DEFAULT_MODEL
      const provider = ProviderFactory.getProviderForModel(model)

      // Execute the prompt
      const stream = provider.executeQuery({
        prompt,
        model,
        cwd: projectPath,
        systemPrompt: combinedSystemPrompt,
        abortController,
        maxTurns: DEFAULT_MAX_TURNS,
      })

      for await (const msg of stream) {
        if (abortController.signal.aborted) break

        if (msg.type === 'assistant' && msg.message) {
          for (const block of msg.message.content) {
            if (block.type === 'text' && block.text) {
              if (running) {
                running.transcript += block.text
              }
              this.emit('featureProgress', projectPath, {
                featureId: feature.id,
                status: 'in_progress',
                message: 'Executing...',
                textDelta: block.text,
              })
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
          if (msg.subtype === 'error' && msg.error) {
            throw new Error(msg.error)
          }
        } else if (msg.type === 'error') {
          throw new Error(msg.error || 'Unknown error')
        }
      }

      // Save agent output
      if (running) {
        await this.featureLoader.saveAgentOutput(
          projectPath,
          feature.id,
          running.transcript
        )
      }

      // Mark as completed
      await this.featureLoader.updateFeature(projectPath, feature.id, {
        status: 'completed',
        summary: running?.transcript.slice(0, 500),
      })

      this.emit('featureCompleted', projectPath, feature.id)
    } catch (error) {
      const errorInfo = classifyError(error)

      if (errorInfo.type === 'rate_limit') {
        await this.handleRateLimit(
          projectPath,
          feature.id,
          toProviderErrorInfo(errorInfo)
        )
        return
      }

      if (errorInfo.isAbort) {
        console.log(`[AutoModeService] Feature ${feature.id} execution aborted`)
        return
      }

      await this.featureLoader.updateFeature(projectPath, feature.id, {
        status: 'failed',
        error: errorInfo.message,
      })

      this.emit('featureFailed', projectPath, feature.id, errorInfo.message)
      this.emit('error', projectPath, toProviderErrorInfo(errorInfo))
    } finally {
      this.runningFeatures.delete(feature.id)

      if (loop) {
        loop.abortControllers.delete(feature.id)
        loop.runningFeatureIds.delete(feature.id)
        this.emitStateChanged(projectPath)
      }

      if (loop?.enabled) {
        this.processNextFeature(projectPath).catch((err: Error) => {
          console.error(`[AutoModeService] Error processing next feature:`, err)
        })
      }
    }
  }

  // ==========================================================================
  // Rate Limit Handling (Requirement 10.1)
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

    // Parse reset time
    let resetTime: Date
    if (errorInfo.resetTime) {
      resetTime = new Date(errorInfo.resetTime)
    } else {
      // Default to 1 minute from now
      resetTime = new Date(Date.now() + 60 * 1000)
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
      `[AutoModeService] Rate limited, waiting ${waitSeconds}s until ${waitUntil.toISOString()}`
    )

    // Set up timer for resume
    loop.rateLimitTimer = setTimeout(async () => {
      // Clear rate limit state
      loop.rateLimitResetTime = undefined
      loop.rateLimitTimer = undefined
      this.emitStateChanged(projectPath)

      // Re-queue the feature
      await this.featureLoader.updateFeature(projectPath, featureId, {
        status: 'pending',
      })

      console.log(`[AutoModeService] Rate limit wait complete, resuming`)

      // Process next feature
      if (loop.enabled) {
        await this.processNextFeature(projectPath)
      }
    }, waitSeconds * 1000)
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
    this.runningFeatures.clear()
    this.pendingPlanApprovals.clear()
    this.removeAllListeners()
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/** Default auto mode service instance */
let autoModeServiceInstance: AutoModeService | null = null

/**
 * Get the singleton auto mode service instance
 */
export function getAutoModeService(): AutoModeService {
  if (!autoModeServiceInstance) {
    autoModeServiceInstance = new AutoModeService()
  }
  return autoModeServiceInstance
}

/**
 * Create a new auto mode service instance (for testing)
 */
export function createAutoModeService(
  featureLoader?: FeatureLoader
): AutoModeService {
  return new AutoModeService(featureLoader)
}
