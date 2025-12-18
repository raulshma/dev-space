/**
 * Task Completion View Component
 *
 * Displays completed task information with:
 * - Completion status and duration
 * - File change summary
 * - Git diff for repository tasks
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from 'renderer/components/ui/card'
import { Button } from 'renderer/components/ui/button'
import { Badge } from 'renderer/components/ui/badge'
import { ScrollArea } from 'renderer/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from 'renderer/components/ui/tabs'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from 'renderer/components/ui/collapsible'
import {
  IconCheck,
  IconX,
  IconPlayerStop,
  IconClock,
  IconFilePlus,
  IconFileCode,
  IconFileX,
  IconGitBranch,
  IconRocket,
  IconChevronDown,
  IconChevronRight,
  IconCopy,
  IconExternalLink,
} from '@tabler/icons-react'
import { useTask, useTaskOutput } from 'renderer/stores/agent-task-store'
import type { AgentTask, TaskStatus, FileChangeSummary, OutputLine } from 'shared/ai-types'

interface TaskCompletionViewProps {
  taskId: string
  onBack?: () => void
  onViewOutput?: () => void
}

const STATUS_CONFIG: Record<
  Extract<TaskStatus, 'completed' | 'failed' | 'stopped'>,
  { label: string; description: string; icon: React.ReactNode; variant: 'default' | 'destructive' | 'secondary' }
> = {
  completed: {
    label: 'Completed Successfully',
    description: 'The task finished without errors',
    icon: <IconCheck className="h-6 w-6" />,
    variant: 'default',
  },
  failed: {
    label: 'Failed',
    description: 'The task encountered an error',
    icon: <IconX className="h-6 w-6" />,
    variant: 'destructive',
  },
  stopped: {
    label: 'Stopped',
    description: 'The task was manually stopped',
    icon: <IconPlayerStop className="h-6 w-6" />,
    variant: 'secondary',
  },
}

function formatDuration(startDate: Date, endDate: Date): string {
  const diffMs = endDate.getTime() - startDate.getTime()
  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${seconds}s`
}

function FileChangeList({
  title,
  files,
  icon,
  emptyMessage,
}: {
  title: string
  files: string[]
  icon: React.ReactNode
  emptyMessage: string
}): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(files.length > 0)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md p-2 hover:bg-muted/50">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{title}</span>
          <Badge variant="outline" className="text-xs">
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
          {files.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">{emptyMessage}</p>
          ) : (
            files.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 rounded-md px-2 py-1 text-xs font-mono hover:bg-muted/50"
              >
                <span className="truncate">{file}</span>
              </div>
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function GitDiffViewer({ diff }: { diff: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(diff)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy diff:', error)
    }
  }

  // Parse and colorize diff
  const renderDiffLine = (line: string, index: number): React.ReactNode => {
    let className = 'text-muted-foreground'
    if (line.startsWith('+') && !line.startsWith('+++')) {
      className = 'text-green-500 bg-green-500/10'
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      className = 'text-red-500 bg-red-500/10'
    } else if (line.startsWith('@@')) {
      className = 'text-blue-500 bg-blue-500/10'
    } else if (line.startsWith('diff ') || line.startsWith('index ')) {
      className = 'text-muted-foreground font-medium'
    }

    return (
      <div key={index} className={`px-2 py-0.5 ${className}`}>
        {line || ' '}
      </div>
    )
  }

  const lines = diff.split('\n')

  return (
    <div className="rounded-md border bg-muted/30">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium">Git Diff</span>
        <Button variant="ghost" size="sm" onClick={handleCopy}>
          <IconCopy className="mr-2 h-3 w-3" />
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
      <ScrollArea className="h-[400px]">
        <div className="font-mono text-xs">
          {lines.map((line, index) => renderDiffLine(line, index))}
        </div>
      </ScrollArea>
    </div>
  )
}

function OutputSummary({ output }: { output: OutputLine[] }): React.JSX.Element {
  // Get last 20 lines for summary
  const lastLines = output.slice(-20)

  return (
    <div className="rounded-md border bg-muted/30">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium">Output Summary (last 20 lines)</span>
        <Badge variant="outline" className="text-xs">
          {output.length} total lines
        </Badge>
      </div>
      <ScrollArea className="h-[200px]">
        <div className="p-3 font-mono text-xs space-y-1">
          {lastLines.map((line, index) => (
            <div
              key={index}
              className={`whitespace-pre-wrap break-all ${
                line.stream === 'stderr' ? 'text-destructive' : ''
              }`}
            >
              {line.content}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

export function TaskCompletionView({
  taskId,
  onBack,
  onViewOutput,
}: TaskCompletionViewProps): React.JSX.Element {
  const task = useTask(taskId)
  const output = useTaskOutput(taskId)

  if (!task) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Task not found</p>
      </div>
    )
  }

  // Only show for completed/failed/stopped tasks
  const isTerminalStatus =
    task.status === 'completed' ||
    task.status === 'failed' ||
    task.status === 'stopped'

  if (!isTerminalStatus) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Task is still in progress</p>
      </div>
    )
  }

  const statusConfig = STATUS_CONFIG[task.status as 'completed' | 'failed' | 'stopped']
  const duration =
    task.startedAt && task.completedAt
      ? formatDuration(task.startedAt, task.completedAt)
      : 'Unknown'

  const fileChanges: FileChangeSummary = task.fileChanges || {
    created: [],
    modified: [],
    deleted: [],
  }

  const totalChanges =
    fileChanges.created.length +
    fileChanges.modified.length +
    fileChanges.deleted.length

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Status header */}
      <Card
        className={
          task.status === 'completed'
            ? 'border-green-500/50 bg-green-500/5'
            : task.status === 'failed'
              ? 'border-destructive/50 bg-destructive/5'
              : ''
        }
      >
        <CardContent className="py-6">
          <div className="flex items-center gap-4">
            <div
              className={`rounded-full p-3 ${
                task.status === 'completed'
                  ? 'bg-green-500/20 text-green-500'
                  : task.status === 'failed'
                    ? 'bg-destructive/20 text-destructive'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {statusConfig.icon}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">{statusConfig.label}</h2>
              <p className="text-sm text-muted-foreground">
                {statusConfig.description}
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-sm">
                <IconClock className="h-4 w-4 text-muted-foreground" />
                <span>{duration}</span>
              </div>
              {task.exitCode !== undefined && (
                <p className="text-xs text-muted-foreground mt-1">
                  Exit code: {task.exitCode}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task details */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            {task.agentType === 'autonomous' ? (
              <IconRocket className="h-4 w-4 text-muted-foreground" />
            ) : (
              <IconGitBranch className="h-4 w-4 text-muted-foreground" />
            )}
            <CardTitle className="text-sm">Task Details</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">Description</p>
            <p className="text-sm">{task.description}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Target Directory</p>
            <p className="text-sm font-mono">{task.targetDirectory}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Started</p>
              <p className="text-sm">
                {task.startedAt?.toLocaleString() || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="text-sm">
                {task.completedAt?.toLocaleString() || 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error display */}
      {task.error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-destructive">Error Details</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs text-destructive whitespace-pre-wrap font-mono bg-destructive/10 rounded-md p-3">
              {task.error}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* File changes and output tabs */}
      <Card className="flex-1 flex flex-col min-h-0">
        <Tabs defaultValue="changes" className="flex-1 flex flex-col">
          <CardHeader className="pb-0">
            <TabsList>
              <TabsTrigger value="changes">
                File Changes
                {totalChanges > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {totalChanges}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="diff">Git Diff</TabsTrigger>
              <TabsTrigger value="output">Output Log</TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent className="flex-1 min-h-0 pt-4">
            <TabsContent value="changes" className="h-full mt-0">
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  <FileChangeList
                    title="Created Files"
                    files={fileChanges.created}
                    icon={<IconFilePlus className="h-4 w-4 text-green-500" />}
                    emptyMessage="No files created"
                  />
                  <FileChangeList
                    title="Modified Files"
                    files={fileChanges.modified}
                    icon={<IconFileCode className="h-4 w-4 text-blue-500" />}
                    emptyMessage="No files modified"
                  />
                  <FileChangeList
                    title="Deleted Files"
                    files={fileChanges.deleted}
                    icon={<IconFileX className="h-4 w-4 text-red-500" />}
                    emptyMessage="No files deleted"
                  />
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="diff" className="h-full mt-0">
              {fileChanges.gitDiff ? (
                <GitDiffViewer diff={fileChanges.gitDiff} />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-muted-foreground">
                    No git diff available
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="output" className="h-full mt-0">
              <OutputSummary output={output} />
              {onViewOutput && (
                <div className="mt-4 flex justify-center">
                  <Button variant="outline" onClick={onViewOutput}>
                    <IconExternalLink className="mr-2 h-4 w-4" />
                    View Full Output
                  </Button>
                </div>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  )
}
