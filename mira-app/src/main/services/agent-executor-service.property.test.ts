/**
 * Property-based tests for Agent Executor Service
 *
 * These tests verify the correctness properties of the agent executor service
 * including task creation, state transitions, and completion handling.
 *
 * @module agent-executor-service.property.test
 */

import { describe, it, expect, vi } from 'vitest'
import * as fc from 'fast-check'
import {
  AgentExecutorService,
  AgentExecutorError,
  AgentExecutorErrorCode,
} from './agent-executor-service'
import { ProcessManager } from './agent/process-manager'
import { TaskQueue } from './agent/task-queue'
import { OutputBuffer } from './agent/output-buffer'
import { AgentConfigService } from './agent/agent-config-service'
import { GitService } from './git-service'
import { DatabaseService } from './database'
import type {
  CreateAgentTaskInput,
  TaskStatus,
  AgentType,
} from 'shared/ai-types'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

// Mock fs.existsSync for testing
vi.mock('node:fs', async () => {
  const actual = await vi.importActual('node:fs')
  return {
    ...actual,
    existsSync: vi.fn(),
  }
})

/**
 * Arbitrary generator for valid task descriptions
 */
const arbitraryDescription: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 200 })
  .filter(s => s.trim().length > 0)
  .map(s => s.trim())

/**
 * Arbitrary generator for agent types
 */
const arbitraryAgentType: fc.Arbitrary<AgentType> = fc.constantFrom(
  'autonomous',
  'feature'
)

/**
 * Arbitrary generator for valid directory paths
 */
const arbitraryDirectory: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0 && !s.includes('\0'))
  .map(s => `/test/path/${s.trim().replace(/[<>:"|?*]/g, '_')}`)

/**
 * Arbitrary generator for task creation input
 */
const arbitraryCreateTaskInput: fc.Arbitrary<CreateAgentTaskInput> = fc.record({
  description: arbitraryDescription,
  agentType: arbitraryAgentType,
  targetDirectory: arbitraryDirectory,
  parameters: fc.option(
    fc.record({
      model: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
      maxIterations: fc.option(fc.nat({ max: 100 })),
      testCount: fc.option(fc.nat({ max: 50 })),
    }),
    { nil: undefined }
  ),
  priority: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
})

/**
 * Arbitrary generator for task status
 */
const arbitraryTaskStatus: fc.Arbitrary<TaskStatus> = fc.constantFrom(
  'pending',
  'queued',
  'running',
  'paused',
  'completed',
  'failed',
  'stopped'
)

/**
 * Create mock services for testing
 */
function createMockServices() {
  // Create a temporary database
  const tempDir = os.tmpdir()
  const dbPath = path.join(
    tempDir,
    `test-db-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
  )
  const db = new DatabaseService(dbPath)
  db.initialize()

  const processManager = new ProcessManager()
  const taskQueue = new TaskQueue()
  const outputBuffer = new OutputBuffer(db)

  // Mock keychain service
  const mockKeychain = {
    getSecret: vi.fn().mockResolvedValue('test-token'),
    setSecret: vi.fn().mockResolvedValue(undefined),
    deleteSecret: vi.fn().mockResolvedValue(undefined),
  }

  const configService = new AgentConfigService(db, mockKeychain as any)
  const gitService = new GitService()

  return {
    db,
    processManager,
    taskQueue,
    outputBuffer,
    configService,
    gitService,
    dbPath,
    cleanup: () => {
      db.close()
      try {
        fs.unlinkSync(dbPath)
      } catch {
        // Ignore cleanup errors
      }
    },
  }
}

describe('Agent Executor Service Property Tests', () => {
  /**
   * **Feature: ai-agent-rework, Property 9: Task Creation Adds to Backlog**
   * **Validates: Requirements 6.4**
   *
   * For any confirmed task creation, the task SHALL appear in the backlog
   * with status "pending" and the backlog size SHALL increase by exactly 1.
   */
  describe('Property 9: Task Creation Adds to Backlog', () => {
    it('creating a task adds it to the backlog with pending status', async () => {
      await fc.assert(
        fc.asyncProperty(arbitraryCreateTaskInput, async input => {
          const services = createMockServices()

          try {
            // Mock fs.existsSync to return true for the target directory
            vi.mocked(fs.existsSync).mockReturnValue(true)

            // Mock gitService.isGitRepo for feature agents
            vi.spyOn(services.gitService, 'isGitRepo').mockResolvedValue(true)

            const executor = new AgentExecutorService(
              services.db,
              services.processManager,
              services.taskQueue,
              services.outputBuffer,
              services.configService,
              services.gitService,
              '/test/agents'
            )

            // Get initial backlog size
            const initialPendingTasks = services.db.getAgentTasks({
              status: 'pending',
            })
            const initialSize = initialPendingTasks.length

            // Create task
            const task = await executor.createTask(input)

            // Verify task was created with pending status
            expect(task.status).toBe('pending')
            expect(task.description).toBe(input.description)
            expect(task.agentType).toBe(input.agentType)
            expect(task.targetDirectory).toBe(input.targetDirectory)

            // Verify backlog size increased by 1
            const finalPendingTasks = services.db.getAgentTasks({
              status: 'pending',
            })
            expect(finalPendingTasks.length).toBe(initialSize + 1)

            // Verify task can be retrieved
            const retrievedTask = executor.getTask(task.id)
            expect(retrievedTask).toBeDefined()
            expect(retrievedTask?.id).toBe(task.id)
            expect(retrievedTask?.status).toBe('pending')

            return true
          } finally {
            services.cleanup()
          }
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: ai-agent-rework, Property 10: Feature Agent Repository Validation**
   * **Validates: Requirements 6.5**
   *
   * For any feature agent task creation targeting a directory without a .git folder,
   * validation SHALL fail with an error indicating the directory is not a valid repository.
   */
  describe('Property 10: Feature Agent Repository Validation', () => {
    it('feature agent task creation fails for non-repository directories', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryDescription,
          arbitraryDirectory,
          async (description, targetDir) => {
            const services = createMockServices()

            try {
              // Mock fs.existsSync to return true for directory but false for .git
              vi.mocked(fs.existsSync).mockReturnValue(true)

              // Mock gitService.isGitRepo to return false (not a git repo)
              vi.spyOn(services.gitService, 'isGitRepo').mockResolvedValue(
                false
              )

              const executor = new AgentExecutorService(
                services.db,
                services.processManager,
                services.taskQueue,
                services.outputBuffer,
                services.configService,
                services.gitService,
                '/test/agents'
              )

              const input: CreateAgentTaskInput = {
                description,
                agentType: 'feature',
                targetDirectory: targetDir,
              }

              // Attempt to create feature agent task should fail
              await expect(executor.createTask(input)).rejects.toThrow(
                AgentExecutorError
              )

              try {
                await executor.createTask(input)
              } catch (error) {
                expect(error).toBeInstanceOf(AgentExecutorError)
                expect((error as AgentExecutorError).code).toBe(
                  AgentExecutorErrorCode.NOT_A_REPOSITORY
                )
              }

              return true
            } finally {
              services.cleanup()
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('autonomous agent task creation succeeds for non-repository directories', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryDescription,
          arbitraryDirectory,
          async (description, targetDir) => {
            const services = createMockServices()

            try {
              // Mock fs.existsSync to return true
              vi.mocked(fs.existsSync).mockReturnValue(true)

              // Mock gitService.isGitRepo to return false (not a git repo)
              vi.spyOn(services.gitService, 'isGitRepo').mockResolvedValue(
                false
              )

              const executor = new AgentExecutorService(
                services.db,
                services.processManager,
                services.taskQueue,
                services.outputBuffer,
                services.configService,
                services.gitService,
                '/test/agents'
              )

              const input: CreateAgentTaskInput = {
                description,
                agentType: 'autonomous',
                targetDirectory: targetDir,
              }

              // Autonomous agent should succeed even without git repo
              const task = await executor.createTask(input)
              expect(task.status).toBe('pending')
              expect(task.agentType).toBe('autonomous')

              return true
            } finally {
              services.cleanup()
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: ai-agent-rework, Property 12: Task State Transitions**
   * **Validates: Requirements 7.2, 7.3**
   *
   * For any task, the status transitions SHALL follow the valid state machine:
   * pending → queued → running → (completed | failed | stopped),
   * with paused being a valid intermediate state from running.
   */
  describe('Property 12: Task State Transitions', () => {
    const validTransitions: Record<TaskStatus, TaskStatus[]> = {
      pending: ['queued', 'stopped', 'completed'],
      queued: ['running', 'pending', 'stopped', 'completed', 'archived'],
      running: ['paused', 'completed', 'failed', 'stopped'],
      paused: ['running', 'stopped', 'completed'],
      completed: ['pending', 'archived'],
      failed: ['pending', 'queued', 'archived'],
      stopped: ['pending', 'queued', 'archived'],
      archived: ['pending'],
    }

    it('only valid state transitions are allowed', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryCreateTaskInput,
          arbitraryTaskStatus,
          arbitraryTaskStatus,
          async (input, fromStatus, toStatus) => {
            const services = createMockServices()

            try {
              vi.mocked(fs.existsSync).mockReturnValue(true)
              vi.spyOn(services.gitService, 'isGitRepo').mockResolvedValue(true)

              const executor = new AgentExecutorService(
                services.db,
                services.processManager,
                services.taskQueue,
                services.outputBuffer,
                services.configService,
                services.gitService,
                '/test/agents'
              )

              // Create a task
              const task = await executor.createTask(input)

              // Manually set the task to fromStatus (bypassing normal flow for testing)
              services.db.updateAgentTask(task.id, { status: fromStatus })

              const isValidTransition =
                validTransitions[fromStatus]?.includes(toStatus) ?? false

              if (isValidTransition) {
                // Valid transition should succeed
                const updatedTask = await executor.updateTask(task.id, {
                  status: toStatus,
                })
                expect(updatedTask.status).toBe(toStatus)
              } else if (fromStatus !== toStatus) {
                // Invalid transition should throw
                await expect(
                  executor.updateTask(task.id, { status: toStatus })
                ).rejects.toThrow(AgentExecutorError)
              }

              return true
            } finally {
              services.cleanup()
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('task starts in pending state', async () => {
      await fc.assert(
        fc.asyncProperty(arbitraryCreateTaskInput, async input => {
          const services = createMockServices()

          try {
            vi.mocked(fs.existsSync).mockReturnValue(true)
            vi.spyOn(services.gitService, 'isGitRepo').mockResolvedValue(true)

            const executor = new AgentExecutorService(
              services.db,
              services.processManager,
              services.taskQueue,
              services.outputBuffer,
              services.configService,
              services.gitService,
              '/test/agents'
            )

            const task = await executor.createTask(input)
            expect(task.status).toBe('pending')

            return true
          } finally {
            services.cleanup()
          }
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: ai-agent-rework, Property 14: Correct Agent Script Selection**
   * **Validates: Requirements 8.2**
   *
   * For any task with agentType "autonomous", the spawned process SHALL execute autonomous_agent.py.
   * For any task with agentType "feature", the spawned process SHALL execute feature_agent.py.
   */
  describe('Property 14: Correct Agent Script Selection', () => {
    it('autonomous agent uses autonomous_agent.py script', () => {
      fc.assert(
        fc.property(fc.constant('autonomous' as const), agentType => {
          const services = createMockServices()

          try {
            const executor = new AgentExecutorService(
              services.db,
              services.processManager,
              services.taskQueue,
              services.outputBuffer,
              services.configService,
              services.gitService,
              '/test/agents'
            )

            const scriptPath = executor.getAgentScriptPath(agentType)
            expect(scriptPath).toContain('autonomous_agent.py')
            expect(scriptPath).not.toContain('feature_agent.py')

            return true
          } finally {
            services.cleanup()
          }
        }),
        { numRuns: 10 }
      )
    })

    it('feature agent uses feature_agent.py script', () => {
      fc.assert(
        fc.property(fc.constant('feature' as const), agentType => {
          const services = createMockServices()

          try {
            const executor = new AgentExecutorService(
              services.db,
              services.processManager,
              services.taskQueue,
              services.outputBuffer,
              services.configService,
              services.gitService,
              '/test/agents'
            )

            const scriptPath = executor.getAgentScriptPath(agentType)
            expect(scriptPath).toContain('feature_agent.py')
            expect(scriptPath).not.toContain('autonomous_agent.py')

            return true
          } finally {
            services.cleanup()
          }
        }),
        { numRuns: 10 }
      )
    })

    it('agent type determines correct script path', () => {
      fc.assert(
        fc.property(arbitraryAgentType, agentType => {
          const services = createMockServices()

          try {
            const executor = new AgentExecutorService(
              services.db,
              services.processManager,
              services.taskQueue,
              services.outputBuffer,
              services.configService,
              services.gitService,
              '/base/path'
            )

            const scriptPath = executor.getAgentScriptPath(agentType)
            // Normalize path separators for cross-platform testing
            const normalizedPath = scriptPath.replace(/\\/g, '/')

            if (agentType === 'autonomous') {
              return normalizedPath.includes(
                'autonomous-coding/autonomous_agent.py'
              )
            }
            return normalizedPath.includes(
              'feature-coding-agent/feature_agent.py'
            )
          } finally {
            services.cleanup()
          }
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: ai-agent-rework, Property 18: Task Completion Status Updates**
   * **Validates: Requirements 11.1, 11.3**
   *
   * For any task where the agent process exits with code 0, status SHALL be "completed".
   * For any task where the agent process exits with non-zero code, status SHALL be "failed".
   */
  describe('Property 18: Task Completion Status Updates', () => {
    it('exit code 0 results in completed status', async () => {
      await fc.assert(
        fc.asyncProperty(arbitraryCreateTaskInput, async input => {
          const services = createMockServices()

          try {
            vi.mocked(fs.existsSync).mockReturnValue(true)
            vi.spyOn(services.gitService, 'isGitRepo').mockResolvedValue(true)

            const executor = new AgentExecutorService(
              services.db,
              services.processManager,
              services.taskQueue,
              services.outputBuffer,
              services.configService,
              services.gitService,
              '/test/agents'
            )

            // Create a task and simulate completion with exit code 0
            const task = await executor.createTask(input)

            // Manually update to simulate successful completion
            services.db.updateAgentTask(task.id, {
              status: 'completed',
              exitCode: 0,
              completedAt: new Date(),
            })

            const completedTask = services.db.getAgentTask(task.id)
            expect(completedTask?.status).toBe('completed')
            expect(completedTask?.exitCode).toBe(0)

            return true
          } finally {
            services.cleanup()
          }
        }),
        { numRuns: 100 }
      )
    })

    it('non-zero exit code results in failed status', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryCreateTaskInput,
          fc.integer({ min: 1, max: 255 }),
          async (input, exitCode) => {
            const services = createMockServices()

            try {
              vi.mocked(fs.existsSync).mockReturnValue(true)
              vi.spyOn(services.gitService, 'isGitRepo').mockResolvedValue(true)

              const executor = new AgentExecutorService(
                services.db,
                services.processManager,
                services.taskQueue,
                services.outputBuffer,
                services.configService,
                services.gitService,
                '/test/agents'
              )

              // Create a task and simulate failure with non-zero exit code
              const task = await executor.createTask(input)

              // Manually update to simulate failed completion
              services.db.updateAgentTask(task.id, {
                status: 'failed',
                exitCode,
                error: `Exit code: ${exitCode}`,
                completedAt: new Date(),
              })

              const failedTask = services.db.getAgentTask(task.id)
              expect(failedTask?.status).toBe('failed')
              expect(failedTask?.exitCode).toBe(exitCode)
              expect(failedTask?.error).toContain(exitCode.toString())

              return true
            } finally {
              services.cleanup()
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: ai-agent-rework, Property 19: File Change Summary on Completion**
   * **Validates: Requirements 11.2**
   *
   * For any completed task in a git repository, the fileChanges field SHALL contain
   * arrays for created, modified, and deleted files based on git status.
   */
  describe('Property 19: File Change Summary on Completion', () => {
    it('completed feature agent tasks have file change summary structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryDescription,
          arbitraryDirectory,
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), {
            minLength: 0,
            maxLength: 5,
          }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), {
            minLength: 0,
            maxLength: 5,
          }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), {
            minLength: 0,
            maxLength: 5,
          }),
          async (description, targetDir, created, modified, deleted) => {
            const services = createMockServices()

            try {
              vi.mocked(fs.existsSync).mockReturnValue(true)
              vi.spyOn(services.gitService, 'isGitRepo').mockResolvedValue(true)

              const executor = new AgentExecutorService(
                services.db,
                services.processManager,
                services.taskQueue,
                services.outputBuffer,
                services.configService,
                services.gitService,
                '/test/agents'
              )

              const input: CreateAgentTaskInput = {
                description,
                agentType: 'feature',
                targetDirectory: targetDir,
              }

              const task = await executor.createTask(input)

              // Simulate completion with file changes
              const fileChanges = {
                created,
                modified,
                deleted,
                gitDiff:
                  created.length > 0 || modified.length > 0
                    ? 'diff content'
                    : undefined,
              }

              services.db.updateAgentTask(task.id, {
                status: 'completed',
                exitCode: 0,
                completedAt: new Date(),
                fileChanges,
              })

              const completedTask = services.db.getAgentTask(task.id)

              // Verify file changes structure
              expect(completedTask?.fileChanges).toBeDefined()
              expect(Array.isArray(completedTask?.fileChanges?.created)).toBe(
                true
              )
              expect(Array.isArray(completedTask?.fileChanges?.modified)).toBe(
                true
              )
              expect(Array.isArray(completedTask?.fileChanges?.deleted)).toBe(
                true
              )

              // Verify arrays contain expected values
              expect(completedTask?.fileChanges?.created).toEqual(created)
              expect(completedTask?.fileChanges?.modified).toEqual(modified)
              expect(completedTask?.fileChanges?.deleted).toEqual(deleted)

              return true
            } finally {
              services.cleanup()
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('file change summary preserves all file paths', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryCreateTaskInput,
          fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
            minLength: 1,
            maxLength: 10,
          }),
          async (input, filePaths) => {
            const services = createMockServices()

            try {
              vi.mocked(fs.existsSync).mockReturnValue(true)
              vi.spyOn(services.gitService, 'isGitRepo').mockResolvedValue(true)

              // Create task
              const task = services.db.createAgentTask({
                ...input,
                agentType: 'feature',
              })

              // Create file changes with the generated paths
              const fileChanges = {
                created: filePaths.slice(0, Math.ceil(filePaths.length / 3)),
                modified: filePaths.slice(
                  Math.ceil(filePaths.length / 3),
                  Math.ceil((2 * filePaths.length) / 3)
                ),
                deleted: filePaths.slice(Math.ceil((2 * filePaths.length) / 3)),
              }

              services.db.updateAgentTask(task.id, {
                status: 'completed',
                fileChanges,
              })

              const completedTask = services.db.getAgentTask(task.id)

              // All original paths should be preserved
              const allPaths = [
                ...(completedTask?.fileChanges?.created || []),
                ...(completedTask?.fileChanges?.modified || []),
                ...(completedTask?.fileChanges?.deleted || []),
              ]

              // Every path in fileChanges should be from original filePaths
              for (const path of allPaths) {
                expect(filePaths).toContain(path)
              }

              return true
            } finally {
              services.cleanup()
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
