/**
 * PinnedProcessIndicator Component
 *
 * Global indicator showing active pinned terminal processes.
 * Requirements: 12.1, 12.2, 12.3, 12.4
 */

import { useEffect, useState } from 'react'
import { IconPin, IconChevronUp, IconChevronDown } from '@tabler/icons-react'
import { Card, CardContent, CardHeader } from 'renderer/components/ui/card'
import { ScrollArea } from 'renderer/components/ui/scroll-area'
import { Badge } from 'renderer/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from 'renderer/components/ui/collapsible'
import type { PinnedProcess } from 'shared/models'

export function PinnedProcessIndicator(): React.JSX.Element | null {
  const [pinnedProcesses, setPinnedProcesses] = useState<PinnedProcess[]>([])
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    const fetchPinnedProcesses = async (): Promise<void> => {
      try {
        const response = await window.api.pty.getPinned({})
        setPinnedProcesses(response.processes)
      } catch (error) {
        console.error('Failed to fetch pinned processes:', error)
      }
    }

    fetchPinnedProcesses()
    const interval = setInterval(fetchPinnedProcesses, 5000)

    return () => clearInterval(interval)
  }, [])

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

  if (pinnedProcesses.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className="shadow-lg backdrop-blur-sm bg-card/95">
        <Collapsible onOpenChange={setIsExpanded} open={isExpanded}>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="p-3 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <IconPin className="h-4 w-4 text-primary" fill="currentColor" />
                <span className="text-sm font-medium">
                  {pinnedProcesses.length} Pinned Process
                  {pinnedProcesses.length !== 1 ? 'es' : ''}
                </span>
                {isExpanded ? (
                  <IconChevronDown className="h-4 w-4 ml-auto text-muted-foreground" />
                ) : (
                  <IconChevronUp className="h-4 w-4 ml-auto text-muted-foreground" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <ScrollArea className="max-h-60">
              <CardContent className="p-0">
                {pinnedProcesses.map(process => (
                  <div className="px-3 py-2 border-t" key={process.ptyId}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-mono truncate">
                          {process.command}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Project: {process.projectId.slice(0, 8)}...
                        </div>
                      </div>
                      <Badge className="text-xs shrink-0" variant="secondary">
                        {formatDuration(process.startTime)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  )
}
