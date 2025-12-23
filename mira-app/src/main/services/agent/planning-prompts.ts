/**
 * Planning Prompts for Agent Task Execution
 *
 * Provides prompt templates for different planning modes:
 * - lite: Brief planning outline
 * - spec: Detailed specification with task breakdown
 * - full: Comprehensive specification with phased tasks
 *
 * Implements Requirements:
 * - 3.3: Lite mode generates brief planning outline
 * - 3.4: Spec mode generates specification with acceptance criteria
 * - 3.5: Full mode generates comprehensive specification with phases
 *
 * @module planning-prompts
 */

import type { PlanningMode, PlanTask } from 'shared/ai-types'

/**
 * Planning prompt templates for each mode
 */
export const PLANNING_PROMPTS = {
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

  spec_without_approval: `## Specification Phase (Spec Mode)

IMPORTANT: Do NOT output exploration text, tool usage, or thinking before the spec. Start DIRECTLY with the specification format below. Silently analyze the codebase first, then output ONLY the structured specification.

Generate a specification with an actionable task breakdown, then proceed with implementation.

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
"[PLAN_GENERATED] Specification complete. Proceeding with implementation."

Then execute tasks SEQUENTIALLY in order. For each task:
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

  full_without_approval: `## Full Specification Phase (Full SDD Mode)

IMPORTANT: Do NOT output exploration text, tool usage, or thinking before the spec. Start DIRECTLY with the specification format below. Silently analyze the codebase first, then output ONLY the structured specification.

Generate a comprehensive specification with phased task breakdown, then proceed with implementation.

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
"[PLAN_GENERATED] Comprehensive specification complete. Proceeding with implementation."

Then execute tasks SEQUENTIALLY by phase. For each task:
1. BEFORE starting, output: "[TASK_START] T###: Description"
2. Implement the task
3. AFTER completing, output: "[TASK_COMPLETE] T###: Brief summary"

After completing all tasks in a phase, output:
"[PHASE_COMPLETE] Phase N complete"

This allows real-time progress tracking during implementation.`,
} as const

/**
 * Markers used in planning prompts for parsing
 */
export const PLANNING_MARKERS = {
  PLAN_GENERATED: '[PLAN_GENERATED]',
  SPEC_GENERATED: '[SPEC_GENERATED]',
  TASK_START: '[TASK_START]',
  TASK_COMPLETE: '[TASK_COMPLETE]',
  PHASE_COMPLETE: '[PHASE_COMPLETE]',
} as const

/**
 * Get the planning prompt prefix for a given planning mode
 *
 * @param planningMode - The planning mode (skip, lite, spec, full)
 * @param requirePlanApproval - Whether plan approval is required
 * @returns The prompt prefix to prepend to the task description
 */
export function getPlanningPromptPrefix(
  planningMode: PlanningMode,
  requirePlanApproval: boolean
): string {
  if (planningMode === 'skip') {
    return ''
  }

  let promptKey: keyof typeof PLANNING_PROMPTS

  // All modes now respect requirePlanApproval setting
  // When approval is NOT required, agents will generate the spec/plan and immediately proceed
  if (planningMode === 'lite') {
    promptKey = requirePlanApproval ? 'lite_with_approval' : 'lite'
  } else if (planningMode === 'spec') {
    promptKey = requirePlanApproval ? 'spec' : 'spec_without_approval'
  } else if (planningMode === 'full') {
    promptKey = requirePlanApproval ? 'full' : 'full_without_approval'
  } else {
    // Fallback for unknown modes
    return ''
  }

  const planningPrompt = PLANNING_PROMPTS[promptKey]
  if (!planningPrompt) {
    return ''
  }

  return `${planningPrompt}\n\n---\n\n## Task Request\n\n`
}

/**
 * Parse a single task line from spec content
 * Format: - [ ] T###: Description | File: path/to/file
 *
 * @param line - The task line to parse
 * @param phase - Optional phase name
 * @returns Parsed task or null if invalid
 */
function parseTaskLine(line: string, phase?: string): PlanTask | null {
  // Match: - [ ] T###: Description | File: path/to/file
  // or: - [ ] T###: Description
  const match = line.match(
    /^-\s*\[\s*\]\s*(T\d{3}):\s*(.+?)(?:\s*\|\s*File:\s*(.+))?$/
  )
  if (!match) {
    return null
  }

  const [, id, description, filePath] = match

  return {
    id,
    description: description.trim(),
    filePath: filePath?.trim(),
    phase,
    status: 'pending',
  }
}

/**
 * Parse tasks from generated spec content
 * Looks for the ```tasks code block and extracts task lines
 *
 * @param specContent - The generated spec content
 * @returns Array of parsed tasks
 */
export function parseTasksFromSpec(specContent: string): PlanTask[] {
  const tasks: PlanTask[] = []

  // Extract content within ```tasks ... ``` block
  const tasksBlockMatch = specContent.match(/```tasks\s*([\s\S]*?)```/)
  if (!tasksBlockMatch) {
    // Try fallback: look for task lines anywhere in content
    const taskLines = specContent.match(/- \[ \] T\d{3}:.*$/gm)
    if (!taskLines) {
      return tasks
    }
    // Parse fallback task lines
    for (const line of taskLines) {
      const parsed = parseTaskLine(line, undefined)
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
 * Check if content contains a plan/spec generated marker
 *
 * @param content - The content to check
 * @returns True if a plan/spec was generated
 */
export function hasPlanGenerated(content: string): boolean {
  return (
    content.includes(PLANNING_MARKERS.PLAN_GENERATED) ||
    content.includes(PLANNING_MARKERS.SPEC_GENERATED)
  )
}

/**
 * Check if content indicates plan approval is needed
 *
 * @param content - The content to check
 * @returns True if approval is needed
 */
export function needsPlanApproval(content: string): boolean {
  return content.includes(PLANNING_MARKERS.SPEC_GENERATED)
}

/**
 * Extract task progress from output content
 *
 * @param content - The output content to parse
 * @returns Object with started and completed task IDs
 */
export function extractTaskProgress(content: string): {
  startedTasks: string[]
  completedTasks: string[]
  completedPhases: string[]
} {
  const startedTasks: string[] = []
  const completedTasks: string[] = []
  const completedPhases: string[] = []

  // Find all task start markers
  const startMatches = content.matchAll(/\[TASK_START\]\s*(T\d{3})/g)
  for (const match of startMatches) {
    startedTasks.push(match[1])
  }

  // Find all task complete markers
  const completeMatches = content.matchAll(/\[TASK_COMPLETE\]\s*(T\d{3})/g)
  for (const match of completeMatches) {
    completedTasks.push(match[1])
  }

  // Find all phase complete markers
  const phaseMatches = content.matchAll(/\[PHASE_COMPLETE\]\s*(.+)$/gm)
  for (const match of phaseMatches) {
    completedPhases.push(match[1].trim())
  }

  return { startedTasks, completedTasks, completedPhases }
}

/**
 * Update task statuses based on progress markers
 *
 * @param tasks - The tasks to update
 * @param progress - The progress extracted from output
 * @returns Updated tasks array
 */
export function updateTaskStatuses(
  tasks: PlanTask[],
  progress: ReturnType<typeof extractTaskProgress>
): PlanTask[] {
  return tasks.map(task => {
    if (progress.completedTasks.includes(task.id)) {
      return { ...task, status: 'completed' as const }
    }
    if (progress.startedTasks.includes(task.id)) {
      return { ...task, status: 'in_progress' as const }
    }
    return task
  })
}
