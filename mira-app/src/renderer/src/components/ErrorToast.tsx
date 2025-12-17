/**
 * ErrorToast Component
 *
 * Displays error notifications with recovery options.
 * Requirements: 18.4
 */

import { useEffect, useState } from 'react'
import { useErrorStore } from 'renderer/stores/error-store'

export function ErrorToast(): React.JSX.Element {
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

  if (errors.length === 0) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md">
      {errors.map(error => (
        <div
          className={`bg-white border-l-4 ${
            error.severity === 'error'
              ? 'border-red-500'
              : error.severity === 'warning'
                ? 'border-amber-500'
                : 'border-blue-500'
          } rounded-sm shadow-lg p-4 transition-all duration-300 ${
            visible[error.id]
              ? 'opacity-100 translate-x-0'
              : 'opacity-0 translate-x-4'
          }`}
          key={error.id}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">
                  {error.severity === 'error'
                    ? '❌'
                    : error.severity === 'warning'
                      ? '⚠️'
                      : 'ℹ️'}
                </span>
                <h4 className="font-semibold text-neutral-900">
                  {error.title}
                </h4>
              </div>
              <p className="text-sm text-neutral-600">{error.message}</p>
              {error.details && (
                <details className="mt-2">
                  <summary className="text-xs text-neutral-500 cursor-pointer hover:text-neutral-700">
                    Technical details
                  </summary>
                  <pre className="mt-1 p-2 bg-neutral-100 text-xs text-neutral-800 rounded-sm overflow-auto max-h-32">
                    {typeof error.details === 'string'
                      ? error.details
                      : JSON.stringify(error.details, null, 2)}
                  </pre>
                </details>
              )}
              {error.recoveryAction && (
                <button
                  className="mt-2 text-sm text-amber-600 hover:text-amber-700 font-medium"
                  onClick={() => {
                    error.recoveryAction?.action()
                    dismissError(error.id)
                  }}
                >
                  {error.recoveryAction.label}
                </button>
              )}
            </div>
            <button
              aria-label="Dismiss"
              className="text-neutral-400 hover:text-neutral-600 transition-colors"
              onClick={() => dismissError(error.id)}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
