/**
 * SDK Options Factory - Centralized configuration for Claude Agent SDK
 *
 * Provides presets for common use cases:
 * - Auto mode: Autonomous feature implementation with full tool access
 * - Chat: Interactive coding sessions with full tool access
 * - Read-only: Analysis and spec generation with limited tools
 *
 * Centralizes presets so agent execution stays consistent across Mira.
 *
 * @module sdk-options
 */

import type { Options } from '@anthropic-ai/claude-agent-sdk'
import path from 'node:path'

/**
 * Tool presets for different use cases
 */
export const TOOL_PRESETS = {
  /** Read-only tools for analysis */
  readOnly: ['Read', 'Glob', 'Grep'] as const,

  /** Tools for spec generation that needs to read the codebase */
  specGeneration: ['Read', 'Glob', 'Grep'] as const,

  /** Full tool access for feature implementation */
  fullAccess: [
    'Read',
    'Write',
    'Edit',
    'Glob',
    'Grep',
    'Bash',
    'WebSearch',
    'WebFetch',
  ] as const,

  /** Tools for chat/interactive mode */
  chat: [
    'Read',
    'Write',
    'Edit',
    'Glob',
    'Grep',
    'Bash',
    'WebSearch',
    'WebFetch',
  ] as const,
} as const

/**
 * Max turns presets for different use cases
 */
export const MAX_TURNS = {
  /** Quick operations that shouldn't need many iterations */
  quick: 50,

  /** Standard operations */
  standard: 100,

  /** Long-running operations like full spec generation */
  extended: 250,

  /** Very long operations that may require extensive exploration */
  maximum: 1000,
} as const

/**
 * Default models for different use cases
 */
export const DEFAULT_MODELS = {
  /** Model for specification generation */
  spec: 'claude-sonnet-4-5',

  /** Model for feature implementation */
  feature: 'claude-sonnet-4-5',

  /** Model for autonomous tasks */
  auto: 'claude-sonnet-4-5',

  /** Model for chat/interactive mode */
  chat: 'claude-sonnet-4-5',

  /** Default fallback model */
  default: 'claude-sonnet-4-5',
} as const

/**
 * Model presets for different use cases
 *
 * These can be overridden via environment variables:
 * - MIRA_MODEL_SPEC: Model for spec generation
 * - MIRA_MODEL_FEATURE: Model for feature implementation
 * - MIRA_MODEL_AUTO: Model for autonomous tasks
 * - MIRA_MODEL_CHAT: Model for chat
 * - MIRA_MODEL_DEFAULT: Fallback model for all operations
 */
export function getModelForUseCase(
  useCase: 'spec' | 'feature' | 'auto' | 'chat' | 'default',
  explicitModel?: string
): string {
  // Explicit model takes precedence
  if (explicitModel) {
    return explicitModel
  }

  // Check environment variable override for this use case
  const envVarMap: Record<string, string | undefined> = {
    spec: process.env.MIRA_MODEL_SPEC,
    feature: process.env.MIRA_MODEL_FEATURE,
    auto: process.env.MIRA_MODEL_AUTO,
    chat: process.env.MIRA_MODEL_CHAT,
    default: process.env.MIRA_MODEL_DEFAULT,
  }

  const envModel = envVarMap[useCase] || envVarMap.default
  if (envModel) {
    return envModel
  }

  return DEFAULT_MODELS[useCase] || DEFAULT_MODELS.default
}

/**
 * Base options that apply to all SDK calls
 */
function getBaseOptions(): Partial<Options> {
  return {
    permissionMode: 'acceptEdits',
  }
}

/**
 * Options configuration for creating SDK options
 */
export interface CreateSdkOptionsConfig {
  /** Working directory for the agent */
  cwd: string

  /** Optional explicit model override */
  model?: string

  /** Optional session model (used as fallback if explicit model not provided) */
  sessionModel?: string

  /** Optional system prompt */
  systemPrompt?: string

  /** Optional abort controller for cancellation */
  abortController?: AbortController

  /** API key for authentication */
  apiKey?: string

  /** Custom environment variables */
  customEnvVars?: Record<string, string>
}

/**
 * Create SDK options for autonomous/feature implementation
 *
 * Configuration:
 * - Full tool access for code modification and implementation
 * - Maximum turns for thorough feature implementation
 * - Sandbox enabled for bash safety
 */
export function createAutoModeOptions(config: CreateSdkOptionsConfig): Options {
  // Resolve working directory to absolute path
  const resolvedCwd = path.resolve(config.cwd)

  const options: Options = {
    ...getBaseOptions(),
    model: getModelForUseCase('auto', config.model),
    maxTurns: MAX_TURNS.maximum,
    cwd: resolvedCwd,
    allowedTools: [...TOOL_PRESETS.fullAccess],
    sandbox: {
      enabled: true,
      autoAllowBashIfSandboxed: true,
    },
  }

  if (config.systemPrompt) {
    options.systemPrompt = config.systemPrompt
  }

  if (config.abortController) {
    options.abortController = config.abortController
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

  return options
}

/**
 * Create SDK options for chat/interactive mode
 *
 * Configuration:
 * - Full tool access for code modification
 * - Standard turns for interactive sessions
 * - Model priority: explicit model > session model > chat default
 * - Sandbox enabled for bash safety
 */
export function createChatOptions(config: CreateSdkOptionsConfig): Options {
  // Resolve working directory to absolute path
  const resolvedCwd = path.resolve(config.cwd)

  // Model priority: explicit model > session model > chat default
  const effectiveModel = config.model || config.sessionModel

  const options: Options = {
    ...getBaseOptions(),
    model: getModelForUseCase('chat', effectiveModel),
    maxTurns: MAX_TURNS.standard,
    cwd: resolvedCwd,
    allowedTools: [...TOOL_PRESETS.chat],
    sandbox: {
      enabled: true,
      autoAllowBashIfSandboxed: true,
    },
  }

  if (config.systemPrompt) {
    options.systemPrompt = config.systemPrompt
  }

  if (config.abortController) {
    options.abortController = config.abortController
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

  return options
}

/**
 * Create SDK options for spec generation (read-only analysis)
 *
 * Configuration:
 * - Read-only tools for codebase analysis
 * - Extended turns for thorough exploration
 * - Default permission mode (no auto-accept)
 */
export function createSpecGenerationOptions(
  config: CreateSdkOptionsConfig
): Options {
  // Resolve working directory to absolute path
  const resolvedCwd = path.resolve(config.cwd)

  const options: Options = {
    ...getBaseOptions(),
    // Override permission mode for read-only operations
    permissionMode: 'default',
    model: getModelForUseCase('spec', config.model),
    maxTurns: MAX_TURNS.extended,
    cwd: resolvedCwd,
    allowedTools: [...TOOL_PRESETS.specGeneration],
  }

  if (config.systemPrompt) {
    options.systemPrompt = config.systemPrompt
  }

  if (config.abortController) {
    options.abortController = config.abortController
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

  return options
}

/**
 * Create custom SDK options with explicit configuration
 *
 * Use this when the preset options don't fit your use case.
 */
export function createCustomOptions(
  config: CreateSdkOptionsConfig & {
    maxTurns?: number
    allowedTools?: readonly string[]
    disallowedTools?: string[]
    sandbox?: { enabled: boolean; autoAllowBashIfSandboxed?: boolean }
    permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions'
  }
): Options {
  // Resolve working directory to absolute path
  const resolvedCwd = path.resolve(config.cwd)

  const options: Options = {
    ...getBaseOptions(),
    model: getModelForUseCase('default', config.model),
    maxTurns: config.maxTurns ?? MAX_TURNS.maximum,
    cwd: resolvedCwd,
    allowedTools: config.allowedTools
      ? [...config.allowedTools]
      : [...TOOL_PRESETS.fullAccess],
  }

  if (config.permissionMode) {
    options.permissionMode = config.permissionMode
  }

  if (config.disallowedTools && config.disallowedTools.length > 0) {
    options.disallowedTools = config.disallowedTools
  }

  if (config.sandbox) {
    options.sandbox = config.sandbox
  }

  if (config.systemPrompt) {
    options.systemPrompt = config.systemPrompt
  }

  if (config.abortController) {
    options.abortController = config.abortController
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

  return options
}
