/**
 * Running Projects Store
 *
 * Manages state for running dev servers across projects.
 * Handles real-time status updates and log streaming.
 */

import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { RunningProject, RunningProjectStatus } from 'shared/models'

interface RunningProjectWithLogs extends RunningProject {
  logs: string[]
}

interface RunningProjectsState {
  projects: Map<string, RunningProjectWithLogs>
  isLoading: boolean
  error: string | null

  // Actions
  setProjects: (projects: RunningProject[]) => void
  addProject: (project: RunningProject) => void
  updateProjectStatus: (
    projectId: string,
    status: RunningProjectStatus,
    error?: string
  ) => void
  removeProject: (projectId: string) => void
  appendLog: (projectId: string, data: string) => void
  setLogs: (projectId: string, logs: string[]) => void
  clearLogs: (projectId: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useRunningProjectsStore = create<RunningProjectsState>(
  (set, get) => ({
    projects: new Map(),
    isLoading: false,
    error: null,

    setProjects: (projects: RunningProject[]) =>
      set(state => {
        const map = new Map<string, RunningProjectWithLogs>()
        for (const project of projects) {
          // Preserve existing logs if project was already in store
          const existing = state.projects.get(project.projectId)
          const existingLogs = existing?.logs ?? []
          map.set(project.projectId, { ...project, logs: existingLogs })
        }
        return { projects: map }
      }),

    addProject: (project: RunningProject) =>
      set(state => {
        const newProjects = new Map(state.projects)
        // Preserve existing logs if project was already added (e.g., from buffered output)
        const existing = newProjects.get(project.projectId)
        const existingLogs = existing?.logs ?? []
        newProjects.set(project.projectId, { ...project, logs: existingLogs })
        return { projects: newProjects }
      }),

    updateProjectStatus: (
      projectId: string,
      status: RunningProjectStatus,
      error?: string
    ) =>
      set(state => {
        const project = state.projects.get(projectId)
        if (!project) return state

        const newProjects = new Map(state.projects)
        newProjects.set(projectId, { ...project, status, error })
        return { projects: newProjects }
      }),

    removeProject: (projectId: string) =>
      set(state => {
        const newProjects = new Map(state.projects)
        newProjects.delete(projectId)
        return { projects: newProjects }
      }),

    appendLog: (projectId: string, data: string) =>
      set(state => {
        const newProjects = new Map(state.projects)
        const project = newProjects.get(projectId)

        if (project) {
          const newLogs = [...project.logs, data]
          // Keep only last 1000 log entries
          if (newLogs.length > 1000) {
            newLogs.splice(0, newLogs.length - 1000)
          }
          newProjects.set(projectId, { ...project, logs: newLogs })
        } else {
          // Create a placeholder entry to buffer logs until project info arrives
          newProjects.set(projectId, {
            id: `pending-${projectId}`,
            projectId,
            projectName: 'Loading...',
            projectPath: '',
            devCommand: '',
            ptyId: '',
            status: 'running',
            startedAt: new Date(),
            logs: [data],
          })
        }

        return { projects: newProjects }
      }),

    setLogs: (projectId: string, logs: string[]) =>
      set(state => {
        const newProjects = new Map(state.projects)
        const project = newProjects.get(projectId)

        if (project) {
          newProjects.set(projectId, { ...project, logs })
        } else {
          // Create a placeholder entry with the logs
          newProjects.set(projectId, {
            id: `pending-${projectId}`,
            projectId,
            projectName: 'Loading...',
            projectPath: '',
            devCommand: '',
            ptyId: '',
            status: 'running',
            startedAt: new Date(),
            logs,
          })
        }

        return { projects: newProjects }
      }),

    clearLogs: (projectId: string) =>
      set(state => {
        const project = state.projects.get(projectId)
        if (!project) return state

        const newProjects = new Map(state.projects)
        newProjects.set(projectId, { ...project, logs: [] })
        return { projects: newProjects }
      }),

    setLoading: (loading: boolean) => set({ isLoading: loading }),

    setError: (error: string | null) => set({ error }),
  })
)

// Selectors
export const useRunningProjects = () =>
  useRunningProjectsStore(
    useShallow(state => Array.from(state.projects.values()))
  )

export const useRunningProjectsCount = () =>
  useRunningProjectsStore(state => state.projects.size)

export const useRunningProject = (projectId: string) =>
  useRunningProjectsStore(state => state.projects.get(projectId))

export const useIsProjectRunning = (projectId: string) =>
  useRunningProjectsStore(state => {
    const project = state.projects.get(projectId)
    return project?.status === 'running' || project?.status === 'starting'
  })

export const useRunningProjectLogs = (projectId: string) =>
  useRunningProjectsStore(state => state.projects.get(projectId)?.logs ?? [])
