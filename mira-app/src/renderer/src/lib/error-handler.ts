/**
 * Error Handler Utility
 *
 * Provides utilities for handling and displaying errors in the UI.
 * Requirements: 18.4
 */

import { useErrorStore } from '../stores/error-store'
import { IPCError } from './ipc-client'

export interface ErrorHandlerOptions {
  title?: string
  severity?: 'error' | 'warning' | 'info'
  persistent?: boolean
  showDetails?: boolean
  recoveryAction?: {
    label: string
    action: () => void
  }
}

/**
 * Handle an error and display it in the UI
 */
export function handleError(error: unknown, options: ErrorHandlerOptions = {}): void {
  const { addAppError } = useErrorStore.getState()

  let title = options.title || 'An error occurred'
  let message = 'An unexpected error occurred. Please try again.'
  let details: string | object | undefined

  // Extract error information
  if (error instanceof IPCError) {
    title = options.title || 'Communication Error'
    message = error.message
    details =
      options.showDetails !== false ? { code: error.code, details: error.details } : undefined
  } else if (error instanceof Error) {
    message = error.message
    details = options.showDetails !== false ? error.stack : undefined
  } else if (typeof error === 'string') {
    message = error
  } else if (options.showDetails !== false) {
    details = JSON.stringify(error)
  }

  addAppError({
    title,
    message,
    severity: options.severity || 'error',
    details,
    persistent: options.persistent,
    recoveryAction: options.recoveryAction
  })
}

/**
 * Handle database errors
 */
export function handleDatabaseError(error: unknown, _operation: string): void {
  handleError(error, {
    title: 'Database Error',
    severity: 'error',
    persistent: true,
    recoveryAction: {
      label: 'Reload Application',
      action: () => window.location.reload()
    }
  })
}

/**
 * Handle IPC communication errors
 */
export function handleIPCError(error: unknown, _operation: string): void {
  handleError(error, {
    title: 'Communication Error',
    severity: 'error',
    showDetails: true
  })
}

/**
 * Handle PTY/Terminal errors
 */
export function handleTerminalError(error: unknown, _terminalId: string): void {
  handleError(error, {
    title: 'Terminal Error',
    severity: 'warning',
    showDetails: true
  })
}

/**
 * Handle Git operation errors
 */
export function handleGitError(error: unknown): void {
  handleError(error, {
    title: 'Git Operation Failed',
    severity: 'warning',
    showDetails: false
  })
}

/**
 * Show a success notification
 */
export function showSuccess(message: string, title: string = 'Success'): void {
  const { addAppError } = useErrorStore.getState()
  addAppError({
    title,
    message,
    severity: 'info'
  })
}

/**
 * Show a warning notification
 */
export function showWarning(message: string, title: string = 'Warning'): void {
  const { addAppError } = useErrorStore.getState()
  addAppError({
    title,
    message,
    severity: 'warning'
  })
}
