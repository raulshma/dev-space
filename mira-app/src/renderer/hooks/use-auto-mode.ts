/**
 * Auto-Mode Hook
 *
 * Provides methods to manage auto-mode for a project and subscribes
 * to real-time state updates.
 * Requirements: 1.1, 1.3, 1.5, 1.6
 */

import { useEffect, useCallback } from 'react'
import {
  useAutoModeStore,
  useProjectAutoModeState,
  useIsAutoModeRunning,
  useConcurrencyLimit,
  useRunningTaskCount,
  useAutoModeLoading,
  useAutoModeError,
  type ProjectAutoModeState,
} from 'renderer/stores/auto-mode-store'

/**
 * Initialize auto-mode subscriptions - call ONCE at app root level
 */
export function useAutoModeInit() {
  // Subscribe to state change events from main process
  useEffect(() => {
    const unsubscribe = window.api.autoMode.onStateChanged(data => {
      useAutoModeStore.getState().setProjectState(data.projectPath, data.state)
    })

    return () => {
      unsubscribe()
    }
  }, [])
}

/**
 * Hook to manage auto-mode for a specific project
 * Loads initial state and provides actions
 */
export function useAutoMode(projectPath: string) {
  const state = useProjectAutoModeState(projectPath)
  const isLoading = useAutoModeLoading()
  const error = useAutoModeError()
  const { startAutoMode, stopAutoMode, setConcurrencyLimit, loadState } =
    useAutoModeStore()

  // Load initial state when project changes
  useEffect(() => {
    if (projectPath) {
      loadState(projectPath)
    }
  }, [projectPath, loadState])

  const start = useCallback(
    async (concurrencyLimit?: number) => {
      return startAutoMode(projectPath, concurrencyLimit)
    },
    [projectPath, startAutoMode]
  )

  const stop = useCallback(async () => {
    return stopAutoMode(projectPath)
  }, [projectPath, stopAutoMode])

  const setLimit = useCallback(
    async (limit: number) => {
      return setConcurrencyLimit(projectPath, limit)
    },
    [projectPath, setConcurrencyLimit]
  )

  return {
    state,
    isRunning: state?.isRunning ?? false,
    runningTaskCount: state?.runningTaskCount ?? 0,
    concurrencyLimit: state?.concurrencyLimit ?? 1,
    isLoading,
    error,
    start,
    stop,
    setConcurrencyLimit: setLimit,
  }
}

/**
 * Hook to get auto-mode state for a project (read-only)
 */
export function useAutoModeState(
  projectPath: string
): ProjectAutoModeState | undefined {
  return useProjectAutoModeState(projectPath)
}

/**
 * Hook to check if auto-mode is running for a project
 */
export { useIsAutoModeRunning }

/**
 * Hook to get the concurrency limit for a project
 */
export { useConcurrencyLimit }

/**
 * Hook to get the running task count for a project
 */
export { useRunningTaskCount }

/**
 * Hook to get loading state
 */
export { useAutoModeLoading }

/**
 * Hook to get error state
 */
export { useAutoModeError }
