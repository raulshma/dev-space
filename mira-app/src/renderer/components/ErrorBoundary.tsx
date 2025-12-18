/**
 * ErrorBoundary Component
 *
 * Catches React errors and displays a fallback UI with recovery options.
 * Requirements: 18.4
 */

import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from 'renderer/components/ui/alert'
import { Button } from 'renderer/components/ui/button'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  reset = (): void => {
    this.setState({
      hasError: false,
      error: null,
    })
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset)
      }

      return (
        <div className="flex items-center justify-center h-screen bg-background">
          <Alert className="max-w-md" variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>
              <p className="mb-4">
                An unexpected error occurred. You can try to recover or reload
                the application.
              </p>
              <details className="mb-4">
                <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                  Error details
                </summary>
                <pre className="mt-2 p-3 bg-muted text-xs rounded-sm overflow-auto max-h-40">
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
              </details>
              <div className="flex gap-2">
                <Button onClick={this.reset}>Try to recover</Button>
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                >
                  Reload application
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )
    }

    return this.props.children
  }
}
