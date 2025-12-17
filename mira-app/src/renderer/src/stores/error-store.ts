/**
 * Error State Management
 *
 * Manages terminal errors and Fix button state, plus global error notifications.
 * Requirements: 7.1, 7.4, 18.4
 */

import { create } from 'zustand'
import type { DetectedError } from 'renderer/lib/error-detector'

export interface AppError {
  id: string
  title: string
  message: string
  severity: 'error' | 'warning' | 'info'
  details?: string | object
  persistent?: boolean
  recoveryAction?: {
    label: string
    action: () => void
  }
  timestamp: Date
}

export interface ErrorState {
  errors: Map<string, DetectedError>
  appErrors: AppError[]

  // Terminal error actions
  addError: (error: DetectedError) => void
  removeError: (errorId: string) => void
  getError: (errorId: string) => DetectedError | undefined
  getErrorsByTerminal: (terminalId: string) => DetectedError[]
  clearTerminalErrors: (terminalId: string) => void
  clearAllErrors: () => void

  // Global error notification actions
  addAppError: (error: Omit<AppError, 'id' | 'timestamp'>) => void
  dismissAppError: (errorId: string) => void
  clearAppErrors: () => void
}

export const useErrorStore = create<ErrorState>((set, get) => ({
  errors: new Map(),
  appErrors: [],

  // Terminal error actions
  addError: (error: DetectedError) =>
    set(state => {
      const newErrors = new Map(state.errors)
      newErrors.set(error.id, error)
      return { errors: newErrors }
    }),

  removeError: (errorId: string) =>
    set(state => {
      const newErrors = new Map(state.errors)
      newErrors.delete(errorId)
      return { errors: newErrors }
    }),

  getError: (errorId: string) => {
    return get().errors.get(errorId)
  },

  getErrorsByTerminal: (terminalId: string) => {
    const errors = get().errors
    return Array.from(errors.values()).filter(e => e.terminalId === terminalId)
  },

  clearTerminalErrors: (terminalId: string) =>
    set(state => {
      const newErrors = new Map(state.errors)
      for (const e of Array.from(newErrors.values()).filter(
        e => e.terminalId === terminalId
      )) {
        newErrors.delete(e.id)
      }
      return { errors: newErrors }
    }),

  clearAllErrors: () =>
    set({
      errors: new Map(),
    }),

  // Global error notification actions
  addAppError: (error: Omit<AppError, 'id' | 'timestamp'>) =>
    set(state => ({
      appErrors: [
        ...state.appErrors,
        {
          ...error,
          id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
        },
      ],
    })),

  dismissAppError: (errorId: string) =>
    set(state => ({
      appErrors: state.appErrors.filter(e => e.id !== errorId),
    })),

  clearAppErrors: () =>
    set({
      appErrors: [],
    }),
}))
