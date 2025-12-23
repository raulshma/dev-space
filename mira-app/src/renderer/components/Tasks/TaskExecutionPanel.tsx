/**
 * Task Execution Panel Component
 *
 * Side panel showing task details, output stream, and controls.
 * Renders ReviewPanel for tasks in "review" status.
 *
 * Requirements: 1.3, 7.1
 */

import { useEffect, useRef, useCallback, useState, memo, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from 'renderer/components/ui/button'
import { Badge } from 'renderer/components/ui/badge'
import { ScrollArea } from 'renderer/components/ui/scroll-area'
import { cn } from 'renderer/lib/utils'
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
  IconFiles,
  IconGitCommit,
  IconArchive,
  IconRefresh,
  IconEye,
  IconArrowsMaximize,
  IconArrowsMinimize,
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
  useRestartAgentTask,
  useStopAgentTask,
  useStartAgentTask,
  useApprovePlanForTask,
  useRejectPlanForTask,
} from 'renderer/hooks/use-agent-tasks'
import {
  useApprovePlan,
  useSendJulesMessage,
} from 'renderer/hooks/use-jules-notifications'
import { useNotificationStore } from 'renderer/stores/notification-store'
import { ReviewPanel } from 'renderer/components/Agent/ReviewPanel'
import { Input } from 'renderer/components/ui/input'
import { SimpleMarkdown } from 'renderer/components/ui/simple-markdown'
import { IconSend } from '@tabler/icons-react'
import type { TaskStatus, OutputLine, FileChangeSummary } from 'shared/ai-types'
import type {
  JulesSessionStatus,
  JulesTaskState,
} from 'shared/notification-types'
import type { JulesActivity } from 'shared/ipc-types'

interface TaskExecutionPanelProps {
  taskId: string
  onClose: () => void
  isExpanded?: boolean
  onToggleExpand?: () => void
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

const JULES_STATE_CONFIG: Record<
  JulesTaskState,
  { label: string; className: string; icon: React.ReactNode }
> = {
  initializing: {
    label: 'Initializing',
    className: 'bg-muted/10 text-muted-foreground border-border',
    icon: <IconLoader2 className="h-4 w-4 animate-spin" />,
  },
  planning: {
    label: 'Planning',
    className: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    icon: <IconLoader2 className="h-4 w-4 animate-spin" />,
  },
  'awaiting-plan-approval': {
    label: 'Awaiting Approval',
    className:
      'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border-yellow-500/20',
    icon: <IconListCheck className="h-4 w-4" />,
  },
  executing: {
    label: 'Executing',
    className: 'bg-green-500/10 text-green-500 border-green-500/20',
    icon: <IconLoader2 className="h-4 w-4 animate-spin" />,
  },
  'awaiting-reply': {
    label: 'Awaiting Reply',
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
  unknown: {
    label: 'Unknown',
    className: 'bg-muted/10 text-muted-foreground border-border',
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
 * Get the last agent message text from activities
 */
function getLastAgentMessage(activities: JulesActivity[]): string | null {
  // Find the last activity from the agent that has a message
  for (let i = activities.length - 1; i >= 0; i--) {
    const activity = activities[i]
    if (activity.originator === 'agent') {
      // Check agentMessaged for direct agent messages (highest priority)
      if (activity.agentMessaged?.agentMessage) {
        return activity.agentMessaged.agentMessage
      }
      // Check progressUpdated for agent status messages
      if (activity.progressUpdated?.description) {
        return activity.progressUpdated.description
      }
      if (activity.progressUpdated?.title) {
        return activity.progressUpdated.title
      }
      // Check userMessageRequested for agent prompts
      if (activity.userMessageRequested?.prompt) {
        return activity.userMessageRequested.prompt
      }
    }
  }
  return null
}

/**
 * Jules Activity Item Component
 * Renders a single activity from the Jules session
 */
const JulesActivityItem = memo(function JulesActivityItem({
  activity,
  isWaitingForReply,
  sessionStatus,
  isLastAgentActivity,
}: {
  activity: JulesActivity
  isWaitingForReply?: boolean
  sessionStatus?: JulesSessionStatus | null
  isLastAgentActivity?: boolean
}): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)
  const timestamp = new Date(activity.createTime)
  const isAgent = activity.originator === 'agent'

  // Determine if this activity requires user action
  const requiresUserAction =
    activity.userMessageRequested ||
    (activity.planGenerated && isWaitingForReply)

  // Get the agent message text for this activity
  const agentMessageText =
    activity.agentMessaged?.agentMessage ||
    activity.progressUpdated?.description ||
    activity.progressUpdated?.title ||
    activity.userMessageRequested?.prompt

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
            {requiresUserAction && (
              <Badge className="text-xs bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                Action Required
              </Badge>
            )}
            {isLastAgentActivity && isAgent && (
              <Badge className="text-xs bg-blue-500/20 text-blue-500 border-blue-500/30">
                Latest
              </Badge>
            )}
          </div>

          {/* Agent message text - shown prominently for the last agent activity */}
          {isAgent && isLastAgentActivity && agentMessageText && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-2 mb-2">
              <p className="text-sm font-medium text-blue-400 mb-1">
                Latest Message
              </p>
              <SimpleMarkdown className="text-sm" content={agentMessageText} />
            </div>
          )}

          {/* Plan Generated */}
          {activity.planGenerated && (
            <div
              className={`rounded-md p-3 mt-2 ${
                isWaitingForReply
                  ? 'bg-yellow-500/10 border border-yellow-500/30'
                  : 'bg-blue-500/10 border border-blue-500/30'
              }`}
            >
              <p
                className={`text-sm font-medium mb-2 ${
                  isWaitingForReply ? 'text-yellow-500' : 'text-blue-500'
                }`}
              >
                {isWaitingForReply
                  ? 'Plan Awaiting Approval'
                  : 'Plan Generated'}
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

          {/* User Message Requested - Agent waiting for user input */}
          {activity.userMessageRequested && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-3 mt-2">
              <div className="flex items-center gap-2 text-yellow-500">
                <IconClock className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Waiting for your reply
                </span>
              </div>
              {activity.userMessageRequested.prompt && (
                <p className="text-xs text-muted-foreground mt-1">
                  {activity.userMessageRequested.prompt}
                </p>
              )}
            </div>
          )}

          {/* User Message Sent */}
          {activity.userMessageSent && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-md p-3 mt-2">
              <p className="text-sm">{activity.userMessageSent.message}</p>
            </div>
          )}

          {/* Agent Message - Direct message from agent */}
          {activity.agentMessaged && !isLastAgentActivity && (
            <div className="bg-muted/50 border border-border rounded-md p-3 mt-2">
              <SimpleMarkdown
                className="text-sm"
                content={activity.agentMessaged.agentMessage}
              />
            </div>
          )}

          {/* Session Completed - Show detailed summary */}
          {activity.sessionCompleted && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-md p-3 mt-2">
              <div className="flex items-center gap-2 text-green-500 mb-2">
                <IconCheck className="h-4 w-4" />
                <span className="text-sm font-medium">Session Completed</span>
              </div>
              {sessionStatus && (
                <div className="space-y-2 text-xs">
                  {sessionStatus.title && (
                    <div>
                      <span className="text-muted-foreground">Task: </span>
                      <span>{sessionStatus.title}</span>
                    </div>
                  )}
                  {sessionStatus.pullRequestUrl && (
                    <div className="flex items-center gap-2">
                      <IconBrandGithub className="h-3 w-3 text-green-500" />
                      <span className="text-muted-foreground">PR: </span>
                      <Button
                        className="text-xs h-5 p-0 text-green-500"
                        onClick={() => {
                          if (sessionStatus.pullRequestUrl) {
                            window.api.shell.openExternal({
                              url: sessionStatus.pullRequestUrl,
                            })
                          }
                        }}
                        variant="link"
                      >
                        {sessionStatus.pullRequestUrl
                          .split('/')
                          .slice(-2)
                          .join('/')}
                      </Button>
                    </div>
                  )}
                  {sessionStatus.sourceContext && (
                    <div>
                      <span className="text-muted-foreground">
                        Repository:{' '}
                      </span>
                      <span className="font-mono">
                        {sessionStatus.sourceContext.source}
                      </span>
                    </div>
                  )}
                  {sessionStatus.updateTime && (
                    <div>
                      <span className="text-muted-foreground">Completed: </span>
                      <span>
                        {new Date(sessionStatus.updateTime).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )}
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
                    {artifact.changeSet && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <IconFileCode className="h-3 w-3" />
                        <span>Code changes available in Changes tab</span>
                      </div>
                    )}
                    {artifact.media && (
                      <div className="text-muted-foreground">
                        Media: {artifact.media.mimeType}
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
 * Jules Changes Tab Component
 * Displays all file changes from Jules activities in a dedicated tab
 */
function JulesChangesTab({ taskId }: { taskId: string }): React.JSX.Element {
  const [selectedFile, setSelectedFile] = useState<{
    path: string
    type: 'added' | 'deleted' | 'modified' | 'renamed'
    additions: number
    deletions: number
    hunks: Array<{
      header: string
      lines: Array<{
        type: 'context' | 'addition' | 'deletion' | 'header'
        content: string
        raw: string
        oldLineNumber?: number
        newLineNumber?: number
      }>
    }>
  } | null>(null)
  const [copied, setCopied] = useState(false)

  // Fetch Jules activities
  const { data: activitiesData, isLoading } = useQuery({
    queryKey: ['jules-activities', taskId],
    queryFn: async () => {
      const response = await window.api.jules.getActivities({ taskId })
      return response.activities ?? []
    },
    staleTime: 0,
    refetchOnMount: 'always',
  })

  // Extract all changesets from activities
  const allChanges = useMemo(() => {
    if (!activitiesData) return null

    const files: Map<
      string,
      {
        path: string
        type: 'added' | 'deleted' | 'modified' | 'renamed'
        additions: number
        deletions: number
        hunks: Array<{
          header: string
          lines: Array<{
            type: 'context' | 'addition' | 'deletion' | 'header'
            content: string
            raw: string
            oldLineNumber?: number
            newLineNumber?: number
          }>
        }>
      }
    > = new Map()

    let totalAdditions = 0
    let totalDeletions = 0
    let latestCommitMessage: string | undefined

    for (const activity of activitiesData) {
      if (!activity.artifacts) continue

      for (const artifact of activity.artifacts) {
        if (!artifact.changeSet?.gitPatch?.unidiffPatch) continue

        const patch = artifact.changeSet.gitPatch.unidiffPatch
        if (artifact.changeSet.gitPatch.suggestedCommitMessage) {
          latestCommitMessage =
            artifact.changeSet.gitPatch.suggestedCommitMessage
        }

        // Parse the unidiff
        const parsed = parseUnidiffForTab(patch)
        for (const file of parsed.files) {
          const key = file.type === 'deleted' ? file.oldPath : file.newPath
          // Use the latest version of each file
          files.set(key, {
            path: key,
            type: file.type,
            additions: file.additions,
            deletions: file.deletions,
            hunks: file.hunks,
          })
          totalAdditions += file.additions
          totalDeletions += file.deletions
        }
      }
    }

    return {
      files: Array.from(files.values()),
      totalAdditions,
      totalDeletions,
      commitMessage: latestCommitMessage,
    }
  }, [activitiesData])

  const handleCopyDiff = async (): Promise<void> => {
    if (!selectedFile) return
    const diffText = selectedFile.hunks
      .map(h => `${h.header}\n${h.lines.map(l => l.raw).join('\n')}`)
      .join('\n\n')
    try {
      await navigator.clipboard.writeText(diffText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!allChanges || allChanges.files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <IconFiles className="h-8 w-8 mb-2" />
        <p className="text-sm">No file changes yet</p>
      </div>
    )
  }

  const addedFiles = allChanges.files.filter(f => f.type === 'added')
  const modifiedFiles = allChanges.files.filter(f => f.type === 'modified')
  const deletedFiles = allChanges.files.filter(f => f.type === 'deleted')

  return (
    <div className="h-full flex overflow-hidden">
      {/* File list sidebar */}
      <div className="w-64 border-r border-border flex flex-col min-h-0 overflow-hidden">
        <div className="p-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <IconFiles className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{allChanges.files.length} files</span>
            <span className="text-green-500">+{allChanges.totalAdditions}</span>
            <span className="text-red-500">-{allChanges.totalDeletions}</span>
          </div>
          {allChanges.commitMessage && (
            <div className="mt-2 text-xs text-muted-foreground truncate">
              <IconGitCommit className="h-3 w-3 inline mr-1" />
              {allChanges.commitMessage}
            </div>
          )}
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2 space-y-1">
            {addedFiles.length > 0 && (
              <div className="mb-2">
                <div className="text-xs text-muted-foreground px-2 py-1 flex items-center gap-1 sticky top-0 bg-card z-10">
                  <IconFilePlus className="h-3 w-3 text-green-500" />
                  Added ({addedFiles.length})
                </div>
                {addedFiles.map(file => (
                  <button
                    className={`w-full text-left px-2 py-1.5 text-xs rounded flex items-center justify-between gap-1 ${
                      selectedFile?.path === file.path
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-muted/50'
                    }`}
                    key={file.path}
                    onClick={() => setSelectedFile(file)}
                    type="button"
                  >
                    <span className="font-mono truncate">{file.path}</span>
                    <span className="text-green-500 shrink-0">
                      +{file.additions}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {modifiedFiles.length > 0 && (
              <div className="mb-2">
                <div className="text-xs text-muted-foreground px-2 py-1 flex items-center gap-1 sticky top-0 bg-card z-10">
                  <IconFileCode className="h-3 w-3 text-blue-500" />
                  Modified ({modifiedFiles.length})
                </div>
                {modifiedFiles.map(file => (
                  <button
                    className={`w-full text-left px-2 py-1.5 text-xs rounded flex items-center justify-between gap-1 ${
                      selectedFile?.path === file.path
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-muted/50'
                    }`}
                    key={file.path}
                    onClick={() => setSelectedFile(file)}
                    type="button"
                  >
                    <span className="font-mono truncate">{file.path}</span>
                    <span className="shrink-0">
                      <span className="text-green-500">+{file.additions}</span>
                      <span className="text-muted-foreground mx-0.5">/</span>
                      <span className="text-red-500">-{file.deletions}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {deletedFiles.length > 0 && (
              <div className="mb-2">
                <div className="text-xs text-muted-foreground px-2 py-1 flex items-center gap-1 sticky top-0 bg-card z-10">
                  <IconFileX className="h-3 w-3 text-red-500" />
                  Deleted ({deletedFiles.length})
                </div>
                {deletedFiles.map(file => (
                  <button
                    className={`w-full text-left px-2 py-1.5 text-xs rounded flex items-center justify-between gap-1 ${
                      selectedFile?.path === file.path
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-muted/50'
                    }`}
                    key={file.path}
                    onClick={() => setSelectedFile(file)}
                    type="button"
                  >
                    <span className="font-mono truncate">{file.path}</span>
                    <span className="text-red-500 shrink-0">
                      -{file.deletions}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Diff viewer */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {selectedFile ? (
          <>
            <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {selectedFile.type === 'added' && (
                  <IconFilePlus className="h-4 w-4 text-green-500 shrink-0" />
                )}
                {selectedFile.type === 'modified' && (
                  <IconFileCode className="h-4 w-4 text-blue-500 shrink-0" />
                )}
                {selectedFile.type === 'deleted' && (
                  <IconFileX className="h-4 w-4 text-red-500 shrink-0" />
                )}
                <span className="font-mono text-sm truncate">
                  {selectedFile.path}
                </span>
                <Badge className="shrink-0" variant="secondary">
                  <span className="text-green-500">
                    +{selectedFile.additions}
                  </span>
                  {' / '}
                  <span className="text-red-500">
                    -{selectedFile.deletions}
                  </span>
                </Badge>
              </div>
              <Button onClick={handleCopyDiff} size="sm" variant="ghost">
                <IconCopy className="h-3 w-3 mr-1" />
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <div className="flex-1 min-h-0">
              <ScrollArea className="h-full">
                <div className="font-mono text-xs">
                  {selectedFile.hunks.map(hunk => (
                    <div className="mb-4" key={hunk.header}>
                      <div className="bg-blue-500/10 text-blue-500 px-2 py-1 sticky top-0 z-10">
                        {hunk.header}
                      </div>
                      {hunk.lines.map((line, lineIdx) => {
                        let className = 'text-muted-foreground'
                        let bgClass = ''
                        if (line.type === 'addition') {
                          className = 'text-green-500'
                          bgClass = 'bg-green-500/10'
                        } else if (line.type === 'deletion') {
                          className = 'text-red-500'
                          bgClass = 'bg-red-500/10'
                        }
                        return (
                          <div className={`flex ${bgClass}`} key={lineIdx}>
                            <span className="w-12 text-right pr-2 text-muted-foreground/50 select-none shrink-0 border-r border-border/30">
                              {line.oldLineNumber ?? ''}
                            </span>
                            <span className="w-12 text-right pr-2 text-muted-foreground/50 select-none shrink-0 border-r border-border/30">
                              {line.newLineNumber ?? ''}
                            </span>
                            <span className={`flex-1 px-2 ${className}`}>
                              {line.raw || ' '}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <IconFileCode className="h-8 w-8 mb-2" />
            <p className="text-sm">Select a file to view changes</p>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Parse unidiff for the changes tab (simplified version)
 */
function parseUnidiffForTab(diffString: string): {
  files: Array<{
    oldPath: string
    newPath: string
    type: 'added' | 'deleted' | 'modified' | 'renamed'
    additions: number
    deletions: number
    hunks: Array<{
      header: string
      lines: Array<{
        type: 'context' | 'addition' | 'deletion' | 'header'
        content: string
        raw: string
        oldLineNumber?: number
        newLineNumber?: number
      }>
    }>
  }>
} {
  const files: Array<{
    oldPath: string
    newPath: string
    type: 'added' | 'deleted' | 'modified' | 'renamed'
    additions: number
    deletions: number
    hunks: Array<{
      header: string
      lines: Array<{
        type: 'context' | 'addition' | 'deletion' | 'header'
        content: string
        raw: string
        oldLineNumber?: number
        newLineNumber?: number
      }>
    }>
  }> = []

  if (!diffString || diffString.trim() === '') {
    return { files }
  }

  const lines = diffString.split('\n')
  let currentFile: (typeof files)[0] | null = null
  let currentHunk: (typeof files)[0]['hunks'][0] | null = null
  let oldLineNum = 0
  let newLineNum = 0

  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      if (currentFile) {
        if (currentHunk) currentFile.hunks.push(currentHunk)
        files.push(currentFile)
      }
      const match = line.match(/diff --git a\/(.+) b\/(.+)/)
      currentFile = {
        oldPath: match?.[1] ?? '',
        newPath: match?.[2] ?? '',
        type: 'modified',
        additions: 0,
        deletions: 0,
        hunks: [],
      }
      currentHunk = null
      continue
    }

    if (line.startsWith('new file mode') && currentFile) {
      currentFile.type = 'added'
      continue
    }
    if (line.startsWith('deleted file mode') && currentFile) {
      currentFile.type = 'deleted'
      continue
    }
    if (line.startsWith('--- ') && currentFile && line.includes('/dev/null')) {
      currentFile.type = 'added'
      continue
    }
    if (line.startsWith('+++ ') && currentFile && line.includes('/dev/null')) {
      currentFile.type = 'deleted'
      continue
    }

    const hunkMatch = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
    if (hunkMatch && currentFile) {
      if (currentHunk) currentFile.hunks.push(currentHunk)
      oldLineNum = Number.parseInt(hunkMatch[1], 10)
      newLineNum = Number.parseInt(hunkMatch[3], 10)
      currentHunk = { header: line, lines: [] }
      continue
    }

    if (currentHunk && currentFile) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        currentHunk.lines.push({
          type: 'addition',
          content: line.slice(1),
          raw: line,
          newLineNumber: newLineNum++,
        })
        currentFile.additions++
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        currentHunk.lines.push({
          type: 'deletion',
          content: line.slice(1),
          raw: line,
          oldLineNumber: oldLineNum++,
        })
        currentFile.deletions++
      } else if (line.startsWith(' ') || line === '') {
        currentHunk.lines.push({
          type: 'context',
          content: line.slice(1),
          raw: line,
          oldLineNumber: oldLineNum++,
          newLineNumber: newLineNum++,
        })
      }
    }
  }

  if (currentFile) {
    if (currentHunk) currentFile.hunks.push(currentHunk)
    files.push(currentFile)
  }

  return { files }
}

/**
 * Jules Activities Output Component
 * Displays Jules activities as the output stream
 */
function JulesActivitiesOutput({
  taskId,
  sessionStatus,
  julesSessionId,
  onApprovePlan,
  isApprovingPlan,
}: {
  taskId: string
  sessionStatus: JulesSessionStatus | null
  julesSessionId?: string
  onApprovePlan: () => void
  isApprovingPlan: boolean
}): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isAutoScroll, setIsAutoScroll] = useState(true)
  const [userInterrupted, setUserInterrupted] = useState(false)
  const [messageInput, setMessageInput] = useState('')
  const lastScrollTop = useRef(0)
  const prevActivitiesLength = useRef(0)
  const prevSessionState = useRef<string | null>(null)

  const sendMessage = useSendJulesMessage()
  const { addNotification } = useNotificationStore()

  const isExecuting =
    sessionStatus?.state === 'executing' ||
    sessionStatus?.state === 'planning' ||
    sessionStatus?.state === 'initializing'

  const isWaitingForReply =
    sessionStatus?.state === 'awaiting-reply' ||
    sessionStatus?.state === 'awaiting-plan-approval'

  // Reset state when taskId changes (component remounts or task changes)
  useEffect(() => {
    prevActivitiesLength.current = 0
    lastScrollTop.current = 0
    prevSessionState.current = null
    setIsAutoScroll(true)
    setUserInterrupted(false)
    setMessageInput('')
  }, [taskId])

  // Notify user when session state changes to awaiting states
  useEffect(() => {
    if (!sessionStatus) return

    const currentState = sessionStatus.state
    const prevState = prevSessionState.current

    // Only notify on state change, not on initial load
    if (prevState && prevState !== currentState) {
      if (currentState === 'awaiting-reply') {
        addNotification({
          type: 'jules-waiting-reply',
          severity: 'warning',
          title: 'Jules Needs Your Input',
          message: `Jules is waiting for your reply on "${sessionStatus.title || 'your task'}"`,
          persistent: true,
          autoHideMs: 0,
          taskId: sessionStatus.taskId,
          julesSessionId: sessionStatus.sessionId,
        })
      } else if (currentState === 'awaiting-plan-approval') {
        addNotification({
          type: 'jules-plan-approval',
          severity: 'warning',
          title: 'Plan Approval Required',
          message: `Jules has generated a plan for "${sessionStatus.title || 'your task'}"`,
          persistent: true,
          autoHideMs: 0,
          taskId: sessionStatus.taskId,
          julesSessionId: sessionStatus.sessionId,
        })
      }
    }

    prevSessionState.current = currentState
  }, [sessionStatus, addNotification])

  const handleSendMessage = useCallback(() => {
    const sessionId = sessionStatus?.sessionId || julesSessionId
    if (!messageInput.trim() || !sessionId) return

    sendMessage.mutate({
      sessionId,
      message: messageInput.trim(),
    })
    setMessageInput('')
  }, [messageInput, sessionStatus?.sessionId, julesSessionId, sendMessage])

  // Fetch Jules activities - refetch on mount and when taskId changes
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
    staleTime: 0, // Always consider data stale to ensure fresh fetch on mount
    refetchOnMount: 'always', // Always refetch when component mounts
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
        '[data-slot="scroll-area-viewport"]'
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
        '[data-slot="scroll-area-viewport"]'
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

      {/* Last agent message banner */}
      {activities.length > 0 &&
        (() => {
          const lastAgentMessage = getLastAgentMessage(activities)
          if (lastAgentMessage && (isExecuting || isWaitingForReply)) {
            return (
              <div className="border-b border-blue-500/30 bg-blue-500/5 px-4 py-3 shrink-0 max-h-32 overflow-y-auto">
                <div className="flex items-start gap-2">
                  <div className="shrink-0 w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <span className="text-xs font-medium text-blue-500">J</span>
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="text-xs text-muted-foreground mb-0.5">
                      Latest from Jules
                    </p>
                    <SimpleMarkdown
                      className="text-sm"
                      content={lastAgentMessage}
                    />
                  </div>
                </div>
              </div>
            )
          }
          return null
        })()}

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
                {(() => {
                  // Find the index of the last agent activity
                  let lastAgentActivityIndex = -1
                  for (let i = activities.length - 1; i >= 0; i--) {
                    if (activities[i].originator === 'agent') {
                      lastAgentActivityIndex = i
                      break
                    }
                  }

                  return activities.map((activity, index) => {
                    // Determine if this activity should show waiting state
                    // Only the last activity with planGenerated or userMessageRequested should show waiting
                    const isLastActivity = index === activities.length - 1
                    const showWaiting =
                      isWaitingForReply &&
                      isLastActivity &&
                      !!(
                        activity.planGenerated || activity.userMessageRequested
                      )

                    // Pass sessionStatus to the last activity if it's a completion
                    const isCompletionActivity =
                      isLastActivity && activity.sessionCompleted

                    // Check if this is the last agent activity
                    const isLastAgentActivity = index === lastAgentActivityIndex

                    return (
                      <JulesActivityItem
                        activity={activity}
                        isLastAgentActivity={isLastAgentActivity}
                        isWaitingForReply={showWaiting}
                        key={activity.id}
                        sessionStatus={
                          isCompletionActivity ? sessionStatus : null
                        }
                      />
                    )
                  })
                })()}
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

      {/* Message input - show for sessions that have a session ID */}
      {(sessionStatus?.sessionId || julesSessionId) && (
        <div
          className={`border-t px-4 py-3 ${
            isWaitingForReply
              ? 'border-yellow-500/30 bg-yellow-500/5'
              : 'border-border bg-muted/30'
          }`}
        >
          {isWaitingForReply && (
            <p className="text-xs text-yellow-500 mb-2">
              Jules is waiting for your reply
            </p>
          )}
          <div className="flex items-center gap-2">
            <Input
              className="flex-1"
              disabled={sendMessage.isPending}
              onChange={e => setMessageInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              placeholder={
                isWaitingForReply
                  ? 'Type your reply to Jules...'
                  : 'Send a message to Jules...'
              }
              value={messageInput}
            />
            <Button
              disabled={!messageInput.trim() || sendMessage.isPending}
              onClick={handleSendMessage}
              size="sm"
              variant={isWaitingForReply ? 'default' : 'outline'}
            >
              {sendMessage.isPending ? (
                <IconLoader2 className="h-4 w-4 animate-spin" />
              ) : (
                <IconSend className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}

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
          {isWaitingForReply && (
            <span className="flex items-center gap-1 text-xs text-yellow-500">
              <IconClock className="h-3 w-3" />
              Waiting for input
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
  isExpanded = false,
  onToggleExpand,
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

  // Claude Code plan approval (for awaiting_approval status)
  const approvePlanForTask = useApprovePlanForTask()
  const rejectPlanForTask = useRejectPlanForTask()
  const [rejectFeedback, setRejectFeedback] = useState('')
  const [showRejectDialog, setShowRejectDialog] = useState(false)

  const isAwaitingApproval =
    task?.status === 'awaiting_approval' && !isJulesTask

  const handleApproveClaudeCodePlan = useCallback(() => {
    if (task?.id) {
      approvePlanForTask.mutate(task.id)
    }
  }, [task?.id, approvePlanForTask])

  const handleRejectClaudeCodePlan = useCallback(() => {
    if (task?.id && rejectFeedback.trim()) {
      rejectPlanForTask.mutate({
        taskId: task.id,
        feedback: rejectFeedback.trim(),
      })
      setRejectFeedback('')
      setShowRejectDialog(false)
    }
  }, [task?.id, rejectFeedback, rejectPlanForTask])

  // Fetch initial output (for non-Jules tasks)
  useAgentTaskOutput(taskId)

  // Subscribe to live output (for non-Jules tasks)
  const { subscribe, unsubscribe } = useTaskOutputSubscription(taskId)

  // Task control mutations
  const startTask = useStartAgentTask()
  const pauseTask = usePauseAgentTask()
  const resumeTask = useResumeAgentTask()
  const restartTask = useRestartAgentTask()
  const stopTask = useStopAgentTask()

  // Subscribe to output when task is running or awaiting approval
  useEffect(() => {
    if (
      task?.status === 'running' ||
      task?.status === 'paused' ||
      task?.status === 'awaiting_approval'
    ) {
      subscribe()
      return () => unsubscribe()
    }
  }, [task?.status, subscribe, unsubscribe])

  // Auto-scroll to bottom
  useEffect(() => {
    if (isAutoScrollEnabled && !isUserScrolling && scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector(
        '[data-slot="scroll-area-viewport"]'
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
        '[data-slot="scroll-area-viewport"]'
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

  // Render ReviewPanel for tasks in "review" status
  // Requirements: 1.3, 7.1
  if (task.status === 'review') {
    return (
      <div className="flex h-full flex-col bg-card">
        {/* Header with close button */}
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
            <Badge
              className="gap-1 bg-amber-500/10 text-amber-500 border-amber-500/20"
              variant="outline"
            >
              <IconEye className="h-4 w-4" />
              Review
            </Badge>
            {onToggleExpand && (
              <Button
                onClick={onToggleExpand}
                size="icon-sm"
                title={isExpanded ? 'Minimize' : 'Maximize'}
                variant="ghost"
              >
                {isExpanded ? (
                  <IconArrowsMinimize className="h-4 w-4" />
                ) : (
                  <IconArrowsMaximize className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button onClick={onClose} size="icon-sm" variant="ghost">
              <IconX className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* ReviewPanel content */}
        <div className="flex-1 min-h-0 overflow-auto">
          <ReviewPanel taskId={taskId} />
        </div>
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
  // Can restart stopped, failed, or completed tasks (with session resume support)
  const canRestart =
    !isJulesTask &&
    (task.status === 'stopped' ||
      task.status === 'failed' ||
      task.status === 'completed')
  // Check if task has a previous session that can be resumed
  const hasSession = !!task.parameters?.sessionId

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
          <Badge
            className={cn('gap-1', statusConfig.className)}
            variant="outline"
          >
            {statusConfig.icon}
            {statusConfig.label}
          </Badge>
          {onToggleExpand && (
            <Button
              onClick={onToggleExpand}
              size="icon-sm"
              title={isExpanded ? 'Minimize' : 'Maximize'}
              variant="ghost"
            >
              {isExpanded ? (
                <IconArrowsMinimize className="h-4 w-4" />
              ) : (
                <IconArrowsMaximize className="h-4 w-4" />
              )}
            </Button>
          )}
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
          {canRestart && (
            <Button
              disabled={restartTask.isPending}
              onClick={() =>
                restartTask.mutate({
                  taskId,
                  resumeSession: hasSession,
                  forkSession: false,
                })
              }
              size="sm"
              title={
                hasSession
                  ? 'Restart and resume from previous session'
                  : 'Restart task from beginning'
              }
              variant="outline"
            >
              <IconRefresh className="h-4 w-4 mr-1" />
              {hasSession ? 'Resume Session' : 'Restart'}
            </Button>
          )}
        </div>
      </div>

      {/* Claude Code Plan Approval Banner */}
      {isAwaitingApproval && (
        <div className="border-b border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconListCheck className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium text-yellow-500">
                Plan awaiting approval
              </span>
              {task.planSpec?.content && (
                <span className="text-xs text-muted-foreground ml-2">
                  Review the plan in the output below
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowRejectDialog(true)}
                size="sm"
                variant="outline"
              >
                <IconX className="h-4 w-4 mr-1" />
                Reject
              </Button>
              <Button
                disabled={approvePlanForTask.isPending}
                onClick={handleApproveClaudeCodePlan}
                size="sm"
                variant="default"
              >
                {approvePlanForTask.isPending ? (
                  <IconLoader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <IconCheck className="h-4 w-4 mr-1" />
                )}
                Approve Plan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Plan Dialog */}
      {showRejectDialog && (
        <div className="border-b border-border bg-muted/30 px-4 py-3">
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Provide feedback for plan revision:
            </p>
            <Input
              autoFocus
              className="w-full"
              onChange={e => setRejectFeedback(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && rejectFeedback.trim()) {
                  e.preventDefault()
                  handleRejectClaudeCodePlan()
                }
                if (e.key === 'Escape') {
                  setShowRejectDialog(false)
                  setRejectFeedback('')
                }
              }}
              placeholder="What changes would you like to see in the plan?"
              value={rejectFeedback}
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                onClick={() => {
                  setShowRejectDialog(false)
                  setRejectFeedback('')
                }}
                size="sm"
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                disabled={!rejectFeedback.trim() || rejectPlanForTask.isPending}
                onClick={handleRejectClaudeCodePlan}
                size="sm"
                variant="destructive"
              >
                {rejectPlanForTask.isPending ? (
                  <IconLoader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <IconX className="h-4 w-4 mr-1" />
                )}
                Reject with Feedback
              </Button>
            </div>
          </div>
        </div>
      )}

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
            {isJulesTask && (
              <TabsTrigger className="text-xs" value="jules-changes">
                Changes
              </TabsTrigger>
            )}
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
              julesSessionId={task.julesSessionId}
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

        {isJulesTask && (
          <TabsContent
            className="flex-1 min-h-0 mt-0 p-0"
            value="jules-changes"
          >
            <JulesChangesTab taskId={taskId} />
          </TabsContent>
        )}

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
              {/* Jules Session Info */}
              {isJulesTask && julesStatus && (
                <div className="border border-blue-500/30 bg-blue-500/5 rounded-md p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-blue-500">
                      Jules Session
                    </p>
                    {julesStatus.webUrl && (
                      <Button
                        className="text-xs h-6"
                        onClick={() => {
                          if (julesStatus.webUrl) {
                            window.api.shell.openExternal({
                              url: julesStatus.webUrl,
                            })
                          }
                        }}
                        size="sm"
                        variant="ghost"
                      >
                        <IconExternalLink className="h-3 w-3 mr-1" />
                        Open in Jules
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">
                        Session ID
                      </p>
                      <p className="text-xs font-mono truncate">
                        {julesStatus.sessionId}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">
                        State
                      </p>
                      <p className="text-xs">
                        {JULES_STATE_CONFIG[julesStatus.state]?.label ||
                          julesStatus.state}
                      </p>
                    </div>
                  </div>
                  {julesStatus.title && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">
                        Title
                      </p>
                      <p className="text-xs">{julesStatus.title}</p>
                    </div>
                  )}
                  {julesStatus.prompt && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">
                        Prompt
                      </p>
                      <p className="text-xs line-clamp-3">
                        {julesStatus.prompt}
                      </p>
                    </div>
                  )}
                  {julesStatus.sourceContext && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">
                        Source
                      </p>
                      <p className="text-xs font-mono">
                        {julesStatus.sourceContext.source}
                        {julesStatus.sourceContext.githubRepoContext
                          ?.startingBranch &&
                          ` (${julesStatus.sourceContext.githubRepoContext.startingBranch})`}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {julesStatus.createTime && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">
                          Created
                        </p>
                        <p className="text-xs">
                          {new Date(julesStatus.createTime).toLocaleString()}
                        </p>
                      </div>
                    )}
                    {julesStatus.updateTime && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">
                          Last Updated
                        </p>
                        <p className="text-xs">
                          {new Date(julesStatus.updateTime).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                  {julesStatus.pullRequestUrl && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">
                        Pull Request
                      </p>
                      <Button
                        className="text-xs h-6 p-0"
                        onClick={() => {
                          if (julesStatus.pullRequestUrl) {
                            window.api.shell.openExternal({
                              url: julesStatus.pullRequestUrl,
                            })
                          }
                        }}
                        variant="link"
                      >
                        {julesStatus.pullRequestUrl}
                      </Button>
                    </div>
                  )}
                </div>
              )}

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
