// App-wide UI state management using Zustand
// Requirements: 16.1, 16.3, 13.1

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type ActiveView = 'dashboard' | 'workspace' | 'tasks' | 'running-agents'

export interface AppState {
  // UI State
  sidebarCollapsed: boolean
  devToolsPanelCollapsed: boolean
  zenMode: boolean
  activeProjectId: string | null
  activeTerminalId: string | null
  commandPaletteOpen: boolean
  settingsPanelOpen: boolean
  activeView: ActiveView
  previousView: ActiveView | null
  preferredWorkspaceView: 'workspace' | 'tasks'
  tasksViewMode: 'table' | 'kanban'

  // Previous state for Zen Mode restoration
  previousSidebarState: boolean
  previousDevToolsPanelState: boolean

  // Actions
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleDevToolsPanel: () => void
  setDevToolsPanelCollapsed: (collapsed: boolean) => void
  toggleZenMode: () => void
  hydrateWorkspaceState: (
    state: Partial<
      Pick<
        AppState,
        | 'sidebarCollapsed'
        | 'devToolsPanelCollapsed'
        | 'zenMode'
        | 'previousSidebarState'
        | 'previousDevToolsPanelState'
      >
    >
  ) => void
  setActiveProject: (id: string | null) => void
  setActiveTerminal: (id: string | null) => void
  setActiveView: (view: ActiveView) => void
  setTasksViewMode: (mode: 'table' | 'kanban') => void
  openTasksWithTask: (taskId: string) => void
  openCommandPalette: () => void
  closeCommandPalette: () => void
  openSettingsPanel: () => void
  closeSettingsPanel: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      sidebarCollapsed: false,
      devToolsPanelCollapsed: false,
      zenMode: false,
      activeProjectId: null,
      activeTerminalId: null,
      commandPaletteOpen: false,
      settingsPanelOpen: false,
      activeView: 'dashboard',
      previousView: null,
      preferredWorkspaceView: 'tasks',
      tasksViewMode: 'kanban',
      previousSidebarState: false,
      previousDevToolsPanelState: false,

      // Actions
      toggleSidebar: () =>
        set(state => ({
          sidebarCollapsed: !state.sidebarCollapsed,
        })),

      setSidebarCollapsed: (collapsed: boolean) =>
        set({
          sidebarCollapsed: collapsed,
        }),

      toggleDevToolsPanel: () =>
        set(state => ({
          devToolsPanelCollapsed: !state.devToolsPanelCollapsed,
        })),

      setDevToolsPanelCollapsed: (collapsed: boolean) =>
        set({
          devToolsPanelCollapsed: collapsed,
        }),

      toggleZenMode: () =>
        set(state => {
          if (!state.zenMode) {
            // Entering Zen Mode - save current state and collapse panels
            return {
              zenMode: true,
              previousSidebarState: state.sidebarCollapsed,
              previousDevToolsPanelState: state.devToolsPanelCollapsed,
              sidebarCollapsed: true,
              devToolsPanelCollapsed: true,
            }
          }
          // Exiting Zen Mode - restore previous state
          return {
            zenMode: false,
            sidebarCollapsed: state.previousSidebarState,
            devToolsPanelCollapsed: state.previousDevToolsPanelState,
          }
        }),

      hydrateWorkspaceState: state =>
        set(current => ({
          ...current,
          ...state,
        })),

      setActiveProject: (id: string | null) => {
        const state = get()
        set({
          activeProjectId: id,
          activeView: id ? state.preferredWorkspaceView : 'dashboard',
          previousView: id ? 'dashboard' : state.activeView,
        })
      },

      setActiveTerminal: (id: string | null) =>
        set({
          activeTerminalId: id,
        }),

      setActiveView: (view: ActiveView) =>
        set(state => {
          const updates: Partial<AppState> = {
            activeView: view,
            previousView: state.activeView,
          }

          if (view === 'workspace' || view === 'tasks') {
            updates.preferredWorkspaceView = view
          }

          return updates
        }),

      setTasksViewMode: (mode: 'table' | 'kanban') =>
        set({
          tasksViewMode: mode,
        }),

      openTasksWithTask: (_taskId: string) =>
        set(state => ({
          activeView: 'tasks',
          previousView: state.activeView,
          preferredWorkspaceView: 'tasks',
        })),

      openCommandPalette: () =>
        set({
          commandPaletteOpen: true,
        }),

      closeCommandPalette: () =>
        set({
          commandPaletteOpen: false,
        }),

      openSettingsPanel: () =>
        set({
          settingsPanelOpen: true,
        }),

      closeSettingsPanel: () =>
        set({
          settingsPanelOpen: false,
        }),
    }),
    {
      name: 'mira-app-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({
        sidebarCollapsed: state.sidebarCollapsed,
        devToolsPanelCollapsed: state.devToolsPanelCollapsed,
        preferredWorkspaceView: state.preferredWorkspaceView,
        tasksViewMode: state.tasksViewMode,
      }),
    }
  )
)
