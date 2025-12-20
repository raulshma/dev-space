/**
 * Claude Agent SDK Service
 *
 * Provides integration with the @anthropic-ai/claude-agent-sdk for executing
 * coding agent tasks. Replaces the previous Python-based agent execution.
 *
 * @module claude-sdk-service
 */

import {
  query,
  type Options,
  type SDKMessage,
  type SDKResultMessage,
  type SDKSystemMessage,
  type SDKAssistantMessage,
  type CanUseTool,
  type PermissionResult,
} from '@anthropic-ai/claude-agent-sdk'
import { EventEmitter } from 'node:events'

/**
 * Configuration for Claude SDK execution
 */
export interface ClaudeExecutionConfig {
  /** Task prompt/description */
  prompt: string
  /** Working directory for the agent */
  workingDirectory: string
  /** Model to use (default: claude-sonnet-4-5) */
  model?: string
  /** System prompt override */
  systemPrompt?: string
  /** Permission mode */
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions'
  /** Maximum budget in USD */
  maxBudgetUsd?: number
  /** Custom environment variables */
  customEnvVars?: Record<string, string>
  /** Anthropic API key */
  apiKey?: string
  /** Custom tool permission callback (uses SDK's CanUseTool type) */
  canUseTool?: CanUseTool
  /** Session ID to resume */
  resumeSessionId?: string
  /** Fork the session instead of continuing it */
  forkSession?: boolean
  /** Allowed tools (restrict which tools the agent can use) */
  allowedTools?: string[]
  /** Disallowed tools (exclude specific tools) */
  disallowedTools?: string[]
  /** Settings sources to load (user, project, local) */
  settingSources?: Array<'user' | 'project' | 'local'>
  /** Beta features to enable */
  betas?: Array<'context-1m-2025-08-07'>
}

/**
 * Execution result from Claude SDK
 */
export interface ClaudeExecutionResult {
  /** Session ID from the execution */
  sessionId?: string
  /** Whether execution completed successfully */
  success: boolean
  /** Error message if failed */
  error?: string
  /** Total cost of the execution */
  totalCost?: number
}

/**
 * Events emitted by ClaudeSdkService
 */
export interface ClaudeSdkEvents {
  output: (data: string, stream: 'stdout' | 'stderr') => void
  toolCall: (toolName: string, input: Record<string, unknown>) => void
  toolResult: (toolName: string, result: string) => void
  error: (error: string) => void
  sessionInit: (sessionId: string, skills: string[]) => void
  completion: () => void
}

/**
 * Execution context for managing task state
 */
interface ExecutionContext {
  abortController: AbortController
  isPaused: boolean
  sessionId?: string
}

/**
 * Claude Agent SDK Service
 *
 * Manages execution of coding tasks using the Claude Agent SDK.
 * Provides streaming output, tool execution tracking, and execution control.
 */
export class ClaudeSdkService extends EventEmitter {
  /** Map of task IDs to their execution contexts */
  private executions: Map<string, ExecutionContext> = new Map()

  /**
   * Execute a task using Claude Agent SDK
   *
   * @param taskId - Unique identifier for the task
   * @param config - Execution configuration
   * @returns Promise resolving to execution result
   */
  async execute(
    taskId: string,
    config: ClaudeExecutionConfig
  ): Promise<ClaudeExecutionResult> {
    const abortController = new AbortController()
    const context: ExecutionContext = {
      abortController,
      isPaused: false,
    }
    this.executions.set(taskId, context)

    let sessionId: string | undefined
    let totalCost = 0

    try {
      // Build query options
      const options: Options = {
        model: config.model || 'claude-sonnet-4-5',
        cwd: config.workingDirectory,
        permissionMode: config.permissionMode || 'acceptEdits',
        abortController,
      }

      if (config.systemPrompt) {
        options.systemPrompt = config.systemPrompt
      }

      if (config.maxBudgetUsd) {
        options.maxBudgetUsd = config.maxBudgetUsd
      }

      // Set API key via environment if provided
      if (config.apiKey) {
        options.env = {
          ...process.env,
          ANTHROPIC_API_KEY: config.apiKey,
        }
      }

      if (config.customEnvVars) {
        options.env = {
          ...options.env,
          ...config.customEnvVars,
        }
      }

      // Add custom tool permission callback if provided
      if (config.canUseTool) {
        options.canUseTool = config.canUseTool
      } else {
        // Default safety callback - block dangerous commands
        options.canUseTool = async (
          toolName: string,
          input: Record<string, unknown>
        ): Promise<PermissionResult> => {
          if (toolName === 'Bash') {
            const command = String(input.command || '')
            const dangerousPatterns = [
              'rm -rf /',
              'rm -rf ~',
              'dd if=',
              'mkfs',
              '> /dev/',
              ':(){:|:&};:',
              'chmod -R 777 /',
            ]
            if (dangerousPatterns.some(pattern => command.includes(pattern))) {
              return {
                behavior: 'deny',
                message: 'Destructive command blocked for safety',
              }
            }
          }
          // Allow with original input (required by SDK type)
          return { behavior: 'allow', updatedInput: input }
        }
      }

      // Add session resume if provided
      if (config.resumeSessionId) {
        options.resume = config.resumeSessionId
      }

      // Add fork session option
      if (config.forkSession) {
        options.forkSession = config.forkSession
      }

      // Add tool restrictions if provided
      if (config.allowedTools && config.allowedTools.length > 0) {
        options.allowedTools = config.allowedTools
      }

      if (config.disallowedTools && config.disallowedTools.length > 0) {
        options.disallowedTools = config.disallowedTools
      }

      // Add settings sources if provided
      if (config.settingSources) {
        options.settingSources = config.settingSources
      }

      // Add beta features if provided
      if (config.betas && config.betas.length > 0) {
        options.betas = config.betas
      }

      // Execute query with streaming
      const response = query({
        prompt: config.prompt,
        options,
      })

      // Process streaming messages
      for await (const message of response) {
        // Check if aborted
        if (abortController.signal.aborted) {
          break
        }

        // Handle pause (busy wait - SDK doesn't support native pause)
        while (context.isPaused && !abortController.signal.aborted) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        this.handleMessage(taskId, message, context)

        // Track session ID from init message
        if (this.isSystemInitMessage(message)) {
          sessionId = message.session_id
          context.sessionId = sessionId
        }

        // Track cost from result message
        if (this.isResultMessage(message)) {
          totalCost = message.total_cost_usd
        }
      }

      this.emit('completion')
      return {
        sessionId,
        success: true,
        totalCost,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      // Check for abort
      if (abortController.signal.aborted) {
        return {
          sessionId,
          success: false,
          error: 'Execution was stopped',
          totalCost,
        }
      }

      this.emit('error', errorMessage)
      return {
        sessionId,
        success: false,
        error: errorMessage,
        totalCost,
      }
    } finally {
      this.executions.delete(taskId)
    }
  }

  /**
   * Type guard for system init messages
   */
  private isSystemInitMessage(
    message: SDKMessage
  ): message is SDKSystemMessage {
    return (
      message.type === 'system' &&
      'subtype' in message &&
      message.subtype === 'init'
    )
  }

  /**
   * Type guard for result messages
   */
  private isResultMessage(message: SDKMessage): message is SDKResultMessage {
    return message.type === 'result'
  }

  /**
   * Type guard for assistant messages
   */
  private isAssistantMessage(
    message: SDKMessage
  ): message is SDKAssistantMessage {
    return message.type === 'assistant'
  }

  /**
   * Format tool call details for output display
   * Shows tool name and relevant input parameters
   */
  private formatToolCallDetails(
    toolName: string,
    input: Record<string, unknown>
  ): string {
    const lines: string[] = [`[Tool] ${toolName}`]

    // Format input based on tool type for better readability
    switch (toolName) {
      case 'Read':
      case 'ReadFile':
        if (input.file_path) lines.push(`  file: ${input.file_path}`)
        break

      case 'Write':
      case 'WriteFile':
        if (input.file_path) lines.push(`  file: ${input.file_path}`)
        break

      case 'Edit':
      case 'EditFile':
        if (input.file_path) lines.push(`  file: ${input.file_path}`)
        break

      case 'Bash':
      case 'Execute':
        if (input.command) lines.push(`  command: ${input.command}`)
        break

      case 'Glob':
      case 'ListFiles':
        if (input.pattern) lines.push(`  pattern: ${input.pattern}`)
        if (input.path) lines.push(`  path: ${input.path}`)
        break

      case 'Grep':
      case 'Search':
        if (input.pattern) lines.push(`  pattern: ${input.pattern}`)
        if (input.path) lines.push(`  path: ${input.path}`)
        break

      case 'WebFetch':
        if (input.url) lines.push(`  url: ${input.url}`)
        break

      case 'WebSearch':
        if (input.query) lines.push(`  query: ${input.query}`)
        break

      case 'TodoWrite':
        if (input.todos) {
          const todos = input.todos as Array<{ content: string }>
          lines.push(`  todos: ${todos.length} item(s)`)
        }
        break

      default:
        // For unknown tools, show all non-empty string/number inputs
        for (const [key, value] of Object.entries(input)) {
          if (
            value !== undefined &&
            value !== null &&
            (typeof value === 'string' || typeof value === 'number')
          ) {
            const strValue = String(value)
            // Truncate long values
            const displayValue =
              strValue.length > 100 ? `${strValue.slice(0, 100)}...` : strValue
            lines.push(`  ${key}: ${displayValue}`)
          }
        }
        break
    }

    return `${lines.join('\n')}\n`
  }

  /**
   * Handle a message from the Claude SDK stream
   */
  private handleMessage(
    _taskId: string,
    message: SDKMessage,
    _context: ExecutionContext
  ): void {
    // Cast to access potential properties not in base type
    const msg = message as SDKMessage & {
      tool_name?: string
      input?: Record<string, unknown>
      result?: string
      error?: { message?: string; type?: string } | string
      content?:
        | string
        | Array<{ type: string; text?: string; name?: string; input?: unknown }>
    }

    switch (message.type) {
      case 'system':
        if ('subtype' in message && message.subtype === 'init') {
          const initMsg = message as SDKSystemMessage
          this.emit('sessionInit', initMsg.session_id, initMsg.skills || [])
          this.emit(
            'output',
            `[Claude] Session started: ${initMsg.session_id}\n`,
            'stdout'
          )
        }
        break

      case 'assistant':
        if (this.isAssistantMessage(message)) {
          // Extract text content from the assistant message
          const content = message.message?.content
          if (typeof content === 'string') {
            // Handle string content directly
            this.emit('output', `${content}\n`, 'stdout')
          } else if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === 'text' && 'text' in block) {
                this.emit('output', `${block.text}\n`, 'stdout')
              } else if (block.type === 'tool_use' && 'name' in block) {
                const toolInput = (
                  'input' in block ? block.input : {}
                ) as Record<string, unknown>
                // Format tool call with details
                const toolDetails = this.formatToolCallDetails(
                  block.name as string,
                  toolInput
                )
                this.emit('output', toolDetails, 'stdout')
                // Emit tool call event from assistant message
                this.emit('toolCall', block.name as string, toolInput)
              }
            }
          }
        }
        break

      case 'result':
        if (this.isResultMessage(message)) {
          if (message.subtype === 'success') {
            this.emit('output', `[Claude] Task completed\n`, 'stdout')
            if (message.result) {
              this.emit('output', `${message.result}\n`, 'stdout')
            }
          } else {
            const errorResult = message as SDKResultMessage & {
              errors?: string[]
            }
            if (errorResult.errors) {
              for (const err of errorResult.errors) {
                this.emit('output', `[Error] ${err}\n`, 'stderr')
                this.emit('error', err)
              }
            }
          }
        }
        break

      case 'tool_progress':
        if (msg.tool_name) {
          this.emit('output', `[Executing] ${msg.tool_name}...\n`, 'stdout')
        }
        break

      default:
        // Handle any other message types for forward compatibility
        // Tool results and errors may come through as different message structures
        if (msg.tool_name && msg.result !== undefined) {
          const result = String(msg.result || '')
          this.emit('toolResult', msg.tool_name, result)
          // Show full result for complete output visibility
          if (result) {
            this.emit(
              'output',
              `[Result] ${msg.tool_name}:\n${result}\n`,
              'stdout'
            )
          }
        } else if (msg.error) {
          const errorMsg =
            typeof msg.error === 'string'
              ? msg.error
              : msg.error.message || String(msg.error)
          this.emit('error', errorMsg)
          this.emit('output', `[Error] ${errorMsg}\n`, 'stderr')
        }
        break
    }
  }

  /**
   * Stop a running execution
   *
   * @param taskId - The task ID to stop
   */
  stop(taskId: string): void {
    const context = this.executions.get(taskId)
    if (context) {
      context.abortController.abort()
    }
  }

  /**
   * Pause a running execution
   *
   * Note: The SDK doesn't natively support pause, so this uses a busy-wait approach.
   *
   * @param taskId - The task ID to pause
   */
  pause(taskId: string): void {
    const context = this.executions.get(taskId)
    if (context) {
      context.isPaused = true
    }
  }

  /**
   * Resume a paused execution
   *
   * @param taskId - The task ID to resume
   */
  resume(taskId: string): void {
    const context = this.executions.get(taskId)
    if (context) {
      context.isPaused = false
    }
  }

  /**
   * Check if a task is currently executing
   *
   * @param taskId - The task ID to check
   * @returns True if the task is executing
   */
  isExecuting(taskId: string): boolean {
    return this.executions.has(taskId)
  }

  /**
   * Check if a task is paused
   *
   * @param taskId - The task ID to check
   * @returns True if the task is paused
   */
  isPaused(taskId: string): boolean {
    const context = this.executions.get(taskId)
    return context?.isPaused ?? false
  }

  /**
   * Get the session ID for a task
   *
   * @param taskId - The task ID
   * @returns The session ID or undefined
   */
  getSessionId(taskId: string): string | undefined {
    return this.executions.get(taskId)?.sessionId
  }

  /**
   * Stop all running executions
   */
  stopAll(): void {
    for (const [taskId] of this.executions) {
      this.stop(taskId)
    }
  }
}
