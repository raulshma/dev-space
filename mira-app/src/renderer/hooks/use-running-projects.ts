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

export function useRunningProjectsManager() {
  const {
    setProjects,
    addProject,
    updateProjectStatus,
    removeProject,
    appendLog,
    setLoading,
    setError,
  } = useRunningProjectsStore()

  // Subscribe to status updates and output
  useEffect(() => {
    const unsubscribeStatus = window.api.runningProjects.onStatusUpdate(
      data => {
        updateProjectStatus(data.projectId, data.status, data.error)
        if (data.status === 'stopped' || data.status === 'error') {
          // Optionally remove after a delay
          setTimeout(() => {
            removeProject(data.projectId)
          }, 5000)
        }
      }
    )

    const unsubscribeOutput = window.api.runningProjects.onOutput(data => {
      appendLog(data.projectId, data.data)
    })

    return () => {
      unsubscribeStatus()
      unsubscribeOutput()
    }
  }, [updateProjectStatus, removeProject, appendLog])

  // Load initial running projects
  useEffect(() => {
    const loadProjects = async () => {
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
        setLoading(false)
      }
    }

    loadProjects()
  }, [setProjects, setLoading, setError])

  const startProject = useCallback(
    async (projectId: string, devCommand?: string) => {
      setLoading(true)
      setError(null)
      try {
        const response = (await window.api.runningProjects.start({
          projectId,
          devCommand,
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
