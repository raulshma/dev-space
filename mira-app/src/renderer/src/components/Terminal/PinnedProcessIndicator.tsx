/**
 * PinnedProcessIndicator Component
 *
 * Global indicator showing active pinned terminal processes.
 * Requirements: 12.1, 12.2, 12.3, 12.4
 */

import { useEffect, useState } from 'react'
import { Pin } from 'lucide-react'
import type { PinnedProcess } from '../../../../shared/models'

export function PinnedProcessIndicator(): React.JSX.Element {
  const [pinnedProcesses, setPinnedProcesses] = useState<PinnedProcess[]>([])
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    // Fetch pinned processes on mount
    const fetchPinnedProcesses = async (): Promise<void> => {
      try {
        const response = await window.api.pty.getPinned({})
        setPinnedProcesses(response.processes)
      } catch (error) {
        console.error('Failed to fetch pinned processes:', error)
      }
    }

    fetchPinnedProcesses()

    // Poll for updates every 5 seconds
    const interval = setInterval(fetchPinnedProcesses, 5000)

    return () => clearInterval(interval)
  }, [])

  if (pinnedProcesses.length === 0) {
    return <></>
  }

  const formatDuration = (startTime: Date): string => {
    const now = new Date()
    const start = new Date(startTime)
    const diffMs = now.getTime() - start.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`

    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`

    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div
        className={`
          bg-amber-900/90 backdrop-blur-sm border border-amber-700/50 rounded-sm
          shadow-lg transition-all duration-200
          ${isExpanded ? 'w-80' : 'w-auto'}
        `}
      >
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-3 py-2 w-full hover:bg-amber-800/50 transition-colors"
        >
          <Pin size={16} className="text-amber-400" fill="currentColor" />
          <span className="text-sm text-amber-100 font-medium">
            {pinnedProcesses.length} Pinned Process{pinnedProcesses.length !== 1 ? 'es' : ''}
          </span>
          <span className="ml-auto text-amber-400 text-xs">
            {isExpanded ? '▼' : '▲'}
          </span>
        </button>

        {/* Expanded list */}
        {isExpanded && (
          <div className="border-t border-amber-700/50 max-h-60 overflow-y-auto">
            {pinnedProcesses.map((process) => (
              <div
                key={process.ptyId}
                className="px-3 py-2 border-b border-amber-700/30 last:border-b-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-amber-100 font-mono truncate">
                      {process.command}
                    </div>
                    <div className="text-xs text-amber-400 mt-0.5">
                      Project: {process.projectId.slice(0, 8)}...
                    </div>
                  </div>
                  <div className="text-xs text-amber-500 whitespace-nowrap">
                    {formatDuration(process.startTime)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
