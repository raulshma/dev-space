/**
 * Worktrees Hook
 *
 * Provides methods to manage git worktrees for a project.
 * Requirements: 4.5, 4.6
 */

import { useState, useEffect, useCallback } from 'react'
import type { WorktreeInfo } from 'shared/ipc-types'

/**
 * Hook to manage worktrees for a specific project
 */
export function useWorktrees(projectPath: string | null) {
  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load worktrees when project changes
  useEffect(() => {
    if (!projectPath) {
      setWorktrees([])
      return
    }

    const loadWorktrees = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await window.api.worktrees.list({ projectPath })
        setWorktrees(response.worktrees)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to load worktrees'
        setError(message)
      } finally {
        setIsLoading(false)
      }
    }

    loadWorktrees()
  }, [projectPath])

  const createWorktree = useCallback(
    async (
      branchName: string,
      taskId?: string
    ): Promise<WorktreeInfo | null> => {
      if (!projectPath) return null

      setIsLoading(true)
      setError(null)

      try {
        const response = await window.api.worktrees.create({
          projectPath,
          branchName,
          taskId,
        })

        // Add to local state
        setWorktrees(prev => [...prev, response.worktree])

        return response.worktree
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to create worktree'
        setError(message)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [projectPath]
  )

  const deleteWorktree = useCallback(
    async (worktreePath: string): Promise<boolean> => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await window.api.worktrees.delete({ worktreePath })

        if (response.success) {
          // Remove from local state
          setWorktrees(prev => prev.filter(w => w.path !== worktreePath))
        }

        return response.success
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to delete worktree'
        setError(message)
        return false
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const refreshWorktrees = useCallback(async (): Promise<void> => {
    if (!projectPath) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await window.api.worktrees.list({ projectPath })
      setWorktrees(response.worktrees)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to refresh worktrees'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [projectPath])

  const getWorktreeForTask = useCallback(
    (taskId: string): WorktreeInfo | undefined => {
      return worktrees.find(w => w.taskId === taskId)
    },
    [worktrees]
  )

  const getWorktreeForBranch = useCallback(
    (branch: string): WorktreeInfo | undefined => {
      return worktrees.find(w => w.branch === branch)
    },
    [worktrees]
  )

  return {
    worktrees,
    isLoading,
    error,
    createWorktree,
    deleteWorktree,
    refreshWorktrees,
    getWorktreeForTask,
    getWorktreeForBranch,
  }
}

/**
 * Hook to get worktree for a specific task
 */
export function useWorktreeForTask(taskId: string | null): WorktreeInfo | null {
  const [worktree, setWorktree] = useState<WorktreeInfo | null>(null)

  useEffect(() => {
    if (!taskId) {
      setWorktree(null)
      return
    }

    const loadWorktree = async () => {
      try {
        const response = await window.api.worktrees.getForTask({ taskId })
        setWorktree(response.worktree)
      } catch {
        setWorktree(null)
      }
    }

    loadWorktree()
  }, [taskId])

  return worktree
}

/**
 * Hook to get worktree count for a project
 */
export function useWorktreeCount(projectPath: string | null): number {
  const { worktrees } = useWorktrees(projectPath)
  return worktrees.length
}

/**
 * Hook to get unique branches from worktrees
 */
export function useWorktreeBranches(projectPath: string | null): string[] {
  const { worktrees } = useWorktrees(projectPath)
  return [...new Set(worktrees.map(w => w.branch))]
}
