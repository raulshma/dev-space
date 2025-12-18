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
} from 'shared/ai-types'

/**
 * Settings keys used in the ai_settings table
 */
const SETTINGS_KEYS = {
  ANTHROPIC_BASE_URL: 'agent.anthropic_base_url',
  API_TIMEOUT_MS: 'agent.api_timeout_ms',
  PYTHON_PATH: 'agent.python_path',
  CUSTOM_ENV_VARS: 'agent.custom_env_vars',
} as const

/**
 * Keychain identifiers for sensitive values
 */
const KEYCHAIN_SERVICE = 'mira-agent'
const KEYCHAIN_ACCOUNT_AUTH_TOKEN = 'anthropic_auth_token'

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Omit<AgentEnvironmentConfig, 'anthropicAuthToken'> = {
  anthropicBaseUrl: undefined,
  apiTimeoutMs: 30000,
  pythonPath: 'python',
  customEnvVars: {},
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
   * - ANTHROPIC_AUTH_TOKEN from keychain
   * - Other settings from ai_settings table
   * - Falls back to defaults for missing values
   *
   * @returns The current configuration
   */
  async getConfig(): Promise<AgentEnvironmentConfig> {
    // Get auth token from keychain
    const authToken = await this.keychain.getSecret(
      KEYCHAIN_SERVICE,
      KEYCHAIN_ACCOUNT_AUTH_TOKEN
    )

    // Get other settings from database
    const baseUrl = this.db.getAISetting(SETTINGS_KEYS.ANTHROPIC_BASE_URL)
    const timeoutStr = this.db.getAISetting(SETTINGS_KEYS.API_TIMEOUT_MS)
    const pythonPath = this.db.getAISetting(SETTINGS_KEYS.PYTHON_PATH)
    const customEnvStr = this.db.getAISetting(SETTINGS_KEYS.CUSTOM_ENV_VARS)

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
      anthropicAuthToken: authToken ?? '',
      anthropicBaseUrl: baseUrl ?? DEFAULT_CONFIG.anthropicBaseUrl,
      apiTimeoutMs: timeoutStr ? Number.parseInt(timeoutStr, 10) : DEFAULT_CONFIG.apiTimeoutMs,
      pythonPath: pythonPath ?? DEFAULT_CONFIG.pythonPath,
      customEnvVars: Object.keys(customEnvVars).length > 0 ? customEnvVars : DEFAULT_CONFIG.customEnvVars,
    }
  }

  /**
   * Update the agent environment configuration
   *
   * - Stores ANTHROPIC_AUTH_TOKEN in keychain if provided
   * - Stores other settings in ai_settings table
   *
   * @param updates - Partial configuration updates
   */
  async setConfig(updates: UpdateAgentConfigInput): Promise<void> {
    // Store auth token in keychain if provided
    if (updates.anthropicAuthToken !== undefined) {
      if (updates.anthropicAuthToken) {
        await this.keychain.setSecret(
          KEYCHAIN_SERVICE,
          KEYCHAIN_ACCOUNT_AUTH_TOKEN,
          updates.anthropicAuthToken
        )
      } else {
        // Empty string means delete the token
        await this.keychain.deleteSecret(
          KEYCHAIN_SERVICE,
          KEYCHAIN_ACCOUNT_AUTH_TOKEN
        )
      }
    }

    // Store other settings in database
    if (updates.anthropicBaseUrl !== undefined) {
      if (updates.anthropicBaseUrl) {
        this.db.setAISetting(SETTINGS_KEYS.ANTHROPIC_BASE_URL, updates.anthropicBaseUrl)
      } else {
        // Empty string means use default (delete the setting)
        this.db.deleteAISetting(SETTINGS_KEYS.ANTHROPIC_BASE_URL)
      }
    }

    if (updates.apiTimeoutMs !== undefined) {
      this.db.setAISetting(SETTINGS_KEYS.API_TIMEOUT_MS, updates.apiTimeoutMs.toString())
    }

    if (updates.pythonPath !== undefined) {
      if (updates.pythonPath) {
        this.db.setAISetting(SETTINGS_KEYS.PYTHON_PATH, updates.pythonPath)
      } else {
        // Empty string means use default
        this.db.deleteAISetting(SETTINGS_KEYS.PYTHON_PATH)
      }
    }

    if (updates.customEnvVars !== undefined) {
      this.db.setAISetting(SETTINGS_KEYS.CUSTOM_ENV_VARS, JSON.stringify(updates.customEnvVars))
    }
  }

  /**
   * Validate the agent environment configuration
   *
   * Validates:
   * - anthropicAuthToken: Required, non-empty, non-whitespace
   * - pythonPath: Required, non-empty, non-whitespace
   * - apiTimeoutMs: Must be a positive number
   *
   * @param config - Configuration to validate
   * @returns Validation result with any errors
   */
  validateConfig(config: AgentEnvironmentConfig): AgentConfigValidationResult {
    const errors: AgentConfigValidationError[] = []

    // Validate anthropicAuthToken - required, non-empty, non-whitespace
    if (!config.anthropicAuthToken || config.anthropicAuthToken.trim() === '') {
      errors.push({
        field: 'anthropicAuthToken',
        message: 'Anthropic authentication token is required',
      })
    }

    // Validate pythonPath - required, non-empty, non-whitespace
    if (!config.pythonPath || config.pythonPath.trim() === '') {
      errors.push({
        field: 'pythonPath',
        message: 'Python path is required',
      })
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
   * Clear all agent configuration
   *
   * Removes:
   * - Auth token from keychain
   * - All settings from database
   */
  async clearConfig(): Promise<void> {
    // Remove auth token from keychain
    await this.keychain.deleteSecret(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT_AUTH_TOKEN)

    // Remove settings from database
    this.db.deleteAISetting(SETTINGS_KEYS.ANTHROPIC_BASE_URL)
    this.db.deleteAISetting(SETTINGS_KEYS.API_TIMEOUT_MS)
    this.db.deleteAISetting(SETTINGS_KEYS.PYTHON_PATH)
    this.db.deleteAISetting(SETTINGS_KEYS.CUSTOM_ENV_VARS)
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
