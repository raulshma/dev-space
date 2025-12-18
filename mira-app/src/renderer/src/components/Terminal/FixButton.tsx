/**
 * FixButton Component
 *
 * Displays a Fix button near terminal errors to send error context to AI agent.
 * Requirements: 7.1, 7.4
 */

import { Wrench } from 'lucide-react'
import { useErrorStore } from 'renderer/stores/error-store'
import { createErrorContext } from 'renderer/lib/error-detector'
import type { DetectedError } from 'renderer/lib/error-detector'
import type { ErrorContext } from 'shared/models'

interface FixButtonProps {
  error: DetectedError
  onFixClick?: (errorId: string) => void
  onErrorContext?: (context: ErrorContext) => void
}

export function FixButton({
  error,
  onFixClick,
  onErrorContext,
}: FixButtonProps): React.JSX.Element {
  const removeError = useErrorStore(state => state.removeError)

  const handleClick = (): void => {
    // Create error context
    const errorContext = createErrorContext(error)

    // Send error context to parent (ProjectWorkspace -> ConversationView)
    if (onErrorContext) {
      onErrorContext(errorContext)
    }

    // Notify parent
    if (onFixClick) {
      onFixClick(error.id)
    }

    // Remove error after clicking fix
    removeError(error.id)
  }

  const handleDismiss = (e: React.MouseEvent): void => {
    e.stopPropagation()
    removeError(error.id)
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-red-900/20 border border-red-700/50 rounded-sm">
      <div className="flex-1">
        <div className="flex items-center gap-2 text-sm text-red-400">
          <span className="font-mono">Exit code: {error.exitCode}</span>
          <span className="text-red-600">•</span>
          <span className="text-red-500 truncate max-w-[200px]">
            {error.command}
          </span>
        </div>
      </div>

      <button
        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700
                   text-white text-sm rounded-sm transition-colors"
        onClick={handleClick}
        title="Send error to AI agent for fix suggestions"
      >
        <Wrench size={14} />
        <span>Fix</span>
      </button>

      <button
        className="px-2 py-1 text-red-400 hover:text-red-300 text-xs"
        onClick={handleDismiss}
        title="Dismiss error"
      >
        ✕
      </button>
    </div>
  )
}

interface TerminalErrorsProps {
  terminalId: string
  onFixClick?: (errorId: string) => void
  onErrorContext?: (context: ErrorContext) => void
}

export function TerminalErrors({
  terminalId,
  onFixClick,
  onErrorContext,
}: TerminalErrorsProps): React.JSX.Element | null {
  const errors = useErrorStore(state => state.getErrorsByTerminal(terminalId))

  return errors.length === 0 ? null : (
    <div className="absolute bottom-4 left-4 right-4 z-10 space-y-2 max-h-[200px] overflow-y-auto">
      {errors.map(error => (
        <FixButton
          error={error}
          key={error.id}
          onErrorContext={onErrorContext}
          onFixClick={onFixClick}
        />
      ))}
    </div>
  )
}
