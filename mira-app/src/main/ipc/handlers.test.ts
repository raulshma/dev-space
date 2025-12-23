import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as path from 'node:path'
import * as fs from 'node:fs'
import * as os from 'node:os'

// Mock Electron app module - must be before other imports that use electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockImplementation(() => os.tmpdir()),
  },
}))

import { DatabaseService } from '../services/database'
import { PTYManager } from '../services/pty-manager'
import { GitService } from '../services/git-service'
import { KeychainService } from '../services/keychain-service'
import { IPCHandlers } from './handlers'
import type { AIService } from '../services/ai-service'
import type { RequestLogger } from '../services/ai/request-logger'
import type { RunningProjectsService } from '../services/running-projects-service'
import type { GlobalProcessService } from '../services/global-process-service'
import type { WorktreeService } from '../services/worktree-service'
import type { DependencyManager } from '../services/dependency-manager'
import type { SessionService } from '../services/session-service'
import type { ReviewService } from '../services/review-service'
import type { AgentService } from '../services/agent-service'
import type { AutoModeService } from '../services/auto-mode-service'

describe('IPCHandlers', () => {
  let db: DatabaseService
  let ptyManager: PTYManager
  let gitService: GitService
  let keychainService: KeychainService
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

    // Create IPC handlers (without optional services)
    ipcHandlers = new IPCHandlers(db, ptyManager, gitService, keychainService)
  })

  afterEach(async () => {
    // Clean up
    db.close()
    ptyManager.killAll()
    gitService.stopAllRefreshes()

    // Small delay to allow file handles to be released on Windows
    await new Promise(resolve => setTimeout(resolve, 50))

    // Remove temp database (ignore errors on Windows due to file locking)
    try {
      if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath)
      }
    } catch {
      // Ignore cleanup errors - temp files will be cleaned up by OS
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
        path: '/test/path',
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
        cwd: process.cwd(),
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

  describe('new service integration', () => {
    it('should accept optional AI service', () => {
      const mockAIService = {
        initialize: vi.fn(),
        getProvider: vi.fn(),
        getAvailableModels: vi.fn().mockResolvedValue([]),
        setDefaultModel: vi.fn(),
        setActionModel: vi.fn(),
        getModelForAction: vi.fn(),
        generateText: vi.fn(),
        streamText: vi.fn(),
        getConversation: vi.fn().mockReturnValue([]),
        clearConversation: vi.fn(),
        addMessageToConversation: vi.fn(),
      } as unknown as AIService

      const handlers = new IPCHandlers(
        db,
        ptyManager,
        gitService,
        keychainService,
        mockAIService
      )

      expect(handlers).toBeDefined()
    })

    it('should accept optional request logger', () => {
      const mockRequestLogger = {
        logRequest: vi.fn().mockReturnValue('log-id'),
        updateResponse: vi.fn(),
        logError: vi.fn(),
        getLogs: vi.fn().mockReturnValue([]),
        getLog: vi.fn().mockReturnValue(null),
        clearOldLogs: vi.fn().mockReturnValue(0),
        stopPeriodicCleanup: vi.fn(),
      } as unknown as RequestLogger

      const handlers = new IPCHandlers(
        db,
        ptyManager,
        gitService,
        keychainService,
        undefined, // aiService
        mockRequestLogger
      )

      expect(handlers).toBeDefined()
    })

    it('should accept optional agent service', () => {
      const mockAgentService = {
        createSession: vi.fn(),
        listSessions: vi.fn().mockReturnValue([]),
        deleteSession: vi.fn(),
        archiveSession: vi.fn(),
        sendMessage: vi.fn(),
        stopExecution: vi.fn(),
        clearSession: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      } as unknown as AgentService

      const handlers = new IPCHandlers(
        db,
        ptyManager,
        gitService,
        keychainService,
        undefined, // aiService
        undefined, // requestLogger
        undefined, // runningProjectsService
        undefined, // globalProcessService
        undefined, // worktreeService
        undefined, // dependencyManager
        undefined, // sessionService
        undefined, // reviewService
        mockAgentService
      )

      expect(handlers).toBeDefined()
    })

    it('should accept optional auto mode service', () => {
      const mockAutoModeService = {
        startAutoLoop: vi.fn(),
        stopAutoLoop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(false),
        getState: vi.fn().mockReturnValue(null),
        executeFeature: vi.fn(),
        stopFeature: vi.fn(),
        approvePlan: vi.fn(),
        rejectPlan: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      } as unknown as AutoModeService

      const handlers = new IPCHandlers(
        db,
        ptyManager,
        gitService,
        keychainService,
        undefined, // aiService
        undefined, // requestLogger
        undefined, // runningProjectsService
        undefined, // globalProcessService
        undefined, // worktreeService
        undefined, // dependencyManager
        undefined, // sessionService
        undefined, // reviewService
        undefined, // agentService
        mockAutoModeService
      )

      expect(handlers).toBeDefined()
    })

    it('should accept all optional services together', () => {
      const mockAIService = {
        initialize: vi.fn(),
        getProvider: vi.fn(),
        getAvailableModels: vi.fn().mockResolvedValue([]),
        setDefaultModel: vi.fn(),
        setActionModel: vi.fn(),
        getModelForAction: vi.fn(),
        generateText: vi.fn(),
        streamText: vi.fn(),
        getConversation: vi.fn().mockReturnValue([]),
        clearConversation: vi.fn(),
        addMessageToConversation: vi.fn(),
      } as unknown as AIService

      const mockRequestLogger = {
        logRequest: vi.fn().mockReturnValue('log-id'),
        updateResponse: vi.fn(),
        logError: vi.fn(),
        getLogs: vi.fn().mockReturnValue([]),
        getLog: vi.fn().mockReturnValue(null),
        clearOldLogs: vi.fn().mockReturnValue(0),
        stopPeriodicCleanup: vi.fn(),
      } as unknown as RequestLogger

      const mockRunningProjectsService = {} as unknown as RunningProjectsService
      const mockGlobalProcessService = {} as unknown as GlobalProcessService
      const mockWorktreeService = {} as unknown as WorktreeService
      const mockDependencyManager = {} as unknown as DependencyManager
      const mockSessionService = {} as unknown as SessionService
      const mockReviewService = {} as unknown as ReviewService

      const mockAgentService = {
        createSession: vi.fn(),
        listSessions: vi.fn().mockReturnValue([]),
        deleteSession: vi.fn(),
        archiveSession: vi.fn(),
        sendMessage: vi.fn(),
        stopExecution: vi.fn(),
        clearSession: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      } as unknown as AgentService

      const mockAutoModeService = {
        startAutoLoop: vi.fn(),
        stopAutoLoop: vi.fn(),
        isRunning: vi.fn().mockReturnValue(false),
        getState: vi.fn().mockReturnValue(null),
        executeFeature: vi.fn(),
        stopFeature: vi.fn(),
        approvePlan: vi.fn(),
        rejectPlan: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      } as unknown as AutoModeService

      const handlers = new IPCHandlers(
        db,
        ptyManager,
        gitService,
        keychainService,
        mockAIService,
        mockRequestLogger,
        mockRunningProjectsService,
        mockGlobalProcessService,
        mockWorktreeService,
        mockDependencyManager,
        mockSessionService,
        mockReviewService,
        mockAgentService,
        mockAutoModeService
      )

      expect(handlers).toBeDefined()
    })
  })
})
