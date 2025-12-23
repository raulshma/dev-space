/**
 * Task Detail View Component
 *
 * Displays detailed task information with:
 * - Live output stream with ANSI rendering
 * - Auto-scroll with pause on user scroll
 * - Pause, resume, stop controls
 * - Review panel for tasks in "review" status
 *
 * Requirements: 1.3, 7.1, 9.2, 9.3, 9.4, 9.5, 10.1
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
import { cn } from 'renderer/lib/utils'
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
  IconArchive,
  IconEye,
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
import { ReviewPanel } from './ReviewPanel'
import type { TaskStatus, OutputLine, ExecutionStep } from 'shared/ai-types'
import { EXECUTION_STEPS } from 'shared/ai-types'

interface TaskDetailViewProps {
  taskId: string
  onBack?: () => void
}

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; className: string; icon: React.ReactNode }
> = {
  pending: {
    label: 'Pending',
    className: 'bg-muted/10 text-muted-foreground border-border',
    icon: <IconClock className="h-4 w-4" />,
  },
  queued: {
    label: 'Queued',
    className: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    icon: <IconClock className="h-4 w-4" />,
  },
  running: {
    label: 'Running',
    className: 'bg-green-500/10 text-green-500 border-green-500/20',
    icon: <IconLoader2 className="h-4 w-4 animate-spin" />,
  },
  paused: {
    label: 'Paused',
    className:
      'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border-yellow-500/20',
    icon: <IconPlayerPause className="h-4 w-4" />,
  },
  awaiting_approval: {
    label: 'Awaiting Approval',
    className:
      'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border-yellow-500/20',
    icon: <IconClock className="h-4 w-4" />,
  },
  completed: {
    label: 'Completed',
    className: 'bg-green-500/10 text-green-500 border-green-500/20',
    icon: <IconCheck className="h-4 w-4" />,
  },
  failed: {
    label: 'Failed',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
    icon: <IconX className="h-4 w-4" />,
  },
  stopped: {
    label: 'Stopped',
    className: 'bg-muted/10 text-muted-foreground border-border',
    icon: <IconPlayerStop className="h-4 w-4" />,
  },
  archived: {
    label: 'Archived',
    className: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    icon: <IconArchive className="h-4 w-4" />,
  },
  review: {
    label: 'Review',
    className: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    icon: <IconEye className="h-4 w-4" />,
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

/**
 * Execution step indicator showing progress through task phases
 */
function ExecutionStepIndicator({
  currentStep,
}: {
  currentStep?: ExecutionStep
}): React.JSX.Element | null {
  if (!currentStep || currentStep === 'pending') return null

  // Filter to show only relevant steps for display
  const displaySteps = EXECUTION_STEPS.filter(
    s => !['pending', 'failed'].includes(s.step)
  )

  const currentIndex = displaySteps.findIndex(s => s.step === currentStep)
  const currentStepInfo = EXECUTION_STEPS.find(s => s.step === currentStep)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        {displaySteps.map((step, index) => {
          const isCompleted = index < currentIndex
          const isCurrent = step.step === currentStep
          const isFailed = currentStep === 'failed'

          return (
            <div className="flex items-center" key={step.step}>
              <div
                className={`h-2 w-2 rounded-full transition-colors ${
                  isCompleted
                    ? 'bg-green-500'
                    : isCurrent
                      ? isFailed
                        ? 'bg-destructive'
                        : 'bg-blue-500 animate-pulse'
                      : 'bg-muted-foreground/30'
                }`}
                title={step.label}
              />
              {index < displaySteps.length - 1 && (
                <div
                  className={`h-0.5 w-4 transition-colors ${
                    isCompleted ? 'bg-green-500' : 'bg-muted-foreground/30'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>
      {currentStepInfo && (
        <p className="text-xs text-muted-foreground">
          {currentStepInfo.description}
        </p>
      )}
    </div>
  )
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
}: TaskDetailViewProps): React.JSX.Element {
  const task = useTask(taskId)
  const output = useTaskOutput(taskId)
  const isAutoScrollEnabled = useAutoScroll()
  const { setAutoScroll } = useAgentTaskStore()

  const scrollRef = useRef<HTMLDivElement>(null)
  const [isUserScrolling, setIsUserScrolling] = useState(false)
  const lastScrollTop = useRef(0)
  const outputLengthRef = useRef(0)

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
    // Only scroll if output length has actually changed
    if (output.length === outputLengthRef.current) return
    outputLengthRef.current = output.length

    if (isAutoScrollEnabled && !isUserScrolling && scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector(
        '[data-slot="scroll-area-viewport"]'
      )
      if (scrollContainer) {
        // Use requestAnimationFrame to ensure DOM has updated
        requestAnimationFrame(() => {
          scrollContainer.scrollTop = scrollContainer.scrollHeight
        })
      }
    }
  }, [output, isAutoScrollEnabled, isUserScrolling])

  // Handle scroll events to detect user scrolling
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.target as HTMLDivElement
      const { scrollTop, scrollHeight, clientHeight } = target
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50

      // Detect if user is scrolling up (and not at bottom)
      if (scrollTop < lastScrollTop.current && !isAtBottom) {
        if (!isUserScrolling) {
          setIsUserScrolling(true)
          setAutoScroll(false)
        }
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
        '[data-slot="scroll-area-viewport"]'
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

  // Render ReviewPanel for tasks in "review" status
  // Requirements: 1.3, 7.1
  if (task.status === 'review') {
    return <ReviewPanel taskId={taskId} />
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
            <Badge
              className={cn('gap-1', statusConfig.className)}
              variant="outline"
            >
              {statusConfig.icon}
              {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {/* Execution step progress */}
          {task.executionStep && task.status === 'running' && (
            <ExecutionStepIndicator currentStep={task.executionStep} />
          )}

          {/* Working directory info */}
          {task.workingDirectory &&
            task.workingDirectory !== task.targetDirectory && (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                <span className="font-medium">Working directory:</span>{' '}
                <span className="font-mono">{task.workingDirectory}</span>
              </div>
            )}

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
