/**
 * Task Killer Tool
 * Lists running processes and allows killing them
 */

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from 'renderer/components/ui/button'
import { Input } from 'renderer/components/ui/input'
import { ScrollArea } from 'renderer/components/ui/scroll-area'
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

interface ProcessInfo {
  pid: number
  name: string
  cpu: number
  memory: number
}

export function TaskKiller(): React.JSX.Element {
  const [filter, setFilter] = useState('')
  const queryClient = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['devtools', 'tasks', filter],
    queryFn: async () => {
      const result = await window.api.devTools.listTasks({ filter })
      if (result.error) throw new Error(result.error)
      return result.processes
    },
    refetchInterval: 5000,
  })

  const killMutation = useMutation({
    mutationFn: async ({ pid, force }: { pid: number; force: boolean }) => {
      const result = await window.api.devTools.killTask({ pid, force })
      if (!result.success) throw new Error(result.error || 'Failed to kill task')
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devtools', 'tasks'] })
    },
  })

  const handleKill = useCallback(
    (pid: number, name: string, force = false) => {
      if (confirm(`Kill process "${name}" (PID: ${pid})${force ? ' forcefully' : ''}?`)) {
        killMutation.mutate({ pid, force })
      }
    },
    [killMutation]
  )

  const processes = data || []

  return (
    <div className="flex flex-col h-full gap-3 overflow-hidden">
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative flex-1">
          <IconSearch className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-xs"
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter by name or PID..."
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

      <div className="grid grid-cols-[1fr_60px_70px_32px] gap-2 px-2 text-xs text-muted-foreground font-medium shrink-0">
        <span>Process</span>
        <span className="text-right">CPU</span>
        <span className="text-right">Memory</span>
        <span />
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {isLoading && processes.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
            Loading processes...
          </div>
        ) : processes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-xs">
            No processes found
          </div>
        ) : (
          <div className="space-y-0.5">
            {processes.map((proc: ProcessInfo) => (
              <div
                className="grid grid-cols-[1fr_60px_70px_32px] gap-2 items-center p-2 rounded-md hover:bg-muted/50 group"
                key={proc.pid}
              >
                <div className="min-w-0">
                  <div className="text-xs truncate">{proc.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    PID: {proc.pid}
                  </div>
                </div>
                <span className="text-xs text-right tabular-nums">
                  {proc.cpu.toFixed(1)}%
                </span>
                <span className="text-xs text-right tabular-nums">
                  {proc.memory.toFixed(1)} MB
                </span>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        disabled={killMutation.isPending}
                        onClick={() => handleKill(proc.pid, proc.name, true)}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <IconX className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    }
                  />
                  <TooltipContent>Force kill</TooltipContent>
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
