/**
 * ErrorBoundary Component
 *
 * Catches React errors and displays a fallback UI with recovery options.
 * Requirements: 18.4
 */

import { Component, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  reset = (): void => {
    this.setState({
      hasError: false,
      error: null
    })
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset)
      }

      return (
        <div className="flex items-center justify-center h-screen bg-neutral-50">
          <div className="max-w-md p-6 bg-white border border-red-200 rounded-sm shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">⚠️</span>
              <h2 className="text-lg font-semibold text-neutral-900">Something went wrong</h2>
            </div>
            <p className="text-sm text-neutral-600 mb-4">
              An unexpected error occurred. You can try to recover or reload the application.
            </p>
            <details className="mb-4">
              <summary className="text-sm text-neutral-500 cursor-pointer hover:text-neutral-700">
                Error details
              </summary>
              <pre className="mt-2 p-3 bg-neutral-100 text-xs text-neutral-800 rounded-sm overflow-auto max-h-40">
                {this.state.error.message}
                {'\n\n'}
                {this.state.error.stack}
              </pre>
            </details>
            <div className="flex gap-2">
              <button
                onClick={this.reset}
                className="px-4 py-2 bg-amber-500 text-white rounded-sm hover:bg-amber-600 transition-colors"
              >
                Try to recover
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-neutral-200 text-neutral-700 rounded-sm hover:bg-neutral-300 transition-colors"
              >
                Reload application
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
