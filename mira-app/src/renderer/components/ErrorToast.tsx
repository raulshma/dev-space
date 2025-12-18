/**
 * ErrorToast Component
 *
 * Displays error notifications with recovery options.
 * Requirements: 18.4
 */

import { useEffect, useState } from 'react'
import { X, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { useErrorStore } from 'renderer/stores/error-store'
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from 'renderer/components/ui/alert'
import { Button } from 'renderer/components/ui/button'

export function ErrorToast(): React.JSX.Element | null {
  const errors = useErrorStore(state => state.appErrors)
  const dismissError = useErrorStore(state => state.dismissAppError)
  const [visible, setVisible] = useState<Record<string, boolean>>({})

  // Auto-dismiss errors after 10 seconds
  useEffect(() => {
    const timers: Record<string, NodeJS.Timeout> = {}

    errors.forEach(error => {
      if (!error.persistent && !timers[error.id]) {
        timers[error.id] = setTimeout(() => {
          dismissError(error.id)
        }, 10000)
      }
    })

    return () => {
      Object.values(timers).forEach(clearTimeout)
    }
  }, [errors, dismissError])

  // Animate in new errors
  useEffect(() => {
    errors.forEach(error => {
      if (!visible[error.id]) {
        setTimeout(() => {
          setVisible(prev => ({ ...prev, [error.id]: true }))
        }, 10)
      }
    })
  }, [errors, visible])

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />
      default:
        return <Info className="h-4 w-4 text-blue-500" />
    }
  }

  return errors.length === 0 ? null : (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md">
      {errors.map(error => (
        <Alert
          className={`shadow-lg transition-all duration-300 ${
            visible[error.id]
              ? 'opacity-100 translate-x-0'
              : 'opacity-0 translate-x-4'
          }`}
          key={error.id}
          variant={error.severity === 'error' ? 'destructive' : 'default'}
        >
          {getIcon(error.severity)}
          <AlertTitle className="flex items-center justify-between">
            {error.title}
            <Button
              aria-label="Dismiss"
              onClick={() => dismissError(error.id)}
              size="icon-xs"
              variant="ghost"
            >
              <X className="h-3 w-3" />
            </Button>
          </AlertTitle>
          <AlertDescription>
            <p>{error.message}</p>
            {error.details && (
              <details className="mt-2">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                  Technical details
                </summary>
                <pre className="mt-1 p-2 bg-muted text-xs rounded-sm overflow-auto max-h-32">
                  {typeof error.details === 'string'
                    ? error.details
                    : JSON.stringify(error.details, null, 2)}
                </pre>
              </details>
            )}
            {error.recoveryAction && (
              <Button
                className="mt-2 p-0 h-auto"
                onClick={() => {
                  error.recoveryAction?.action()
                  dismissError(error.id)
                }}
                size="sm"
                variant="link"
              >
                {error.recoveryAction.label}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  )
}
