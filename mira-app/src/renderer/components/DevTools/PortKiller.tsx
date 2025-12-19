/**
 * Port Killer Tool
 * Lists listening ports and allows killing processes
 */

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from 'renderer/components/ui/button'
import { Input } from 'renderer/components/ui/input'
import { ScrollArea } from 'renderer/components/ui/scroll-area'
import { Badge } from 'renderer/components/ui/badge'
import {
  IconRefresh,
  IconX,
  IconSearch,
  IconLoader2,
} from '@tabler/icons-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from 'renderer/components/ui/tooltip'

interface PortInfo {
  port: number
  pid: number
  processName: string
  protocol: string
  state: string
}

export function PortKiller(): React.JSX.Element {
  const [filter, setFilter] = useState('')
  const queryClient = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['devtools', 'ports', filter],
    queryFn: async () => {
      const result = await window.api.devTools.listPorts({ filter })
      if (result.error) throw new Error(result.error)
      return result.ports
    },
    refetchInterval: 5000,
  })

  const killMutation = useMutation({
    mutationFn: async (port: number) => {
      const result = await window.api.devTools.killPort({ port })
      if (!result.success) throw new Error(result.error || 'Failed to kill port')
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devtools', 'ports'] })
    },
  })

  const handleKill = useCallback(
    (port: number) => {
      if (confirm(`Kill process on port ${port}?`)) {
        killMutation.mutate(port)
      }
    },
    [killMutation]
  )

  const ports = data || []

  return (
    <div className="flex flex-col h-full gap-3 overflow-hidden">
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative flex-1">
          <IconSearch className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-xs"
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter by port or process name..."
            value={filter}
          />
        </div>
        <Button
          className="h-8"
          disabled={isLoading}
          onClick={() => refetch()}
          size="sm"
          variant="outline"
        >
          <IconRefresh
            className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}
          />
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {isLoading && ports.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
            Loading ports...
          </div>
        ) : ports.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-xs">
            No listening ports found
          </div>
        ) : (
          <div className="space-y-1">
            {ports.map((port: PortInfo) => (
              <div
                className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 group"
                key={`${port.port}-${port.pid}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Badge className="font-mono" variant="secondary">
                    :{port.port}
                  </Badge>
                  <span className="text-xs truncate">{port.processName}</span>
                  <span className="text-xs text-muted-foreground">
                    PID: {port.pid}
                  </span>
                </div>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        disabled={killMutation.isPending}
                        onClick={() => handleKill(port.port)}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <IconX className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    }
                  />
                  <TooltipContent>Kill process</TooltipContent>
                </Tooltip>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {killMutation.isError && (
        <div className="text-xs text-destructive">
          {killMutation.error?.message}
        </div>
      )}
    </div>
  )
}
