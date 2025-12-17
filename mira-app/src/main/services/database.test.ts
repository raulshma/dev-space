import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseService } from './database'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

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
      expect(commands.every((cmd) => !cmd.isCustom)).toBe(true)
      expect(blueprints).toEqual([])
      expect(shortcuts).toEqual({})
    })
  })

  describe('project operations', () => {
    it('should create and retrieve a project', () => {
      const project = dbService.createProject({
        name: 'Test Project',
        path: '/test/path'
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
        path: '/test/path'
      })

      const updated = dbService.updateProject(project.id, {
        name: 'Updated Project'
      })

      expect(updated.name).toBe('Updated Project')
      expect(updated.path).toBe('/test/path')
    })

    it('should delete a project', () => {
      const project = dbService.createProject({
        name: 'Test Project',
        path: '/test/path'
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
        color: '#61dafb'
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
        path: '/test/path'
      })

      const tag = dbService.createTag({
        name: 'React',
        category: 'tech_stack'
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
        path: '/test/path'
      })

      const sessionState = {
        terminals: [],
        agentConversation: [],
        contextFiles: ['file1.ts', 'file2.ts'],
        activeTerminalId: null
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
        category: 'Testing'
      })

      expect(command.id).toBeDefined()
      expect(command.name).toBe('Custom Test Command')
      expect(command.isCustom).toBe(true)

      const commands = dbService.getCommands()
      expect(commands).toHaveLength(initialCommandCount + 1)

      // Find the custom command we just created
      const customCommand = commands.find((c) => c.id === command.id)
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
            { relativePath: 'src/index.tsx', isDirectory: false, content: 'console.log("hello")' }
          ],
          excludePatterns: ['node_modules', '.git']
        }
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
        action2: 'Cmd+P'
      })
    })
  })
})
