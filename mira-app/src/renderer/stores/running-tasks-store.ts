/**
 * Running Tasks Store - Zustand state management for global running tasks view
 *
 * Manages the global list of running agent tasks across all projects.
 * Provides actions for refreshing and stopping tasks.
 * Requirements: 2.1, 2.4
 */

import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { RunningTaskInfo } from 'shared/ipc-types'

// ============================================================================
// Types
// ============================================================================

/**
 * Running tasks store state
 */
export interface RunningTasksStoreState {
  // Task list
  tasks: RunningTaskInfo[]
  isLoading: boolean
  error: string | null

  // Polling state
  isPolling: boolean
  pollIntervalId: ReturnType<typeof setInterval> | null

  // Actions
  setTasks: (tasks: RunningTaskInfo[]) => void
  addTask: (task: RunningTaskInfo) => void
  updateTask: (taskId: string, updates: Partial<RunningTaskInfo>) => void
  removeTask: (taskId: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // Async actions
  refreshTasks: () => Promise<void>
  stopTask: (taskId: string) => Promise<void>

  // Polling control
  startPolling: (intervalMs?: number) => void
  stopPolling: () => void
}

// ============================================================================
// Store
// ============================================================================

export const useRunningTasksStore = create<RunningTasksStoreState>(
  (set, get) => ({
    // Initial state
    tasks: [],
    isLoading: false,
    error: null,
    isPolling: false,
    pollIntervalId: null,

    // Synchronous actions
    setTasks: tasks => set({ tasks, error: null }),

    addTask: task =>
      set(state => {
        // Avoid duplicates
        if (state.tasks.some(t => t.taskId === task.taskId)) {
          return state
        }
        return { tasks: [...state.tasks, task] }
      }),

    updateTask: (taskId, updates) =>
      set(state => ({
        tasks: state.tasks.map(t =>
          t.taskId === taskId ? { ...t, ...updates } : t
        ),
      })),

    removeTask: taskId =>
      set(state => ({
        tasks: state.tasks.filter(t => t.taskId !== taskId),
      })),

    setLoading: loading => set({ isLoading: loading }),

    setError: error => set({ error }),

    // Async actions
    refreshTasks: async () => {
      const { setTasks, setError, setLoading } = get()
      setLoading(true)
      setError(null)

      try {
        const response = await window.api.runningTasks.getAll()
        setTasks(response.tasks)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to fetch running tasks'
        setError(message)
      } finally {
        setLoading(false)
      }
    },

    stopTask: async taskId => {
      const { removeTask, setError, setLoading } = get()
      setLoading(true)
      setError(null)

      try {
        const response = await window.api.runningTasks.stop({ taskId })

        if (response.success) {
          removeTask(taskId)
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to stop task'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },

    // Polling control
    startPolling: (intervalMs = 2000) => {
      const { pollIntervalId, refreshTasks } = get()

      // Don't start if already polling
      if (pollIntervalId) return

      // Initial fetch
      refreshTasks()

      // Start interval
      const id = setInterval(() => {
        refreshTasks()
      }, intervalMs)

      set({ isPolling: true, pollIntervalId: id })
    },

    stopPolling: () => {
      const { pollIntervalId } = get()

      if (pollIntervalId) {
        clearInterval(pollIntervalId)
        set({ isPolling: false, pollIntervalId: null })
      }
    },
  })
)

// ============================================================================
// Selectors / Custom Hooks
// ============================================================================

/**
 * Hook to get all running tasks
 */
export const useRunningTasks = (): RunningTaskInfo[] => {
  return useRunningTasksStore(useShallow(state => state.tasks))
}

/**
 * Hook to get running tasks count
 */
export const useRunningTasksCount = (): number => {
  return useRunningTasksStore(state => state.tasks?.length ?? 0)
}

/**
 * Hook to get a specific running task by ID
 */
export const useRunningTask = (taskId: string): RunningTaskInfo | undefined => {
  return useRunningTasksStore(state =>
    state.tasks.find(t => t.taskId === taskId)
  )
}

/**
 * Hook to get running tasks for a specific project
 */
export const useRunningTasksForProject = (
  projectPath: string
): RunningTaskInfo[] => {
  return useRunningTasksStore(
    useShallow(state => state.tasks.filter(t => t.projectPath === projectPath))
  )
}

/**
 * Hook to get running tasks count for a specific project
 */
export const useRunningTasksCountForProject = (projectPath: string): number => {
  return useRunningTasksStore(
    state => state.tasks?.filter(t => t.projectPath === projectPath).length ?? 0
  )
}

/**
 * Hook to get auto-mode tasks only
 */
export const useAutoModeTasks = (): RunningTaskInfo[] => {
  return useRunningTasksStore(
    useShallow(state => state.tasks.filter(t => t.isAutoMode))
  )
}

/**
 * Hook to check if any tasks are running
 */
export const useHasRunningTasks = (): boolean => {
  return useRunningTasksStore(state => (state.tasks?.length ?? 0) > 0)
}

/**
 * Hook to get loading state
 */
export const useRunningTasksLoading = (): boolean => {
  return useRunningTasksStore(state => state.isLoading)
}

/**
 * Hook to get error state
 */
export const useRunningTasksError = (): string | null => {
  return useRunningTasksStore(state => state.error)
}

/**
 * Hook to get polling state
 */
export const useIsPolling = (): boolean => {
  return useRunningTasksStore(state => state.isPolling)
}

/**
 * Hook to get running tasks actions
 */
export const useRunningTasksActions = () => {
  return useRunningTasksStore(
    useShallow(state => ({
      refreshTasks: state.refreshTasks,
      stopTask: state.stopTask,
      startPolling: state.startPolling,
      stopPolling: state.stopPolling,
      setTasks: state.setTasks,
      addTask: state.addTask,
      updateTask: state.updateTask,
      removeTask: state.removeTask,
    }))
  )
}
