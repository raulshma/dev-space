// Terminal state management using Zustand
// Requirements: 16.1, 16.3, 13.1

import { create } from 'zustand'
import type { TerminalLayout } from '../../../shared/models'

export interface TerminalInstance {
  id: string
  projectId: string
  ptyId: string
  isPinned: boolean
  title: string
  cwd: string
}

export interface TerminalState {
  terminals: Map<string, TerminalInstance>
  layouts: Map<string, TerminalLayout>
  focusedTerminalId: string | null

  // Actions
  addTerminal: (terminal: TerminalInstance) => void
  removeTerminal: (terminalId: string) => void
  updateTerminal: (terminalId: string, updates: Partial<TerminalInstance>) => void
  getTerminal: (terminalId: string) => TerminalInstance | undefined
  getTerminalsByProject: (projectId: string) => TerminalInstance[]
  setLayout: (projectId: string, layout: TerminalLayout) => void
  getLayout: (projectId: string) => TerminalLayout | undefined
  focusTerminal: (terminalId: string) => void
  pinTerminal: (terminalId: string) => void
  unpinTerminal: (terminalId: string) => void
  clearProject: (projectId: string) => void
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  terminals: new Map(),
  layouts: new Map(),
  focusedTerminalId: null,

  addTerminal: (terminal: TerminalInstance) =>
    set((state) => {
      const newTerminals = new Map(state.terminals)
      newTerminals.set(terminal.id, terminal)
      return { terminals: newTerminals }
    }),

  removeTerminal: (terminalId: string) =>
    set((state) => {
      const newTerminals = new Map(state.terminals)
      newTerminals.delete(terminalId)
      return {
        terminals: newTerminals,
        focusedTerminalId: state.focusedTerminalId === terminalId ? null : state.focusedTerminalId
      }
    }),

  updateTerminal: (terminalId: string, updates: Partial<TerminalInstance>) =>
    set((state) => {
      const terminal = state.terminals.get(terminalId)
      if (!terminal) return state

      const newTerminals = new Map(state.terminals)
      newTerminals.set(terminalId, { ...terminal, ...updates })
      return { terminals: newTerminals }
    }),

  getTerminal: (terminalId: string) => {
    return get().terminals.get(terminalId)
  },

  getTerminalsByProject: (projectId: string) => {
    const terminals = get().terminals
    return Array.from(terminals.values()).filter((t) => t.projectId === projectId)
  },

  setLayout: (projectId: string, layout: TerminalLayout) =>
    set((state) => {
      const newLayouts = new Map(state.layouts)
      newLayouts.set(projectId, layout)
      return { layouts: newLayouts }
    }),

  getLayout: (projectId: string) => {
    return get().layouts.get(projectId)
  },

  focusTerminal: (terminalId: string) =>
    set({
      focusedTerminalId: terminalId
    }),

  pinTerminal: (terminalId: string) =>
    set((state) => {
      const terminal = state.terminals.get(terminalId)
      if (!terminal) return state

      const newTerminals = new Map(state.terminals)
      newTerminals.set(terminalId, { ...terminal, isPinned: true })
      return { terminals: newTerminals }
    }),

  unpinTerminal: (terminalId: string) =>
    set((state) => {
      const terminal = state.terminals.get(terminalId)
      if (!terminal) return state

      const newTerminals = new Map(state.terminals)
      newTerminals.set(terminalId, { ...terminal, isPinned: false })
      return { terminals: newTerminals }
    }),

  clearProject: (projectId: string) =>
    set((state) => {
      const newTerminals = new Map(state.terminals)
      const newLayouts = new Map(state.layouts)

      // Remove all terminals for this project
      Array.from(newTerminals.values())
        .filter((t) => t.projectId === projectId)
        .forEach((t) => newTerminals.delete(t.id))

      // Remove layout for this project
      newLayouts.delete(projectId)

      return {
        terminals: newTerminals,
        layouts: newLayouts,
        focusedTerminalId:
          state.focusedTerminalId &&
          state.terminals.get(state.focusedTerminalId)?.projectId === projectId
            ? null
            : state.focusedTerminalId
      }
    })
}))
