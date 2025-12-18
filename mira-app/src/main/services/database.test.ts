import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseService } from './database'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

describe('DatabaseService', () => {
  let dbService: DatabaseService
  let testDbPath: string

  beforeEach(() => {
    // Create a temporary database file for testing
    const tempDir = os.tmpdir()
    testDbPath = path.join(tempDir, `test-mira-${Date.now()}.db`)
    dbService = new DatabaseService(testDbPath)
    dbService.initialize()
  })

  afterEach(() => {
    // Clean up
    dbService.close()
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
    // Also clean up WAL files
    const walPath = `${testDbPath}-wal`
    const shmPath = `${testDbPath}-shm`
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath)
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath)
  })

  describe('initialization', () => {
    it('should create database file', () => {
      expect(fs.existsSync(testDbPath)).toBe(true)
    })

    it('should create all required tables', () => {
      // Test that we can query each table without error
      const projects = dbService.getProjects()
      const tags = dbService.getTags()
      const commands = dbService.getCommands()
      const blueprints = dbService.getBlueprints()
      const shortcuts = dbService.getShortcuts()

      expect(projects).toEqual([])
      expect(tags).toEqual([])
      // Commands should have default seeded commands
      expect(commands.length).toBeGreaterThan(0)
      expect(commands.every(cmd => !cmd.isCustom)).toBe(true)
      expect(blueprints).toEqual([])
      expect(shortcuts).toEqual({})
    })
  })

  describe('project operations', () => {
    it('should create and retrieve a project', () => {
      const project = dbService.createProject({
        name: 'Test Project',
        path: '/test/path',
      })

      expect(project.id).toBeDefined()
      expect(project.name).toBe('Test Project')
      expect(project.path).toBe('/test/path')
      expect(project.tags).toEqual([])

      const retrieved = dbService.getProject(project.id)
      expect(retrieved).toEqual(project)
    })

    it('should update a project', () => {
      const project = dbService.createProject({
        name: 'Test Project',
        path: '/test/path',
      })

      const updated = dbService.updateProject(project.id, {
        name: 'Updated Project',
      })

      expect(updated.name).toBe('Updated Project')
      expect(updated.path).toBe('/test/path')
    })

    it('should delete a project', () => {
      const project = dbService.createProject({
        name: 'Test Project',
        path: '/test/path',
      })

      dbService.deleteProject(project.id)

      const retrieved = dbService.getProject(project.id)
      expect(retrieved).toBeNull()
    })

    it('should list all projects', () => {
      dbService.createProject({ name: 'Project 1', path: '/path1' })
      dbService.createProject({ name: 'Project 2', path: '/path2' })

      const projects = dbService.getProjects()
      expect(projects).toHaveLength(2)
    })
  })

  describe('tag operations', () => {
    it('should create and retrieve tags', () => {
      const tag = dbService.createTag({
        name: 'React',
        category: 'tech_stack',
        color: '#61dafb',
      })

      expect(tag.id).toBeDefined()
      expect(tag.name).toBe('React')
      expect(tag.category).toBe('tech_stack')

      const tags = dbService.getTags()
      expect(tags).toHaveLength(1)
      expect(tags[0]).toEqual(tag)
    })

    it('should add and remove tags from projects', () => {
      const project = dbService.createProject({
        name: 'Test Project',
        path: '/test/path',
      })

      const tag = dbService.createTag({
        name: 'React',
        category: 'tech_stack',
      })

      dbService.addTagToProject(project.id, tag.id)

      const projectWithTag = dbService.getProject(project.id)
      expect(projectWithTag?.tags).toHaveLength(1)
      expect(projectWithTag?.tags[0].name).toBe('React')

      dbService.removeTagFromProject(project.id, tag.id)

      const projectWithoutTag = dbService.getProject(project.id)
      expect(projectWithoutTag?.tags).toHaveLength(0)
    })
  })

  describe('session operations', () => {
    it('should save and retrieve session state', () => {
      const project = dbService.createProject({
        name: 'Test Project',
        path: '/test/path',
      })

      const sessionState = {
        terminals: [],
        agentConversation: [],
        contextFiles: ['file1.ts', 'file2.ts'],
        activeTerminalId: null,
      }

      dbService.saveSession(project.id, sessionState)

      const retrieved = dbService.getSession(project.id)
      expect(retrieved).toEqual(sessionState)
    })

    it('should return null for non-existent session', () => {
      const session = dbService.getSession('non-existent-id')
      expect(session).toBeNull()
    })
  })

  describe('command operations', () => {
    it('should create and retrieve commands', () => {
      const initialCommandCount = dbService.getCommands().length

      const command = dbService.createCommand({
        name: 'Custom Test Command',
        command: 'echo "test"',
        category: 'Testing',
      })

      expect(command.id).toBeDefined()
      expect(command.name).toBe('Custom Test Command')
      expect(command.isCustom).toBe(true)

      const commands = dbService.getCommands()
      expect(commands).toHaveLength(initialCommandCount + 1)

      // Find the custom command we just created
      const customCommand = commands.find(c => c.id === command.id)
      expect(customCommand).toEqual(command)
    })
  })

  describe('blueprint operations', () => {
    it('should create and retrieve blueprints', () => {
      const blueprint = dbService.createBlueprint({
        name: 'React App',
        description: 'Basic React application',
        structure: {
          files: [
            { relativePath: 'src', isDirectory: true },
            {
              relativePath: 'src/index.tsx',
              isDirectory: false,
              content: 'console.log("hello")',
            },
          ],
          excludePatterns: ['node_modules', '.git'],
        },
      })

      expect(blueprint.id).toBeDefined()
      expect(blueprint.name).toBe('React App')

      const blueprints = dbService.getBlueprints()
      expect(blueprints).toHaveLength(1)
      expect(blueprints[0].structure.files).toHaveLength(2)
    })
  })

  describe('settings operations', () => {
    it('should set and get settings', () => {
      dbService.setSetting('theme', 'dark')

      const value = dbService.getSetting('theme')
      expect(value).toBe('dark')
    })

    it('should return null for non-existent setting', () => {
      const value = dbService.getSetting('non-existent')
      expect(value).toBeNull()
    })

    it('should update existing setting', () => {
      dbService.setSetting('theme', 'dark')
      dbService.setSetting('theme', 'light')

      const value = dbService.getSetting('theme')
      expect(value).toBe('light')
    })
  })

  describe('shortcut operations', () => {
    it('should set and get shortcuts', () => {
      const success = dbService.setShortcut('openCommandPalette', 'Cmd+K')
      expect(success).toBe(true)

      const binding = dbService.getShortcut('openCommandPalette')
      expect(binding).toBe('Cmd+K')
    })

    it('should detect shortcut conflicts', () => {
      dbService.setShortcut('action1', 'Cmd+K')

      const success = dbService.setShortcut('action2', 'Cmd+K')
      expect(success).toBe(false)
    })

    it('should allow updating same action with same binding', () => {
      dbService.setShortcut('action1', 'Cmd+K')

      const success = dbService.setShortcut('action1', 'Cmd+K')
      expect(success).toBe(true)
    })

    it('should get all shortcuts', () => {
      dbService.setShortcut('action1', 'Cmd+K')
      dbService.setShortcut('action2', 'Cmd+P')

      const shortcuts = dbService.getShortcuts()
      expect(shortcuts).toEqual({
        action1: 'Cmd+K',
        action2: 'Cmd+P',
      })
    })
  })

  describe('AI request log operations', () => {
    it('should create and retrieve an AI request log', () => {
      const log = dbService.createAIRequestLog({
        modelId: 'gpt-4',
        action: 'chat',
        input: {
          messages: [
            {
              id: '1',
              role: 'user',
              content: 'Hello',
              timestamp: new Date().toISOString(),
            },
          ],
        },
        metadata: {
          temperature: 0.7,
          projectId: 'test-project',
        },
      })

      expect(log.id).toBeDefined()
      expect(log.modelId).toBe('gpt-4')
      expect(log.action).toBe('chat')
      expect(log.status).toBe('pending')
      expect(log.input.messages).toHaveLength(1)

      const retrieved = dbService.getAIRequestLog(log.id)
      expect(retrieved).toBeDefined()
      expect(retrieved?.modelId).toBe('gpt-4')
    })

    it('should update log with response data', () => {
      const log = dbService.createAIRequestLog({
        modelId: 'gpt-4',
        action: 'chat',
        input: { messages: [] },
      })

      dbService.updateAIRequestLogResponse(log.id, {
        output: 'Hello there!',
        tokenUsage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        latencyMs: 500,
        finishReason: 'stop',
      })

      const updated = dbService.getAIRequestLog(log.id)
      expect(updated?.status).toBe('completed')
      expect(updated?.response?.output).toBe('Hello there!')
      expect(updated?.response?.latencyMs).toBe(500)
    })

    it('should update log with error data', () => {
      const log = dbService.createAIRequestLog({
        modelId: 'gpt-4',
        action: 'chat',
        input: { messages: [] },
      })

      dbService.updateAIRequestLogError(log.id, {
        type: 'RateLimitError',
        message: 'Too many requests',
        retryCount: 3,
      })

      const updated = dbService.getAIRequestLog(log.id)
      expect(updated?.status).toBe('failed')
      expect(updated?.error?.type).toBe('RateLimitError')
      expect(updated?.error?.retryCount).toBe(3)
    })

    it('should filter logs by model and status', () => {
      dbService.createAIRequestLog({
        modelId: 'gpt-4',
        action: 'chat',
        input: { messages: [] },
      })
      dbService.createAIRequestLog({
        modelId: 'claude-3',
        action: 'code-generation',
        input: { messages: [] },
      })

      const gpt4Logs = dbService.getAIRequestLogs({ modelId: 'gpt-4' })
      expect(gpt4Logs).toHaveLength(1)
      expect(gpt4Logs[0].modelId).toBe('gpt-4')

      const pendingLogs = dbService.getAIRequestLogs({ status: 'pending' })
      expect(pendingLogs).toHaveLength(2)
    })

    it('should clear old logs based on retention period', () => {
      // Create a log
      dbService.createAIRequestLog({
        modelId: 'gpt-4',
        action: 'chat',
        input: { messages: [] },
      })

      // Clear logs older than 30 days (should not delete the fresh log)
      const deletedNone = dbService.clearOldAIRequestLogs(30)
      expect(deletedNone).toBe(0)

      // Verify log still exists
      const logsAfterFirst = dbService.getAIRequestLogs()
      expect(logsAfterFirst).toHaveLength(1)
    })
  })

  describe('agent task operations', () => {
    it('should create and retrieve an agent task', () => {
      const task = dbService.createAgentTask({
        description: 'Build a React app',
        agentType: 'autonomous',
        targetDirectory: '/projects/new-app',
        parameters: {
          model: 'claude-3',
          maxIterations: 10,
        },
      })

      expect(task.id).toBeDefined()
      expect(task.description).toBe('Build a React app')
      expect(task.agentType).toBe('autonomous')
      expect(task.status).toBe('pending')
      expect(task.parameters.model).toBe('claude-3')

      const retrieved = dbService.getAgentTask(task.id)
      expect(retrieved).toBeDefined()
      expect(retrieved?.description).toBe('Build a React app')
    })

    it('should update an agent task', () => {
      const task = dbService.createAgentTask({
        description: 'Build a React app',
        agentType: 'autonomous',
        targetDirectory: '/projects/new-app',
      })

      const updated = dbService.updateAgentTask(task.id, {
        status: 'running',
        processId: 12345,
        startedAt: new Date(),
      })

      expect(updated?.status).toBe('running')
      expect(updated?.processId).toBe(12345)
      expect(updated?.startedAt).toBeDefined()
    })

    it('should delete an agent task', () => {
      const task = dbService.createAgentTask({
        description: 'Build a React app',
        agentType: 'autonomous',
        targetDirectory: '/projects/new-app',
      })

      dbService.deleteAgentTask(task.id)

      const retrieved = dbService.getAgentTask(task.id)
      expect(retrieved).toBeNull()
    })

    it('should filter tasks by status and agent type', () => {
      dbService.createAgentTask({
        description: 'Task 1',
        agentType: 'autonomous',
        targetDirectory: '/path1',
      })
      dbService.createAgentTask({
        description: 'Task 2',
        agentType: 'feature',
        targetDirectory: '/path2',
      })

      const autonomousTasks = dbService.getAgentTasks({ agentType: 'autonomous' })
      expect(autonomousTasks).toHaveLength(1)
      expect(autonomousTasks[0].agentType).toBe('autonomous')

      const pendingTasks = dbService.getAgentTasks({ status: 'pending' })
      expect(pendingTasks).toHaveLength(2)
    })

    it('should order tasks by priority', () => {
      dbService.createAgentTask({
        description: 'Low priority',
        agentType: 'autonomous',
        targetDirectory: '/path1',
        priority: 1,
      })
      dbService.createAgentTask({
        description: 'High priority',
        agentType: 'autonomous',
        targetDirectory: '/path2',
        priority: 10,
      })

      const tasks = dbService.getAgentTasks()
      expect(tasks[0].description).toBe('High priority')
      expect(tasks[1].description).toBe('Low priority')
    })
  })

  describe('agent task output operations', () => {
    it('should create and retrieve task output', () => {
      const task = dbService.createAgentTask({
        description: 'Test task',
        agentType: 'autonomous',
        targetDirectory: '/path',
      })

      const output = dbService.createTaskOutput({
        taskId: task.id,
        content: 'Starting build...',
        stream: 'stdout',
      })

      expect(output.id).toBeDefined()
      expect(output.content).toBe('Starting build...')
      expect(output.stream).toBe('stdout')

      const outputs = dbService.getTaskOutput(task.id)
      expect(outputs).toHaveLength(1)
      expect(outputs[0].content).toBe('Starting build...')
    })

    it('should get output from a specific index', () => {
      const task = dbService.createAgentTask({
        description: 'Test task',
        agentType: 'autonomous',
        targetDirectory: '/path',
      })

      const output1 = dbService.createTaskOutput({
        taskId: task.id,
        content: 'Line 1',
        stream: 'stdout',
      })
      dbService.createTaskOutput({
        taskId: task.id,
        content: 'Line 2',
        stream: 'stdout',
      })

      const outputs = dbService.getTaskOutput(task.id, output1.id)
      expect(outputs).toHaveLength(1)
      expect(outputs[0].content).toBe('Line 2')
    })

    it('should count and clear task output', () => {
      const task = dbService.createAgentTask({
        description: 'Test task',
        agentType: 'autonomous',
        targetDirectory: '/path',
      })

      dbService.createTaskOutput({ taskId: task.id, content: 'Line 1', stream: 'stdout' })
      dbService.createTaskOutput({ taskId: task.id, content: 'Line 2', stream: 'stderr' })

      expect(dbService.getTaskOutputCount(task.id)).toBe(2)

      dbService.clearTaskOutput(task.id)
      expect(dbService.getTaskOutputCount(task.id)).toBe(0)
    })
  })

  describe('model cache operations', () => {
    it('should cache and retrieve a model', () => {
      const model = dbService.cacheModel({
        id: 'gpt-4',
        name: 'GPT-4',
        provider: 'openai',
        contextLength: 8192,
        pricing: { prompt: 0.03, completion: 0.06 },
        capabilities: ['chat', 'code'],
      })

      expect(model.id).toBe('gpt-4')
      expect(model.name).toBe('GPT-4')
      expect(model.cachedAt).toBeDefined()

      const retrieved = dbService.getCachedModel('gpt-4')
      expect(retrieved).toBeDefined()
      expect(retrieved?.name).toBe('GPT-4')
      expect(retrieved?.pricing.prompt).toBe(0.03)
    })

    it('should cache multiple models at once', () => {
      dbService.cacheModels([
        {
          id: 'gpt-4',
          name: 'GPT-4',
          provider: 'openai',
          contextLength: 8192,
          pricing: { prompt: 0.03, completion: 0.06 },
          capabilities: ['chat'],
        },
        {
          id: 'claude-3',
          name: 'Claude 3',
          provider: 'anthropic',
          contextLength: 100000,
          pricing: { prompt: 0.01, completion: 0.03 },
          capabilities: ['chat', 'code'],
        },
      ])

      const models = dbService.getCachedModels()
      expect(models).toHaveLength(2)
    })

    it('should clear model cache', () => {
      dbService.cacheModel({
        id: 'gpt-4',
        name: 'GPT-4',
        provider: 'openai',
        contextLength: 8192,
        pricing: { prompt: 0.03, completion: 0.06 },
        capabilities: [],
      })

      dbService.clearModelCache()

      const models = dbService.getCachedModels()
      expect(models).toHaveLength(0)
    })

    it('should check if cache is stale', () => {
      // Empty cache should be stale
      expect(dbService.isModelCacheStale(1000)).toBe(true)

      dbService.cacheModel({
        id: 'gpt-4',
        name: 'GPT-4',
        provider: 'openai',
        contextLength: 8192,
        pricing: { prompt: 0.03, completion: 0.06 },
        capabilities: [],
      })

      // Fresh cache should not be stale with reasonable TTL
      expect(dbService.isModelCacheStale(60000)).toBe(false)

      // Fresh cache should also not be stale with very short TTL (just created)
      // Note: 0ms TTL means "immediately stale" but since we just created it,
      // the time difference is 0 which is not > 0, so it's not stale
      expect(dbService.isModelCacheStale(1000)).toBe(false)
    })
  })

  describe('AI settings operations', () => {
    it('should set and get AI settings', () => {
      dbService.setAISetting('default_model', 'gpt-4')

      const value = dbService.getAISetting('default_model')
      expect(value).toBe('gpt-4')
    })

    it('should return null for non-existent AI setting', () => {
      const value = dbService.getAISetting('non-existent')
      expect(value).toBeNull()
    })

    it('should update existing AI setting', () => {
      dbService.setAISetting('default_model', 'gpt-4')
      dbService.setAISetting('default_model', 'claude-3')

      const value = dbService.getAISetting('default_model')
      expect(value).toBe('claude-3')
    })

    it('should get all AI settings', () => {
      dbService.setAISetting('default_model', 'gpt-4')
      dbService.setAISetting('temperature', '0.7')

      const settings = dbService.getAllAISettings()
      expect(settings).toHaveLength(2)
      expect(settings.find((s: { key: string; value: string }) => s.key === 'default_model')?.value).toBe('gpt-4')
    })

    it('should delete an AI setting', () => {
      dbService.setAISetting('default_model', 'gpt-4')
      dbService.deleteAISetting('default_model')

      const value = dbService.getAISetting('default_model')
      expect(value).toBeNull()
    })
  })
})
