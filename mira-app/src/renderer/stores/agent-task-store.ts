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
  TaskFeedback,
  TaskRunningProcess,
} from 'shared/ai-types'
import type {
  ReviewStatusInfo,
  ReviewApprovalResult,
  ReviewRunningProcess,
  ReviewTerminalSession,
  ReviewScriptInfo,
} from 'shared/ipc-types'

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

  // Task detail tabs state (multiple open tabs support)
  openTaskTabs: string[] // Array of task IDs for open tabs
  activeTaskTab: string | null // Currently active tab

  // Output buffer state (per task)
  outputBuffers: Map<string, OutputLine[]>
  isAutoScrollEnabled: boolean

  // Subscription state
  subscribedTaskIds: Set<string>

  // Dependency state (per task)
  dependencies: Map<string, string[]>
  dependencyStatuses: Map<string, TaskDependencyStatus>
  isLoadingDependencies: boolean

  // Review workflow state (per task)
  feedbackHistories: Map<string, TaskFeedback[]>
  runningProcesses: Map<string, ReviewRunningProcess>
  openTerminals: Map<string, ReviewTerminalSession[]>
  reviewStatuses: Map<string, ReviewStatusInfo>
  isLoadingReview: boolean
  reviewError: string | null

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

  // Actions - Task detail tabs
  openTaskTab: (taskId: string) => void
  closeTaskTab: (taskId: string) => void
  setActiveTaskTab: (taskId: string | null) => void
  closeAllTaskTabs: () => void

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

  // Actions - Review Workflow State Management
  setFeedbackHistory: (taskId: string, feedback: TaskFeedback[]) => void
  addFeedbackEntry: (taskId: string, feedback: TaskFeedback) => void
  setRunningProcess: (
    taskId: string,
    process: ReviewRunningProcess | null
  ) => void
  setOpenTerminals: (taskId: string, terminals: ReviewTerminalSession[]) => void
  addOpenTerminal: (taskId: string, terminal: ReviewTerminalSession) => void
  removeOpenTerminal: (taskId: string, terminalId: string) => void
  setReviewStatus: (taskId: string, status: ReviewStatusInfo) => void
  clearReviewState: (taskId: string) => void
  setLoadingReview: (loading: boolean) => void
  setReviewError: (error: string | null) => void

  // Async Actions - Review Workflow
  submitFeedback: (taskId: string, feedback: string) => Promise<void>
  approveChanges: (taskId: string) => Promise<ReviewApprovalResult>
  discardChanges: (taskId: string) => Promise<void>
  runProject: (taskId: string, script?: string) => Promise<ReviewRunningProcess>
  stopProject: (taskId: string) => Promise<void>
  openTerminal: (taskId: string) => Promise<ReviewTerminalSession>
  loadReviewStatus: (taskId: string) => Promise<void>
  loadFeedbackHistory: (taskId: string) => Promise<void>
  loadAvailableScripts: (taskId: string) => Promise<ReviewScriptInfo[]>
  loadOpenTerminals: (taskId: string) => Promise<void>

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
  getTasksInReview: () => AgentTask[]
  getTaskFeedbackHistory: (taskId: string) => TaskFeedback[]
  getTaskRunningProcess: (taskId: string) => ReviewRunningProcess | undefined
  getTaskOpenTerminals: (taskId: string) => ReviewTerminalSession[]
  getTaskReviewStatus: (taskId: string) => ReviewStatusInfo | undefined
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

  // Task detail tabs state
  openTaskTabs: [],
  activeTaskTab: null,

  outputBuffers: new Map(),
  isAutoScrollEnabled: true,

  subscribedTaskIds: new Set(),

  // Dependency state
  dependencies: new Map(),
  dependencyStatuses: new Map(),
  isLoadingDependencies: false,

  // Review workflow state
  feedbackHistories: new Map(),
  runningProcesses: new Map(),
  openTerminals: new Map(),
  reviewStatuses: new Map(),
  isLoadingReview: false,
  reviewError: null,

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

      // Clean up task tabs
      const newOpenTabs = state.openTaskTabs.filter(id => id !== taskId)
      let newActiveTab = state.activeTaskTab
      if (state.activeTaskTab === taskId) {
        const closedIndex = state.openTaskTabs.indexOf(taskId)
        newActiveTab =
          newOpenTabs.length > 0
            ? newOpenTabs[Math.max(0, closedIndex - 1)]
            : null
      }

      return {
        tasks: newTasks,
        taskOrder: newOrder,
        outputBuffers: newOutputBuffers,
        subscribedTaskIds: newSubscriptions,
        openTaskTabs: newOpenTabs,
        activeTaskTab: newActiveTab,
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

  // Task detail tabs actions
  openTaskTab: taskId =>
    set(state => {
      // If tab already open, just make it active
      if (state.openTaskTabs.includes(taskId)) {
        return { activeTaskTab: taskId }
      }
      // Add new tab and make it active
      return {
        openTaskTabs: [...state.openTaskTabs, taskId],
        activeTaskTab: taskId,
      }
    }),

  closeTaskTab: taskId =>
    set(state => {
      const newTabs = state.openTaskTabs.filter(id => id !== taskId)
      let newActiveTab = state.activeTaskTab

      // If closing the active tab, switch to another tab
      if (state.activeTaskTab === taskId) {
        const closedIndex = state.openTaskTabs.indexOf(taskId)
        if (newTabs.length > 0) {
          // Prefer the tab to the left, or the first tab
          newActiveTab = newTabs[Math.max(0, closedIndex - 1)]
        } else {
          newActiveTab = null
        }
      }

      return {
        openTaskTabs: newTabs,
        activeTaskTab: newActiveTab,
      }
    }),

  setActiveTaskTab: taskId =>
    set({
      activeTaskTab: taskId,
    }),

  closeAllTaskTabs: () =>
    set({
      openTaskTabs: [],
      activeTaskTab: null,
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

  // Review workflow state management actions
  setFeedbackHistory: (taskId, feedback) =>
    set(state => {
      const newHistories = new Map(state.feedbackHistories)
      newHistories.set(taskId, feedback)
      return { feedbackHistories: newHistories }
    }),

  addFeedbackEntry: (taskId, feedback) =>
    set(state => {
      const newHistories = new Map(state.feedbackHistories)
      const existing = newHistories.get(taskId) || []
      newHistories.set(taskId, [...existing, feedback])
      return { feedbackHistories: newHistories }
    }),

  setRunningProcess: (taskId, process) =>
    set(state => {
      const newProcesses = new Map(state.runningProcesses)
      if (process) {
        newProcesses.set(taskId, process)
      } else {
        newProcesses.delete(taskId)
      }
      return { runningProcesses: newProcesses }
    }),

  setOpenTerminals: (taskId, terminals) =>
    set(state => {
      const newTerminals = new Map(state.openTerminals)
      newTerminals.set(taskId, terminals)
      return { openTerminals: newTerminals }
    }),

  addOpenTerminal: (taskId, terminal) =>
    set(state => {
      const newTerminals = new Map(state.openTerminals)
      const existing = newTerminals.get(taskId) || []
      newTerminals.set(taskId, [...existing, terminal])
      return { openTerminals: newTerminals }
    }),

  removeOpenTerminal: (taskId, terminalId) =>
    set(state => {
      const newTerminals = new Map(state.openTerminals)
      const existing = newTerminals.get(taskId) || []
      newTerminals.set(
        taskId,
        existing.filter(t => t.id !== terminalId)
      )
      return { openTerminals: newTerminals }
    }),

  setReviewStatus: (taskId, status) =>
    set(state => {
      const newStatuses = new Map(state.reviewStatuses)
      newStatuses.set(taskId, status)
      return { reviewStatuses: newStatuses }
    }),

  clearReviewState: taskId =>
    set(state => {
      const newHistories = new Map(state.feedbackHistories)
      newHistories.delete(taskId)
      const newProcesses = new Map(state.runningProcesses)
      newProcesses.delete(taskId)
      const newTerminals = new Map(state.openTerminals)
      newTerminals.delete(taskId)
      const newStatuses = new Map(state.reviewStatuses)
      newStatuses.delete(taskId)
      return {
        feedbackHistories: newHistories,
        runningProcesses: newProcesses,
        openTerminals: newTerminals,
        reviewStatuses: newStatuses,
      }
    }),

  setLoadingReview: loading => set({ isLoadingReview: loading }),

  setReviewError: error => set({ reviewError: error }),

  // Async review workflow actions
  submitFeedback: async (taskId, feedback) => {
    const { setLoadingReview, setReviewError, addFeedbackEntry, updateTask } =
      get()
    setLoadingReview(true)
    setReviewError(null)
    try {
      await window.api.review.submitFeedback({ taskId, feedback })
      // The feedback entry will be added via the status update event
      // Update task status to running since agent is restarting
      updateTask(taskId, { status: 'running' })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to submit feedback'
      setReviewError(message)
      throw err
    } finally {
      setLoadingReview(false)
    }
  },

  approveChanges: async taskId => {
    const { setLoadingReview, setReviewError, updateTask, clearReviewState } =
      get()
    setLoadingReview(true)
    setReviewError(null)
    try {
      const response = await window.api.review.approveChanges({ taskId })

      // Handle IPC error response (handleError returns { error: string, code: string })
      if ('error' in response && response.error) {
        const errorMessage =
          typeof response.error === 'string'
            ? response.error
            : 'Failed to approve changes'
        throw new Error(errorMessage)
      }

      // Handle missing result
      if (!response.result) {
        throw new Error('No result returned from approval')
      }

      if (response.result.success) {
        updateTask(taskId, { status: 'completed' })
        clearReviewState(taskId)
      }
      return response.result
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to approve changes'
      setReviewError(message)
      throw err
    } finally {
      setLoadingReview(false)
    }
  },

  discardChanges: async taskId => {
    const { setLoadingReview, setReviewError, updateTask, clearReviewState } =
      get()
    setLoadingReview(true)
    setReviewError(null)
    try {
      await window.api.review.discardChanges({ taskId })
      updateTask(taskId, { status: 'stopped' })
      clearReviewState(taskId)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to discard changes'
      setReviewError(message)
      throw err
    } finally {
      setLoadingReview(false)
    }
  },

  runProject: async (taskId, script) => {
    const { setLoadingReview, setReviewError, setRunningProcess } = get()
    setLoadingReview(true)
    setReviewError(null)
    try {
      const response = await window.api.review.runProject({ taskId, script })
      setRunningProcess(taskId, response.process)
      return response.process
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to run project'
      setReviewError(message)
      throw err
    } finally {
      setLoadingReview(false)
    }
  },

  stopProject: async taskId => {
    const { setLoadingReview, setReviewError, setRunningProcess } = get()
    setLoadingReview(true)
    setReviewError(null)
    try {
      await window.api.review.stopProject({ taskId })
      setRunningProcess(taskId, null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to stop project'
      setReviewError(message)
      throw err
    } finally {
      setLoadingReview(false)
    }
  },

  openTerminal: async taskId => {
    const { setLoadingReview, setReviewError, addOpenTerminal } = get()
    setLoadingReview(true)
    setReviewError(null)
    try {
      const response = await window.api.review.openTerminal({ taskId })
      addOpenTerminal(taskId, response.session)
      return response.session
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to open terminal'
      setReviewError(message)
      throw err
    } finally {
      setLoadingReview(false)
    }
  },

  loadReviewStatus: async taskId => {
    const { setLoadingReview, setReviewError, setReviewStatus } = get()
    setLoadingReview(true)
    setReviewError(null)
    try {
      const response = await window.api.review.getStatus({ taskId })
      setReviewStatus(taskId, response.status)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load review status'
      setReviewError(message)
    } finally {
      setLoadingReview(false)
    }
  },

  loadFeedbackHistory: async taskId => {
    const { setLoadingReview, setReviewError, setFeedbackHistory } = get()
    setLoadingReview(true)
    setReviewError(null)
    try {
      const response = await window.api.review.getFeedbackHistory({ taskId })
      setFeedbackHistory(taskId, response.feedback)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load feedback history'
      setReviewError(message)
    } finally {
      setLoadingReview(false)
    }
  },

  loadAvailableScripts: async taskId => {
    const { setLoadingReview, setReviewError } = get()
    setLoadingReview(true)
    setReviewError(null)
    try {
      const response = await window.api.review.getAvailableScripts({ taskId })
      return response.scripts
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load available scripts'
      setReviewError(message)
      throw err
    } finally {
      setLoadingReview(false)
    }
  },

  loadOpenTerminals: async taskId => {
    const { setLoadingReview, setReviewError, setOpenTerminals } = get()
    setLoadingReview(true)
    setReviewError(null)
    try {
      const response = await window.api.review.getOpenTerminals({ taskId })
      setOpenTerminals(taskId, response.terminals)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load open terminals'
      setReviewError(message)
    } finally {
      setLoadingReview(false)
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

  // Review workflow selectors
  getTasksInReview: () => {
    const state = get()
    return state.taskOrder
      .map(id => state.tasks.get(id))
      .filter(
        (task): task is AgentTask =>
          task !== undefined && task.status === 'review'
      )
  },

  getTaskFeedbackHistory: (taskId: string) => {
    return get().feedbackHistories.get(taskId) || []
  },

  getTaskRunningProcess: (taskId: string) => {
    return get().runningProcesses.get(taskId)
  },

  getTaskOpenTerminals: (taskId: string) => {
    return get().openTerminals.get(taskId) || []
  },

  getTaskReviewStatus: (taskId: string) => {
    return get().reviewStatuses.get(taskId)
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

// ============================================================================
// Task Detail Tabs Hooks
// ============================================================================

/**
 * Hook to get open task tabs
 */
export const useOpenTaskTabs = (): string[] => {
  return useAgentTaskStore(useShallow(state => state.openTaskTabs))
}

/**
 * Hook to get the active task tab
 */
export const useActiveTaskTab = (): string | null => {
  return useAgentTaskStore(state => state.activeTaskTab)
}

/**
 * Hook to check if a task tab is open
 */
export const useIsTaskTabOpen = (taskId: string): boolean => {
  return useAgentTaskStore(state => state.openTaskTabs.includes(taskId))
}

/**
 * Hook to get task tab actions
 */
export const useTaskTabActions = () => {
  return useAgentTaskStore(
    useShallow(state => ({
      openTaskTab: state.openTaskTab,
      closeTaskTab: state.closeTaskTab,
      setActiveTaskTab: state.setActiveTaskTab,
      closeAllTaskTabs: state.closeAllTaskTabs,
    }))
  )
}

/**
 * Hook to get tasks for open tabs with their data
 */
export const useOpenTaskTabsWithData = (): AgentTask[] => {
  return useAgentTaskStore(
    useShallow(state =>
      state.openTaskTabs
        .map(id => state.tasks.get(id))
        .filter((task): task is AgentTask => task !== undefined)
    )
  )
}

// ============================================================================
// Review Workflow Hooks
// ============================================================================

/**
 * Hook to get all tasks in review status
 * Requirements: 1.3
 */
export const useTasksInReview = (): AgentTask[] => {
  return useAgentTaskStore(
    useShallow(state =>
      state.taskOrder
        .map(id => state.tasks.get(id))
        .filter(
          (task): task is AgentTask =>
            task !== undefined && task.status === 'review'
        )
    )
  )
}

/**
 * Hook to get feedback history for a specific task
 * Requirements: 4.5
 */
export const useTaskFeedbackHistory = (taskId: string): TaskFeedback[] => {
  return useAgentTaskStore(
    useShallow(state => state.feedbackHistories.get(taskId) || [])
  )
}

/**
 * Hook to get running process for a specific task
 * Requirements: 2.3
 */
export const useTaskRunningProcess = (
  taskId: string
): ReviewRunningProcess | undefined => {
  return useAgentTaskStore(state => state.runningProcesses.get(taskId))
}

/**
 * Hook to get open terminals for a specific task
 * Requirements: 3.4
 */
export const useTaskOpenTerminals = (
  taskId: string
): ReviewTerminalSession[] => {
  return useAgentTaskStore(
    useShallow(state => state.openTerminals.get(taskId) || [])
  )
}

/**
 * Hook to get review status for a specific task
 * Requirements: 1.3
 */
export const useTaskReviewStatus = (
  taskId: string
): ReviewStatusInfo | undefined => {
  return useAgentTaskStore(state => state.reviewStatuses.get(taskId))
}

/**
 * Hook to check if review operations are loading
 */
export const useReviewLoading = (): boolean => {
  return useAgentTaskStore(state => state.isLoadingReview)
}

/**
 * Hook to get review error
 */
export const useReviewError = (): string | null => {
  return useAgentTaskStore(state => state.reviewError)
}

/**
 * Hook to get review workflow actions
 * Requirements: 4.2, 5.2, 6.4, 2.2, 3.2
 */
export const useReviewActions = () => {
  return useAgentTaskStore(
    useShallow(state => ({
      submitFeedback: state.submitFeedback,
      approveChanges: state.approveChanges,
      discardChanges: state.discardChanges,
      runProject: state.runProject,
      stopProject: state.stopProject,
      openTerminal: state.openTerminal,
      loadReviewStatus: state.loadReviewStatus,
      loadFeedbackHistory: state.loadFeedbackHistory,
      loadAvailableScripts: state.loadAvailableScripts,
      loadOpenTerminals: state.loadOpenTerminals,
      setReviewError: state.setReviewError,
      clearReviewState: state.clearReviewState,
    }))
  )
}
