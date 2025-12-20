/**
 * Agent Configuration Service
 *
 * Manages configuration for coding agent execution environment.
 * Stores sensitive values (ANTHROPIC_AUTH_TOKEN) in the OS keychain
 * and other settings in the ai_settings database table.
 *
 * Implements Requirements 5.1, 5.2, 5.5
 *
 * @module agent-config-service
 */

import type { DatabaseService } from '../database'
import type { KeychainService } from '../keychain-service'
import type {
  AgentEnvironmentConfig,
  AgentConfigValidationResult,
  AgentConfigValidationError,
  UpdateAgentConfigInput,
  AgentCLIService,
} from 'shared/ai-types'

/**
 * Settings keys used in the ai_settings table
 */
const SETTINGS_KEYS = {
  AGENT_SERVICE: 'agent.service',
  ANTHROPIC_BASE_URL: 'agent.anthropic_base_url',
  ANTHROPIC_API_KEY: 'agent.anthropic_api_key',
  ANTHROPIC_DEFAULT_SONNET_MODEL: 'agent.anthropic_default_sonnet_model',
  ANTHROPIC_DEFAULT_OPUS_MODEL: 'agent.anthropic_default_opus_model',
  ANTHROPIC_DEFAULT_HAIKU_MODEL: 'agent.anthropic_default_haiku_model',
  API_TIMEOUT_MS: 'agent.api_timeout_ms',
  PYTHON_PATH: 'agent.python_path',
  CUSTOM_ENV_VARS: 'agent.custom_env_vars',
  CUSTOM_COMMAND: 'agent.custom_command',
} as const

/**
 * Keychain identifiers for sensitive values
 */
const KEYCHAIN_SERVICE = 'mira-agent'
const KEYCHAIN_ACCOUNT_AUTH_TOKEN = 'anthropic_auth_token'
const KEYCHAIN_ACCOUNT_GOOGLE_API_KEY = 'google_api_key'
const KEYCHAIN_ACCOUNT_OPENAI_API_KEY = 'openai_api_key'

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Omit<AgentEnvironmentConfig, 'anthropicAuthToken'> = {
  agentService: 'claude-code',
  anthropicBaseUrl: undefined,
  anthropicApiKey: undefined,
  anthropicDefaultSonnetModel: undefined,
  anthropicDefaultOpusModel: undefined,
  anthropicDefaultHaikuModel: undefined,
  apiTimeoutMs: 30000,
  pythonPath: 'python',
  customEnvVars: {},
  googleApiKey: undefined,
  openaiApiKey: undefined,
  customCommand: undefined,
}

/**
 * Interface for the Agent Configuration Service
 */
export interface IAgentConfigService {
  /**
   * Get the current agent environment configuration
   * @returns The current configuration
   */
  getConfig(): Promise<AgentEnvironmentConfig>

  /**
   * Update the agent environment configuration
   * @param updates - Partial configuration updates
   */
  setConfig(updates: UpdateAgentConfigInput): Promise<void>

  /**
   * Validate the agent environment configuration
   * @param config - Configuration to validate
   * @returns Validation result with any errors
   */
  validateConfig(config: AgentEnvironmentConfig): AgentConfigValidationResult

  /**
   * Check if the agent is properly configured
   * @returns True if all required fields are set and valid
   */
  isConfigured(): Promise<boolean>

  /**
   * Clear all agent configuration
   */
  clearConfig(): Promise<void>
}

/**
 * Agent Configuration Service
 *
 * Provides secure storage and validation for agent execution configuration.
 * - Sensitive values (auth tokens) are stored in the OS keychain
 * - Non-sensitive settings are stored in the database
 * - Validation ensures required fields are present and valid
 */
export class AgentConfigService implements IAgentConfigService {
  private db: DatabaseService
  private keychain: KeychainService

  /**
   * Create a new AgentConfigService instance
   * @param db - Database service for settings storage
   * @param keychain - Keychain service for secure token storage
   */
  constructor(db: DatabaseService, keychain: KeychainService) {
    this.db = db
    this.keychain = keychain
  }

  /**
   * Get the current agent environment configuration
   *
   * Retrieves:
   * - Sensitive tokens from keychain
   * - Other settings from ai_settings table
   * - Falls back to defaults for missing values
   *
   * @returns The current configuration
   */
  async getConfig(): Promise<AgentEnvironmentConfig> {
    // Get tokens from keychain
    const authToken = await this.keychain.getSecret(
      KEYCHAIN_SERVICE,
      KEYCHAIN_ACCOUNT_AUTH_TOKEN
    )
    const googleApiKey = await this.keychain.getSecret(
      KEYCHAIN_SERVICE,
      KEYCHAIN_ACCOUNT_GOOGLE_API_KEY
    )
    const openaiApiKey = await this.keychain.getSecret(
      KEYCHAIN_SERVICE,
      KEYCHAIN_ACCOUNT_OPENAI_API_KEY
    )

    // Get other settings from database
    const agentService = this.db.getAISetting(
      SETTINGS_KEYS.AGENT_SERVICE
    ) as AgentCLIService | null
    const baseUrl = this.db.getAISetting(SETTINGS_KEYS.ANTHROPIC_BASE_URL)
    const anthropicApiKey = this.db.getAISetting(SETTINGS_KEYS.ANTHROPIC_API_KEY)
    const defaultSonnetModel = this.db.getAISetting(
      SETTINGS_KEYS.ANTHROPIC_DEFAULT_SONNET_MODEL
    )
    const defaultOpusModel = this.db.getAISetting(
      SETTINGS_KEYS.ANTHROPIC_DEFAULT_OPUS_MODEL
    )
    const defaultHaikuModel = this.db.getAISetting(
      SETTINGS_KEYS.ANTHROPIC_DEFAULT_HAIKU_MODEL
    )
    const timeoutStr = this.db.getAISetting(SETTINGS_KEYS.API_TIMEOUT_MS)
    const pythonPath = this.db.getAISetting(SETTINGS_KEYS.PYTHON_PATH)
    const customEnvStr = this.db.getAISetting(SETTINGS_KEYS.CUSTOM_ENV_VARS)
    const customCommand = this.db.getAISetting(SETTINGS_KEYS.CUSTOM_COMMAND)

    // Parse custom env vars
    let customEnvVars: Record<string, string> = {}
    if (customEnvStr) {
      try {
        customEnvVars = JSON.parse(customEnvStr)
      } catch {
        // Invalid JSON, use empty object
        customEnvVars = {}
      }
    }

    return {
      agentService: agentService ?? DEFAULT_CONFIG.agentService,
      anthropicAuthToken: authToken ?? '',
      anthropicBaseUrl: baseUrl ?? DEFAULT_CONFIG.anthropicBaseUrl,
      anthropicApiKey: anthropicApiKey ?? DEFAULT_CONFIG.anthropicApiKey,
      anthropicDefaultSonnetModel:
        defaultSonnetModel ?? DEFAULT_CONFIG.anthropicDefaultSonnetModel,
      anthropicDefaultOpusModel:
        defaultOpusModel ?? DEFAULT_CONFIG.anthropicDefaultOpusModel,
      anthropicDefaultHaikuModel:
        defaultHaikuModel ?? DEFAULT_CONFIG.anthropicDefaultHaikuModel,
      apiTimeoutMs: timeoutStr
        ? Number.parseInt(timeoutStr, 10)
        : DEFAULT_CONFIG.apiTimeoutMs,
      pythonPath: pythonPath ?? DEFAULT_CONFIG.pythonPath,
      customEnvVars:
        Object.keys(customEnvVars).length > 0
          ? customEnvVars
          : DEFAULT_CONFIG.customEnvVars,
      googleApiKey: googleApiKey ?? DEFAULT_CONFIG.googleApiKey,
      openaiApiKey: openaiApiKey ?? DEFAULT_CONFIG.openaiApiKey,
      customCommand: customCommand ?? DEFAULT_CONFIG.customCommand,
    }
  }

  /**
   * Update the agent environment configuration
   *
   * - Stores sensitive tokens in keychain if provided
   * - Stores other settings in ai_settings table
   *
   * @param updates - Partial configuration updates
   */
  async setConfig(updates: UpdateAgentConfigInput): Promise<void> {
    // Store agent service in database
    if (updates.agentService !== undefined) {
      this.db.setAISetting(SETTINGS_KEYS.AGENT_SERVICE, updates.agentService)
    }

    // Store auth token in keychain if provided
    if (updates.anthropicAuthToken !== undefined) {
      if (updates.anthropicAuthToken) {
        await this.keychain.setSecret(
          KEYCHAIN_SERVICE,
          KEYCHAIN_ACCOUNT_AUTH_TOKEN,
          updates.anthropicAuthToken
        )
      } else {
        await this.keychain.deleteSecret(
          KEYCHAIN_SERVICE,
          KEYCHAIN_ACCOUNT_AUTH_TOKEN
        )
      }
    }

    // Store Google API key in keychain if provided
    if (updates.googleApiKey !== undefined) {
      if (updates.googleApiKey) {
        await this.keychain.setSecret(
          KEYCHAIN_SERVICE,
          KEYCHAIN_ACCOUNT_GOOGLE_API_KEY,
          updates.googleApiKey
        )
      } else {
        await this.keychain.deleteSecret(
          KEYCHAIN_SERVICE,
          KEYCHAIN_ACCOUNT_GOOGLE_API_KEY
        )
      }
    }

    // Store OpenAI API key in keychain if provided
    if (updates.openaiApiKey !== undefined) {
      if (updates.openaiApiKey) {
        await this.keychain.setSecret(
          KEYCHAIN_SERVICE,
          KEYCHAIN_ACCOUNT_OPENAI_API_KEY,
          updates.openaiApiKey
        )
      } else {
        await this.keychain.deleteSecret(
          KEYCHAIN_SERVICE,
          KEYCHAIN_ACCOUNT_OPENAI_API_KEY
        )
      }
    }

    // Store other settings in database
    if (updates.anthropicBaseUrl !== undefined) {
      if (updates.anthropicBaseUrl) {
        this.db.setAISetting(
          SETTINGS_KEYS.ANTHROPIC_BASE_URL,
          updates.anthropicBaseUrl
        )
      } else {
        this.db.deleteAISetting(SETTINGS_KEYS.ANTHROPIC_BASE_URL)
      }
    }

    // Handle anthropicApiKey - empty string is a valid value for OpenRouter
    // undefined means "don't update", null or explicit deletion would remove it
    if (updates.anthropicApiKey !== undefined) {
      // Store even empty string - this is intentional for OpenRouter config
      this.db.setAISetting(
        SETTINGS_KEYS.ANTHROPIC_API_KEY,
        updates.anthropicApiKey
      )
    }

    // Store model override settings
    if (updates.anthropicDefaultSonnetModel !== undefined) {
      if (updates.anthropicDefaultSonnetModel) {
        this.db.setAISetting(
          SETTINGS_KEYS.ANTHROPIC_DEFAULT_SONNET_MODEL,
          updates.anthropicDefaultSonnetModel
        )
      } else {
        this.db.deleteAISetting(SETTINGS_KEYS.ANTHROPIC_DEFAULT_SONNET_MODEL)
      }
    }

    if (updates.anthropicDefaultOpusModel !== undefined) {
      if (updates.anthropicDefaultOpusModel) {
        this.db.setAISetting(
          SETTINGS_KEYS.ANTHROPIC_DEFAULT_OPUS_MODEL,
          updates.anthropicDefaultOpusModel
        )
      } else {
        this.db.deleteAISetting(SETTINGS_KEYS.ANTHROPIC_DEFAULT_OPUS_MODEL)
      }
    }

    if (updates.anthropicDefaultHaikuModel !== undefined) {
      if (updates.anthropicDefaultHaikuModel) {
        this.db.setAISetting(
          SETTINGS_KEYS.ANTHROPIC_DEFAULT_HAIKU_MODEL,
          updates.anthropicDefaultHaikuModel
        )
      } else {
        this.db.deleteAISetting(SETTINGS_KEYS.ANTHROPIC_DEFAULT_HAIKU_MODEL)
      }
    }

    if (updates.apiTimeoutMs !== undefined) {
      this.db.setAISetting(
        SETTINGS_KEYS.API_TIMEOUT_MS,
        updates.apiTimeoutMs.toString()
      )
    }

    if (updates.pythonPath !== undefined) {
      if (updates.pythonPath) {
        this.db.setAISetting(SETTINGS_KEYS.PYTHON_PATH, updates.pythonPath)
      } else {
        this.db.deleteAISetting(SETTINGS_KEYS.PYTHON_PATH)
      }
    }

    if (updates.customEnvVars !== undefined) {
      this.db.setAISetting(
        SETTINGS_KEYS.CUSTOM_ENV_VARS,
        JSON.stringify(updates.customEnvVars)
      )
    }

    if (updates.customCommand !== undefined) {
      if (updates.customCommand) {
        this.db.setAISetting(
          SETTINGS_KEYS.CUSTOM_COMMAND,
          updates.customCommand
        )
      } else {
        this.db.deleteAISetting(SETTINGS_KEYS.CUSTOM_COMMAND)
      }
    }
  }

  /**
   * Validate the agent environment configuration
   *
   * Validates based on selected service:
   * - claude-code: Requires anthropicAuthToken
   * - google-jules: Requires googleApiKey
   * - opencode/aider: Requires openaiApiKey or anthropicAuthToken, and pythonPath
   * - custom: Requires customCommand and pythonPath
   * - apiTimeoutMs must be positive for all services
   *
   * @param config - Configuration to validate
   * @returns Validation result with any errors
   */
  validateConfig(config: AgentEnvironmentConfig): AgentConfigValidationResult {
    const errors: AgentConfigValidationError[] = []

    // Validate based on selected service
    switch (config.agentService) {
      case 'claude-code':
        if (
          !config.anthropicAuthToken ||
          config.anthropicAuthToken.trim() === ''
        ) {
          errors.push({
            field: 'anthropicAuthToken',
            message:
              'Anthropic authentication token is required for Claude Code',
          })
        }
        break
      case 'google-jules':
        if (!config.googleApiKey || config.googleApiKey.trim() === '') {
          errors.push({
            field: 'googleApiKey',
            message: 'Google API key is required for Jules',
          })
        }
        break
      case 'opencode':
      case 'aider':
        // At least one API key is required
        if (
          (!config.openaiApiKey || config.openaiApiKey.trim() === '') &&
          (!config.anthropicAuthToken ||
            config.anthropicAuthToken.trim() === '')
        ) {
          errors.push({
            field: 'openaiApiKey',
            message: 'At least one API key (OpenAI or Anthropic) is required',
          })
        }
        // pythonPath is required for these services
        if (!config.pythonPath || config.pythonPath.trim() === '') {
          errors.push({
            field: 'pythonPath',
            message: 'Python path is required for this agent service',
          })
        }
        break
      case 'custom':
        if (!config.customCommand || config.customCommand.trim() === '') {
          errors.push({
            field: 'customCommand',
            message: 'Custom command is required for custom agents',
          })
        }
        // pythonPath is required for custom agents that may use Python
        if (!config.pythonPath || config.pythonPath.trim() === '') {
          errors.push({
            field: 'pythonPath',
            message: 'Python path is required for custom agents',
          })
        }
        break
    }

    // Validate apiTimeoutMs - must be positive
    if (config.apiTimeoutMs <= 0) {
      errors.push({
        field: 'apiTimeoutMs',
        message: 'API timeout must be a positive number',
      })
    }

    // Validate anthropicBaseUrl - if provided, must be a valid URL
    if (config.anthropicBaseUrl && config.anthropicBaseUrl.trim() !== '') {
      try {
        new URL(config.anthropicBaseUrl)
      } catch {
        errors.push({
          field: 'anthropicBaseUrl',
          message: 'Anthropic base URL must be a valid URL',
        })
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  /**
   * Check if the agent is properly configured
   *
   * @returns True if all required fields are set and valid
   */
  async isConfigured(): Promise<boolean> {
    const config = await this.getConfig()
    const validation = this.validateConfig(config)
    return validation.isValid
  }

  /**
   * Get list of task service types that are properly configured
   *
   * @returns Array of configured service type IDs
   */
  async getConfiguredServices(): Promise<
    import('shared/ai-types').TaskServiceType[]
  > {
    const config = await this.getConfig()
    const configuredServices: import('shared/ai-types').TaskServiceType[] = []

    // Check Claude Code - requires anthropicAuthToken (uses SDK, no Python needed)
    if (config.anthropicAuthToken && config.anthropicAuthToken.trim() !== '') {
      configuredServices.push('claude-code')
    }

    // Check Google Jules - requires googleApiKey
    if (config.googleApiKey && config.googleApiKey.trim() !== '') {
      configuredServices.push('google-jules')
    }

    return configuredServices
  }

  /**
   * Clear all agent configuration
   *
   * Removes:
   * - All tokens from keychain
   * - All settings from database
   */
  async clearConfig(): Promise<void> {
    // Remove tokens from keychain
    await this.keychain.deleteSecret(
      KEYCHAIN_SERVICE,
      KEYCHAIN_ACCOUNT_AUTH_TOKEN
    )
    await this.keychain.deleteSecret(
      KEYCHAIN_SERVICE,
      KEYCHAIN_ACCOUNT_GOOGLE_API_KEY
    )
    await this.keychain.deleteSecret(
      KEYCHAIN_SERVICE,
      KEYCHAIN_ACCOUNT_OPENAI_API_KEY
    )

    // Remove settings from database
    this.db.deleteAISetting(SETTINGS_KEYS.AGENT_SERVICE)
    this.db.deleteAISetting(SETTINGS_KEYS.ANTHROPIC_BASE_URL)
    this.db.deleteAISetting(SETTINGS_KEYS.ANTHROPIC_API_KEY)
    this.db.deleteAISetting(SETTINGS_KEYS.ANTHROPIC_DEFAULT_SONNET_MODEL)
    this.db.deleteAISetting(SETTINGS_KEYS.ANTHROPIC_DEFAULT_OPUS_MODEL)
    this.db.deleteAISetting(SETTINGS_KEYS.ANTHROPIC_DEFAULT_HAIKU_MODEL)
    this.db.deleteAISetting(SETTINGS_KEYS.API_TIMEOUT_MS)
    this.db.deleteAISetting(SETTINGS_KEYS.PYTHON_PATH)
    this.db.deleteAISetting(SETTINGS_KEYS.CUSTOM_ENV_VARS)
    this.db.deleteAISetting(SETTINGS_KEYS.CUSTOM_COMMAND)
  }
}

/**
 * Helper function to check if a string is empty or whitespace-only
 * @param value - String to check
 * @returns True if empty or whitespace-only
 */
export function isEmptyOrWhitespace(value: string | undefined | null): boolean {
  return !value || value.trim() === ''
}
