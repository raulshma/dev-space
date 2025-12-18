// App-wide UI state management using Zustand
// Requirements: 16.1, 16.3, 13.1

import { create } from 'zustand'

export type ActiveView = 'dashboard' | 'workspace' | 'tasks'

export interface AppState {
  // UI State
  sidebarCollapsed: boolean
  agentPanelCollapsed: boolean
  zenMode: boolean
  activeProjectId: string | null
  activeTerminalId: string | null
  commandPaletteOpen: boolean
  settingsPanelOpen: boolean
  activeView: ActiveView

  // Previous state for Zen Mode restoration
  previousSidebarState: boolean
  previousAgentPanelState: boolean

  // Actions
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleAgentPanel: () => void
  setAgentPanelCollapsed: (collapsed: boolean) => void
  toggleZenMode: () => void
  hydrateWorkspaceState: (
    state: Partial<
      Pick<
        AppState,
        | 'sidebarCollapsed'
        | 'agentPanelCollapsed'
        | 'zenMode'
        | 'previousSidebarState'
        | 'previousAgentPanelState'
      >
    >
  ) => void
  setActiveProject: (id: string | null) => void
  setActiveTerminal: (id: string | null) => void
  setActiveView: (view: ActiveView) => void
  openTasksWithTask: (taskId: string) => void
  openCommandPalette: () => void
  closeCommandPalette: () => void
  openSettingsPanel: () => void
  closeSettingsPanel: () => void
}

export const useAppStore = create<AppState>(set => ({
  // Initial state
  sidebarCollapsed: false,
  agentPanelCollapsed: false,
  zenMode: false,
  activeProjectId: null,
  activeTerminalId: null,
  commandPaletteOpen: false,
  settingsPanelOpen: false,
  activeView: 'dashboard',
  previousSidebarState: false,
  previousAgentPanelState: false,

  // Actions
  toggleSidebar: () =>
    set(state => ({
      sidebarCollapsed: !state.sidebarCollapsed,
    })),

  setSidebarCollapsed: (collapsed: boolean) =>
    set({
      sidebarCollapsed: collapsed,
    }),

  toggleAgentPanel: () =>
    set(state => ({
      agentPanelCollapsed: !state.agentPanelCollapsed,
    })),

  setAgentPanelCollapsed: (collapsed: boolean) =>
    set({
      agentPanelCollapsed: collapsed,
    }),

  toggleZenMode: () =>
    set(state => {
      if (!state.zenMode) {
        // Entering Zen Mode - save current state and collapse panels
        return {
          zenMode: true,
          previousSidebarState: state.sidebarCollapsed,
          previousAgentPanelState: state.agentPanelCollapsed,
          sidebarCollapsed: true,
          agentPanelCollapsed: true,
        }
      }
      // Exiting Zen Mode - restore previous state
      return {
        zenMode: false,
        sidebarCollapsed: state.previousSidebarState,
        agentPanelCollapsed: state.previousAgentPanelState,
      }
    }),

  hydrateWorkspaceState: state =>
    set(current => ({
      ...current,
      ...state,
    })),

  setActiveProject: (id: string | null) =>
    set(() => ({
      activeProjectId: id,
      activeView: id ? 'workspace' : 'dashboard',
    })),

  setActiveTerminal: (id: string | null) =>
    set({
      activeTerminalId: id,
    }),

  setActiveView: (view: ActiveView) =>
    set({
      activeView: view,
    }),

  openTasksWithTask: (_taskId: string) =>
    set({
      activeView: 'tasks',
    }),

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
}))
