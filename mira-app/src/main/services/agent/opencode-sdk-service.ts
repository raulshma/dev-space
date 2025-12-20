/**
 * OpenCode SDK Service
 *
 * Provides integration with the @opencode-ai/sdk for executing
 * coding agent tasks. OpenCode runs as a server process with REST API.
 *
 * @module opencode-sdk-service
 */

import { createOpencodeClient, type OpencodeClient } from '@opencode-ai/sdk'
import { EventEmitter } from 'node:events'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Configuration for OpenCode execution
 */
export interface OpencodeExecutionConfig {
  /** Task prompt/description */
  prompt: string
  /** Working directory for the agent */
  workingDirectory: string
  /** Model to use (e.g., "anthropic/claude-sonnet-4-5") */
  model?: string
  /** Session ID to resume */
  sessionId?: string
  /** Agent/mode name (e.g., "coder", "plan") */
  agentName?: string
  /** Custom environment variables */
  customEnvVars?: Record<string, string>
  /** Server port (default: 4096) */
  serverPort?: number
  /** Server base URL (if connecting to existing server) */
  serverBaseUrl?: string
}

/**
 * Execution result from OpenCode SDK
 */
export interface OpencodeExecutionResult {
  /** Session ID from the execution */
  sessionId?: string
  /** Whether execution completed successfully */
  success: boolean
  /** Error message if failed */
  error?: string
}

/**
 * OpenCode configuration file structure
 */
export interface OpencodeConfig {
  $schema?: string
  model?: string
  theme?: string
  autoupdate?: boolean
  disabled_providers?: string[]
  instructions?: string[]
  provider?: Record<string, OpencodeProviderConfig>
  mode?: Record<string, OpencodeModeConfig>
  keybinds?: Record<string, string>
  formatter?: Record<string, OpencodeFormatterConfig>
  lsp?: Record<string, OpencodeLspConfig>
}

export interface OpencodeProviderConfig {
  npm?: string
  name?: string
  options?: {
    baseURL?: string
    apiKey?: string
    headers?: Record<string, string>
  }
  models?: Record<string, OpencodeModelConfig>
}

export interface OpencodeModelConfig {
  name?: string
  options?: Record<string, unknown>
  limit?: {
    context?: number
    output?: number
  }
}

export interface OpencodeModeConfig {
  model?: string
  prompt?: string
  tools?: {
    write?: boolean
    edit?: boolean
    bash?: boolean
  }
}

export interface OpencodeFormatterConfig {
  disabled?: boolean
  command?: string[]
  environment?: Record<string, string>
  extensions?: string[]
}

export interface OpencodeLspConfig {
  command?: string[]
  extensions?: string[]
}

/**
 * Events emitted by OpencodeSdkService
 */
export interface OpencodeSdkEvents {
  output: (data: string, stream: 'stdout' | 'stderr') => void
  toolCall: (toolName: string, input: Record<string, unknown>) => void
  toolResult: (toolName: string, result: string) => void
  error: (error: string) => void
  sessionInit: (sessionId: string) => void
  completion: () => void
}

/**
 * Execution context for managing task state
 */
interface ExecutionContext {
  abortController: AbortController
  sessionId?: string
  client?: OpencodeClient
}

/**
 * Config backup info
 */
interface ConfigBackup {
  originalPath: string
  backupPath: string
  hadOriginal: boolean
}

/**
 * OpenCode SDK Service
 *
 * Manages execution of coding tasks using the OpenCode SDK.
 * Provides streaming output, tool execution tracking, and execution control.
 */
export class OpencodeSdkService extends EventEmitter {
  /** Map of task IDs to their execution contexts */
  private executions: Map<string, ExecutionContext> = new Map()

  /** Default server port */
  private readonly DEFAULT_PORT = 4096

  /** Config schema URL */
  private readonly CONFIG_SCHEMA = 'https://opencode.ai/config.json'

  /**
   * Get the project config path
   */
  private getProjectConfigPath(workingDirectory: string): string {
    return path.join(workingDirectory, 'opencode.json')
  }

  /**
   * Backup existing config file if present
   */
  async backupConfig(workingDirectory: string): Promise<ConfigBackup | null> {
    const configPath = this.getProjectConfigPath(workingDirectory)
    const backupPath = `${configPath}.mira-backup`

    try {
      if (fs.existsSync(configPath)) {
        await fs.promises.copyFile(configPath, backupPath)
        return {
          originalPath: configPath,
          backupPath,
          hadOriginal: true,
        }
      }
      return {
        originalPath: configPath,
        backupPath,
        hadOriginal: false,
      }
    } catch (error) {
      console.error('Failed to backup OpenCode config:', error)
      return null
    }
  }

  /**
   * Restore config from backup
   */
  async restoreConfig(backup: ConfigBackup): Promise<void> {
    try {
      if (backup.hadOriginal) {
        await fs.promises.copyFile(backup.backupPath, backup.originalPath)
        await fs.promises.unlink(backup.backupPath)
      } else {
        // Remove the config we created if there was no original
        if (fs.existsSync(backup.originalPath)) {
          await fs.promises.unlink(backup.originalPath)
        }
      }
    } catch (error) {
      console.error('Failed to restore OpenCode config:', error)
    }
  }

  /**
   * Write OpenCode configuration file
   */
  async writeConfig(
    workingDirectory: string,
    config: OpencodeConfig
  ): Promise<void> {
    const configPath = this.getProjectConfigPath(workingDirectory)
    const configWithSchema = {
      $schema: this.CONFIG_SCHEMA,
      ...config,
    }
    await fs.promises.writeFile(
      configPath,
      JSON.stringify(configWithSchema, null, 2),
      'utf-8'
    )
  }

  /**
   * Read existing OpenCode configuration
   */
  async readConfig(workingDirectory: string): Promise<OpencodeConfig | null> {
    const configPath = this.getProjectConfigPath(workingDirectory)
    try {
      if (fs.existsSync(configPath)) {
        const content = await fs.promises.readFile(configPath, 'utf-8')
        return JSON.parse(content) as OpencodeConfig
      }
    } catch (error) {
      console.error('Failed to read OpenCode config:', error)
    }
    return null
  }

  /**
   * Build config from Mira settings
   */
  buildConfigFromSettings(options: {
    model?: string
    anthropicApiKey?: string
    openaiApiKey?: string
    googleApiKey?: string
    openrouterApiKey?: string
    customProviders?: Record<string, OpencodeProviderConfig>
  }): OpencodeConfig {
    const config: OpencodeConfig = {
      $schema: this.CONFIG_SCHEMA,
    }

    if (options.model) {
      config.model = options.model
    }

    config.provider = {}

    // Configure Anthropic if key provided
    if (options.anthropicApiKey) {
      config.provider.anthropic = {
        options: {
          apiKey: options.anthropicApiKey,
        },
      }
    }

    // Configure OpenAI if key provided
    if (options.openaiApiKey) {
      config.provider.openai = {
        options: {
          apiKey: options.openaiApiKey,
        },
      }
    }

    // Configure Google if key provided
    if (options.googleApiKey) {
      config.provider.google = {
        options: {
          apiKey: options.googleApiKey,
        },
      }
    }

    // Configure OpenRouter if key provided
    if (options.openrouterApiKey) {
      config.provider.openrouter = {
        options: {
          apiKey: options.openrouterApiKey,
        },
      }
    }

    // Merge custom providers
    if (options.customProviders) {
      config.provider = {
        ...config.provider,
        ...options.customProviders,
      }
    }

    return config
  }

  /**
   * Execute a task using OpenCode SDK
   *
   * @param taskId - Unique identifier for the task
   * @param config - Execution configuration
   * @returns Promise resolving to execution result
   */
  async execute(
    taskId: string,
    config: OpencodeExecutionConfig
  ): Promise<OpencodeExecutionResult> {
    const abortController = new AbortController()
    const context: ExecutionContext = {
      abortController,
    }
    this.executions.set(taskId, context)

    let sessionId: string | undefined

    try {
      // Create client - connect to existing server or use provided base URL
      const baseUrl =
        config.serverBaseUrl ||
        `http://localhost:${config.serverPort || this.DEFAULT_PORT}`

      const client = createOpencodeClient({
        baseUrl,
      })
      context.client = client

      // Create or resume session
      if (config.sessionId) {
        sessionId = config.sessionId
        this.emit(
          'output',
          `[OpenCode] Resuming session: ${sessionId}\n`,
          'stdout'
        )
      } else {
        const sessionResponse = await client.session.create()
        if (sessionResponse.data) {
          sessionId = sessionResponse.data.id
          context.sessionId = sessionId
          this.emit('sessionInit', sessionId)
          this.emit(
            'output',
            `[OpenCode] Session started: ${sessionId}\n`,
            'stdout'
          )
        }
      }

      if (!sessionId) {
        throw new Error('Failed to create or resume session')
      }

      // Subscribe to events for real-time updates
      const eventResult = await client.event.subscribe()

      // Start event processing in background if we have a stream
      let eventPromise: Promise<void> | undefined
      if (eventResult) {
        // The SSE result is an async iterable
        eventPromise = this.processEvents(
          taskId,
          eventResult as unknown as AsyncIterable<unknown>,
          abortController.signal
        )
      }

      // Send the message/prompt to the session
      this.emit('output', `[OpenCode] Sending prompt...\n`, 'stdout')

      const promptResponse = await client.session.prompt({
        path: { id: sessionId },
        body: {
          parts: [{ type: 'text', text: config.prompt }],
        },
      })

      // Process the response
      if (promptResponse.data) {
        const message = promptResponse.data as {
          message?: { content?: unknown }
        }
        const content = message.message?.content
        if (typeof content === 'string') {
          this.emit('output', `${content}\n`, 'stdout')
        } else if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text' && 'text' in block) {
              this.emit(
                'output',
                `${(block as { text: string }).text}\n`,
                'stdout'
              )
            }
          }
        }
      }

      // Wait for events to complete or abort
      if (eventPromise) {
        await Promise.race([
          eventPromise,
          new Promise<void>(resolve => {
            if (abortController.signal.aborted) resolve()
            abortController.signal.addEventListener('abort', () => resolve())
          }),
        ])
      }

      this.emit('completion')
      return {
        sessionId,
        success: true,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      if (abortController.signal.aborted) {
        return {
          sessionId,
          success: false,
          error: 'Execution was stopped',
        }
      }

      this.emit('error', errorMessage)
      return {
        sessionId,
        success: false,
        error: errorMessage,
      }
    } finally {
      this.executions.delete(taskId)
    }
  }

  /**
   * Process SSE events from OpenCode server
   */
  private async processEvents(
    taskId: string,
    eventStream: AsyncIterable<unknown>,
    signal: AbortSignal
  ): Promise<void> {
    try {
      for await (const event of eventStream) {
        if (signal.aborted) break

        const evt = event as {
          type?: string
          properties?: Record<string, unknown>
        }

        this.handleEvent(taskId, evt)
      }
    } catch (error) {
      if (!signal.aborted) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        this.emit('error', `Event stream error: ${errorMessage}`)
      }
    }
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
   * Handle an event from the OpenCode server
   */
  private handleEvent(
    _taskId: string,
    event: { type?: string; properties?: Record<string, unknown> }
  ): void {
    const { type, properties } = event

    switch (type) {
      case 'session.updated':
        // Session state changed
        if (properties?.status === 'completed') {
          this.emit('output', '[OpenCode] Session completed\n', 'stdout')
        }
        break

      case 'message.part.updated':
        // Streaming message content
        if (properties?.text) {
          this.emit('output', String(properties.text), 'stdout')
        }
        break

      case 'tool.execute':
        // Tool is being executed
        if (properties?.name) {
          const toolName = String(properties.name)
          const input = (properties.input as Record<string, unknown>) || {}
          this.emit('toolCall', toolName, input)
          const toolDetails = this.formatToolCallDetails(toolName, input)
          this.emit('output', toolDetails, 'stdout')
        }
        break

      case 'tool.result':
        // Tool execution completed
        if (properties?.name) {
          const toolName = String(properties.name)
          const result = String(properties.result || '')
          this.emit('toolResult', toolName, result)
          const truncated =
            result.length > 500 ? `${result.slice(0, 500)}...` : result
          if (truncated) {
            this.emit(
              'output',
              `[Result] ${toolName}: ${truncated}\n`,
              'stdout'
            )
          }
        }
        break

      case 'error':
        if (properties?.message) {
          const errorMsg = String(properties.message)
          this.emit('error', errorMsg)
          this.emit('output', `[Error] ${errorMsg}\n`, 'stderr')
        }
        break

      default:
        // Log unknown events for debugging
        if (type) {
          console.debug(`[OpenCode] Unknown event type: ${type}`, properties)
        }
        break
    }
  }

  /**
   * Stop a running execution
   *
   * @param taskId - The task ID to stop
   */
  async stop(taskId: string): Promise<void> {
    const context = this.executions.get(taskId)
    if (context) {
      context.abortController.abort()

      // Try to abort the session on the server
      if (context.client && context.sessionId) {
        try {
          await context.client.session.abort({
            path: { id: context.sessionId },
          })
        } catch (error) {
          console.error('Failed to abort OpenCode session:', error)
        }
      }
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
  async stopAll(): Promise<void> {
    const stopPromises: Promise<void>[] = []
    for (const [taskId] of this.executions) {
      stopPromises.push(this.stop(taskId))
    }
    await Promise.all(stopPromises)
  }

  /**
   * List sessions from OpenCode server
   */
  async listSessions(baseUrl?: string): Promise<
    Array<{
      id: string
      title?: string
      createdAt?: string
    }>
  > {
    const client = createOpencodeClient({
      baseUrl: baseUrl || `http://localhost:${this.DEFAULT_PORT}`,
    })

    try {
      const response = await client.session.list()
      if (response.data && Array.isArray(response.data)) {
        return response.data.map(s => ({
          id: String((s as { id?: string }).id || ''),
          title: (s as { title?: string }).title,
          createdAt: (s as { createdAt?: string }).createdAt,
        }))
      }
      return []
    } catch (error) {
      console.error('Failed to list OpenCode sessions:', error)
      return []
    }
  }

  /**
   * Get messages from a session
   */
  async getSessionMessages(
    sessionId: string,
    baseUrl?: string
  ): Promise<unknown[]> {
    const client = createOpencodeClient({
      baseUrl: baseUrl || `http://localhost:${this.DEFAULT_PORT}`,
    })

    try {
      const response = await client.session.messages({
        path: { id: sessionId },
      })
      if (response.data && Array.isArray(response.data)) {
        return response.data
      }
      return []
    } catch (error) {
      console.error('Failed to get OpenCode session messages:', error)
      return []
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string, baseUrl?: string): Promise<boolean> {
    const client = createOpencodeClient({
      baseUrl: baseUrl || `http://localhost:${this.DEFAULT_PORT}`,
    })

    try {
      await client.session.delete({
        path: { id: sessionId },
      })
      return true
    } catch (error) {
      console.error('Failed to delete OpenCode session:', error)
      return false
    }
  }
}
