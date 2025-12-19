/**
 * Logs Dialog
 *
 * A dialog component for viewing live logs from running projects.
 * Features auto-scroll, clear logs, and proper terminal-like styling.
 */

import { memo, useEffect, useRef, useState, useCallback, useMemo } from 'react'
import {
  parseAnsiSequences,
  createColorPalette,
} from 'ansi-sequence-parser'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from 'renderer/components/ui/dialog'
import { Button } from 'renderer/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from 'renderer/components/ui/tooltip'
import {
  IconTrash,
  IconArrowDown,
  IconPlayerPlay,
  IconLoader2,
  IconPlayerStop,
  IconAlertCircle,
} from '@tabler/icons-react'
import { useRunningProjectsStore } from 'renderer/stores/running-projects-store'
import type { RunningProjectStatus } from 'shared/models'

// Terminal-style color palette
const colorPalette = createColorPalette({
  black: '#18181b',
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#eab308',
  blue: '#3b82f6',
  magenta: '#a855f7',
  cyan: '#06b6d4',
  white: '#f4f4f5',
  brightBlack: '#71717a',
  brightRed: '#f87171',
  brightGreen: '#4ade80',
  brightYellow: '#facc15',
  brightBlue: '#60a5fa',
  brightMagenta: '#c084fc',
  brightCyan: '#22d3ee',
  brightWhite: '#ffffff',
})

/**
 * Strip terminal control sequences that aren't color codes
 * This removes cursor movement, window title, and other non-printable sequences
 */
function stripControlSequences(text: string): string {
  return (
    text
      // Remove OSC sequences (Operating System Command) - window titles, etc.
      // Format: ESC ] ... BEL or ESC ] ... ESC \
      .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
      // Remove CSI sequences that aren't SGR (color) codes
      // SGR codes end with 'm', keep those. Remove others like cursor movement (H, J, K, etc.)
      .replace(/\x1b\[[0-9;]*[ABCDEFGHJKSTfnsu]/g, '')
      // Remove private mode sequences (cursor show/hide, alternate screen, etc.)
      // Format: ESC [ ? number h/l
      .replace(/\x1b\[\?[0-9;]*[hl]/g, '')
      // Remove device status/control sequences
      .replace(/\x1b\[[0-9;]*[cdqr]/g, '')
      // Remove carriage return that might cause display issues
      .replace(/\r(?!\n)/g, '')
  )
}

// Component to render a single log line with ANSI colors
const LogLine = memo(function LogLine({ line }: { line: string }) {
  const tokens = useMemo(() => {
    const cleaned = stripControlSequences(line)
    return parseAnsiSequences(cleaned)
  }, [line])

  // Skip empty lines after stripping
  if (tokens.every(t => !t.value.trim())) {
    return null
  }

  return (
    <pre className="whitespace-pre-wrap break-all hover:bg-zinc-900/50">
      {tokens.map((token, i) => {
        const style: React.CSSProperties = {}
        if (token.foreground) {
          style.color = colorPalette.value(token.foreground)
        }
        if (token.background) {
          style.backgroundColor = colorPalette.value(token.background)
        }
        if (token.decorations.has('bold')) {
          style.fontWeight = 'bold'
        }
        if (token.decorations.has('dim')) {
          style.opacity = 0.7
        }
        if (token.decorations.has('italic')) {
          style.fontStyle = 'italic'
        }
        if (token.decorations.has('underline')) {
          style.textDecoration = 'underline'
        }

        return (
          <span key={i} style={style}>
            {token.value}
          </span>
        )
      })}
    </pre>
  )
})

interface LogsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectName: string
}

const StatusBadge = memo(function StatusBadge({
  status,
}: {
  status: RunningProjectStatus
}) {
  const config = {
    running: {
      icon: IconPlayerPlay,
      label: 'Running',
      className: 'text-green-500 bg-green-500/10',
    },
    starting: {
      icon: IconLoader2,
      label: 'Starting',
      className: 'text-blue-500 bg-blue-500/10',
      spin: true,
    },
    stopping: {
      icon: IconLoader2,
      label: 'Stopping',
      className: 'text-yellow-500 bg-yellow-500/10',
      spin: true,
    },
    stopped: {
      icon: IconPlayerStop,
      label: 'Stopped',
      className: 'text-muted-foreground bg-muted',
    },
    error: {
      icon: IconAlertCircle,
      label: 'Error',
      className: 'text-destructive bg-destructive/10',
    },
  }[status] ?? {
    icon: IconPlayerStop,
    label: status,
    className: 'text-muted-foreground bg-muted',
  }

  const Icon = config.icon

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}
    >
      <Icon className={`h-3 w-3 ${config.spin ? 'animate-spin' : ''}`} />
      {config.label}
    </span>
  )
})

export const LogsDialog = memo(function LogsDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
}: LogsDialogProps) {
  const project = useRunningProjectsStore(state =>
    state.projects.get(projectId)
  )
  const clearLogs = useRunningProjectsStore(state => state.clearLogs)
  const setLogs = useRunningProjectsStore(state => state.setLogs)
  const logs = project?.logs ?? []
  const status = project?.status ?? 'stopped'
  const devCommand = project?.devCommand ?? ''

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  // Fetch existing logs when dialog opens
  useEffect(() => {
    if (open && projectId) {
      window.api.runningProjects
        .getLogs({ projectId })
        .then(response => {
          if ('logs' in response && response.logs.length > 0) {
            setLogs(projectId, response.logs)
          }
        })
        .catch(() => {
          // Ignore errors - logs will stream in via IPC
        })
    }
  }, [open, projectId, setLogs])

  // Auto-scroll to bottom on new logs when autoScroll is enabled
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'instant' })
    }
  }, [logs.length, autoScroll])

  // Detect manual scroll to disable auto-scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    const { scrollTop, scrollHeight, clientHeight } = target
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
    setAutoScroll(isAtBottom)
  }, [])

  const handleClearLogs = useCallback(() => {
    clearLogs(projectId)
  }, [clearLogs, projectId])

  const handleScrollToBottom = useCallback(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
      setAutoScroll(true)
    }
  }, [])

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="sm:max-w-3xl h-[70vh] flex flex-col p-0 gap-0"
        showCloseButton
      >
        <DialogHeader className="px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between gap-4 pr-8">
            <div className="flex items-center gap-3 min-w-0">
              <DialogTitle className="truncate">{projectName}</DialogTitle>
              <StatusBadge status={status} />
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      className="h-7 w-7"
                      onClick={handleClearLogs}
                      size="icon-sm"
                      variant="ghost"
                    >
                      <IconTrash className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
                <TooltipContent>Clear Logs</TooltipContent>
              </Tooltip>
              {!autoScroll && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        className="h-7 w-7"
                        onClick={handleScrollToBottom}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <IconArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    }
                  />
                  <TooltipContent>Scroll to Bottom</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
          <DialogDescription className="font-mono text-xs truncate">
            {devCommand}
          </DialogDescription>
        </DialogHeader>

        <div
          className="flex-1 overflow-y-auto bg-zinc-950"
          onScroll={handleScroll}
          ref={scrollContainerRef}
        >
          <div className="p-3 font-mono text-xs text-zinc-100 leading-relaxed">
            {logs.length === 0 ? (
              <span className="text-zinc-500">Waiting for output...</span>
            ) : (
              logs.map((line, index) => <LogLine key={index} line={line} />)
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
})
