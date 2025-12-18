import { safeStorage, app } from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { AIProvider } from 'shared/models'

/**
 * Persisted secrets storage structure
 */
interface SecretsStore {
  version: number
  secrets: Record<string, string> // key -> base64 encoded encrypted data
}

/**
 * KeychainService provides secure storage for API keys and secrets
 * using Electron's safeStorage API which integrates with OS keychains:
 * - macOS: Keychain
 * - Windows: DPAPI
 * - Linux: libsecret
 *
 * Encrypted secrets are persisted to a JSON file in the user data directory.
 */
export class KeychainService {
  private static readonly SERVICE_NAME = 'mira-developer-hub'
  private static readonly SECRETS_FILE = 'secrets.json'
  private static readonly STORE_VERSION = 1
  private storage: Map<string, Buffer>
  private secretsFilePath: string
  private initialized = false

  constructor() {
    this.storage = new Map<string, Buffer>()
    // Use userData directory for persistent storage
    this.secretsFilePath = path.join(
      app.getPath('userData'),
      KeychainService.SECRETS_FILE
    )
  }

  /**
   * Initialize the keychain service by loading persisted secrets
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      await this.loadSecrets()
      this.initialized = true
    } catch (error) {
      console.error('Failed to initialize keychain service:', error)
      // Continue with empty storage if load fails
      this.initialized = true
    }
  }

  /**
   * Check if safeStorage is available on this platform
   */
  isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable()
  }

  /**
   * Set an API key for a specific provider
   */
  async setApiKey(provider: AIProvider, key: string): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Secure storage is not available on this platform')
    }

    await this.initialize()

    const storageKey = this.getApiKeyStorageKey(provider)
    const encrypted = safeStorage.encryptString(key)
    this.storage.set(storageKey, encrypted)

    // Persist to disk
    await this.saveSecrets()
  }

  /**
   * Get an API key for a specific provider
   */
  async getApiKey(provider: AIProvider): Promise<string | null> {
    if (!this.isAvailable()) {
      throw new Error('Secure storage is not available on this platform')
    }

    await this.initialize()

    const storageKey = this.getApiKeyStorageKey(provider)
    const encrypted = this.storage.get(storageKey)

    if (!encrypted) {
      return null
    }

    try {
      return safeStorage.decryptString(encrypted)
    } catch (error) {
      console.error(`Failed to decrypt API key for ${provider}:`, error)
      return null
    }
  }

  /**
   * Delete an API key for a specific provider
   */
  async deleteApiKey(provider: AIProvider): Promise<void> {
    await this.initialize()

    const storageKey = this.getApiKeyStorageKey(provider)
    this.storage.delete(storageKey)

    // Persist to disk
    await this.saveSecrets()
  }

  /**
   * Check if an API key exists for a specific provider
   */
  async hasApiKey(provider: AIProvider): Promise<boolean> {
    await this.initialize()

    const storageKey = this.getApiKeyStorageKey(provider)
    return this.storage.has(storageKey)
  }

  /**
   * Set a generic secret
   */
  async setSecret(
    service: string,
    account: string,
    secret: string
  ): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Secure storage is not available on this platform')
    }

    await this.initialize()

    const storageKey = this.getSecretStorageKey(service, account)
    const encrypted = safeStorage.encryptString(secret)
    this.storage.set(storageKey, encrypted)

    // Persist to disk
    await this.saveSecrets()
  }

  /**
   * Get a generic secret
   */
  async getSecret(service: string, account: string): Promise<string | null> {
    if (!this.isAvailable()) {
      throw new Error('Secure storage is not available on this platform')
    }

    await this.initialize()

    const storageKey = this.getSecretStorageKey(service, account)
    const encrypted = this.storage.get(storageKey)

    if (!encrypted) {
      return null
    }

    try {
      return safeStorage.decryptString(encrypted)
    } catch (error) {
      console.error(
        `Failed to decrypt secret for ${service}/${account}:`,
        error
      )
      return null
    }
  }

  /**
   * Delete a generic secret
   */
  async deleteSecret(service: string, account: string): Promise<void> {
    await this.initialize()

    const storageKey = this.getSecretStorageKey(service, account)
    this.storage.delete(storageKey)

    // Persist to disk
    await this.saveSecrets()
  }

  /**
   * Generate storage key for API keys
   */
  private getApiKeyStorageKey(provider: AIProvider): string {
    return `${KeychainService.SERVICE_NAME}:api-key:${provider}`
  }

  /**
   * Generate storage key for generic secrets
   */
  private getSecretStorageKey(service: string, account: string): string {
    return `${KeychainService.SERVICE_NAME}:${service}:${account}`
  }

  /**
   * Load secrets from persistent storage
   */
  private async loadSecrets(): Promise<void> {
    try {
      if (!fs.existsSync(this.secretsFilePath)) {
        return
      }

      const data = fs.readFileSync(this.secretsFilePath, 'utf-8')
      const store: SecretsStore = JSON.parse(data)

      // Validate store version
      if (store.version !== KeychainService.STORE_VERSION) {
        console.warn('Secrets store version mismatch, starting fresh')
        return
      }

      // Load secrets into memory
      for (const [key, base64Data] of Object.entries(store.secrets)) {
        try {
          const buffer = Buffer.from(base64Data, 'base64')
          this.storage.set(key, buffer)
        } catch (error) {
          console.error(`Failed to load secret ${key}:`, error)
        }
      }
    } catch (error) {
      console.error('Failed to load secrets from disk:', error)
    }
  }

  /**
   * Save secrets to persistent storage
   */
  private async saveSecrets(): Promise<void> {
    try {
      const store: SecretsStore = {
        version: KeychainService.STORE_VERSION,
        secrets: {},
      }

      // Convert buffers to base64 for JSON storage
      for (const [key, buffer] of this.storage.entries()) {
        store.secrets[key] = buffer.toString('base64')
      }

      // Ensure directory exists
      const dir = path.dirname(this.secretsFilePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      // Write atomically by writing to temp file first
      const tempPath = `${this.secretsFilePath}.tmp`
      fs.writeFileSync(tempPath, JSON.stringify(store, null, 2), 'utf-8')
      fs.renameSync(tempPath, this.secretsFilePath)
    } catch (error) {
      console.error('Failed to save secrets to disk:', error)
      throw error
    }
  }

  /**
   * Clear all stored secrets (useful for testing or logout)
   */
  async clearAll(): Promise<void> {
    this.storage.clear()

    // Remove persisted file
    try {
      if (fs.existsSync(this.secretsFilePath)) {
        fs.unlinkSync(this.secretsFilePath)
      }
    } catch (error) {
      console.error('Failed to delete secrets file:', error)
    }
  }
}
