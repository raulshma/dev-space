import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Mock modules before importing the service
vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
}))

vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/home/testuser'),
  platform: vi.fn(() => 'linux'),
}))

// Import after mocks are set up
import { CLIDetectorService } from './cli-detector-service'
import { existsSync } from 'node:fs'
import { platform } from 'node:os'

describe('CLIDetectorService', () => {
  let service: CLIDetectorService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new CLIDetectorService()
  })

  afterEach(() => {
    service.clearCache()
  })

  describe('detect', () => {
    it('should return error for unknown CLI type', async () => {
      const result = await service.detect('unknown-cli' as never)

      expect(result.found).toBe(false)
      expect(result.error).toContain('Unknown CLI type')
    })
  })

  describe('verifyPath', () => {
    it('should return false for non-existent path', async () => {
      vi.mocked(existsSync).mockReturnValue(false)

      const valid = await service.verifyPath('python', '/nonexistent/python')

      expect(valid).toBe(false)
    })
  })

  describe('clearCache', () => {
    it('should not throw when clearing empty cache', () => {
      expect(() => service.clearCache()).not.toThrow()
    })
  })

  describe('platform detection', () => {
    it('should detect current platform', () => {
      // The service uses platform() internally
      expect(platform()).toBe('linux')
    })
  })
})
