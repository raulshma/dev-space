import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { AgentExecutorService } from './agent-executor-service'
import { ProcessManager } from './agent/process-manager'
import { TaskQueue } from './agent/task-queue'
import { OutputBuffer } from './agent/output-buffer'
import { AgentConfigService } from './agent/agent-config-service'
import { GitService } from './git-service'
import { DatabaseService } from './database'
import type { PlanSpec } from 'shared/ai-types'

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
  return {
    ...actual,
    existsSync: vi.fn(),
  }
})

describe('AgentExecutorService plan approval workflow', () => {
  let db: DatabaseService
  let dbPath: string

  beforeEach(() => {
    dbPath = path.join(
      os.tmpdir(),
      `test-db-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
    )
    db = new DatabaseService(dbPath)
    db.initialize()

    vi.mocked(fs.existsSync).mockReturnValue(true)
  })

  afterEach(() => {
    db.close()
    try {
      fs.unlinkSync(dbPath)
    } catch {
      // ignore
    }
  })

  function createExecutor() {
    const processManager = new ProcessManager()
    const taskQueue = new TaskQueue()
    const outputBuffer = new OutputBuffer(db)

    const mockKeychain = {
      getSecret: vi.fn().mockResolvedValue('test-token'),
      setSecret: vi.fn().mockResolvedValue(undefined),
      deleteSecret: vi.fn().mockResolvedValue(undefined),
    }

    const configService = new AgentConfigService(db, mockKeychain as any)
    const gitService = new GitService()

    return {
      executor: new AgentExecutorService(
        db,
        processManager,
        taskQueue,
        outputBuffer,
        configService,
        gitService
      ),
      taskQueue,
    }
  }

  it('approvePlan transitions awaiting_approval -> queued and enqueues continuation', async () => {
    const { executor, taskQueue } = createExecutor()

    const task = await executor.createTask({
      description: 'Generate a plan and implement it',
      agentType: 'autonomous',
      targetDirectory: 'C:/test/path/project',
    })

    const planSpec: PlanSpec = {
      status: 'generated',
      version: 1,
      generatedAt: new Date(),
      content: '...plan content...\n[SPEC_GENERATED] ...',
      tasks: [
        { id: 'T001', description: 'Do thing', status: 'pending' },
        { id: 'T002', description: 'Do next thing', status: 'pending' },
      ],
    }

    db.updateAgentTask(task.id, {
      status: 'awaiting_approval',
      planSpec,
      requirePlanApproval: true,
    })

    const updated = await executor.approvePlan(task.id)

    expect(updated.status).toBe('queued')
    expect(updated.planSpec?.status).toBe('approved')
    expect(updated.parameters.continuationMode).toBe('post-approval')
    expect(updated.parameters.approvedPlanContent).toBe(planSpec.content)
    expect(updated.parameters.useMultiTaskExecution).toBe(true)

    expect(taskQueue.contains(task.id)).toBe(true)
  })

  it('rejectPlan transitions awaiting_approval -> queued and enqueues revision', async () => {
    const { executor, taskQueue } = createExecutor()

    const task = await executor.createTask({
      description: 'Generate a plan and implement it',
      agentType: 'autonomous',
      targetDirectory: 'C:/test/path/project',
    })

    const planSpec: PlanSpec = {
      status: 'generated',
      version: 3,
      generatedAt: new Date(),
      content: '...original plan content...\n[SPEC_GENERATED] ...',
      tasks: [{ id: 'T001', description: 'Do thing', status: 'pending' }],
    }

    db.updateAgentTask(task.id, {
      status: 'awaiting_approval',
      planSpec,
      requirePlanApproval: true,
    })

    const feedback = 'Please split the tasks and add tests.'
    const updated = await executor.rejectPlan(task.id, feedback)

    expect(updated.status).toBe('queued')
    expect(updated.planSpec?.status).toBe('rejected')
    expect(updated.planSpec?.feedback).toBe(feedback)
    expect(updated.planSpec?.version).toBe(4)

    expect(updated.parameters.continuationMode).toBe('plan-revision')
    expect(updated.parameters.previousPlanContent).toBe(planSpec.content)
    expect(updated.parameters.rejectionFeedback).toBe(feedback)

    expect(taskQueue.contains(task.id)).toBe(true)
  })
})
