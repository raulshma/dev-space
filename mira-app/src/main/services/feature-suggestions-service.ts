/**
 * Feature Suggestions Service
 *
 * Generates AI-powered feature suggestions for existing projects by analyzing
 * the codebase and providing actionable improvement recommendations.
 * Suggestions can be approved and converted into agent tasks.
 *
 * @module feature-suggestions-service
 */

import { EventEmitter } from 'node:events'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { DatabaseService } from './database'
import type { AIService } from './ai-service'
import type {
  FeatureSuggestion,
  FeatureSuggestionFilter,
  CreateFeatureSuggestionInput,
  UpdateFeatureSuggestionInput,
  GenerateSuggestionsParams,
  GenerateSuggestionsResult,
  SuggestionBatch,
  AgentTask,
  CreateAgentTaskInput,
  AgentType,
  PlanningMode,
} from 'shared/ai-types'

// ============================================================================
// Types
// ============================================================================

export interface FeatureSuggestionsServiceEvents {
  progress: (data: {
    projectId: string
    status: 'analyzing' | 'generating' | 'complete' | 'error'
    progress: number
    message: string
    currentStep?: string
    /** Streaming text output from AI */
    streamingText?: string
  }) => void
}

export interface ApproveOptions {
  description?: string
  agentType?: AgentType
  planningMode?: PlanningMode
  requirePlanApproval?: boolean
  branchName?: string
}

// ============================================================================
// Service
// ============================================================================

export class FeatureSuggestionsService extends EventEmitter {
  private db: DatabaseService
  private aiService: AIService

  constructor(db: DatabaseService, aiService: AIService) {
    super()
    this.db = db
    this.aiService = aiService
  }

  /**
   * Generate feature suggestions for a project
   */
  async generateSuggestions(
    params: GenerateSuggestionsParams
  ): Promise<GenerateSuggestionsResult> {
    const {
      projectId,
      projectPath,
      focusAreas,
      maxSuggestions = 10,
      analyzeCode = true,
      analyzeDependencies = true,
      customContext,
    } = params

    try {
      // Emit progress: analyzing
      this.emitProgress(
        projectId,
        'analyzing',
        10,
        'Analyzing project structure...'
      )

      // Gather project context
      const projectContext = await this.gatherProjectContext(
        projectPath,
        analyzeCode,
        analyzeDependencies
      )

      this.emitProgress(projectId, 'analyzing', 30, 'Reading project files...')

      // Build the prompt for AI
      const prompt = this.buildSuggestionPrompt(
        projectContext,
        focusAreas,
        maxSuggestions,
        customContext
      )

      this.emitProgress(
        projectId,
        'generating',
        50,
        'Generating suggestions with AI...'
      )

      // Generate suggestions using AI with streaming
      let fullText = ''

      // Use streaming to show live output
      const streamGenerator = this.aiService.streamText({
        projectId,
        content: prompt,
        action: 'code-generation',
        systemPrompt: this.getSystemPrompt(),
      })

      for await (const chunk of streamGenerator) {
        if (chunk.text) {
          fullText += chunk.text
          // Emit progress with streaming text (throttle to avoid too many updates)
          this.emitProgress(
            projectId,
            'generating',
            50 + Math.min(25, fullText.length / 100), // Progress based on text length
            'AI is analyzing...',
            undefined,
            fullText
          )
        }
      }

      this.emitProgress(
        projectId,
        'generating',
        80,
        'Processing suggestions...'
      )

      // Parse the AI response
      const parsedSuggestions = this.parseAIResponse(fullText, projectId)

      // Create a batch and persist suggestions
      const batch = this.db.createSuggestionBatch(
        projectId,
        'AI Model', // Model name not available from streaming
        projectContext.summary
      )

      const suggestions = this.db.createFeatureSuggestionsBatch(
        parsedSuggestions,
        batch.id
      )

      this.emitProgress(
        projectId,
        'complete',
        100,
        `Generated ${suggestions.length} suggestions`
      )

      return {
        batchId: batch.id,
        suggestions,
        analysisContext: projectContext.summary,
        model: 'AI Model',
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      this.emitProgress(
        projectId,
        'error',
        0,
        `Failed to generate suggestions: ${message}`
      )
      throw error
    }
  }

  /**
   * Get all suggestions with optional filtering
   */
  getSuggestions(filter?: FeatureSuggestionFilter): FeatureSuggestion[] {
    return this.db.getFeatureSuggestions(filter)
  }

  /**
   * Get a single suggestion by ID
   */
  getSuggestion(id: string): FeatureSuggestion | null {
    return this.db.getFeatureSuggestion(id)
  }

  /**
   * Update a suggestion
   */
  updateSuggestion(
    id: string,
    updates: UpdateFeatureSuggestionInput
  ): FeatureSuggestion | null {
    return this.db.updateFeatureSuggestion(id, updates)
  }

  /**
   * Delete a suggestion
   */
  deleteSuggestion(id: string): void {
    this.db.deleteFeatureSuggestion(id)
  }

  /**
   * Approve a suggestion and create an agent task
   */
  approveSuggestion(
    id: string,
    options?: ApproveOptions
  ): { suggestion: FeatureSuggestion; task: AgentTask } {
    const suggestion = this.db.getFeatureSuggestion(id)
    if (!suggestion) {
      throw new Error(`Suggestion not found: ${id}`)
    }

    if (suggestion.status !== 'pending') {
      throw new Error(`Suggestion is not pending: ${suggestion.status}`)
    }

    // Get project info
    const project = this.db.getProject(suggestion.projectId)
    if (!project) {
      throw new Error(`Project not found: ${suggestion.projectId}`)
    }

    // Determine agent type based on category
    const agentType =
      options?.agentType ?? this.categoryToAgentType(suggestion.category)

    // Build task description
    const taskDescription =
      options?.description ?? this.buildTaskDescription(suggestion)

    // Create the agent task
    const taskInput: CreateAgentTaskInput = {
      description: taskDescription,
      agentType,
      targetDirectory: project.path,
      planningMode: options?.planningMode ?? 'lite',
      requirePlanApproval: options?.requirePlanApproval ?? true,
      branchName: options?.branchName,
      projectId: suggestion.projectId,
      projectName: project.name,
      serviceType: 'claude-code',
    }

    const task = this.db.createAgentTask(taskInput)

    // Update suggestion status
    const updatedSuggestion = this.db.updateFeatureSuggestion(id, {
      status: 'converted',
      taskId: task.id,
    })

    if (!updatedSuggestion) {
      throw new Error('Failed to update suggestion status')
    }

    return { suggestion: updatedSuggestion, task }
  }

  /**
   * Reject a suggestion
   */
  rejectSuggestion(id: string, feedback?: string): FeatureSuggestion {
    const suggestion = this.db.getFeatureSuggestion(id)
    if (!suggestion) {
      throw new Error(`Suggestion not found: ${id}`)
    }

    const updated = this.db.updateFeatureSuggestion(id, {
      status: 'rejected',
      feedback,
    })

    if (!updated) {
      throw new Error('Failed to update suggestion status')
    }

    return updated
  }

  /**
   * Bulk approve multiple suggestions
   */
  bulkApprove(
    ids: string[],
    options?: Omit<ApproveOptions, 'description' | 'branchName'>
  ): Array<{
    suggestionId: string
    success: boolean
    task?: AgentTask
    error?: string
  }> {
    const results: Array<{
      suggestionId: string
      success: boolean
      task?: AgentTask
      error?: string
    }> = []

    for (const id of ids) {
      try {
        const { task } = this.approveSuggestion(id, options)
        results.push({ suggestionId: id, success: true, task })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        results.push({ suggestionId: id, success: false, error: message })
      }
    }

    return results
  }

  /**
   * Get suggestion batches for a project
   */
  getBatches(projectId: string, limit?: number): SuggestionBatch[] {
    return this.db.getSuggestionBatches(projectId, limit)
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private emitProgress(
    projectId: string,
    status: 'analyzing' | 'generating' | 'complete' | 'error',
    progress: number,
    message: string,
    currentStep?: string,
    streamingText?: string
  ): void {
    this.emit('progress', {
      projectId,
      status,
      progress,
      message,
      currentStep,
      streamingText,
    })
  }

  private async gatherProjectContext(
    projectPath: string,
    analyzeCode: boolean,
    analyzeDependencies: boolean
  ): Promise<{ summary: string; files: string[]; dependencies: string[] }> {
    const files: string[] = []
    const dependencies: string[] = []
    const summaryParts: string[] = []

    // Check if path exists
    if (!fs.existsSync(projectPath)) {
      return { summary: 'Project path not found', files, dependencies }
    }

    // Read package.json if exists
    const packageJsonPath = path.join(projectPath, 'package.json')
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, 'utf-8')
        )
        summaryParts.push(`Project: ${packageJson.name || 'Unknown'}`)
        summaryParts.push(
          `Description: ${packageJson.description || 'No description'}`
        )

        if (analyzeDependencies) {
          const deps = Object.keys(packageJson.dependencies || {})
          const devDeps = Object.keys(packageJson.devDependencies || {})
          dependencies.push(...deps, ...devDeps)
          summaryParts.push(
            `Dependencies: ${deps.length} production, ${devDeps.length} dev`
          )
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Scan for source files
    if (analyzeCode) {
      const srcDirs = ['src', 'lib', 'app', 'pages', 'components']
      for (const dir of srcDirs) {
        const dirPath = path.join(projectPath, dir)
        if (fs.existsSync(dirPath)) {
          const scannedFiles = this.scanDirectory(dirPath, projectPath)
          files.push(...scannedFiles)
        }
      }
      summaryParts.push(`Source files: ${files.length}`)
    }

    // Check for common config files
    const configFiles = [
      'tsconfig.json',
      'vite.config.ts',
      'webpack.config.js',
      'next.config.js',
      '.eslintrc.js',
      'biome.json',
    ]
    const foundConfigs = configFiles.filter(f =>
      fs.existsSync(path.join(projectPath, f))
    )
    if (foundConfigs.length > 0) {
      summaryParts.push(`Config files: ${foundConfigs.join(', ')}`)
    }

    // Check for README
    const readmePath = path.join(projectPath, 'README.md')
    if (fs.existsSync(readmePath)) {
      try {
        const readme = fs.readFileSync(readmePath, 'utf-8')
        const firstParagraph = readme.split('\n\n')[0]?.slice(0, 500)
        if (firstParagraph) {
          summaryParts.push(`README excerpt: ${firstParagraph}`)
        }
      } catch {
        // Ignore read errors
      }
    }

    return {
      summary: summaryParts.join('\n'),
      files: files.slice(0, 50), // Limit to 50 files
      dependencies: dependencies.slice(0, 100), // Limit to 100 deps
    }
  }

  private scanDirectory(
    dirPath: string,
    basePath: string,
    maxFiles = 100
  ): string[] {
    const files: string[] = []
    const ignorePatterns = [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.next',
      'coverage',
    ]

    const scan = (currentPath: string): void => {
      if (files.length >= maxFiles) return

      try {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true })
        for (const entry of entries) {
          if (files.length >= maxFiles) break
          if (ignorePatterns.some(p => entry.name.includes(p))) continue

          const fullPath = path.join(currentPath, entry.name)
          const relativePath = path.relative(basePath, fullPath)

          if (entry.isDirectory()) {
            scan(fullPath)
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name)
            if (
              [
                '.ts',
                '.tsx',
                '.js',
                '.jsx',
                '.vue',
                '.svelte',
                '.py',
                '.go',
                '.rs',
              ].includes(ext)
            ) {
              files.push(relativePath)
            }
          }
        }
      } catch {
        // Ignore permission errors
      }
    }

    scan(dirPath)
    return files
  }

  private buildSuggestionPrompt(
    context: { summary: string; files: string[]; dependencies: string[] },
    focusAreas?: string[],
    maxSuggestions = 10,
    customContext?: string
  ): string {
    let prompt = `Analyze this project and suggest ${maxSuggestions} feature improvements or enhancements.

## Project Context
${context.summary}

## Source Files (sample)
${context.files.slice(0, 20).join('\n')}

## Dependencies
${context.dependencies.slice(0, 30).join(', ')}
`

    if (focusAreas && focusAreas.length > 0) {
      prompt += `\n## Focus Areas\nPlease prioritize suggestions in these areas: ${focusAreas.join(', ')}\n`
    }

    if (customContext) {
      prompt += `\n## Additional Context\n${customContext}\n`
    }

    prompt += `
## Response Format
Respond with a JSON array of suggestions. Each suggestion should have:
- title: Short descriptive title (max 100 chars)
- description: Detailed description of what to implement (200-500 chars)
- category: One of: feature, improvement, refactor, bugfix, performance, security, documentation, testing
- priority: One of: low, medium, high, critical
- complexity: Number 1-5 (1=trivial, 5=major undertaking)
- affectedFiles: Array of file paths that would likely be modified (optional)
- rationale: Why this suggestion would benefit the project (100-300 chars)

Example response:
[
  {
    "title": "Add input validation",
    "description": "Implement comprehensive input validation for all API endpoints using zod schemas...",
    "category": "security",
    "priority": "high",
    "complexity": 3,
    "affectedFiles": ["src/api/routes.ts", "src/validators/index.ts"],
    "rationale": "Prevents injection attacks and improves data integrity..."
  }
]

Respond ONLY with the JSON array, no additional text.`

    return prompt
  }

  private getSystemPrompt(): string {
    return `You are an expert software architect and code reviewer. Your task is to analyze projects and suggest meaningful improvements.

Guidelines:
- Focus on practical, actionable suggestions
- Consider the project's tech stack and conventions
- Prioritize suggestions that add real value
- Be specific about what needs to be done
- Consider security, performance, and maintainability
- Avoid trivial or cosmetic suggestions
- Each suggestion should be implementable as a single task

Always respond with valid JSON.`
  }

  private parseAIResponse(
    response: string,
    projectId: string
  ): CreateFeatureSuggestionInput[] {
    try {
      // Try to extract JSON from the response
      let jsonStr = response.trim()

      // Handle markdown code blocks
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim()
      }

      const parsed = JSON.parse(jsonStr)

      if (!Array.isArray(parsed)) {
        console.warn('[FeatureSuggestions] AI response is not an array')
        return []
      }

      return parsed.map((item: Record<string, unknown>) => ({
        projectId,
        title: String(item.title || 'Untitled suggestion').slice(0, 200),
        description: String(item.description || '').slice(0, 2000),
        category: this.validateCategory(item.category),
        priority: this.validatePriority(item.priority),
        complexity: this.validateComplexity(item.complexity),
        affectedFiles: Array.isArray(item.affectedFiles)
          ? item.affectedFiles.map(String).slice(0, 20)
          : undefined,
        rationale: String(item.rationale || '').slice(0, 1000),
      }))
    } catch (error) {
      console.error('[FeatureSuggestions] Failed to parse AI response:', error)
      return []
    }
  }

  private validateCategory(
    value: unknown
  ): CreateFeatureSuggestionInput['category'] {
    const valid = [
      'feature',
      'improvement',
      'refactor',
      'bugfix',
      'performance',
      'security',
      'documentation',
      'testing',
    ]
    return valid.includes(String(value))
      ? (String(value) as CreateFeatureSuggestionInput['category'])
      : 'improvement'
  }

  private validatePriority(
    value: unknown
  ): CreateFeatureSuggestionInput['priority'] {
    const valid = ['low', 'medium', 'high', 'critical']
    return valid.includes(String(value))
      ? (String(value) as CreateFeatureSuggestionInput['priority'])
      : 'medium'
  }

  private validateComplexity(value: unknown): number {
    const num = Number(value)
    if (Number.isNaN(num) || num < 1) return 3
    if (num > 5) return 5
    return Math.round(num)
  }

  private categoryToAgentType(category: string): AgentType {
    switch (category) {
      case 'bugfix':
        return 'bugfix'
      case 'feature':
        return 'feature'
      default:
        return 'feature'
    }
  }

  private buildTaskDescription(suggestion: FeatureSuggestion): string {
    let description = `## ${suggestion.title}\n\n${suggestion.description}`

    if (suggestion.affectedFiles && suggestion.affectedFiles.length > 0) {
      description += `\n\n### Files to modify\n${suggestion.affectedFiles.map(f => `- ${f}`).join('\n')}`
    }

    description += `\n\n### Rationale\n${suggestion.rationale}`

    return description
  }
}
