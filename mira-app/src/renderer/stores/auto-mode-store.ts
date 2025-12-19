/**
 * Auto-Mode Store - Zustand state management for auto-mode operations
 *
 * Manages per-project auto-mode state including running status,
 * concurrency limits, and task counts.
 * Requirements: 1.1, 1.3, 1.5, 1.6
 */

import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

// ============================================================================
// Types
// ============================================================================

/**
 * Auto-mode state for a single project
 */
export interface ProjectAutoModeState {
  isRunning: boolean
  runningTaskCount: number
  concurrencyLimit: number
  lastStartedTaskId: string | null
}

/**
 * Auto-mode store state
 */
export interface AutoModeStoreState {
  // Per-project auto-mode state
  projectStates: Map<string, ProjectAutoModeState>
  isLoading: boolean
  error: string | null

  // Actions
  setProjectState: (
    projectPath: string,
    state: Partial<ProjectAutoModeState>
  ) => void
  removeProjectState: (projectPath: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // Async actions (call IPC)
  startAutoMode: (projectPath: string, concurrencyLimit?: number) => Promise<void>
  stopAutoMode: (projectPath: string) => Promise<void>
  setConcurrencyLimit: (projectPath: string, limit: number) => Promise<void>
  loadState: (projectPath: string) => Promise<void>
}

// ============================================================================
// Default State
// ============================================================================

const DEFAULT_PROJECT_STATE: ProjectAutoModeState = {
  isRunning: false,
  runningTaskCount: 0,
  concurrencyLimit: 1,
  lastStartedTaskId: null,
}

// ============================================================================
// Store
// ============================================================================

export const useAutoModeStore = create<AutoModeStoreState>((set, get) => ({
  // Initial state
  projectStates: new Map(),
  isLoading: false,
  error: null,

  // Synchronous actions
  setProjectState: (projectPath, updates) =>
    set(state => {
      const newStates = new Map(state.projectStates)
      const existing = newStates.get(projectPath) || { ...DEFAULT_PROJECT_STATE }
      newStates.set(projectPath, { ...existing, ...updates })
      return { projectStates: newStates, error: null }
    }),

  removeProjectState: projectPath =>
    set(state => {
      const newStates = new Map(state.projectStates)
      newStates.delete(projectPath)
      return { projectStates: newStates }
    }),

  setLoading: loading => set({ isLoading: loading }),

  setError: error => set({ error }),

  // Async actions
  startAutoMode: async (projectPath, concurrencyLimit) => {
    const { setProjectState, setError, setLoading } = get()
    setLoading(true)
    setError(null)

    try {
      const response = await window.api.autoMode.start({
        projectPath,
        concurrencyLimit,
      })

      if (response.success) {
        setProjectState(projectPath, {
          isRunning: true,
          concurrencyLimit: concurrencyLimit ?? 1,
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start auto-mode'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  },

  stopAutoMode: async projectPath => {
    const { setProjectState, setError, setLoading } = get()
    setLoading(true)
    setError(null)

    try {
      const response = await window.api.autoMode.stop({ projectPath })

      if (response.success) {
        setProjectState(projectPath, { isRunning: false })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to stop auto-mode'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  },

  setConcurrencyLimit: async (projectPath, limit) => {
    const { setProjectState, setError, setLoading } = get()
    setLoading(true)
    setError(null)

    try {
      const response = await window.api.autoMode.setConcurrency({
        projectPath,
        limit,
      })

      if (response.success) {
        setProjectState(projectPath, { concurrencyLimit: limit })
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to set concurrency limit'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  },

  loadState: async projectPath => {
    const { setProjectState, setError, setLoading } = get()
    setLoading(true)
    setError(null)

    try {
      const response = await window.api.autoMode.getState({ projectPath })

      if (response.state) {
        setProjectState(projectPath, response.state)
      } else {
        // Initialize with default state if none exists
        setProjectState(projectPath, { ...DEFAULT_PROJECT_STATE })
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load auto-mode state'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  },
}))

// ============================================================================
// Selectors / Custom Hooks
// ============================================================================

/**
 * Hook to get auto-mode state for a specific project
 */
export const useProjectAutoModeState = (
  projectPath: string
): ProjectAutoModeState | undefined => {
  return useAutoModeStore(state => state.projectStates.get(projectPath))
}

/**
 * Hook to check if auto-mode is running for a project
 */
export const useIsAutoModeRunning = (projectPath: string): boolean => {
  return useAutoModeStore(
    state => state.projectStates.get(projectPath)?.isRunning ?? false
  )
}

/**
 * Hook to get the concurrency limit for a project
 */
export const useConcurrencyLimit = (projectPath: string): number => {
  return useAutoModeStore(
    state => state.projectStates.get(projectPath)?.concurrencyLimit ?? 1
  )
}

/**
 * Hook to get the running task count for a project
 */
export const useRunningTaskCount = (projectPath: string): number => {
  return useAutoModeStore(
    state => state.projectStates.get(projectPath)?.runningTaskCount ?? 0
  )
}

/**
 * Hook to get all projects with auto-mode enabled
 */
export const useAutoModeProjects = (): string[] => {
  return useAutoModeStore(
    useShallow(state =>
      Array.from(state.projectStates.entries())
        .filter(([_, s]) => s.isRunning)
        .map(([path]) => path)
    )
  )
}

/**
 * Hook to get loading state
 */
export const useAutoModeLoading = (): boolean => {
  return useAutoModeStore(state => state.isLoading)
}

/**
 * Hook to get error state
 */
export const useAutoModeError = (): string | null => {
  return useAutoModeStore(state => state.error)
}

/**
 * Hook to get auto-mode actions
 */
export const useAutoModeActions = () => {
  return useAutoModeStore(
    useShallow(state => ({
      startAutoMode: state.startAutoMode,
      stopAutoMode: state.stopAutoMode,
      setConcurrencyLimit: state.setConcurrencyLimit,
      loadState: state.loadState,
      setProjectState: state.setProjectState,
    }))
  )
}
