/**
 * Property-based tests for Agent Configuration Service
 *
 * These tests verify that the agent configuration validation correctly
 * identifies invalid configurations and returns appropriate error messages.
 *
 * **Feature: ai-agent-rework, Property 8: Configuration Validation**
 * **Validates: Requirements 5.5**
 */

import { describe, it, beforeEach, afterEach, vi } from 'vitest'
import * as fc from 'fast-check'
import { AgentConfigService } from './agent-config-service'
import { DatabaseService } from '../database'
import { KeychainService } from '../keychain-service'
import type { AgentEnvironmentConfig } from 'shared/ai-types'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

/**
 * Arbitrary generator for whitespace-only strings
 */
const arbitraryWhitespaceString: fc.Arbitrary<string> = fc.constantFrom(
  '',
  ' ',
  '  ',
  '\t',
  '\n',
  '\r\n',
  '   \t\n  ',
  '\t\t\t',
  '    '
)

/**
 * Arbitrary generator for valid non-empty strings (for auth token and python path)
 */
const arbitraryValidString: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0)

/**
 * Arbitrary generator for valid URLs
 */
const arbitraryValidUrl: fc.Arbitrary<string> = fc.constantFrom(
  'https://api.anthropic.com',
  'https://api.example.com',
  'http://localhost:8080',
  'https://custom-api.example.org/v1'
)

/**
 * Arbitrary generator for invalid URLs (strings that fail URL parsing)
 * These are verified to throw when passed to new URL()
 */
const arbitraryInvalidUrl: fc.Arbitrary<string> = fc.constantFrom(
  'not-a-url',
  'just-text',
  '://missing-protocol',
  'invalid url with spaces'
)

/**
 * Arbitrary generator for positive timeout values
 */
const arbitraryPositiveTimeout: fc.Arbitrary<number> = fc.integer({ min: 1, max: 300000 })

/**
 * Arbitrary generator for non-positive timeout values
 */
const arbitraryNonPositiveTimeout: fc.Arbitrary<number> = fc.integer({ min: -100000, max: 0 })

/**
 * Arbitrary generator for custom environment variables
 */
const arbitraryCustomEnvVars: fc.Arbitrary<Record<string, string>> = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  fc.string({ maxLength: 200 })
)

/**
 * Arbitrary generator for valid AgentEnvironmentConfig
 */
const arbitraryValidConfig: fc.Arbitrary<AgentEnvironmentConfig> = fc.record({
  anthropicAuthToken: arbitraryValidString,
  anthropicBaseUrl: fc.option(arbitraryValidUrl, { nil: undefined }),
  apiTimeoutMs: arbitraryPositiveTimeout,
  pythonPath: arbitraryValidString,
  customEnvVars: arbitraryCustomEnvVars,
})

/**
 * Arbitrary generator for config with empty/whitespace auth token
 */
const arbitraryConfigWithEmptyAuthToken: fc.Arbitrary<AgentEnvironmentConfig> = fc.record({
  anthropicAuthToken: arbitraryWhitespaceString,
  anthropicBaseUrl: fc.option(arbitraryValidUrl, { nil: undefined }),
  apiTimeoutMs: arbitraryPositiveTimeout,
  pythonPath: arbitraryValidString,
  customEnvVars: arbitraryCustomEnvVars,
})

/**
 * Arbitrary generator for config with empty/whitespace python path
 */
const arbitraryConfigWithEmptyPythonPath: fc.Arbitrary<AgentEnvironmentConfig> = fc.record({
  anthropicAuthToken: arbitraryValidString,
  anthropicBaseUrl: fc.option(arbitraryValidUrl, { nil: undefined }),
  apiTimeoutMs: arbitraryPositiveTimeout,
  pythonPath: arbitraryWhitespaceString,
  customEnvVars: arbitraryCustomEnvVars,
})

/**
 * Arbitrary generator for config with non-positive timeout
 */
const arbitraryConfigWithInvalidTimeout: fc.Arbitrary<AgentEnvironmentConfig> = fc.record({
  anthropicAuthToken: arbitraryValidString,
  anthropicBaseUrl: fc.option(arbitraryValidUrl, { nil: undefined }),
  apiTimeoutMs: arbitraryNonPositiveTimeout,
  pythonPath: arbitraryValidString,
  customEnvVars: arbitraryCustomEnvVars,
})

/**
 * Arbitrary generator for config with invalid base URL
 */
const arbitraryConfigWithInvalidBaseUrl: fc.Arbitrary<AgentEnvironmentConfig> = fc.record({
  anthropicAuthToken: arbitraryValidString,
  anthropicBaseUrl: arbitraryInvalidUrl,
  apiTimeoutMs: arbitraryPositiveTimeout,
  pythonPath: arbitraryValidString,
  customEnvVars: arbitraryCustomEnvVars,
})

describe('Agent Config Service Property Tests', () => {
  let database: DatabaseService
  let keychain: KeychainService
  let configService: AgentConfigService
  let tempDbPath: string

  beforeEach(() => {
    // Create a temporary database for testing
    tempDbPath = path.join(
      os.tmpdir(),
      `mira-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
    )
    database = new DatabaseService(tempDbPath)
    database.initialize()

    // Create keychain service
    keychain = new KeychainService()

    // Create config service
    configService = new AgentConfigService(database, keychain)
  })

  afterEach(() => {
    database.close()
    keychain.clearAll()
    // Clean up temp database
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath)
    }
    // Clean up WAL files if they exist
    const walPath = `${tempDbPath}-wal`
    const shmPath = `${tempDbPath}-shm`
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath)
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath)
  })

  /**
   * **Feature: ai-agent-rework, Property 8: Configuration Validation**
   * **Validates: Requirements 5.5**
   *
   * For any agent configuration with an empty or whitespace-only ANTHROPIC_AUTH_TOKEN,
   * validation SHALL fail with an error message indicating the token is required.
   */
  it('validation fails for empty or whitespace-only auth token', () => {
    fc.assert(
      fc.property(arbitraryConfigWithEmptyAuthToken, (config) => {
        const result = configService.validateConfig(config)

        // Validation should fail
        if (result.isValid) return false

        // Should have at least one error
        if (result.errors.length === 0) return false

        // Should have an error for anthropicAuthToken field
        const authTokenError = result.errors.find((e) => e.field === 'anthropicAuthToken')
        if (!authTokenError) return false

        // Error message should indicate token is required
        if (!authTokenError.message.toLowerCase().includes('required')) return false

        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Feature: ai-agent-rework, Property 8: Configuration Validation**
   * **Validates: Requirements 5.5**
   *
   * For any agent configuration with an empty or whitespace-only python path,
   * validation SHALL fail with an error message indicating the path is required.
   */
  it('validation fails for empty or whitespace-only python path', () => {
    fc.assert(
      fc.property(arbitraryConfigWithEmptyPythonPath, (config) => {
        const result = configService.validateConfig(config)

        // Validation should fail
        if (result.isValid) return false

        // Should have at least one error
        if (result.errors.length === 0) return false

        // Should have an error for pythonPath field
        const pythonPathError = result.errors.find((e) => e.field === 'pythonPath')
        if (!pythonPathError) return false

        // Error message should indicate path is required
        if (!pythonPathError.message.toLowerCase().includes('required')) return false

        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Feature: ai-agent-rework, Property 8: Configuration Validation**
   * **Validates: Requirements 5.5**
   *
   * For any agent configuration with a non-positive API timeout,
   * validation SHALL fail with an error message indicating the timeout must be positive.
   */
  it('validation fails for non-positive API timeout', () => {
    fc.assert(
      fc.property(arbitraryConfigWithInvalidTimeout, (config) => {
        const result = configService.validateConfig(config)

        // Validation should fail
        if (result.isValid) return false

        // Should have at least one error
        if (result.errors.length === 0) return false

        // Should have an error for apiTimeoutMs field
        const timeoutError = result.errors.find((e) => e.field === 'apiTimeoutMs')
        if (!timeoutError) return false

        // Error message should indicate timeout must be positive
        if (!timeoutError.message.toLowerCase().includes('positive')) return false

        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Feature: ai-agent-rework, Property 8: Configuration Validation**
   * **Validates: Requirements 5.5**
   *
   * For any agent configuration with an invalid base URL,
   * validation SHALL fail with an error message indicating the URL is invalid.
   */
  it('validation fails for invalid base URL', () => {
    fc.assert(
      fc.property(arbitraryConfigWithInvalidBaseUrl, (config) => {
        const result = configService.validateConfig(config)

        // Validation should fail
        if (result.isValid) return false

        // Should have at least one error
        if (result.errors.length === 0) return false

        // Should have an error for anthropicBaseUrl field
        const urlError = result.errors.find((e) => e.field === 'anthropicBaseUrl')
        if (!urlError) return false

        // Error message should indicate URL is invalid
        if (!urlError.message.toLowerCase().includes('url')) return false

        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Feature: ai-agent-rework, Property 8: Configuration Validation**
   * **Validates: Requirements 5.5**
   *
   * For any valid agent configuration, validation SHALL pass with no errors.
   */
  it('validation passes for valid configuration', () => {
    fc.assert(
      fc.property(arbitraryValidConfig, (config) => {
        const result = configService.validateConfig(config)

        // Validation should pass
        if (!result.isValid) return false

        // Should have no errors
        if (result.errors.length !== 0) return false

        return true
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Feature: ai-agent-rework, Property 8: Configuration Validation**
   * **Validates: Requirements 5.5**
   *
   * For any configuration with multiple invalid fields, validation SHALL
   * return errors for each invalid field.
   */
  it('validation returns errors for all invalid fields', () => {
    fc.assert(
      fc.property(
        arbitraryWhitespaceString,
        arbitraryWhitespaceString,
        arbitraryNonPositiveTimeout,
        (authToken, pythonPath, timeout) => {
          const config: AgentEnvironmentConfig = {
            anthropicAuthToken: authToken,
            anthropicBaseUrl: undefined,
            apiTimeoutMs: timeout,
            pythonPath: pythonPath,
            customEnvVars: {},
          }

          const result = configService.validateConfig(config)

          // Validation should fail
          if (result.isValid) return false

          // Should have errors for all three invalid fields
          const hasAuthTokenError = result.errors.some((e) => e.field === 'anthropicAuthToken')
          const hasPythonPathError = result.errors.some((e) => e.field === 'pythonPath')
          const hasTimeoutError = result.errors.some((e) => e.field === 'apiTimeoutMs')

          if (!hasAuthTokenError || !hasPythonPathError || !hasTimeoutError) return false

          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})
