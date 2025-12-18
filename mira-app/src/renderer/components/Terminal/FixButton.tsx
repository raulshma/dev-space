/**
 * FixButton Component
 *
 * Displays a Fix button near terminal errors to send error context to AI agent.
 * Requirements: 7.1, 7.4
 */

import { Wrench, X } from 'lucide-react'
import { useErrorStore, useErrorsByTerminal } from 'renderer/stores/error-store'
import { createErrorContext } from 'renderer/lib/error-detector'
import { Button } from 'renderer/components/ui/button'
import { Alert, AlertDescription } from 'renderer/components/ui/alert'
import { ScrollArea } from 'renderer/components/ui/scroll-area'
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
    const errorContext = createErrorContext(error)

    if (onErrorContext) {
      onErrorContext(errorContext)
    }

    if (onFixClick) {
      onFixClick(error.id)
    }

    removeError(error.id)
  }

  const handleDismiss = (e: React.MouseEvent): void => {
    e.stopPropagation()
    removeError(error.id)
  }

  return (
    <Alert className="flex items-center gap-2" variant="destructive">
      <AlertDescription className="flex-1 flex items-center gap-2">
        <span className="font-mono text-sm">Exit code: {error.exitCode}</span>
        <span>•</span>
        <span className="truncate max-w-[200px] text-sm">{error.command}</span>
      </AlertDescription>

      <Button
        onClick={handleClick}
        size="sm"
        title="Send error to AI agent for fix suggestions"
      >
        <Wrench className="h-3 w-3 mr-1" />
        Fix
      </Button>

      <Button
        onClick={handleDismiss}
        size="icon-xs"
        title="Dismiss error"
        variant="ghost"
      >
        <X className="h-3 w-3" />
      </Button>
    </Alert>
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
  const errors = useErrorsByTerminal(terminalId)

  return errors.length === 0 ? null : (
    <ScrollArea className="absolute bottom-4 left-4 right-4 z-10 max-h-[200px]">
      <div className="space-y-2">
        {errors.map(error => (
          <FixButton
            error={error}
            key={error.id}
            onErrorContext={onErrorContext}
            onFixClick={onFixClick}
          />
        ))}
      </div>
    </ScrollArea>
  )
}
