import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { existsSync } from 'fs'
import { promisify } from 'util'
import { exec } from 'child_process'

// Create a mock execAsync that will be controlled by tests - must be hoisted
const mockExecAsync = vi.hoisted(() => vi.fn())

// Mock child_process and fs
vi.mock('child_process', () => ({
  exec: vi.fn()
}))
vi.mock('fs', () => ({
  existsSync: vi.fn()
}))
vi.mock('util', async () => {
  const actual = await vi.importActual<typeof import('util')>('util')
  return {
    ...actual,
    promisify: vi.fn(() => mockExecAsync)
  }
})

// Import after mocks are set up
const { GitService } = await import('./git-service')

describe('GitService', () => {
  let gitService: GitService

  beforeEach(() => {
    gitService = new GitService()
    vi.clearAllMocks()
  })

  afterEach(() => {
    gitService.stopAllRefreshes()
  })

  describe('isGitRepo', () => {
    it('should return false if .git directory does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false)

      const result = await gitService.isGitRepo('/fake/path')

      expect(result).toBe(false)
    })

    it('should return true for a valid git repository', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      mockExecAsync.mockResolvedValue({ stdout: 'true\n', stderr: '' })

      const result = await gitService.isGitRepo('/fake/repo')

      expect(result).toBe(true)
    })

    it('should return false if git command fails', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      mockExecAsync.mockRejectedValue(new Error('Not a git repo'))

      const result = await gitService.isGitRepo('/fake/path')

      expect(result).toBe(false)
    })
  })

  describe('getTelemetry', () => {
    it('should return empty telemetry for non-git repository', async () => {
      vi.mocked(existsSync).mockReturnValue(false)

      const telemetry = await gitService.getTelemetry('/fake/path')

      expect(telemetry).toEqual({
        isGitRepo: false,
        branch: '',
        ahead: 0,
        behind: 0,
        modified: 0,
        staged: 0,
        untracked: 0
      })
    })

    it('should return telemetry for a git repository with no changes', async () => {
      vi.mocked(existsSync).mockReturnValue(true)

      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'true\n', stderr: '' }) // isGitRepo check
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' }) // branch
        .mockResolvedValueOnce({ stdout: '0\t0\n', stderr: '' }) // ahead/behind
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // status

      const telemetry = await gitService.getTelemetry('/fake/repo')

      expect(telemetry).toEqual({
        isGitRepo: true,
        branch: 'main',
        ahead: 0,
        behind: 0,
        modified: 0,
        staged: 0,
        untracked: 0
      })
    })

    it('should parse ahead/behind counts correctly', async () => {
      vi.mocked(existsSync).mockReturnValue(true)

      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'true\n', stderr: '' }) // isGitRepo check
        .mockResolvedValueOnce({ stdout: 'feature-branch\n', stderr: '' }) // branch
        .mockResolvedValueOnce({ stdout: '3\t2\n', stderr: '' }) // ahead/behind
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // status

      const telemetry = await gitService.getTelemetry('/fake/repo')

      expect(telemetry.ahead).toBe(3)
      expect(telemetry.behind).toBe(2)
    })

    it('should parse status counts correctly', async () => {
      vi.mocked(existsSync).mockReturnValue(true)

      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'true\n', stderr: '' }) // isGitRepo check
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' }) // branch
        .mockResolvedValueOnce({ stdout: '0\t0\n', stderr: '' }) // ahead/behind
        .mockResolvedValueOnce({
          // Modified, staged, and untracked files
          stdout: ' M file1.txt\nM  file2.txt\n?? file3.txt\n',
          stderr: ''
        }) // status

      const telemetry = await gitService.getTelemetry('/fake/repo')

      expect(telemetry.modified).toBe(1) // ' M' means modified in work tree
      expect(telemetry.staged).toBe(1) // 'M ' means staged
      expect(telemetry.untracked).toBe(1) // '??' means untracked
    })
  })

  describe('background refresh', () => {
    it('should start and stop background refresh', () => {
      vi.useFakeTimers()

      const onUpdate = vi.fn()
      gitService.startBackgroundRefresh('project1', '/fake/repo', 5000, onUpdate)

      expect(gitService['refreshIntervals'].has('project1')).toBe(true)

      gitService.stopBackgroundRefresh('project1')

      expect(gitService['refreshIntervals'].has('project1')).toBe(false)

      vi.useRealTimers()
    })

    it('should stop all refreshes', () => {
      vi.useFakeTimers()

      gitService.startBackgroundRefresh('project1', '/fake/repo1', 5000)
      gitService.startBackgroundRefresh('project2', '/fake/repo2', 5000)

      expect(gitService['refreshIntervals'].size).toBe(2)

      gitService.stopAllRefreshes()

      expect(gitService['refreshIntervals'].size).toBe(0)

      vi.useRealTimers()
    })
  })

  describe('cache', () => {
    it('should cache telemetry results', async () => {
      vi.mocked(existsSync).mockReturnValue(true)

      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'true\n', stderr: '' }) // isGitRepo check
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' }) // branch
        .mockResolvedValueOnce({ stdout: '0\t0\n', stderr: '' }) // ahead/behind
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // status

      await gitService.getTelemetry('/fake/repo')

      const cached = gitService.getCachedTelemetry('/fake/repo')
      expect(cached).not.toBeNull()
      expect(cached?.branch).toBe('main')
    })

    it('should clear cache', async () => {
      vi.mocked(existsSync).mockReturnValue(true)

      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'true\n', stderr: '' }) // isGitRepo check
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' }) // branch
        .mockResolvedValueOnce({ stdout: '0\t0\n', stderr: '' }) // ahead/behind
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // status

      await gitService.getTelemetry('/fake/repo')
      gitService.clearCache()

      const cached = gitService.getCachedTelemetry('/fake/repo')
      expect(cached).toBeNull()
    })
  })
})
