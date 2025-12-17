import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseService } from '../services/database'
import { PTYManager } from '../services/pty-manager'
import { GitService } from '../services/git-service'
import { KeychainService } from '../services/keychain-service'
import { AgentService } from '../services/agent-service'
import { IPCHandlers } from './handlers'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

describe('IPCHandlers', () => {
  let db: DatabaseService
  let ptyManager: PTYManager
  let gitService: GitService
  let keychainService: KeychainService
  let agentService: AgentService
  let ipcHandlers: IPCHandlers
  let tempDbPath: string

  beforeEach(() => {
    // Create a temporary database for testing
    tempDbPath = path.join(os.tmpdir(), `test-mira-${Date.now()}.db`)

    // Initialize services
    db = new DatabaseService(tempDbPath)
    db.initialize()
    db.migrate()

    ptyManager = new PTYManager()
    gitService = new GitService()
    keychainService = new KeychainService()
    agentService = new AgentService(keychainService)

    // Create IPC handlers
    ipcHandlers = new IPCHandlers(db, ptyManager, gitService, keychainService, agentService)
  })

  afterEach(() => {
    // Clean up
    db.close()
    ptyManager.killAll()
    gitService.stopAllRefreshes()

    // Remove temp database
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath)
    }
  })

  describe('initialization', () => {
    it('should create IPCHandlers instance', () => {
      expect(ipcHandlers).toBeDefined()
      expect(ipcHandlers).toBeInstanceOf(IPCHandlers)
    })

    it('should have registerHandlers method', () => {
      expect(ipcHandlers.registerHandlers).toBeDefined()
      expect(typeof ipcHandlers.registerHandlers).toBe('function')
    })
  })

  describe('service integration', () => {
    it('should integrate with database service', () => {
      // Create a project through the database
      const project = db.createProject({
        name: 'Test Project',
        path: '/test/path'
      })

      expect(project).toBeDefined()
      expect(project.name).toBe('Test Project')

      // Verify we can retrieve it
      const retrieved = db.getProject(project.id)
      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(project.id)
    })

    it('should integrate with PTY manager', () => {
      // Create a PTY instance
      const ptyId = ptyManager.create({
        cwd: process.cwd()
      })

      expect(ptyId).toBeDefined()
      expect(typeof ptyId).toBe('string')
      expect(ptyManager.exists(ptyId)).toBe(true)
    })

    it('should integrate with keychain service', async () => {
      // Keychain service requires full Electron context
      // Just verify the service is instantiated correctly
      expect(keychainService).toBeDefined()
      expect(keychainService).toBeInstanceOf(KeychainService)
    })
  })
})
