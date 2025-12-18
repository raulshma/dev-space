/**
 * Task Execution Panel Component
 *
 * Side panel showing task details, output stream, and controls
 */

import { useEffect, useRef, useCallback, useState, memo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from 'renderer/components/ui/button'
import { Badge } from 'renderer/components/ui/badge'
import { ScrollArea } from 'renderer/components/ui/scroll-area'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from 'renderer/components/ui/tabs'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from 'renderer/components/ui/collapsible'
import {
  IconX,
  IconPlayerPlay,
  IconPlayerPause,
  IconPlayerStop,
  IconArrowDown,
  IconClock,
  IconRocket,
  IconGitBranch,
  IconLoader2,
  IconCheck,
  IconAlertTriangle,
  IconChevronDown,
  IconChevronRight,
  IconFilePlus,
  IconFileCode,
  IconFileX,
  IconCopy,
  IconExternalLink,
  IconListCheck,
  IconBrandGithub,
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
  useStartAgentTask,
} from 'renderer/hooks/use-agent-tasks'
import { useApprovePlan } from 'renderer/hooks/use-jules-notifications'
import type { TaskStatus, OutputLine, FileChangeSummary } from 'shared/ai-types'
import type {
  JulesSessionStatus,
  JulesTaskState,
} from 'shared/notification-types'
import type { JulesActivity } from 'shared/ipc-types'

interface TaskExecutionPanelProps {
  taskId: string
  onClose: () => void
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

const JULES_STATE_CONFIG: Record<
  JulesTaskState,
  { label: string; color: string; icon: React.ReactNode }
> = {
  initializing: {
    label: 'Initializing',
    color: 'text-muted-foreground',
    icon: <IconLoader2 className="h-4 w-4 animate-spin" />,
  },
  planning: {
    label: 'Planning',
    color: 'text-blue-500',
    icon: <IconLoader2 className="h-4 w-4 animate-spin" />,
  },
  'awaiting-plan-approval': {
    label: 'Awaiting Approval',
    color: 'text-yellow-500',
    icon: <IconListCheck className="h-4 w-4" />,
  },
  executing: {
    label: 'Executing',
    color: 'text-green-500',
    icon: <IconLoader2 className="h-4 w-4 animate-spin" />,
  },
  'awaiting-reply': {
    label: 'Awaiting Reply',
    color: 'text-yellow-500',
    icon: <IconClock className="h-4 w-4" />,
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
  unknown: {
    label: 'Unknown',
    color: 'text-muted-foreground',
    icon: <IconAlertTriangle className="h-4 w-4" />,
  },
}

function renderAnsiText(text: string): React.ReactNode {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape codes require control characters
  const ansiRegex = /\x1b\[([0-9;]*)m/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let currentStyle: React.CSSProperties = {}

  const colorMap: Record<string, string> = {
    '30': '#000000',
    '31': '#ef4444',
    '32': '#22c55e',
    '33': '#eab308',
    '34': '#3b82f6',
    '35': '#a855f7',
    '36': '#06b6d4',
    '37': '#f5f5f5',
    '90': '#6b7280',
    '91': '#f87171',
    '92': '#4ade80',
    '93': '#facc15',
    '94': '#60a5fa',
    '95': '#c084fc',
    '96': '#22d3ee',
    '97': '#ffffff',
  }

  let match = ansiRegex.exec(text)
  while (match !== null) {
    if (match.index > lastIndex) {
      const textPart = text.slice(lastIndex, match.index)
      parts.push(
        <span key={parts.length} style={currentStyle}>
          {textPart}
        </span>
      )
    }

    const codes = match[1].split(';')
    for (const code of codes) {
      if (code === '0' || code === '') {
        currentStyle = {}
      } else if (code === '1') {
        currentStyle = { ...currentStyle, fontWeight: 'bold' }
      } else if (code === '3') {
        currentStyle = { ...currentStyle, fontStyle: 'italic' }
      } else if (code === '4') {
        currentStyle = { ...currentStyle, textDecoration: 'underline' }
      } else if (colorMap[code]) {
        currentStyle = { ...currentStyle, color: colorMap[code] }
      }
    }

    lastIndex = match.index + match[0].length
    match = ansiRegex.exec(text)
  }

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
  })
}

function formatDuration(start: Date, end?: Date): string {
  const endTime = end || new Date()
  const diffMs = endTime.getTime() - start.getTime()
  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

const OutputLineComponent = memo(function OutputLineComponent({
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
})

function FileChangeList({
  title,
  files,
  icon,
}: {
  title: string
  files: string[]
  icon: React.ReactNode
}): React.JSX.Element | null {
  const [isOpen, setIsOpen] = useState(files.length > 0)

  if (files.length === 0) return null

  return (
    <Collapsible onOpenChange={setIsOpen} open={isOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md p-2 hover:bg-muted/50">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{title}</span>
          <Badge className="text-xs" variant="outline">
            {files.length}
          </Badge>
        </div>
        {isOpen ? (
          <IconChevronDown className="h-4 w-4" />
        ) : (
          <IconChevronRight className="h-4 w-4" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 space-y-1 pl-6">
          {files.map(file => (
            <div
              className="rounded-md px-2 py-1 text-xs font-mono hover:bg-muted/50 truncate"
              key={file}
            >
              {file}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

/**
 * Jules Activity Item Component
 * Renders a single activity from the Jules session
 */
const JulesActivityItem = memo(function JulesActivityItem({
  activity,
}: {
  activity: JulesActivity
}): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)
  const timestamp = new Date(activity.createTime)
  const isAgent = activity.originator === 'agent'

  return (
    <div className="border-b border-border/50 py-3 last:border-b-0">
      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
            isAgent
              ? 'bg-blue-500/20 text-blue-500'
              : 'bg-green-500/20 text-green-500'
          }`}
        >
          {isAgent ? 'J' : 'U'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium">
              {isAgent ? 'Jules' : 'You'}
            </span>
            <span className="text-xs text-muted-foreground">
              {timestamp.toLocaleTimeString()}
            </span>
          </div>

          {/* Plan Generated */}
          {activity.planGenerated && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-3 mt-2">
              <p className="text-sm font-medium text-blue-500 mb-2">
                Plan Generated
              </p>
              <div className="space-y-1">
                {activity.planGenerated.plan.steps.map((step, idx) => (
                  <div className="flex items-start gap-2 text-xs" key={step.id}>
                    <span className="text-muted-foreground shrink-0">
                      {(step.index ?? idx) + 1}.
                    </span>
                    <span>{step.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Plan Approved */}
          {activity.planApproved && (
            <div className="flex items-center gap-2 text-sm text-green-500">
              <IconCheck className="h-4 w-4" />
              <span>Plan approved</span>
            </div>
          )}

          {/* Progress Updated */}
          {activity.progressUpdated && (
            <div>
              <p className="text-sm">{activity.progressUpdated.title}</p>
              {activity.progressUpdated.description && (
                <p className="text-xs text-muted-foreground mt-1">
                  {activity.progressUpdated.description}
                </p>
              )}
            </div>
          )}

          {/* Session Completed */}
          {activity.sessionCompleted && (
            <div className="flex items-center gap-2 text-sm text-green-500">
              <IconCheck className="h-4 w-4" />
              <span>Session completed</span>
            </div>
          )}

          {/* Artifacts */}
          {activity.artifacts && activity.artifacts.length > 0 && (
            <Collapsible onOpenChange={setIsExpanded} open={isExpanded}>
              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2">
                {isExpanded ? (
                  <IconChevronDown className="h-3 w-3" />
                ) : (
                  <IconChevronRight className="h-3 w-3" />
                )}
                {activity.artifacts.length} artifact
                {activity.artifacts.length > 1 ? 's' : ''}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {activity.artifacts.map((artifact, idx) => (
                  <div
                    className="bg-muted/50 rounded-md p-2 text-xs font-mono"
                    key={idx}
                  >
                    {artifact.bashOutput && (
                      <div>
                        {artifact.bashOutput.command && (
                          <div className="text-blue-400 mb-1">
                            $ {artifact.bashOutput.command}
                          </div>
                        )}
                        {artifact.bashOutput.output && (
                          <div
                            className={`whitespace-pre-wrap ${
                              artifact.bashOutput.exitCode !== 0
                                ? 'text-destructive'
                                : ''
                            }`}
                          >
                            {artifact.bashOutput.output.slice(0, 500)}
                            {artifact.bashOutput.output.length > 500 && '...'}
                          </div>
                        )}
                        {artifact.bashOutput.exitCode !== undefined && (
                          <div className="text-muted-foreground mt-1">
                            Exit code: {artifact.bashOutput.exitCode}
                          </div>
                        )}
                      </div>
                    )}
                    {artifact.changeSet?.gitPatch?.suggestedCommitMessage && (
                      <div>
                        <span className="text-muted-foreground">Commit: </span>
                        {artifact.changeSet.gitPatch.suggestedCommitMessage}
                      </div>
                    )}
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>
    </div>
  )
})

/**
 * Jules Activities Output Component
 * Displays Jules activities as the output stream
 */
function JulesActivitiesOutput({
  taskId,
  sessionStatus,
  onApprovePlan,
  isApprovingPlan,
}: {
  taskId: string
  sessionStatus: JulesSessionStatus | null
  onApprovePlan: () => void
  isApprovingPlan: boolean
}): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isAutoScroll, setIsAutoScroll] = useState(true)
  const [userInterrupted, setUserInterrupted] = useState(false)
  const lastScrollTop = useRef(0)
  const prevActivitiesLength = useRef(0)

  const isExecuting =
    sessionStatus?.state === 'executing' ||
    sessionStatus?.state === 'planning' ||
    sessionStatus?.state === 'initializing'

  // Fetch Jules activities
  const { data: activitiesData, isLoading } = useQuery({
    queryKey: ['jules-activities', taskId],
    queryFn: async () => {
      const response = await window.api.jules.getActivities({ taskId })
      return response.activities ?? []
    },
    refetchInterval:
      sessionStatus?.state === 'completed' || sessionStatus?.state === 'failed'
        ? false
        : 5000,
    staleTime: 3000,
  })

  const activities = activitiesData ?? []

  // Auto-scroll to bottom when new activities arrive (only if not interrupted)
  useEffect(() => {
    const hasNewActivities = activities.length > prevActivitiesLength.current
    prevActivitiesLength.current = activities.length

    if (
      isAutoScroll &&
      !userInterrupted &&
      scrollRef.current &&
      hasNewActivities
    ) {
      const scrollContainer = scrollRef.current.querySelector(
        '[data-radix-scroll-area-viewport]'
      )
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [activities, isAutoScroll, userInterrupted])

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.target as HTMLDivElement
      const { scrollTop, scrollHeight, clientHeight } = target
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50

      // User scrolled up - interrupt auto-scroll
      if (scrollTop < lastScrollTop.current && !isAtBottom) {
        setUserInterrupted(true)
        setIsAutoScroll(false)
      }

      // User scrolled to bottom - re-enable auto-scroll
      if (isAtBottom && userInterrupted) {
        setUserInterrupted(false)
        setIsAutoScroll(true)
      }

      lastScrollTop.current = scrollTop
    },
    [userInterrupted]
  )

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector(
        '[data-radix-scroll-area-viewport]'
      )
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
        setUserInterrupted(false)
        setIsAutoScroll(true)
      }
    }
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Plan approval banner */}
      {sessionStatus?.state === 'awaiting-plan-approval' &&
        sessionStatus.pendingPlan && (
          <div className="border-b border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconListCheck className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium text-yellow-500">
                  Plan awaiting approval
                </span>
              </div>
              <Button
                disabled={isApprovingPlan}
                onClick={onApprovePlan}
                size="sm"
                variant="default"
              >
                {isApprovingPlan ? (
                  <IconLoader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <IconCheck className="h-4 w-4 mr-1" />
                )}
                Approve Plan
              </Button>
            </div>
          </div>
        )}

      {/* PR created banner */}
      {sessionStatus?.pullRequestUrl && (
        <div className="border-b border-green-500/30 bg-green-500/10 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconBrandGithub className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-green-500">
                Pull Request Created
              </span>
            </div>
            <Button
              onClick={() => {
                if (sessionStatus?.pullRequestUrl) {
                  window.api.shell.openExternal({
                    url: sessionStatus.pullRequestUrl,
                  })
                }
              }}
              size="sm"
              variant="outline"
            >
              <IconExternalLink className="h-4 w-4 mr-1" />
              Open PR
            </Button>
          </div>
        </div>
      )}

      {/* Activities list */}
      <div className="flex-1 min-h-0" ref={scrollRef}>
        <ScrollArea className="h-full" onScrollCapture={handleScroll}>
          <div className="p-4">
            {activities.length === 0 ? (
              <div className="text-center py-8">
                <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Waiting for Jules to start...
                </p>
              </div>
            ) : (
              <>
                {activities.map(activity => (
                  <JulesActivityItem activity={activity} key={activity.id} />
                ))}
                {/* In-progress indicator */}
                {isExecuting && (
                  <div className="flex items-center gap-2 py-3 text-muted-foreground">
                    <IconLoader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Jules is working...</span>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Footer with activity count and controls */}
      <div className="border-t border-border px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {activities.length} activities
          </span>
          {isExecuting && (
            <span className="flex items-center gap-1 text-xs text-green-500">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {userInterrupted && (
            <Button
              className="text-xs"
              onClick={scrollToBottom}
              size="sm"
              variant="ghost"
            >
              <IconArrowDown className="h-3 w-3 mr-1" />
              Scroll to bottom
            </Button>
          )}
          <Button
            className="text-xs"
            onClick={() =>
              window.api.shell.openExternal({
                url: 'https://developers.google.com/jules/api',
              })
            }
            size="sm"
            variant="ghost"
          >
            <IconExternalLink className="h-3 w-3 mr-1" />
            Docs
          </Button>
        </div>
      </div>
    </div>
  )
}

export function TaskExecutionPanel({
  taskId,
  onClose,
}: TaskExecutionPanelProps): React.JSX.Element {
  const task = useTask(taskId)
  const output = useTaskOutput(taskId)
  const isAutoScrollEnabled = useAutoScroll()
  const { setAutoScroll } = useAgentTaskStore()

  const scrollRef = useRef<HTMLDivElement>(null)
  const [isUserScrolling, setIsUserScrolling] = useState(false)
  const lastScrollTop = useRef(0)

  const isJulesTask =
    task?.serviceType === 'google-jules' && !!task?.julesSessionId

  // Fetch Jules session status for Jules tasks
  const { data: julesStatus } = useQuery<JulesSessionStatus | null>({
    queryKey: ['jules-session', taskId],
    queryFn: async () => {
      const response = await window.api.jules.getSessionStatus({ taskId })
      return response.status ?? null
    },
    enabled: isJulesTask,
    refetchInterval: 10000,
    staleTime: 5000,
  })

  // Jules plan approval
  const approvePlan = useApprovePlan()
  const handleApprovePlan = useCallback(() => {
    if (task?.julesSessionId) {
      approvePlan.mutate(task.julesSessionId)
    }
  }, [task?.julesSessionId, approvePlan])

  // Fetch initial output (for non-Jules tasks)
  useAgentTaskOutput(taskId)

  // Subscribe to live output (for non-Jules tasks)
  const { subscribe, unsubscribe } = useTaskOutputSubscription(taskId)

  // Task control mutations
  const startTask = useStartAgentTask()
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

  // Auto-scroll to bottom
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

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.target as HTMLDivElement
      const { scrollTop, scrollHeight, clientHeight } = target
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50

      if (scrollTop < lastScrollTop.current && !isAtBottom) {
        setIsUserScrolling(true)
        setAutoScroll(false)
      }

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

  const handleCopyOutput = useCallback(async () => {
    const text = output.map(l => l.content).join('')
    try {
      await navigator.clipboard.writeText(text)
    } catch (error) {
      console.error('Failed to copy output:', error)
    }
  }, [output])

  if (!task) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Task not found</p>
      </div>
    )
  }

  // For Jules tasks, derive status from session state
  const julesStateConfig = julesStatus
    ? JULES_STATE_CONFIG[julesStatus.state]
    : null
  const statusConfig =
    isJulesTask && julesStateConfig
      ? julesStateConfig
      : STATUS_CONFIG[task.status]

  // Control buttons - hide for Jules tasks (controlled via API)
  const canStart =
    !isJulesTask && (task.status === 'pending' || task.status === 'stopped')
  const canPause = !isJulesTask && task.status === 'running'
  const canResume = !isJulesTask && task.status === 'paused'
  const canStop =
    !isJulesTask && (task.status === 'running' || task.status === 'paused')

  const fileChanges: FileChangeSummary = task.fileChanges || {
    created: [],
    modified: [],
    deleted: [],
  }
  const hasFileChanges =
    fileChanges.created.length > 0 ||
    fileChanges.modified.length > 0 ||
    fileChanges.deleted.length > 0

  const isTerminalStatus =
    task.status === 'completed' ||
    task.status === 'failed' ||
    task.status === 'stopped'

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          {task.agentType === 'autonomous' ? (
            <IconRocket className="h-5 w-5 text-muted-foreground shrink-0" />
          ) : (
            <IconGitBranch className="h-5 w-5 text-muted-foreground shrink-0" />
          )}
          <div className="min-w-0">
            <h3 className="font-medium truncate">{task.description}</h3>
            <p className="text-xs text-muted-foreground font-mono truncate">
              {task.targetDirectory}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className={`gap-1 ${statusConfig.color}`}>
            {statusConfig.icon}
            {statusConfig.label}
          </Badge>
          <Button onClick={onClose} size="icon-sm" variant="ghost">
            <IconX className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <IconClock className="h-3 w-3" />
          {task.startedAt ? (
            <span>
              Duration: {formatDuration(task.startedAt, task.completedAt)}
            </span>
          ) : (
            <span>Not started</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canStart && (
            <Button
              disabled={startTask.isPending}
              onClick={() => startTask.mutate(taskId)}
              size="sm"
              variant="outline"
            >
              <IconPlayerPlay className="h-4 w-4 mr-1" />
              Start
            </Button>
          )}
          {canPause && (
            <Button
              disabled={pauseTask.isPending}
              onClick={() => pauseTask.mutate(taskId)}
              size="sm"
              variant="outline"
            >
              <IconPlayerPause className="h-4 w-4 mr-1" />
              Pause
            </Button>
          )}
          {canResume && (
            <Button
              disabled={resumeTask.isPending}
              onClick={() => resumeTask.mutate(taskId)}
              size="sm"
              variant="outline"
            >
              <IconPlayerPlay className="h-4 w-4 mr-1" />
              Resume
            </Button>
          )}
          {canStop && (
            <Button
              disabled={stopTask.isPending}
              onClick={() => stopTask.mutate(taskId)}
              size="sm"
              variant="destructive"
            >
              <IconPlayerStop className="h-4 w-4 mr-1" />
              Stop
            </Button>
          )}
        </div>
      </div>

      {/* Error display */}
      {task.error && (
        <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2">
          <div className="flex items-start gap-2">
            <IconAlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">{task.error}</p>
          </div>
        </div>
      )}

      {/* Content tabs */}
      <Tabs className="flex-1 flex flex-col min-h-0" defaultValue="output">
        <div className="border-b border-border px-4">
          <TabsList className="h-9">
            <TabsTrigger className="text-xs" value="output">
              {isJulesTask ? 'Activities' : 'Output'}
            </TabsTrigger>
            {isTerminalStatus && hasFileChanges && (
              <TabsTrigger className="text-xs" value="changes">
                Changes
              </TabsTrigger>
            )}
            <TabsTrigger className="text-xs" value="details">
              Details
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent className="flex-1 min-h-0 mt-0 p-0" value="output">
          {isJulesTask ? (
            <JulesActivitiesOutput
              isApprovingPlan={approvePlan.isPending}
              onApprovePlan={handleApprovePlan}
              sessionStatus={julesStatus ?? null}
              taskId={taskId}
            />
          ) : (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                <span className="text-xs text-muted-foreground">
                  {output.length} lines
                </span>
                <div className="flex items-center gap-2">
                  {!isAutoScrollEnabled && (
                    <Button onClick={scrollToBottom} size="sm" variant="ghost">
                      <IconArrowDown className="h-3 w-3 mr-1" />
                      Scroll to bottom
                    </Button>
                  )}
                  <Button onClick={handleCopyOutput} size="sm" variant="ghost">
                    <IconCopy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
              </div>
              <div className="flex-1 min-h-0" ref={scrollRef}>
                <ScrollArea className="h-full" onScrollCapture={handleScroll}>
                  <div className="p-3 space-y-0.5 bg-muted/30">
                    {output.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">
                        {task.status === 'pending' || task.status === 'queued'
                          ? 'Output will appear here when the task starts'
                          : 'No output'}
                      </p>
                    ) : (
                      output.map((line, index) => (
                        <OutputLineComponent
                          key={line.id || index}
                          line={line}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </TabsContent>

        {isTerminalStatus && hasFileChanges && (
          <TabsContent className="flex-1 min-h-0 mt-0" value="changes">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-2">
                <FileChangeList
                  files={fileChanges.created}
                  icon={<IconFilePlus className="h-4 w-4 text-green-500" />}
                  title="Created Files"
                />
                <FileChangeList
                  files={fileChanges.modified}
                  icon={<IconFileCode className="h-4 w-4 text-blue-500" />}
                  title="Modified Files"
                />
                <FileChangeList
                  files={fileChanges.deleted}
                  icon={<IconFileX className="h-4 w-4 text-red-500" />}
                  title="Deleted Files"
                />
              </div>
            </ScrollArea>
          </TabsContent>
        )}

        <TabsContent className="flex-1 min-h-0 mt-0" value="details">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Description
                </p>
                <p className="text-sm">{task.description}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Target Directory
                </p>
                <p className="text-sm font-mono">{task.targetDirectory}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Agent Type
                  </p>
                  <p className="text-sm capitalize">{task.agentType}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Priority</p>
                  <p className="text-sm">{task.priority}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Created</p>
                  <p className="text-sm">{task.createdAt.toLocaleString()}</p>
                </div>
                {task.startedAt && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Started
                    </p>
                    <p className="text-sm">{task.startedAt.toLocaleString()}</p>
                  </div>
                )}
              </div>
              {task.completedAt && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Completed
                  </p>
                  <p className="text-sm">{task.completedAt.toLocaleString()}</p>
                </div>
              )}
              {task.exitCode !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Exit Code
                  </p>
                  <p className="text-sm">{task.exitCode}</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
