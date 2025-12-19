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
import type { AgentExecutorService } from '../services/agent-executor-service'
import type { AgentConfigService } from '../services/agent/agent-config-service'
import type { JulesService } from '../services/agent/jules-service'
import type { RequestLogger } from '../services/ai/request-logger'
import type { RunningProjectsService } from '../services/running-projects-service'
import type { AgentServiceV2 } from '../services/agent-service-v2'
import type { AutoModeServiceV2 } from '../services/auto-mode-service-v2'

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

    it('should accept optional agent executor service', () => {
      const mockAgentExecutor = {
        createTask: vi.fn(),
        getTask: vi.fn(),
        getTasks: vi.fn().mockReturnValue([]),
        updateTask: vi.fn(),
        deleteTask: vi.fn(),
        startTask: vi.fn(),
        pauseTask: vi.fn(),
        resumeTask: vi.fn(),
        stopTask: vi.fn(),
        getTaskOutput: vi.fn().mockReturnValue([]),
        subscribeToOutput: vi.fn().mockReturnValue(() => {}),
        getBacklogSize: vi.fn().mockReturnValue(0),
        reorderBacklog: vi.fn(),
      } as unknown as AgentExecutorService

      const handlers = new IPCHandlers(
        db,
        ptyManager,
        gitService,
        keychainService,
        undefined, // aiService
        mockAgentExecutor
      )

      expect(handlers).toBeDefined()
    })

    it('should accept optional agent config service', () => {
      const mockAgentConfig = {
        getConfig: vi.fn().mockResolvedValue({
          anthropicAuthToken: 'test-token',
          apiTimeoutMs: 30000,
          pythonPath: 'python',
          customEnvVars: {},
        }),
        setConfig: vi.fn(),
        validateConfig: vi.fn().mockReturnValue({ isValid: true, errors: [] }),
        isConfigured: vi.fn().mockResolvedValue(true),
        clearConfig: vi.fn(),
      } as unknown as AgentConfigService

      const handlers = new IPCHandlers(
        db,
        ptyManager,
        gitService,
        keychainService,
        undefined, // aiService
        undefined, // agentExecutorService
        mockAgentConfig
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
        undefined, // agentExecutorService
        undefined, // agentConfigService
        undefined, // julesService
        mockRequestLogger
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

      const mockAgentExecutor = {
        createTask: vi.fn(),
        getTask: vi.fn(),
        getTasks: vi.fn().mockReturnValue([]),
        updateTask: vi.fn(),
        deleteTask: vi.fn(),
        startTask: vi.fn(),
        pauseTask: vi.fn(),
        resumeTask: vi.fn(),
        stopTask: vi.fn(),
        getTaskOutput: vi.fn().mockReturnValue([]),
        subscribeToOutput: vi.fn().mockReturnValue(() => {}),
        getBacklogSize: vi.fn().mockReturnValue(0),
        reorderBacklog: vi.fn(),
      } as unknown as AgentExecutorService

      const mockAgentConfig = {
        getConfig: vi.fn().mockResolvedValue({
          anthropicAuthToken: 'test-token',
          apiTimeoutMs: 30000,
          pythonPath: 'python',
          customEnvVars: {},
        }),
        setConfig: vi.fn(),
        validateConfig: vi.fn().mockReturnValue({ isValid: true, errors: [] }),
        isConfigured: vi.fn().mockResolvedValue(true),
        clearConfig: vi.fn(),
      } as unknown as AgentConfigService

      const mockRequestLogger = {
        logRequest: vi.fn().mockReturnValue('log-id'),
        updateResponse: vi.fn(),
        logError: vi.fn(),
        getLogs: vi.fn().mockReturnValue([]),
        getLog: vi.fn().mockReturnValue(null),
        clearOldLogs: vi.fn().mockReturnValue(0),
        stopPeriodicCleanup: vi.fn(),
      } as unknown as RequestLogger

      const mockJulesService = {
        listSources: vi.fn().mockResolvedValue([]),
        createSession: vi.fn(),
        getSession: vi.fn(),
        listSessions: vi.fn().mockResolvedValue([]),
        approvePlan: vi.fn(),
        sendMessage: vi.fn(),
        listActivities: vi.fn().mockResolvedValue([]),
        activitiesToOutputLines: vi.fn().mockReturnValue([]),
      } as unknown as JulesService

      const mockRunningProjectsService = {} as unknown as RunningProjectsService
      const mockAgentServiceV2 = {} as unknown as AgentServiceV2
      const mockAutoModeServiceV2 = {} as unknown as AutoModeServiceV2

      const handlers = new IPCHandlers(
        db,
        ptyManager,
        gitService,
        keychainService,
        mockAIService,
        mockAgentExecutor,
        mockAgentConfig,
        mockJulesService,
        mockRequestLogger,
        mockRunningProjectsService,
        mockAgentServiceV2,
        mockAutoModeServiceV2
      )

      expect(handlers).toBeDefined()
    })
  })
})
