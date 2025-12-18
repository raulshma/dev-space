/**
 * Unit tests for Agent Task Store
 * Requirements: 7.1, 9.2
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useAgentTaskStore } from './agent-task-store'
import type { AgentTask, OutputLine } from 'shared/ai-types'

describe('AgentTaskStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAgentTaskStore.setState({
      tasks: new Map(),
      taskOrder: [],
      isLoadingTasks: false,
      tasksError: null,
      currentTaskId: null,
      selectedTaskId: null,
      outputBuffers: new Map(),
      isAutoScrollEnabled: true,
      subscribedTaskIds: new Set(),
    })
  })

  const createMockTask = (overrides: Partial<AgentTask> = {}): AgentTask => ({
    id: 'task-1',
    description: 'Test task',
    agentType: 'feature',
    targetDirectory: '/test/dir',
    parameters: {},
    status: 'pending',
    priority: 1,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  })

  describe('Task Management', () => {
    it('should set tasks and maintain order by priority', () => {
      const { setTasks } = useAgentTaskStore.getState()

      const tasks: AgentTask[] = [
        createMockTask({ id: 'task-1', priority: 1 }),
        createMockTask({ id: 'task-2', priority: 3 }),
        createMockTask({ id: 'task-3', priority: 2 }),
      ]

      setTasks(tasks)

      const state = useAgentTaskStore.getState()
      expect(state.tasks.size).toBe(3)
      // Should be ordered by priority (highest first)
      expect(state.taskOrder).toEqual(['task-2', 'task-3', 'task-1'])
    })

    it('should add task at correct position based on priority', () => {
      const { setTasks, addTask } = useAgentTaskStore.getState()

      setTasks([
        createMockTask({ id: 'task-1', priority: 1 }),
        createMockTask({ id: 'task-3', priority: 3 }),
      ])

      addTask(createMockTask({ id: 'task-2', priority: 2 }))

      const state = useAgentTaskStore.getState()
      expect(state.taskOrder).toEqual(['task-3', 'task-2', 'task-1'])
    })

    it('should update task', () => {
      const { setTasks, updateTask } = useAgentTaskStore.getState()

      setTasks([createMockTask({ id: 'task-1', status: 'pending' })])

      updateTask('task-1', { status: 'running' })

      const task = useAgentTaskStore.getState().tasks.get('task-1')
      expect(task?.status).toBe('running')
    })

    it('should set currentTaskId when task starts running', () => {
      const { setTasks, updateTask } = useAgentTaskStore.getState()

      setTasks([createMockTask({ id: 'task-1', status: 'pending' })])

      updateTask('task-1', { status: 'running' })

      expect(useAgentTaskStore.getState().currentTaskId).toBe('task-1')
    })

    it('should clear currentTaskId when task completes', () => {
      const { setTasks, updateTask, setCurrentTask } =
        useAgentTaskStore.getState()

      setTasks([createMockTask({ id: 'task-1', status: 'running' })])
      setCurrentTask('task-1')

      updateTask('task-1', { status: 'completed' })

      expect(useAgentTaskStore.getState().currentTaskId).toBe(null)
    })

    it('should remove task and clean up related state', () => {
      const { setTasks, removeTask, setSelectedTask, appendOutput } =
        useAgentTaskStore.getState()

      setTasks([createMockTask({ id: 'task-1' })])
      setSelectedTask('task-1')
      appendOutput('task-1', {
        taskId: 'task-1',
        timestamp: new Date(),
        content: 'test',
        stream: 'stdout',
      })

      removeTask('task-1')

      const state = useAgentTaskStore.getState()
      expect(state.tasks.has('task-1')).toBe(false)
      expect(state.taskOrder).not.toContain('task-1')
      expect(state.selectedTaskId).toBe(null)
      expect(state.outputBuffers.has('task-1')).toBe(false)
    })

    it('should set tasks loading state', () => {
      const { setTasksLoading } = useAgentTaskStore.getState()

      setTasksLoading(true)
      expect(useAgentTaskStore.getState().isLoadingTasks).toBe(true)

      setTasksLoading(false)
      expect(useAgentTaskStore.getState().isLoadingTasks).toBe(false)
    })

    it('should set tasks error', () => {
      const { setTasksError } = useAgentTaskStore.getState()

      setTasksError('Failed to load tasks')
      expect(useAgentTaskStore.getState().tasksError).toBe('Failed to load tasks')
    })

    it('should reorder tasks and update priorities', () => {
      const { setTasks, reorderTasks } = useAgentTaskStore.getState()

      setTasks([
        createMockTask({ id: 'task-1', priority: 3 }),
        createMockTask({ id: 'task-2', priority: 2 }),
        createMockTask({ id: 'task-3', priority: 1 }),
      ])

      reorderTasks(['task-3', 'task-1', 'task-2'])

      const state = useAgentTaskStore.getState()
      expect(state.taskOrder).toEqual(['task-3', 'task-1', 'task-2'])
      expect(state.tasks.get('task-3')?.priority).toBe(3)
      expect(state.tasks.get('task-1')?.priority).toBe(2)
      expect(state.tasks.get('task-2')?.priority).toBe(1)
    })
  })

  describe('Current/Selected Task', () => {
    it('should set current task', () => {
      const { setCurrentTask } = useAgentTaskStore.getState()

      setCurrentTask('task-1')
      expect(useAgentTaskStore.getState().currentTaskId).toBe('task-1')

      setCurrentTask(null)
      expect(useAgentTaskStore.getState().currentTaskId).toBe(null)
    })

    it('should set selected task', () => {
      const { setSelectedTask } = useAgentTaskStore.getState()

      setSelectedTask('task-1')
      expect(useAgentTaskStore.getState().selectedTaskId).toBe('task-1')

      setSelectedTask(null)
      expect(useAgentTaskStore.getState().selectedTaskId).toBe(null)
    })
  })

  describe('Output Buffer', () => {
    const mockOutputLine: OutputLine = {
      taskId: 'task-1',
      timestamp: new Date('2024-01-01'),
      content: 'Test output',
      stream: 'stdout',
    }

    it('should append output to buffer', () => {
      const { appendOutput } = useAgentTaskStore.getState()

      appendOutput('task-1', mockOutputLine)
      appendOutput('task-1', { ...mockOutputLine, content: 'More output' })

      const output = useAgentTaskStore.getState().outputBuffers.get('task-1')
      expect(output).toHaveLength(2)
      expect(output?.[0].content).toBe('Test output')
      expect(output?.[1].content).toBe('More output')
    })

    it('should set output for task', () => {
      const { setOutput } = useAgentTaskStore.getState()

      setOutput('task-1', [mockOutputLine])

      const output = useAgentTaskStore.getState().outputBuffers.get('task-1')
      expect(output).toEqual([mockOutputLine])
    })

    it('should clear output for task', () => {
      const { setOutput, clearOutput } = useAgentTaskStore.getState()

      setOutput('task-1', [mockOutputLine])
      clearOutput('task-1')

      expect(useAgentTaskStore.getState().outputBuffers.has('task-1')).toBe(
        false
      )
    })

    it('should set auto-scroll state', () => {
      const { setAutoScroll } = useAgentTaskStore.getState()

      setAutoScroll(false)
      expect(useAgentTaskStore.getState().isAutoScrollEnabled).toBe(false)

      setAutoScroll(true)
      expect(useAgentTaskStore.getState().isAutoScrollEnabled).toBe(true)
    })

    it('should get task output', () => {
      const { setOutput, getTaskOutput } = useAgentTaskStore.getState()

      setOutput('task-1', [mockOutputLine])

      expect(getTaskOutput('task-1')).toEqual([mockOutputLine])
      expect(getTaskOutput('non-existent')).toEqual([])
    })
  })

  describe('Subscriptions', () => {
    it('should add subscription', () => {
      const { addSubscription } = useAgentTaskStore.getState()

      addSubscription('task-1')

      expect(useAgentTaskStore.getState().subscribedTaskIds.has('task-1')).toBe(
        true
      )
    })

    it('should remove subscription', () => {
      const { addSubscription, removeSubscription } =
        useAgentTaskStore.getState()

      addSubscription('task-1')
      removeSubscription('task-1')

      expect(useAgentTaskStore.getState().subscribedTaskIds.has('task-1')).toBe(
        false
      )
    })
  })

  describe('Selectors', () => {
    it('should get task by ID', () => {
      const { setTasks, getTask } = useAgentTaskStore.getState()

      const task = createMockTask({ id: 'task-1' })
      setTasks([task])

      expect(getTask('task-1')).toEqual(task)
      expect(getTask('non-existent')).toBeUndefined()
    })

    it('should get tasks by status', () => {
      const { setTasks, getTasksByStatus } = useAgentTaskStore.getState()

      setTasks([
        createMockTask({ id: 'task-1', status: 'pending' }),
        createMockTask({ id: 'task-2', status: 'running' }),
        createMockTask({ id: 'task-3', status: 'pending' }),
      ])

      const pendingTasks = getTasksByStatus('pending')
      expect(pendingTasks).toHaveLength(2)
      expect(pendingTasks.map((t) => t.id)).toContain('task-1')
      expect(pendingTasks.map((t) => t.id)).toContain('task-3')
    })

    it('should get pending tasks', () => {
      const { setTasks, getPendingTasks } = useAgentTaskStore.getState()

      setTasks([
        createMockTask({ id: 'task-1', status: 'pending' }),
        createMockTask({ id: 'task-2', status: 'running' }),
      ])

      const pendingTasks = getPendingTasks()
      expect(pendingTasks).toHaveLength(1)
      expect(pendingTasks[0].id).toBe('task-1')
    })

    it('should get running task', () => {
      const { setTasks, setCurrentTask, getRunningTask } =
        useAgentTaskStore.getState()

      setTasks([createMockTask({ id: 'task-1', status: 'running' })])
      setCurrentTask('task-1')

      const runningTask = getRunningTask()
      expect(runningTask?.id).toBe('task-1')
    })

    it('should get queued tasks', () => {
      const { setTasks, getQueuedTasks } = useAgentTaskStore.getState()

      setTasks([
        createMockTask({ id: 'task-1', status: 'queued' }),
        createMockTask({ id: 'task-2', status: 'pending' }),
      ])

      const queuedTasks = getQueuedTasks()
      expect(queuedTasks).toHaveLength(1)
      expect(queuedTasks[0].id).toBe('task-1')
    })
  })
})
