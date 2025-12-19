/**
 * Shell Store
 *
 * Manages the VS Code-like shell layout state.
 */

import { create } from 'zustand'

export type ShellTab =
  | 'projects'
  | 'files'
  | 'git'
  | 'scripts'
  | 'commands'
  | 'tasks'
  | 'agents'

interface ShellState {
  activeTab: ShellTab
  setActiveTab: (tab: ShellTab) => void
}

export const useShellStore = create<ShellState>(set => ({
  activeTab: 'projects',
  setActiveTab: (tab: ShellTab) => set({ activeTab: tab }),
}))
