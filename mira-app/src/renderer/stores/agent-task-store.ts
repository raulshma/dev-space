/**
 * Agent Task Store - Zustand state management for agent task operations
 *
 * Manages task list, current task, output buffer, and task status updates.
 * Extended with planning mode, plan spec, dependencies, and blocking status.
 * Requirements: 7.1, 9.2, 3.1, 5.2
 */

import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type {
  AgentTask,
  TaskStatus,
  OutputLine,
  AgentType,
  PlanningMode,
  PlanSpec,
} from 'shared/ai-types'

// ============================================================================
// Types
// ============================================================================

export interface TaskFilter {
  status?: TaskStatus
  agentType?: AgentType
  planningMode?: PlanningMode
  branchName?: string
}

/**
 * Dependency status for a task
 */
export interface TaskDependencyStatus {
  taskId: string
  isBlocked: boolean
  blockingTasks: string[]
  failedDependencies: string[]
}

/**
 * Extended task with dependency information
 */
export interface TaskWithDependencies extends AgentTask {
  dependencies?: string[]
  dependencyStatus?: TaskDependencyStatus
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

  // Dependency state (per task)
  dependencies: Map<string, string[]>
  dependencyStatuses: Map<string, TaskDependencyStatus>
  isLoadingDependencies: boolean

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

  // Actions - Dependencies
  setDependencies: (taskId: string, dependsOn: string[]) => void
  setDependencyStatus: (taskId: string, status: TaskDependencyStatus) => void
  clearDependencies: (taskId: string) => void
  setLoadingDependencies: (loading: boolean) => void

  // Actions - Planning
  updatePlanSpec: (taskId: string, planSpec: PlanSpec | null) => void
  approvePlan: (taskId: string) => Promise<void>
  rejectPlan: (taskId: string, feedback: string) => Promise<void>

  // Async Actions - Dependencies
  loadDependencies: (taskId: string) => Promise<void>
  loadBlockingStatus: (taskId: string) => Promise<void>
  saveDependencies: (taskId: string, dependsOn: string[]) => Promise<void>

  // Selectors
  getTask: (taskId: string) => AgentTask | undefined
  getTasksByStatus: (status: TaskStatus) => AgentTask[]
  getTaskOutput: (taskId: string) => OutputLine[]
  getPendingTasks: () => AgentTask[]
  getRunningTask: () => AgentTask | undefined
  getQueuedTasks: () => AgentTask[]
  getBlockedTasks: () => AgentTask[]
  getTasksAwaitingApproval: () => AgentTask[]
  getTasksByPlanningMode: (mode: PlanningMode) => AgentTask[]
  getTasksByBranch: (branchName: string) => AgentTask[]
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

  // Dependency state
  dependencies: new Map(),
  dependencyStatuses: new Map(),
  isLoadingDependencies: false,

  // Task management actions
  setTasks: tasks =>
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

  addTask: task =>
    set(state => {
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
    set(state => {
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

  removeTask: taskId =>
    set(state => {
      const newTasks = new Map(state.tasks)
      newTasks.delete(taskId)

      const newOrder = state.taskOrder.filter(id => id !== taskId)

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

  setTasksLoading: loading =>
    set({
      isLoadingTasks: loading,
    }),

  setTasksError: error =>
    set({
      tasksError: error,
    }),

  reorderTasks: taskIds =>
    set(state => {
      // Validate all taskIds exist
      const validIds = taskIds.filter(id => state.tasks.has(id))
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
  setCurrentTask: taskId =>
    set({
      currentTaskId: taskId,
    }),

  setSelectedTask: taskId =>
    set({
      selectedTaskId: taskId,
    }),

  // Output buffer actions
  appendOutput: (taskId, line) =>
    set(state => {
      const newBuffers = new Map(state.outputBuffers)
      const existing = newBuffers.get(taskId) || []
      newBuffers.set(taskId, [...existing, line])
      return { outputBuffers: newBuffers }
    }),

  setOutput: (taskId, lines) =>
    set(state => {
      const newBuffers = new Map(state.outputBuffers)
      newBuffers.set(taskId, lines)
      return { outputBuffers: newBuffers }
    }),

  clearOutput: taskId =>
    set(state => {
      const newBuffers = new Map(state.outputBuffers)
      newBuffers.delete(taskId)
      return { outputBuffers: newBuffers }
    }),

  setAutoScroll: enabled =>
    set({
      isAutoScrollEnabled: enabled,
    }),

  // Subscription actions
  addSubscription: taskId =>
    set(state => {
      const newSubscriptions = new Set(state.subscribedTaskIds)
      newSubscriptions.add(taskId)
      return { subscribedTaskIds: newSubscriptions }
    }),

  removeSubscription: taskId =>
    set(state => {
      const newSubscriptions = new Set(state.subscribedTaskIds)
      newSubscriptions.delete(taskId)
      return { subscribedTaskIds: newSubscriptions }
    }),

  // Dependency actions
  setDependencies: (taskId, dependsOn) =>
    set(state => {
      const newDependencies = new Map(state.dependencies)
      newDependencies.set(taskId, dependsOn)
      return { dependencies: newDependencies }
    }),

  setDependencyStatus: (taskId, status) =>
    set(state => {
      const newStatuses = new Map(state.dependencyStatuses)
      newStatuses.set(taskId, status)
      return { dependencyStatuses: newStatuses }
    }),

  clearDependencies: taskId =>
    set(state => {
      const newDependencies = new Map(state.dependencies)
      newDependencies.delete(taskId)
      const newStatuses = new Map(state.dependencyStatuses)
      newStatuses.delete(taskId)
      return { dependencies: newDependencies, dependencyStatuses: newStatuses }
    }),

  setLoadingDependencies: loading => set({ isLoadingDependencies: loading }),

  // Planning actions
  updatePlanSpec: (taskId, planSpec) =>
    set(state => {
      const task = state.tasks.get(taskId)
      if (!task) return state

      const newTasks = new Map(state.tasks)
      newTasks.set(taskId, {
        ...task,
        planSpec: planSpec ?? undefined,
      })
      return { tasks: newTasks }
    }),

  approvePlan: async taskId => {
    const { updateTask, setTasksError } = get()
    try {
      const response = await window.api.planning.approvePlan({ taskId })
      updateTask(taskId, {
        planSpec: response.task.planSpec,
        status: response.task.status,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to approve plan'
      setTasksError(message)
      throw err
    }
  },

  rejectPlan: async (taskId, feedback) => {
    const { updateTask, setTasksError } = get()
    try {
      const response = await window.api.planning.rejectPlan({
        taskId,
        feedback,
      })
      updateTask(taskId, {
        planSpec: response.task.planSpec,
        status: response.task.status,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to reject plan'
      setTasksError(message)
      throw err
    }
  },

  // Async dependency actions
  loadDependencies: async taskId => {
    const { setDependencies, setLoadingDependencies, setTasksError } = get()
    setLoadingDependencies(true)
    try {
      const response = await window.api.dependencies.get({ taskId })
      setDependencies(taskId, response.dependencies)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load dependencies'
      setTasksError(message)
    } finally {
      setLoadingDependencies(false)
    }
  },

  loadBlockingStatus: async taskId => {
    const { setDependencyStatus, setLoadingDependencies, setTasksError } = get()
    setLoadingDependencies(true)
    try {
      const response = await window.api.dependencies.getBlockingStatus({
        taskId,
      })
      setDependencyStatus(taskId, response.status)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load blocking status'
      setTasksError(message)
    } finally {
      setLoadingDependencies(false)
    }
  },

  saveDependencies: async (taskId, dependsOn) => {
    const { setDependencies, setLoadingDependencies, setTasksError } = get()
    setLoadingDependencies(true)
    try {
      await window.api.dependencies.set({ taskId, dependsOn })
      setDependencies(taskId, dependsOn)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to save dependencies'
      setTasksError(message)
      throw err
    } finally {
      setLoadingDependencies(false)
    }
  },

  // Selectors
  getTask: taskId => {
    return get().tasks.get(taskId)
  },

  getTasksByStatus: status => {
    const state = get()
    return state.taskOrder
      .map(id => state.tasks.get(id))
      .filter(
        (task): task is AgentTask =>
          task !== undefined && task.status === status
      )
  },

  getTaskOutput: taskId => {
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

  getBlockedTasks: () => {
    const state = get()
    return state.taskOrder
      .map(id => state.tasks.get(id))
      .filter((task): task is AgentTask => {
        if (!task) return false
        const status = state.dependencyStatuses.get(task.id)
        return status?.isBlocked ?? false
      })
  },

  getTasksAwaitingApproval: () => {
    return get().getTasksByStatus('awaiting_approval')
  },

  getTasksByPlanningMode: (mode: PlanningMode) => {
    const state = get()
    return state.taskOrder
      .map(id => state.tasks.get(id))
      .filter(
        (task): task is AgentTask =>
          task !== undefined && task.planningMode === mode
      )
  },

  getTasksByBranch: (branchName: string) => {
    const state = get()
    return state.taskOrder
      .map(id => state.tasks.get(id))
      .filter(
        (task): task is AgentTask =>
          task !== undefined && task.branchName === branchName
      )
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
    useShallow(state =>
      state.taskOrder
        .map(id => state.tasks.get(id))
        .filter((task): task is AgentTask => task !== undefined)
    )
  )
}

/**
 * Hook to get a specific task by ID
 */
export const useTask = (taskId: string | null): AgentTask | undefined => {
  return useAgentTaskStore(state =>
    taskId ? state.tasks.get(taskId) : undefined
  )
}

/**
 * Hook to get the currently running task
 */
export const useCurrentTask = (): AgentTask | undefined => {
  return useAgentTaskStore(state =>
    state.currentTaskId ? state.tasks.get(state.currentTaskId) : undefined
  )
}

/**
 * Hook to get the selected task
 */
export const useSelectedTask = (): AgentTask | undefined => {
  return useAgentTaskStore(state =>
    state.selectedTaskId ? state.tasks.get(state.selectedTaskId) : undefined
  )
}

/**
 * Hook to get output for a specific task
 */
export const useTaskOutput = (taskId: string): OutputLine[] => {
  return useAgentTaskStore(
    useShallow(state => state.outputBuffers.get(taskId) || [])
  )
}

/**
 * Hook to get tasks by status
 */
export const useTasksByStatus = (status: TaskStatus): AgentTask[] => {
  return useAgentTaskStore(
    useShallow(state =>
      state.taskOrder
        .map(id => state.tasks.get(id))
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
  return useAgentTaskStore(state => state.isLoadingTasks)
}

/**
 * Hook to get auto-scroll state
 */
export const useAutoScroll = (): boolean => {
  return useAgentTaskStore(state => state.isAutoScrollEnabled)
}

/**
 * Hook to check if subscribed to a task's output
 */
export const useIsSubscribed = (taskId: string): boolean => {
  return useAgentTaskStore(state => state.subscribedTaskIds.has(taskId))
}

// ============================================================================
// Dependency Hooks
// ============================================================================

/**
 * Hook to get dependencies for a task
 */
export const useTaskDependencies = (taskId: string): string[] => {
  return useAgentTaskStore(
    useShallow(state => state.dependencies.get(taskId) || [])
  )
}

/**
 * Hook to get dependency status for a task
 */
export const useTaskDependencyStatus = (
  taskId: string
): TaskDependencyStatus | undefined => {
  return useAgentTaskStore(state => state.dependencyStatuses.get(taskId))
}

/**
 * Hook to check if a task is blocked
 */
export const useIsTaskBlocked = (taskId: string): boolean => {
  return useAgentTaskStore(
    state => state.dependencyStatuses.get(taskId)?.isBlocked ?? false
  )
}

/**
 * Hook to get all blocked tasks
 */
export const useBlockedTasks = (): AgentTask[] => {
  return useAgentTaskStore(
    useShallow(state =>
      state.taskOrder
        .map(id => state.tasks.get(id))
        .filter((task): task is AgentTask => {
          if (!task) return false
          const status = state.dependencyStatuses.get(task.id)
          return status?.isBlocked ?? false
        })
    )
  )
}

/**
 * Hook to check if dependencies are loading
 */
export const useDependenciesLoading = (): boolean => {
  return useAgentTaskStore(state => state.isLoadingDependencies)
}

// ============================================================================
// Planning Hooks
// ============================================================================

/**
 * Hook to get tasks awaiting plan approval
 */
export const useTasksAwaitingApproval = (): AgentTask[] => {
  return useAgentTaskStore(
    useShallow(state =>
      state.taskOrder
        .map(id => state.tasks.get(id))
        .filter(
          (task): task is AgentTask =>
            task !== undefined && task.status === 'awaiting_approval'
        )
    )
  )
}

/**
 * Hook to get tasks by planning mode
 */
export const useTasksByPlanningMode = (mode: PlanningMode): AgentTask[] => {
  return useAgentTaskStore(
    useShallow(state =>
      state.taskOrder
        .map(id => state.tasks.get(id))
        .filter(
          (task): task is AgentTask =>
            task !== undefined && task.planningMode === mode
        )
    )
  )
}

/**
 * Hook to get a task's plan spec
 */
export const useTaskPlanSpec = (taskId: string): PlanSpec | undefined => {
  return useAgentTaskStore(state => state.tasks.get(taskId)?.planSpec)
}

/**
 * Hook to check if a task requires plan approval
 */
export const useRequiresPlanApproval = (taskId: string): boolean => {
  return useAgentTaskStore(
    state => state.tasks.get(taskId)?.requirePlanApproval ?? false
  )
}

// ============================================================================
// Branch/Worktree Hooks
// ============================================================================

/**
 * Hook to get tasks by branch name
 */
export const useTasksByBranch = (branchName: string): AgentTask[] => {
  return useAgentTaskStore(
    useShallow(state =>
      state.taskOrder
        .map(id => state.tasks.get(id))
        .filter(
          (task): task is AgentTask =>
            task !== undefined && task.branchName === branchName
        )
    )
  )
}

/**
 * Hook to get all unique branch names from tasks
 */
export const useTaskBranches = (): string[] => {
  return useAgentTaskStore(
    useShallow(state => {
      const branches = new Set<string>()
      for (const task of state.tasks.values()) {
        if (task.branchName) {
          branches.add(task.branchName)
        }
      }
      return Array.from(branches)
    })
  )
}

/**
 * Hook to get a task's worktree path
 */
export const useTaskWorktreePath = (taskId: string): string | undefined => {
  return useAgentTaskStore(state => state.tasks.get(taskId)?.worktreePath)
}

// ============================================================================
// Action Hooks
// ============================================================================

/**
 * Hook to get dependency actions
 */
export const useDependencyActions = () => {
  return useAgentTaskStore(
    useShallow(state => ({
      loadDependencies: state.loadDependencies,
      loadBlockingStatus: state.loadBlockingStatus,
      saveDependencies: state.saveDependencies,
      setDependencies: state.setDependencies,
      setDependencyStatus: state.setDependencyStatus,
      clearDependencies: state.clearDependencies,
    }))
  )
}

/**
 * Hook to get planning actions
 */
export const usePlanningActions = () => {
  return useAgentTaskStore(
    useShallow(state => ({
      updatePlanSpec: state.updatePlanSpec,
      approvePlan: state.approvePlan,
      rejectPlan: state.rejectPlan,
    }))
  )
}

/**
 * Hook to get all task actions
 */
export const useTaskActions = () => {
  return useAgentTaskStore(
    useShallow(state => ({
      setTasks: state.setTasks,
      addTask: state.addTask,
      updateTask: state.updateTask,
      removeTask: state.removeTask,
      reorderTasks: state.reorderTasks,
      setCurrentTask: state.setCurrentTask,
      setSelectedTask: state.setSelectedTask,
      appendOutput: state.appendOutput,
      setOutput: state.setOutput,
      clearOutput: state.clearOutput,
      setAutoScroll: state.setAutoScroll,
      addSubscription: state.addSubscription,
      removeSubscription: state.removeSubscription,
    }))
  )
}
