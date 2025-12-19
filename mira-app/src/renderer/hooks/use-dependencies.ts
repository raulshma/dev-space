/**
 * Task Dependencies Hook
 *
 * Provides methods to manage task dependencies and query blocking status.
 * Requirements: 5.1, 5.2, 5.5
 */

import { useState, useEffect, useCallback } from 'react'
import type { TaskGetBlockingStatusResponse } from 'shared/ipc-types'

/**
 * Blocking status for a task
 */
export interface BlockingStatus {
  taskId: string
  isBlocked: boolean
  blockingTasks: string[]
  failedDependencies: string[]
}

/**
 * Hook to manage dependencies for a specific task
 */
export function useTaskDependencies(taskId: string | null) {
  const [dependencies, setDependencies] = useState<string[]>([])
  const [blockingStatus, setBlockingStatus] = useState<BlockingStatus | null>(
    null
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load dependencies when task changes
  useEffect(() => {
    if (!taskId) {
      setDependencies([])
      setBlockingStatus(null)
      return
    }

    const loadDependencies = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const [depsResponse, statusResponse] = await Promise.all([
          window.api.dependencies.get({ taskId }),
          window.api.dependencies.getBlockingStatus({ taskId }),
        ])

        setDependencies(depsResponse.dependencies)
        setBlockingStatus(statusResponse.status)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to load dependencies'
        setError(message)
      } finally {
        setIsLoading(false)
      }
    }

    loadDependencies()
  }, [taskId])

  const setTaskDependencies = useCallback(
    async (dependsOn: string[]): Promise<boolean> => {
      if (!taskId) return false

      setIsLoading(true)
      setError(null)

      try {
        const response = await window.api.dependencies.set({
          taskId,
          dependsOn,
        })

        if (response.success) {
          setDependencies(dependsOn)
          // Refresh blocking status after updating dependencies
          const statusResponse = await window.api.dependencies.getBlockingStatus(
            { taskId }
          )
          setBlockingStatus(statusResponse.status)
        }

        return response.success
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to set dependencies'
        setError(message)
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [taskId]
  )

  const addDependency = useCallback(
    async (dependsOnTaskId: string): Promise<boolean> => {
      if (dependencies.includes(dependsOnTaskId)) return true
      return setTaskDependencies([...dependencies, dependsOnTaskId])
    },
    [dependencies, setTaskDependencies]
  )

  const removeDependency = useCallback(
    async (dependsOnTaskId: string): Promise<boolean> => {
      return setTaskDependencies(
        dependencies.filter(id => id !== dependsOnTaskId)
      )
    },
    [dependencies, setTaskDependencies]
  )

  const refreshBlockingStatus = useCallback(async (): Promise<void> => {
    if (!taskId) return

    try {
      const response = await window.api.dependencies.getBlockingStatus({
        taskId,
      })
      setBlockingStatus(response.status)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to refresh blocking status'
      setError(message)
    }
  }, [taskId])

  return {
    dependencies,
    blockingStatus,
    isBlocked: blockingStatus?.isBlocked ?? false,
    blockingTasks: blockingStatus?.blockingTasks ?? [],
    failedDependencies: blockingStatus?.failedDependencies ?? [],
    isLoading,
    error,
    setDependencies: setTaskDependencies,
    addDependency,
    removeDependency,
    refreshBlockingStatus,
  }
}

/**
 * Hook to get blocking status for a task (read-only)
 */
export function useBlockingStatus(taskId: string | null): BlockingStatus | null {
  const [status, setStatus] = useState<BlockingStatus | null>(null)

  useEffect(() => {
    if (!taskId) {
      setStatus(null)
      return
    }

    const loadStatus = async () => {
      try {
        const response = await window.api.dependencies.getBlockingStatus({
          taskId,
        })
        setStatus(response.status)
      } catch {
        setStatus(null)
      }
    }

    loadStatus()
  }, [taskId])

  return status
}

/**
 * Hook to check if a task is blocked
 */
export function useIsTaskBlocked(taskId: string | null): boolean {
  const status = useBlockingStatus(taskId)
  return status?.isBlocked ?? false
}

/**
 * Hook to get blocking tasks for a task
 */
export function useBlockingTasks(taskId: string | null): string[] {
  const status = useBlockingStatus(taskId)
  return status?.blockingTasks ?? []
}

/**
 * Hook to get failed dependencies for a task
 */
export function useFailedDependencies(taskId: string | null): string[] {
  const status = useBlockingStatus(taskId)
  return status?.failedDependencies ?? []
}
