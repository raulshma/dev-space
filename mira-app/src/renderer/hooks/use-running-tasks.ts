/**
 * Running Tasks Hook
 *
 * Provides methods to manage the global running tasks view and subscribes
 * to real-time task updates. Polls every 2 seconds as backup.
 * Requirements: 2.1, 2.4, 2.7
 */

import { useEffect, useCallback } from 'react'
import {
  useRunningTasksStore,
  useRunningTasks as useRunningTasksSelector,
  useRunningTasksCount,
  useRunningTask,
  useRunningTasksForProject,
  useRunningTasksCountForProject,
  useAutoModeTasks,
  useHasRunningTasks,
  useRunningTasksLoading,
  useRunningTasksError,
  useIsPolling,
} from 'renderer/stores/running-tasks-store'

/**
 * Initialize running tasks subscriptions - call ONCE at app root level
 * Sets up event listener and starts polling
 */
export function useRunningTasksInit() {
  // Subscribe to task update events from main process
  useEffect(() => {
    const unsubscribe = window.api.runningTasks.onUpdated(data => {
      useRunningTasksStore.getState().setTasks(data.tasks)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  // Start polling on mount, stop on unmount
  useEffect(() => {
    const { startPolling, stopPolling } = useRunningTasksStore.getState()

    // Start polling with 2 second interval (Requirement 2.7)
    startPolling(2000)

    return () => {
      stopPolling()
    }
  }, [])
}

/**
 * Hook to get running tasks and actions
 */
export function useRunningTasksManager() {
  const tasks = useRunningTasksSelector()
  const isLoading = useRunningTasksLoading()
  const error = useRunningTasksError()
  const { refreshTasks, stopTask: stopTaskAction } = useRunningTasksStore()

  const stopTask = useCallback(
    async (taskId: string) => {
      return stopTaskAction(taskId)
    },
    [stopTaskAction]
  )

  const refresh = useCallback(async () => {
    return refreshTasks()
  }, [refreshTasks])

  return {
    tasks,
    isLoading,
    error,
    stopTask,
    refresh,
  }
}

/**
 * Hook to get all running tasks (read-only)
 */
export { useRunningTasksSelector as useRunningTasks }

/**
 * Hook to get running tasks count
 */
export { useRunningTasksCount }

/**
 * Hook to get a specific running task by ID
 */
export { useRunningTask }

/**
 * Hook to get running tasks for a specific project
 */
export { useRunningTasksForProject }

/**
 * Hook to get running tasks count for a specific project
 */
export { useRunningTasksCountForProject }

/**
 * Hook to get auto-mode tasks only
 */
export { useAutoModeTasks }

/**
 * Hook to check if any tasks are running
 */
export { useHasRunningTasks }

/**
 * Hook to get loading state
 */
export { useRunningTasksLoading }

/**
 * Hook to get error state
 */
export { useRunningTasksError }

/**
 * Hook to get polling state
 */
export { useIsPolling }
