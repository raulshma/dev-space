/**
 * Task Detail View Component
 *
 * Displays detailed task information with:
 * - Live output stream with ANSI rendering
 * - Auto-scroll with pause on user scroll
 * - Pause, resume, stop controls
 *
 * Requirements: 9.2, 9.3, 9.4, 9.5, 10.1
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from 'renderer/components/ui/card'
import { Button } from 'renderer/components/ui/button'
import { Badge } from 'renderer/components/ui/badge'
import { ScrollArea } from 'renderer/components/ui/scroll-area'
import {
  IconPlayerPlay,
  IconPlayerPause,
  IconPlayerStop,
  IconArrowDown,
  IconClock,
  IconRocket,
  IconGitBranch,
  IconLoader2,
  IconCheck,
  IconX,
  IconAlertTriangle,
} from '@tabler/icons-react'
import {
  useTask,
  useTaskOutput,
  useAutoScroll,
  useAgentTaskStore,
} from 'renderer/stores/agent-task-store'
import {
  useAgentTaskOutput,
  useTaskOutputSubscription,
  usePauseAgentTask,
  useResumeAgentTask,
  useStopAgentTask,
} from 'renderer/hooks/use-agent-tasks'
import type { TaskStatus, OutputLine } from 'shared/ai-types'

interface TaskDetailViewProps {
  taskId: string
  onBack?: () => void
}

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  pending: {
    label: 'Pending',
    color: 'text-muted-foreground',
    icon: <IconClock className="h-4 w-4" />,
  },
  queued: {
    label: 'Queued',
    color: 'text-blue-500',
    icon: <IconClock className="h-4 w-4" />,
  },
  running: {
    label: 'Running',
    color: 'text-green-500',
    icon: <IconLoader2 className="h-4 w-4 animate-spin" />,
  },
  paused: {
    label: 'Paused',
    color: 'text-yellow-500',
    icon: <IconPlayerPause className="h-4 w-4" />,
  },
  completed: {
    label: 'Completed',
    color: 'text-green-500',
    icon: <IconCheck className="h-4 w-4" />,
  },
  failed: {
    label: 'Failed',
    color: 'text-destructive',
    icon: <IconX className="h-4 w-4" />,
  },
  stopped: {
    label: 'Stopped',
    color: 'text-muted-foreground',
    icon: <IconPlayerStop className="h-4 w-4" />,
  },
}

/**
 * Converts ANSI escape codes to styled spans
 * Supports basic colors and formatting
 */
function renderAnsiText(text: string): React.ReactNode {
  // Simple ANSI code parser for common codes
  const ansiRegex = /\x1b\[([0-9;]*)m/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let currentStyle: React.CSSProperties = {}
  let match: RegExpExecArray | null

  const colorMap: Record<string, string> = {
    '30': '#000000', // Black
    '31': '#ef4444', // Red
    '32': '#22c55e', // Green
    '33': '#eab308', // Yellow
    '34': '#3b82f6', // Blue
    '35': '#a855f7', // Magenta
    '36': '#06b6d4', // Cyan
    '37': '#f5f5f5', // White
    '90': '#6b7280', // Bright Black (Gray)
    '91': '#f87171', // Bright Red
    '92': '#4ade80', // Bright Green
    '93': '#facc15', // Bright Yellow
    '94': '#60a5fa', // Bright Blue
    '95': '#c084fc', // Bright Magenta
    '96': '#22d3ee', // Bright Cyan
    '97': '#ffffff', // Bright White
  }

  while ((match = ansiRegex.exec(text)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      const textPart = text.slice(lastIndex, match.index)
      parts.push(
        <span key={parts.length} style={currentStyle}>
          {textPart}
        </span>
      )
    }

    // Parse ANSI codes
    const codes = match[1].split(';')
    for (const code of codes) {
      if (code === '0' || code === '') {
        // Reset
        currentStyle = {}
      } else if (code === '1') {
        // Bold
        currentStyle = { ...currentStyle, fontWeight: 'bold' }
      } else if (code === '3') {
        // Italic
        currentStyle = { ...currentStyle, fontStyle: 'italic' }
      } else if (code === '4') {
        // Underline
        currentStyle = { ...currentStyle, textDecoration: 'underline' }
      } else if (colorMap[code]) {
        // Foreground color
        currentStyle = { ...currentStyle, color: colorMap[code] }
      } else if (code.startsWith('4') && code.length === 2) {
        // Background color (40-47)
        const bgCode = String(Number.parseInt(code[1], 10) + 30)
        if (colorMap[bgCode]) {
          currentStyle = { ...currentStyle, backgroundColor: colorMap[bgCode] }
        }
      }
    }

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(
      <span key={parts.length} style={currentStyle}>
        {text.slice(lastIndex)}
      </span>
    )
  }

  return parts.length > 0 ? parts : text
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  })
}

function OutputLineComponent({
  line,
}: {
  line: OutputLine
}): React.JSX.Element {
  return (
    <div className="flex gap-2 font-mono text-xs leading-relaxed">
      <span className="text-muted-foreground shrink-0 select-none">
        [{formatTimestamp(line.timestamp)}]
      </span>
      <span
        className={`flex-1 whitespace-pre-wrap break-all ${
          line.stream === 'stderr' ? 'text-destructive' : ''
        }`}
      >
        {renderAnsiText(line.content)}
      </span>
    </div>
  )
}

export function TaskDetailView({
  taskId,
  onBack,
}: TaskDetailViewProps): React.JSX.Element {
  const task = useTask(taskId)
  const output = useTaskOutput(taskId)
  const isAutoScrollEnabled = useAutoScroll()
  const { setAutoScroll } = useAgentTaskStore()

  const scrollRef = useRef<HTMLDivElement>(null)
  const [isUserScrolling, setIsUserScrolling] = useState(false)
  const lastScrollTop = useRef(0)

  // Fetch initial output
  useAgentTaskOutput(taskId)

  // Subscribe to live output
  const { subscribe, unsubscribe } = useTaskOutputSubscription(taskId)

  // Task control mutations
  const pauseTask = usePauseAgentTask()
  const resumeTask = useResumeAgentTask()
  const stopTask = useStopAgentTask()

  // Subscribe to output when task is running
  useEffect(() => {
    if (task?.status === 'running' || task?.status === 'paused') {
      subscribe()
      return () => unsubscribe()
    }
  }, [task?.status, subscribe, unsubscribe])

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (isAutoScrollEnabled && !isUserScrolling && scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector(
        '[data-radix-scroll-area-viewport]'
      )
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [output, isAutoScrollEnabled, isUserScrolling])

  // Handle scroll events to detect user scrolling
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.target as HTMLDivElement
      const { scrollTop, scrollHeight, clientHeight } = target
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50

      // Detect if user is scrolling up
      if (scrollTop < lastScrollTop.current && !isAtBottom) {
        setIsUserScrolling(true)
        setAutoScroll(false)
      }

      // Re-enable auto-scroll when user scrolls to bottom
      if (isAtBottom && isUserScrolling) {
        setIsUserScrolling(false)
        setAutoScroll(true)
      }

      lastScrollTop.current = scrollTop
    },
    [isUserScrolling, setAutoScroll]
  )

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector(
        '[data-radix-scroll-area-viewport]'
      )
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
        setIsUserScrolling(false)
        setAutoScroll(true)
      }
    }
  }, [setAutoScroll])

  const handlePause = useCallback(async () => {
    try {
      await pauseTask.mutateAsync(taskId)
    } catch (error) {
      console.error('Failed to pause task:', error)
    }
  }, [pauseTask, taskId])

  const handleResume = useCallback(async () => {
    try {
      await resumeTask.mutateAsync(taskId)
    } catch (error) {
      console.error('Failed to resume task:', error)
    }
  }, [resumeTask, taskId])

  const handleStop = useCallback(async () => {
    try {
      await stopTask.mutateAsync(taskId)
    } catch (error) {
      console.error('Failed to stop task:', error)
    }
  }, [stopTask, taskId])

  if (!task) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Task not found</p>
      </div>
    )
  }

  const statusConfig = STATUS_CONFIG[task.status]
  const canPause = task.status === 'running'
  const canResume = task.status === 'paused'
  const canStop = task.status === 'running' || task.status === 'paused'

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {task.agentType === 'autonomous' ? (
                <IconRocket className="h-5 w-5 text-muted-foreground" />
              ) : (
                <IconGitBranch className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <CardTitle className="text-base">{task.description}</CardTitle>
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  {task.targetDirectory}
                </p>
              </div>
            </div>
            <Badge className={`gap-1 ${statusConfig.color}`}>
              {statusConfig.icon}
              {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Created: {task.createdAt.toLocaleString()}</span>
              {task.startedAt && (
                <span>Started: {task.startedAt.toLocaleString()}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {canPause && (
                <Button
                  disabled={pauseTask.isPending}
                  onClick={handlePause}
                  size="sm"
                  variant="outline"
                >
                  <IconPlayerPause className="mr-2 h-4 w-4" />
                  Pause
                </Button>
              )}
              {canResume && (
                <Button
                  disabled={resumeTask.isPending}
                  onClick={handleResume}
                  size="sm"
                  variant="outline"
                >
                  <IconPlayerPlay className="mr-2 h-4 w-4" />
                  Resume
                </Button>
              )}
              {canStop && (
                <Button
                  disabled={stopTask.isPending}
                  onClick={handleStop}
                  size="sm"
                  variant="destructive"
                >
                  <IconPlayerStop className="mr-2 h-4 w-4" />
                  Stop
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error display */}
      {task.error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="py-3">
            <div className="flex items-start gap-2">
              <IconAlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Error</p>
                <p className="text-xs text-destructive/80 mt-1">{task.error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Output stream */}
      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-sm">Output</CardTitle>
          <div className="flex items-center gap-2">
            {!isAutoScrollEnabled && (
              <Button onClick={scrollToBottom} size="sm" variant="outline">
                <IconArrowDown className="mr-2 h-4 w-4" />
                Scroll to bottom
              </Button>
            )}
            <Badge className="text-xs" variant="outline">
              {output.length} lines
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 pt-0">
          <div className="h-full rounded-md border bg-muted/30" ref={scrollRef}>
            <ScrollArea className="h-full" onScrollCapture={handleScroll}>
              <div className="p-3 space-y-1">
                {output.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    {task.status === 'pending' || task.status === 'queued'
                      ? 'Output will appear here when the task starts'
                      : 'No output yet'}
                  </p>
                ) : (
                  output.map((line, index) => (
                    <OutputLineComponent key={line.id || index} line={line} />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
