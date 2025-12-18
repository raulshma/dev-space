/**
 * Agent Task Store - Zustand state management for agent task operations
 *
 * Manages task list, current task, output buffer, and task status updates.
 * Requirements: 7.1, 9.2
 */

import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type {
  AgentTask,
  TaskStatus,
  OutputLine,
  AgentType,
} from 'shared/ai-types'

// ============================================================================
// Types
// ============================================================================

export interface TaskFilter {
  status?: TaskStatus
  agentType?: AgentType
}

export interface AgentTaskState {
  // Task list state
  tasks: Map<string, AgentTask>
  taskOrder: string[] // Maintains priority order
  isLoadingTasks: boolean
  tasksError: string | null

  // Current task state
  currentTaskId: string | null
  selectedTaskId: string | null

  // Output buffer state (per task)
  outputBuffers: Map<string, OutputLine[]>
  isAutoScrollEnabled: boolean

  // Subscription state
  subscribedTaskIds: Set<string>

  // Actions - Task management
  setTasks: (tasks: AgentTask[]) => void
  addTask: (task: AgentTask) => void
  updateTask: (taskId: string, updates: Partial<AgentTask>) => void
  removeTask: (taskId: string) => void
  setTasksLoading: (loading: boolean) => void
  setTasksError: (error: string | null) => void
  reorderTasks: (taskIds: string[]) => void

  // Actions - Current/Selected task
  setCurrentTask: (taskId: string | null) => void
  setSelectedTask: (taskId: string | null) => void

  // Actions - Output buffer
  appendOutput: (taskId: string, line: OutputLine) => void
  setOutput: (taskId: string, lines: OutputLine[]) => void
  clearOutput: (taskId: string) => void
  setAutoScroll: (enabled: boolean) => void

  // Actions - Subscriptions
  addSubscription: (taskId: string) => void
  removeSubscription: (taskId: string) => void

  // Selectors
  getTask: (taskId: string) => AgentTask | undefined
  getTasksByStatus: (status: TaskStatus) => AgentTask[]
  getTaskOutput: (taskId: string) => OutputLine[]
  getPendingTasks: () => AgentTask[]
  getRunningTask: () => AgentTask | undefined
  getQueuedTasks: () => AgentTask[]
}

// ============================================================================
// Store
// ============================================================================

export const useAgentTaskStore = create<AgentTaskState>((set, get) => ({
  // Initial state
  tasks: new Map(),
  taskOrder: [],
  isLoadingTasks: false,
  tasksError: null,

  currentTaskId: null,
  selectedTaskId: null,

  outputBuffers: new Map(),
  isAutoScrollEnabled: true,

  subscribedTaskIds: new Set(),

  // Task management actions
  setTasks: (tasks) =>
    set(() => {
      const taskMap = new Map<string, AgentTask>()
      const order: string[] = []

      // Sort by priority (higher first), then by createdAt (older first)
      const sorted = [...tasks].sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority
        }
        return a.createdAt.getTime() - b.createdAt.getTime()
      })

      for (const task of sorted) {
        taskMap.set(task.id, task)
        order.push(task.id)
      }

      return {
        tasks: taskMap,
        taskOrder: order,
        tasksError: null,
      }
    }),

  addTask: (task) =>
    set((state) => {
      const newTasks = new Map(state.tasks)
      newTasks.set(task.id, task)

      // Insert at appropriate position based on priority
      const newOrder = [...state.taskOrder]
      let insertIndex = newOrder.length

      for (let i = 0; i < newOrder.length; i++) {
        const existingTask = state.tasks.get(newOrder[i])
        if (existingTask && task.priority > existingTask.priority) {
          insertIndex = i
          break
        }
      }

      newOrder.splice(insertIndex, 0, task.id)

      return {
        tasks: newTasks,
        taskOrder: newOrder,
      }
    }),

  updateTask: (taskId, updates) =>
    set((state) => {
      const task = state.tasks.get(taskId)
      if (!task) return state

      const newTasks = new Map(state.tasks)
      newTasks.set(taskId, { ...task, ...updates })

      // Update currentTaskId if this task started running
      let currentTaskId = state.currentTaskId
      if (updates.status === 'running') {
        currentTaskId = taskId
      } else if (
        state.currentTaskId === taskId &&
        updates.status &&
        ['completed', 'failed', 'stopped'].includes(updates.status)
      ) {
        currentTaskId = null
      }

      return {
        tasks: newTasks,
        currentTaskId,
      }
    }),

  removeTask: (taskId) =>
    set((state) => {
      const newTasks = new Map(state.tasks)
      newTasks.delete(taskId)

      const newOrder = state.taskOrder.filter((id) => id !== taskId)

      const newOutputBuffers = new Map(state.outputBuffers)
      newOutputBuffers.delete(taskId)

      const newSubscriptions = new Set(state.subscribedTaskIds)
      newSubscriptions.delete(taskId)

      return {
        tasks: newTasks,
        taskOrder: newOrder,
        outputBuffers: newOutputBuffers,
        subscribedTaskIds: newSubscriptions,
        currentTaskId:
          state.currentTaskId === taskId ? null : state.currentTaskId,
        selectedTaskId:
          state.selectedTaskId === taskId ? null : state.selectedTaskId,
      }
    }),

  setTasksLoading: (loading) =>
    set({
      isLoadingTasks: loading,
    }),

  setTasksError: (error) =>
    set({
      tasksError: error,
    }),

  reorderTasks: (taskIds) =>
    set((state) => {
      // Validate all taskIds exist
      const validIds = taskIds.filter((id) => state.tasks.has(id))
      if (validIds.length !== taskIds.length) {
        return state
      }

      // Update priorities based on new order
      const newTasks = new Map(state.tasks)
      const maxPriority = taskIds.length

      for (let i = 0; i < taskIds.length; i++) {
        const task = newTasks.get(taskIds[i])
        if (task) {
          newTasks.set(taskIds[i], {
            ...task,
            priority: maxPriority - i,
          })
        }
      }

      return {
        tasks: newTasks,
        taskOrder: taskIds,
      }
    }),

  // Current/Selected task actions
  setCurrentTask: (taskId) =>
    set({
      currentTaskId: taskId,
    }),

  setSelectedTask: (taskId) =>
    set({
      selectedTaskId: taskId,
    }),

  // Output buffer actions
  appendOutput: (taskId, line) =>
    set((state) => {
      const newBuffers = new Map(state.outputBuffers)
      const existing = newBuffers.get(taskId) || []
      newBuffers.set(taskId, [...existing, line])
      return { outputBuffers: newBuffers }
    }),

  setOutput: (taskId, lines) =>
    set((state) => {
      const newBuffers = new Map(state.outputBuffers)
      newBuffers.set(taskId, lines)
      return { outputBuffers: newBuffers }
    }),

  clearOutput: (taskId) =>
    set((state) => {
      const newBuffers = new Map(state.outputBuffers)
      newBuffers.delete(taskId)
      return { outputBuffers: newBuffers }
    }),

  setAutoScroll: (enabled) =>
    set({
      isAutoScrollEnabled: enabled,
    }),

  // Subscription actions
  addSubscription: (taskId) =>
    set((state) => {
      const newSubscriptions = new Set(state.subscribedTaskIds)
      newSubscriptions.add(taskId)
      return { subscribedTaskIds: newSubscriptions }
    }),

  removeSubscription: (taskId) =>
    set((state) => {
      const newSubscriptions = new Set(state.subscribedTaskIds)
      newSubscriptions.delete(taskId)
      return { subscribedTaskIds: newSubscriptions }
    }),

  // Selectors
  getTask: (taskId) => {
    return get().tasks.get(taskId)
  },

  getTasksByStatus: (status) => {
    const state = get()
    return state.taskOrder
      .map((id) => state.tasks.get(id))
      .filter((task): task is AgentTask => task !== undefined && task.status === status)
  },

  getTaskOutput: (taskId) => {
    return get().outputBuffers.get(taskId) || []
  },

  getPendingTasks: () => {
    return get().getTasksByStatus('pending')
  },

  getRunningTask: () => {
    const state = get()
    if (!state.currentTaskId) return undefined
    return state.tasks.get(state.currentTaskId)
  },

  getQueuedTasks: () => {
    return get().getTasksByStatus('queued')
  },
}))

// ============================================================================
// Custom Hooks
// ============================================================================

/**
 * Hook to get all tasks in order
 */
export const useTaskList = (): AgentTask[] => {
  return useAgentTaskStore(
    useShallow((state) =>
      state.taskOrder
        .map((id) => state.tasks.get(id))
        .filter((task): task is AgentTask => task !== undefined)
    )
  )
}

/**
 * Hook to get a specific task by ID
 */
export const useTask = (taskId: string | null): AgentTask | undefined => {
  return useAgentTaskStore((state) =>
    taskId ? state.tasks.get(taskId) : undefined
  )
}

/**
 * Hook to get the currently running task
 */
export const useCurrentTask = (): AgentTask | undefined => {
  return useAgentTaskStore((state) =>
    state.currentTaskId ? state.tasks.get(state.currentTaskId) : undefined
  )
}

/**
 * Hook to get the selected task
 */
export const useSelectedTask = (): AgentTask | undefined => {
  return useAgentTaskStore((state) =>
    state.selectedTaskId ? state.tasks.get(state.selectedTaskId) : undefined
  )
}

/**
 * Hook to get output for a specific task
 */
export const useTaskOutput = (taskId: string): OutputLine[] => {
  return useAgentTaskStore(
    useShallow((state) => state.outputBuffers.get(taskId) || [])
  )
}

/**
 * Hook to get tasks by status
 */
export const useTasksByStatus = (status: TaskStatus): AgentTask[] => {
  return useAgentTaskStore(
    useShallow((state) =>
      state.taskOrder
        .map((id) => state.tasks.get(id))
        .filter(
          (task): task is AgentTask =>
            task !== undefined && task.status === status
        )
    )
  )
}

/**
 * Hook to check if tasks are loading
 */
export const useTasksLoading = (): boolean => {
  return useAgentTaskStore((state) => state.isLoadingTasks)
}

/**
 * Hook to get auto-scroll state
 */
export const useAutoScroll = (): boolean => {
  return useAgentTaskStore((state) => state.isAutoScrollEnabled)
}

/**
 * Hook to check if subscribed to a task's output
 */
export const useIsSubscribed = (taskId: string): boolean => {
  return useAgentTaskStore((state) => state.subscribedTaskIds.has(taskId))
}
