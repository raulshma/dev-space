import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { PTYManager } from './pty-manager'

// Mock node-pty
vi.mock('@lydell/node-pty', () => ({
  spawn: vi.fn(() => ({
    pid: 12345,
    onData: vi.fn(),
    onExit: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
  })),
}))

describe('PTYManager', () => {
  let ptyManager: PTYManager

  beforeEach(() => {
    vi.clearAllMocks()
    ptyManager = new PTYManager()
  })

  afterEach(() => {
    // Clean up any remaining PTY instances
    try {
      ptyManager.killAll()
    } catch {
      // Ignore errors during cleanup
    }
  })

  describe('create', () => {
    it('should create a new PTY instance and return a unique ID', () => {
      const ptyId = ptyManager.create({ cwd: '/test/path' })

      expect(ptyId).toMatch(/^pty-\d+$/)
      expect(ptyManager.exists(ptyId)).toBe(true)
    })

    it('should create PTY instances with sequential IDs', () => {
      const ptyId1 = ptyManager.create({ cwd: '/test/path1' })
      const ptyId2 = ptyManager.create({ cwd: '/test/path2' })

      expect(ptyId1).not.toBe(ptyId2)
      expect(ptyManager.exists(ptyId1)).toBe(true)
      expect(ptyManager.exists(ptyId2)).toBe(true)
    })

    it('should accept custom shell option', () => {
      const ptyId = ptyManager.create({
        cwd: '/test/path',
        shell: '/bin/bash',
      })

      expect(ptyManager.exists(ptyId)).toBe(true)
    })

    it('should accept custom environment variables', () => {
      const ptyId = ptyManager.create({
        cwd: '/test/path',
        env: { TEST_VAR: 'test_value' },
      })

      expect(ptyManager.exists(ptyId)).toBe(true)
    })

    it('should accept custom cols and rows', () => {
      const ptyId = ptyManager.create({
        cwd: '/test/path',
        cols: 120,
        rows: 40,
      })

      expect(ptyManager.exists(ptyId)).toBe(true)
    })
  })

  describe('kill', () => {
    it('should kill a PTY instance and remove it', () => {
      const ptyId = ptyManager.create({ cwd: '/test/path' })

      expect(ptyManager.exists(ptyId)).toBe(true)

      ptyManager.kill(ptyId)

      expect(ptyManager.exists(ptyId)).toBe(false)
    })

    it('should throw error when killing non-existent PTY', () => {
      expect(() => ptyManager.kill('non-existent')).toThrow(
        'PTY instance non-existent not found'
      )
    })
  })

  describe('killAll', () => {
    it('should kill all PTY instances', () => {
      const ptyId1 = ptyManager.create({ cwd: '/test/path1' })
      const ptyId2 = ptyManager.create({ cwd: '/test/path2' })
      const ptyId3 = ptyManager.create({ cwd: '/test/path3' })

      expect(ptyManager.exists(ptyId1)).toBe(true)
      expect(ptyManager.exists(ptyId2)).toBe(true)
      expect(ptyManager.exists(ptyId3)).toBe(true)

      ptyManager.killAll()

      expect(ptyManager.exists(ptyId1)).toBe(false)
      expect(ptyManager.exists(ptyId2)).toBe(false)
      expect(ptyManager.exists(ptyId3)).toBe(false)
    })

    it('should handle empty instance list', () => {
      expect(() => ptyManager.killAll()).not.toThrow()
    })
  })

  describe('write', () => {
    it('should write data to a PTY instance', () => {
      const ptyId = ptyManager.create({ cwd: '/test/path' })

      expect(() => ptyManager.write(ptyId, 'echo "test"\n')).not.toThrow()
    })

    it('should throw error when writing to non-existent PTY', () => {
      expect(() => ptyManager.write('non-existent', 'test')).toThrow(
        'PTY instance non-existent not found'
      )
    })
  })

  describe('resize', () => {
    it('should resize a PTY instance', () => {
      const ptyId = ptyManager.create({ cwd: '/test/path' })

      expect(() => ptyManager.resize(ptyId, 120, 40)).not.toThrow()
    })

    it('should throw error when resizing non-existent PTY', () => {
      expect(() => ptyManager.resize('non-existent', 80, 24)).toThrow(
        'PTY instance non-existent not found'
      )
    })
  })

  describe('event handlers', () => {
    it('should register data event handler', () => {
      const ptyId = ptyManager.create({ cwd: '/test/path' })
      const callback = vi.fn()

      expect(() => ptyManager.onData(ptyId, callback)).not.toThrow()
    })

    it('should register exit event handler', () => {
      const ptyId = ptyManager.create({ cwd: '/test/path' })
      const callback = vi.fn()

      expect(() => ptyManager.onExit(ptyId, callback)).not.toThrow()
    })

    it('should throw error when registering handler for non-existent PTY', () => {
      const callback = vi.fn()

      expect(() => ptyManager.onData('non-existent', callback)).toThrow(
        'PTY instance non-existent not found'
      )
      expect(() => ptyManager.onExit('non-existent', callback)).toThrow(
        'PTY instance non-existent not found'
      )
    })
  })

  describe('pin', () => {
    it('should pin a PTY instance', () => {
      const ptyId = ptyManager.create({ cwd: '/test/path' })

      expect(ptyManager.isPinned(ptyId)).toBe(false)

      ptyManager.pin(ptyId, 'project-123', 'npm run dev')

      expect(ptyManager.isPinned(ptyId)).toBe(true)
    })

    it('should throw error when pinning non-existent PTY', () => {
      expect(() => ptyManager.pin('non-existent', 'project-123')).toThrow(
        'PTY instance non-existent not found'
      )
    })

    it('should allow pinning without command', () => {
      const ptyId = ptyManager.create({ cwd: '/test/path' })

      expect(() => ptyManager.pin(ptyId, 'project-123')).not.toThrow()
      expect(ptyManager.isPinned(ptyId)).toBe(true)
    })
  })

  describe('unpin', () => {
    it('should unpin a PTY instance', () => {
      const ptyId = ptyManager.create({ cwd: '/test/path' })

      ptyManager.pin(ptyId, 'project-123', 'npm run dev')
      expect(ptyManager.isPinned(ptyId)).toBe(true)

      ptyManager.unpin(ptyId)
      expect(ptyManager.isPinned(ptyId)).toBe(false)
    })

    it('should throw error when unpinning non-existent PTY', () => {
      expect(() => ptyManager.unpin('non-existent')).toThrow(
        'PTY instance non-existent not found'
      )
    })

    it('should handle unpinning already unpinned PTY', () => {
      const ptyId = ptyManager.create({ cwd: '/test/path' })

      expect(ptyManager.isPinned(ptyId)).toBe(false)

      expect(() => ptyManager.unpin(ptyId)).not.toThrow()
      expect(ptyManager.isPinned(ptyId)).toBe(false)
    })
  })

  describe('getPinnedProcesses', () => {
    it('should return empty array when no processes are pinned', () => {
      ptyManager.create({ cwd: '/test/path1' })
      ptyManager.create({ cwd: '/test/path2' })

      const pinned = ptyManager.getPinnedProcesses()

      expect(pinned).toEqual([])
    })

    it('should return all pinned processes', () => {
      const ptyId1 = ptyManager.create({ cwd: '/test/path1' })
      ptyManager.create({ cwd: '/test/path2' }) // Unpinned process
      const ptyId3 = ptyManager.create({ cwd: '/test/path3' })

      ptyManager.pin(ptyId1, 'project-1', 'npm run dev')
      ptyManager.pin(ptyId3, 'project-3', 'npm run build')

      const pinned = ptyManager.getPinnedProcesses()

      expect(pinned).toHaveLength(2)
      expect(pinned[0]).toMatchObject({
        ptyId: ptyId1,
        projectId: 'project-1',
        command: 'npm run dev',
      })
      expect(pinned[1]).toMatchObject({
        ptyId: ptyId3,
        projectId: 'project-3',
        command: 'npm run build',
      })
      expect(pinned[0].startTime).toBeInstanceOf(Date)
      expect(pinned[1].startTime).toBeInstanceOf(Date)
    })

    it('should not include unpinned processes', () => {
      const ptyId1 = ptyManager.create({ cwd: '/test/path1' })
      const ptyId2 = ptyManager.create({ cwd: '/test/path2' })

      ptyManager.pin(ptyId1, 'project-1', 'npm run dev')
      ptyManager.pin(ptyId2, 'project-2', 'npm run test')

      ptyManager.unpin(ptyId1)

      const pinned = ptyManager.getPinnedProcesses()

      expect(pinned).toHaveLength(1)
      expect(pinned[0].ptyId).toBe(ptyId2)
    })

    it('should handle pinned process with unknown command', () => {
      const ptyId = ptyManager.create({ cwd: '/test/path' })

      ptyManager.pin(ptyId, 'project-1')

      const pinned = ptyManager.getPinnedProcesses()

      expect(pinned).toHaveLength(1)
      expect(pinned[0].command).toBe('unknown')
    })
  })

  describe('exists', () => {
    it('should return true for existing PTY', () => {
      const ptyId = ptyManager.create({ cwd: '/test/path' })

      expect(ptyManager.exists(ptyId)).toBe(true)
    })

    it('should return false for non-existent PTY', () => {
      expect(ptyManager.exists('non-existent')).toBe(false)
    })

    it('should return false after PTY is killed', () => {
      const ptyId = ptyManager.create({ cwd: '/test/path' })

      expect(ptyManager.exists(ptyId)).toBe(true)

      ptyManager.kill(ptyId)

      expect(ptyManager.exists(ptyId)).toBe(false)
    })
  })

  describe('isPinned', () => {
    it('should return false for unpinned PTY', () => {
      const ptyId = ptyManager.create({ cwd: '/test/path' })

      expect(ptyManager.isPinned(ptyId)).toBe(false)
    })

    it('should return true for pinned PTY', () => {
      const ptyId = ptyManager.create({ cwd: '/test/path' })

      ptyManager.pin(ptyId, 'project-123')

      expect(ptyManager.isPinned(ptyId)).toBe(true)
    })

    it('should return false for non-existent PTY', () => {
      expect(ptyManager.isPinned('non-existent')).toBe(false)
    })
  })
})
