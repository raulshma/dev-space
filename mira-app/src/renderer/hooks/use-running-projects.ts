/**
 * Running Projects Hook
 *
 * Provides methods to manage running dev servers and subscribes
 * to real-time status updates and log output.
 */

import { useEffect, useCallback } from 'react'
import {
  useRunningProjectsStore,
  useRunningProjects,
  useRunningProjectsCount,
  useIsProjectRunning,
} from 'renderer/stores/running-projects-store'

/**
 * Initialize running projects subscriptions - call ONCE at app root level
 */
export function useRunningProjectsInit() {
  // Subscribe to status updates and output - empty deps = run once on mount
  useEffect(() => {
    const unsubscribeStatus = window.api.runningProjects.onStatusUpdate(
      data => {
        useRunningProjectsStore
          .getState()
          .updateProjectStatus(data.projectId, data.status, data.error)
        if (data.status === 'stopped' || data.status === 'error') {
          setTimeout(() => {
            useRunningProjectsStore.getState().removeProject(data.projectId)
          }, 5000)
        }
      }
    )

    const unsubscribeOutput = window.api.runningProjects.onOutput(data => {
      useRunningProjectsStore.getState().appendLog(data.projectId, data.data)
    })

    return () => {
      unsubscribeStatus()
      unsubscribeOutput()
    }
  }, [])

  // Load initial running projects - empty deps = run once on mount
  useEffect(() => {
    const loadProjects = async () => {
      const { setProjects, setLoading, setError } =
        useRunningProjectsStore.getState()
      setLoading(true)
      try {
        const response = await window.api.runningProjects.list({})
        if ('projects' in response) {
          setProjects(response.projects)
        }
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : 'Failed to load running projects'
        )
      } finally {
        useRunningProjectsStore.getState().setLoading(false)
      }
    }

    loadProjects()
  }, [])
}

/**
 * Get running projects actions - can be called from any component
 */
export function useRunningProjectsManager() {
  const { addProject, removeProject, setLoading, setError } =
    useRunningProjectsStore()

  const startProject = useCallback(
    async (projectId: string, devCommand?: string, projectPath?: string, projectName?: string) => {
      setLoading(true)
      setError(null)
      try {
        const response = (await window.api.runningProjects.start({
          projectId,
          devCommand,
          projectPath,
          projectName,
        })) as {
          project?: import('shared/models').RunningProject
          error?: string
        }
        if (response.project) {
          addProject(response.project)
          return response.project
        }
        if (response.error) {
          setError(response.error)
          throw new Error(response.error)
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to start project'
        setError(message)
        throw error
      } finally {
        setLoading(false)
      }
    },
    [addProject, setLoading, setError]
  )

  const stopProject = useCallback(
    async (projectId: string) => {
      try {
        const response = await window.api.runningProjects.stop({ projectId })
        if ('success' in response && response.success) {
          removeProject(projectId)
        }
        return response.success
      } catch (error) {
        setError(
          error instanceof Error ? error.message : 'Failed to stop project'
        )
        return false
      }
    },
    [removeProject, setError]
  )

  const restartProject = useCallback(
    async (projectId: string) => {
      setLoading(true)
      try {
        const response = (await window.api.runningProjects.restart({
          projectId,
        })) as {
          project?: import('shared/models').RunningProject
          error?: string
        }
        if (response.project) {
          addProject(response.project)
          return response.project
        }
        if (response.error) {
          setError(response.error)
        }
      } catch (error) {
        setError(
          error instanceof Error ? error.message : 'Failed to restart project'
        )
      } finally {
        setLoading(false)
      }
    },
    [addProject, setLoading, setError]
  )

  const setDevCommand = useCallback(
    async (projectId: string, devCommand: string) => {
      try {
        const response = await window.api.runningProjects.setDevCommand({
          projectId,
          devCommand,
        })
        return 'success' in response && response.success
      } catch (error) {
        setError(
          error instanceof Error ? error.message : 'Failed to set dev command'
        )
        return false
      }
    },
    [setError]
  )

  const getDevCommand = useCallback(async (projectId: string) => {
    try {
      const response = await window.api.runningProjects.getDevCommand({
        projectId,
      })
      return 'devCommand' in response ? response.devCommand : null
    } catch {
      return null
    }
  }, [])

  const getLogs = useCallback(async (projectId: string, lines?: number) => {
    try {
      const response = await window.api.runningProjects.getLogs({
        projectId,
        lines,
      })
      return 'logs' in response ? response.logs : []
    } catch {
      return []
    }
  }, [])

  return {
    startProject,
    stopProject,
    restartProject,
    setDevCommand,
    getDevCommand,
    getLogs,
  }
}

// Re-export selectors for convenience
export { useRunningProjects, useRunningProjectsCount, useIsProjectRunning }
