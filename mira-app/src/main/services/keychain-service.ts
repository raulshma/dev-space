import { safeStorage } from 'electron'
import type { AIProvider } from '../../shared/models'

/**
 * KeychainService provides secure storage for API keys and secrets
 * using Electron's safeStorage API which integrates with OS keychains:
 * - macOS: Keychain
 * - Windows: DPAPI
 * - Linux: libsecret
 */
export class KeychainService {
  private static readonly SERVICE_NAME = 'mira-developer-hub'
  private storage: Map<string, Buffer>

  constructor() {
    // In-memory storage for encrypted values
    // In a production app, you might want to persist these to disk
    // but for now we'll keep them in memory during the session
    this.storage = new Map<string, Buffer>()
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

    const storageKey = this.getApiKeyStorageKey(provider)
    const encrypted = safeStorage.encryptString(key)
    this.storage.set(storageKey, encrypted)
  }

  /**
   * Get an API key for a specific provider
   */
  async getApiKey(provider: AIProvider): Promise<string | null> {
    if (!this.isAvailable()) {
      throw new Error('Secure storage is not available on this platform')
    }

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
    const storageKey = this.getApiKeyStorageKey(provider)
    this.storage.delete(storageKey)
  }

  /**
   * Check if an API key exists for a specific provider
   */
  async hasApiKey(provider: AIProvider): Promise<boolean> {
    const storageKey = this.getApiKeyStorageKey(provider)
    return this.storage.has(storageKey)
  }

  /**
   * Set a generic secret
   */
  async setSecret(service: string, account: string, secret: string): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Secure storage is not available on this platform')
    }

    const storageKey = this.getSecretStorageKey(service, account)
    const encrypted = safeStorage.encryptString(secret)
    this.storage.set(storageKey, encrypted)
  }

  /**
   * Get a generic secret
   */
  async getSecret(service: string, account: string): Promise<string | null> {
    if (!this.isAvailable()) {
      throw new Error('Secure storage is not available on this platform')
    }

    const storageKey = this.getSecretStorageKey(service, account)
    const encrypted = this.storage.get(storageKey)

    if (!encrypted) {
      return null
    }

    try {
      return safeStorage.decryptString(encrypted)
    } catch (error) {
      console.error(`Failed to decrypt secret for ${service}/${account}:`, error)
      return null
    }
  }

  /**
   * Delete a generic secret
   */
  async deleteSecret(service: string, account: string): Promise<void> {
    const storageKey = this.getSecretStorageKey(service, account)
    this.storage.delete(storageKey)
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
   * Clear all stored secrets (useful for testing or logout)
   */
  clearAll(): void {
    this.storage.clear()
  }
}
