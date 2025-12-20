/**
 * Review Panel Component
 *
 * Displays the review workflow UI for tasks in "review" status.
 * Includes:
 * - Review status indicator
 * - File changes summary
 * - Git diff viewer
 * - Feedback input and history
 * - Action buttons (Run Project, Open Terminal, Approve, Discard)
 *
 * Requirements: 1.3, 2.1, 3.1, 4.1, 5.1, 7.2, 7.3, 7.4, 7.5
 */

import { useState, useEffect, useCallback } from 'react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'renderer/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'renderer/components/ui/dropdown-menu'
import { ButtonGroup } from 'renderer/components/ui/button-group'
import { Textarea } from 'renderer/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from 'renderer/components/ui/alert-dialog'
import { toast } from 'sonner'
import {
  IconEye,
  IconPlayerPlay,
  IconPlayerStop,
  IconTerminal2,
  IconCheck,
  IconX,
  IconFilePlus,
  IconFileCode,
  IconFileX,
  IconChevronDown,
  IconChevronRight,
  IconCopy,
  IconSend,
  IconClock,
  IconLoader2,
  IconAlertTriangle,
} from '@tabler/icons-react'
import {
  useTask,
  useTaskFeedbackHistory,
  useTaskRunningProcess,
  useReviewLoading,
  useReviewError,
  useReviewActions,
} from 'renderer/stores/agent-task-store'
import { useRunningProjectsManager, useIsProjectRunning } from 'renderer/hooks/use-running-projects'
import type {
  AgentTask,
  FileChangeSummary,
  TaskFeedback,
} from 'shared/ai-types'
import type { ReviewScriptInfo } from 'shared/ipc-types'

// ============================================================================
// Types
// ============================================================================

interface ReviewPanelProps {
  taskId: string
  onApproved?: () => void
  onDiscarded?: () => void
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Review status indicator badge
 * Requirements: 1.3, 7.1
 */
function ReviewStatusIndicator({
  feedbackCount,
  hasRunningProcess,
}: {
  feedbackCount: number
  hasRunningProcess: boolean
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <Badge className="gap-1 bg-amber-500/20 text-amber-500 border-amber-500/30">
        <IconEye className="h-3 w-3" />
        In Review
      </Badge>
      {feedbackCount > 0 && (
        <Badge className="text-xs" variant="outline">
          {feedbackCount} feedback iteration{feedbackCount > 1 ? 's' : ''}
        </Badge>
      )}
      {hasRunningProcess && (
        <Badge className="gap-1 bg-green-500/20 text-green-500 border-green-500/30">
          <IconLoader2 className="h-3 w-3 animate-spin" />
          Running
        </Badge>
      )}
    </div>
  )
}

/**
 * File change list with collapsible sections
 * Requirements: 7.2
 */
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
          {files.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">{emptyMessage}</p>
          ) : (
            files.map(file => (
              <div
                className="flex items-center gap-2 rounded-md px-2 py-1 text-xs font-mono hover:bg-muted/50"
                key={file}
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

/**
 * File changes summary component
 * Requirements: 7.2
 */
function FileChangesSummary({
  fileChanges,
}: {
  fileChanges: FileChangeSummary
}): React.JSX.Element {
  const totalChanges =
    fileChanges.created.length +
    fileChanges.modified.length +
    fileChanges.deleted.length

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">File Changes</span>
        <Badge variant="secondary">{totalChanges} files</Badge>
      </div>
      <div className="space-y-1">
        <FileChangeList
          emptyMessage="No files created"
          files={fileChanges.created}
          icon={<IconFilePlus className="h-4 w-4 text-green-500" />}
          title="Created"
        />
        <FileChangeList
          emptyMessage="No files modified"
          files={fileChanges.modified}
          icon={<IconFileCode className="h-4 w-4 text-blue-500" />}
          title="Modified"
        />
        <FileChangeList
          emptyMessage="No files deleted"
          files={fileChanges.deleted}
          icon={<IconFileX className="h-4 w-4 text-red-500" />}
          title="Deleted"
        />
      </div>
    </div>
  )
}

/**
 * Git diff viewer component
 * Requirements: 7.3
 */
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
      <div className={`px-2 py-0.5 ${className}`} key={index}>
        {line || ' '}
      </div>
    )
  }

  const lines = diff.split('\n')

  return (
    <div className="h-full flex flex-col rounded-md border bg-muted/30 overflow-hidden">
      <div className="flex items-center justify-between border-b px-3 py-2 shrink-0">
        <span className="text-xs font-medium">Git Diff</span>
        <Button onClick={handleCopy} size="sm" variant="ghost">
          <IconCopy className="mr-2 h-3 w-3" />
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="font-mono text-xs">
          {lines.map((line, index) => renderDiffLine(line, index))}
        </div>
      </ScrollArea>
    </div>
  )
}

/**
 * Feedback input component with submit button
 * Requirements: 4.1, 7.4
 */
function FeedbackInput({
  taskId,
  onSubmit,
  isLoading,
}: {
  taskId: string
  onSubmit: (feedback: string) => Promise<void>
  isLoading: boolean
}): React.JSX.Element {
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (): Promise<void> => {
    if (!feedback.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onSubmit(feedback.trim())
      setFeedback('')
    } catch (error) {
      console.error('Failed to submit feedback:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="space-y-2">
      <Textarea
        className="min-h-[80px] resize-none"
        disabled={isSubmitting || isLoading}
        onChange={e => setFeedback(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Provide feedback for the agent to address..."
        value={feedback}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Press Ctrl+Enter to submit
        </span>
        <Button
          disabled={!feedback.trim() || isSubmitting || isLoading}
          onClick={handleSubmit}
          size="sm"
        >
          {isSubmitting ? (
            <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <IconSend className="mr-2 h-4 w-4" />
          )}
          Submit Feedback
        </Button>
      </div>
    </div>
  )
}

/**
 * Feedback history display component
 * Requirements: 7.4
 */
function FeedbackHistory({
  feedbackHistory,
}: {
  feedbackHistory: TaskFeedback[]
}): React.JSX.Element {
  if (feedbackHistory.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground">
          No feedback submitted yet
        </p>
      </div>
    )
  }

  // Sort by submittedAt in ascending order (oldest first)
  const sortedFeedback = [...feedbackHistory].sort(
    (a, b) =>
      new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
  )

  return (
    <div className="space-y-3">
      {sortedFeedback.map(entry => (
        <div
          className="rounded-md border bg-muted/30 p-3 space-y-2"
          key={entry.id}
        >
          <div className="flex items-center justify-between">
            <Badge className="text-xs" variant="outline">
              Iteration {entry.iteration}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <IconClock className="h-3 w-3" />
              {new Date(entry.submittedAt).toLocaleString()}
            </span>
          </div>
          <p className="text-sm whitespace-pre-wrap">{entry.content}</p>
        </div>
      ))}
    </div>
  )
}

/**
 * Review action buttons component
 * Requirements: 2.1, 3.1, 5.1, 7.5
 */
function ReviewActionButtons({
  taskId,
  hasRunningProcess,
  isLoading,
  onRunProject,
  onStopProject,
  onOpenTerminal,
  onApprove,
  onDiscard,
  availableScripts,
  workspacePath,
  projectPath,
}: {
  taskId: string
  hasRunningProcess: boolean
  isLoading: boolean
  onRunProject: (script?: string) => Promise<void>
  onStopProject: () => Promise<void>
  onOpenTerminal: (path: string) => Promise<void>
  onApprove: () => Promise<void>
  onDiscard: () => Promise<void>
  availableScripts: ReviewScriptInfo[]
  workspacePath?: string
  projectPath?: string
}): React.JSX.Element {
  const [selectedScript, setSelectedScript] = useState<string>('')
  const [isRunning, setIsRunning] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [isDiscarding, setIsDiscarding] = useState(false)
  const [isOpeningTerminal, setIsOpeningTerminal] = useState(false)

  const handleRunProject = async (): Promise<void> => {
    setIsRunning(true)
    try {
      await onRunProject(selectedScript || undefined)
      toast.success('Project started', {
        description: selectedScript 
          ? `Running script: ${selectedScript}`
          : 'Running default dev/start script',
      })
    } catch (error) {
      console.error('Failed to run project:', error)
      toast.error('Failed to run project', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setIsRunning(false)
    }
  }

  const handleStopProject = async (): Promise<void> => {
    setIsStopping(true)
    try {
      await onStopProject()
    } catch (error) {
      console.error('Failed to stop project:', error)
    } finally {
      setIsStopping(false)
    }
  }

  const handleOpenTerminal = async (path: string): Promise<void> => {
    setIsOpeningTerminal(true)
    try {
      await onOpenTerminal(path)
      toast.success('Terminal opened', {
        description: `Terminal opened in ${path}`,
      })
    } catch (error) {
      console.error('Failed to open terminal:', error)
      toast.error('Failed to open terminal', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setIsOpeningTerminal(false)
    }
  }

  const handleApprove = async (): Promise<void> => {
    setIsApproving(true)
    try {
      await onApprove()
    } catch (error) {
      console.error('Failed to approve changes:', error)
    } finally {
      setIsApproving(false)
    }
  }

  const handleDiscard = async (): Promise<void> => {
    setIsDiscarding(true)
    try {
      await onDiscard()
    } catch (error) {
      console.error('Failed to discard changes:', error)
    } finally {
      setIsDiscarding(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Project execution controls */}
      <div className="space-y-2">
        <span className="text-sm font-medium">Test Changes</span>
        <div className="flex items-center gap-2">
          {availableScripts && availableScripts.length > 0 && (
            <Select
              onValueChange={value => setSelectedScript(value ?? '')}
              value={selectedScript || undefined}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue>{selectedScript || 'Select script'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availableScripts.map(script => (
                  <SelectItem key={script.name} value={script.name}>
                    {script.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {hasRunningProcess ? (
            <Button
              disabled={isStopping || isLoading}
              onClick={handleStopProject}
              size="sm"
              variant="destructive"
            >
              {isStopping ? (
                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <IconPlayerStop className="mr-2 h-4 w-4" />
              )}
              Stop Project
            </Button>
          ) : (
            <Button
              disabled={isRunning || isLoading}
              onClick={handleRunProject}
              size="sm"
              variant="outline"
            >
              {isRunning ? (
                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <IconPlayerPlay className="mr-2 h-4 w-4" />
              )}
              Run Project
            </Button>
          )}
          {/* Split button for Terminal - main button opens in workspace, dropdown for project path */}
          <ButtonGroup>
            <Button
              disabled={isOpeningTerminal || isLoading || !workspacePath}
              onClick={() => workspacePath && handleOpenTerminal(workspacePath)}
              size="sm"
              variant="outline"
            >
              {isOpeningTerminal ? (
                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <IconTerminal2 className="mr-2 h-4 w-4" />
              )}
              Terminal
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="px-1.5 h-6 border border-input bg-background hover:bg-accent hover:text-accent-foreground text-sm inline-flex items-center justify-center rounded-md"
                disabled={isOpeningTerminal || isLoading}
              >
                <IconChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={!workspacePath}
                  onClick={() => workspacePath && handleOpenTerminal(workspacePath)}
                >
                  <IconTerminal2 className="mr-2 h-4 w-4" />
                  Open in Workspace
                  {workspacePath && (
                    <span className="ml-2 text-xs text-muted-foreground truncate max-w-[150px]">
                      {workspacePath.split(/[/\\]/).slice(-2).join('/')}
                    </span>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!projectPath}
                  onClick={() => projectPath && handleOpenTerminal(projectPath)}
                >
                  <IconTerminal2 className="mr-2 h-4 w-4" />
                  Open in Project
                  {projectPath && (
                    <span className="ml-2 text-xs text-muted-foreground truncate max-w-[150px]">
                      {projectPath.split(/[/\\]/).slice(-2).join('/')}
                    </span>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
        </div>
      </div>

      {/* Approval/Discard controls */}
      <div className="flex items-center gap-2 pt-2 border-t">
        <Button
          className="flex-1"
          disabled={isApproving || isLoading || hasRunningProcess}
          onClick={handleApprove}
        >
          {isApproving ? (
            <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <IconCheck className="mr-2 h-4 w-4" />
          )}
          Approve Changes
        </Button>
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                className="flex-1"
                disabled={isDiscarding || isLoading || hasRunningProcess}
                variant="destructive"
              >
                <IconX className="mr-2 h-4 w-4" />
                Discard Changes
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all changes made by the agent. This
                action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDiscard}
              >
                {isDiscarding ? (
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Discard
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Review Panel Component
 *
 * Main component for the task review workflow UI.
 * Displays review status, file changes, git diff, feedback input/history,
 * and action buttons.
 *
 * Requirements: 1.3, 2.1, 3.1, 4.1, 5.1, 7.2, 7.3, 7.4, 7.5
 */
export function ReviewPanel({
  taskId,
  onApproved,
  onDiscarded,
}: ReviewPanelProps): React.JSX.Element {
  const task = useTask(taskId)
  const feedbackHistory = useTaskFeedbackHistory(taskId)
  const runningProcess = useTaskRunningProcess(taskId)
  const isLoading = useReviewLoading()
  const reviewError = useReviewError()
  const {
    submitFeedback,
    approveChanges,
    discardChanges,
    runProject,
    stopProject,
    openTerminal,
    loadFeedbackHistory,
    loadAvailableScripts,
    setReviewError,
  } = useReviewActions()

  const [availableScripts, setAvailableScripts] = useState<ReviewScriptInfo[]>(
    []
  )

  // Load feedback history and available scripts on mount
  useEffect(() => {
    loadFeedbackHistory(taskId)
    loadAvailableScripts(taskId)
      .then(scripts => setAvailableScripts(scripts || []))
      .catch(err => console.error('Failed to load scripts:', err))
  }, [taskId, loadFeedbackHistory, loadAvailableScripts])

  const handleSubmitFeedback = useCallback(
    async (feedback: string): Promise<void> => {
      await submitFeedback(taskId, feedback)
    },
    [taskId, submitFeedback]
  )

  const handleApprove = useCallback(async (): Promise<void> => {
    const result = await approveChanges(taskId)
    if (result.success) {
      onApproved?.()
    }
  }, [taskId, approveChanges, onApproved])

  const handleDiscard = useCallback(async (): Promise<void> => {
    await discardChanges(taskId)
    onDiscarded?.()
  }, [taskId, discardChanges, onDiscarded])

  // Use running projects service for proper integration
  const { startProject: runDevProject, stopProject: stopDevProject } = useRunningProjectsManager()
  
  // Get workspace path (where agent made changes) - prefer worktree/working directory
  const workspacePath = task?.worktreePath || task?.workingDirectory
  // Get project path (original project directory)
  const targetProjectPath = task?.targetDirectory
  // For running projects, use the workspace path first
  const projectPath = workspacePath || targetProjectPath
  const projectId = task?.projectId || taskId
  const isProjectRunning = useIsProjectRunning(projectId)

  const handleRunProject = useCallback(
    async (script?: string): Promise<void> => {
      if (!projectPath) {
        toast.error('Cannot run project', {
          description: 'No project directory found for this task',
        })
        return
      }
      
      // Build the dev command from script
      const devCommand = script ? `pnpm run ${script}` : undefined
      
      try {
        await runDevProject(projectId, devCommand)
        toast.success('Project started', {
          description: script 
            ? `Running script: ${script}`
            : 'Running default dev command',
        })
      } catch (error) {
        toast.error('Failed to run project', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    },
    [projectId, projectPath, runDevProject]
  )

  const handleStopProject = useCallback(async (): Promise<void> => {
    try {
      await stopDevProject(projectId)
      toast.success('Project stopped')
    } catch (error) {
      toast.error('Failed to stop project', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }, [projectId, stopDevProject])

  const handleOpenTerminal = useCallback(async (path: string): Promise<void> => {
    try {
      // Open external terminal window in the specified directory
      await window.api.shell.openTerminal({
        cwd: path,
      })
      
      toast.success('Terminal opened', {
        description: `External terminal opened in ${path}`,
      })
    } catch (error) {
      toast.error('Failed to open terminal', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }, [])

  if (!task) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Task not found</p>
      </div>
    )
  }

  if (task.status !== 'review') {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Task is not in review status</p>
      </div>
    )
  }

  const fileChanges: FileChangeSummary = task.fileChanges || {
    created: [],
    modified: [],
    deleted: [],
  }

  const hasRunningProcess = isProjectRunning || !!runningProcess

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      {/* Review status header */}
      <Card className="border-amber-500/30 bg-amber-500/5 shrink-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Review Changes</CardTitle>
            <ReviewStatusIndicator
              feedbackCount={feedbackHistory.length}
              hasRunningProcess={hasRunningProcess}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            Review the agent's changes before approving them to your project.
            You can run the project, open a terminal, or provide feedback for
            additional changes.
          </p>
        </CardContent>
      </Card>

      {/* Error display */}
      {reviewError && (
        <Card className="border-destructive/50 bg-destructive/10 shrink-0">
          <CardContent className="py-3">
            <div className="flex items-start gap-2">
              <IconAlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-destructive">{reviewError}</p>
              </div>
              <Button
                onClick={() => setReviewError(null)}
                size="sm"
                variant="ghost"
              >
                <IconX className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main content tabs */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <Tabs className="flex-1 flex flex-col min-h-0" defaultValue="changes">
          <CardHeader className="pb-0 shrink-0">
            <TabsList>
              <TabsTrigger value="changes">Changes</TabsTrigger>
              <TabsTrigger value="diff">Git Diff</TabsTrigger>
              <TabsTrigger value="feedback">
                Feedback
                {feedbackHistory.length > 0 && (
                  <Badge className="ml-2" variant="secondary">
                    {feedbackHistory.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent className="flex-1 min-h-0 pt-4 overflow-hidden">
            {/* File changes tab */}
            <TabsContent className="h-full mt-0 overflow-hidden" value="changes">
              <ScrollArea className="h-full">
                <FileChangesSummary fileChanges={fileChanges} />
              </ScrollArea>
            </TabsContent>

            {/* Git diff tab */}
            <TabsContent className="h-full mt-0 overflow-hidden" value="diff">
              {fileChanges.gitDiff ? (
                <div className="h-full overflow-hidden">
                  <GitDiffViewer diff={fileChanges.gitDiff} />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-muted-foreground">
                    No git diff available
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Feedback tab */}
            <TabsContent className="h-full mt-0 flex flex-col overflow-hidden" value="feedback">
              <div className="flex-1 min-h-0 mb-4 overflow-hidden">
                <ScrollArea className="h-full">
                  <FeedbackHistory feedbackHistory={feedbackHistory} />
                </ScrollArea>
              </div>
              <div className="shrink-0">
                <FeedbackInput
                  isLoading={isLoading}
                  onSubmit={handleSubmitFeedback}
                  taskId={taskId}
                />
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Action buttons */}
      <Card className="shrink-0">
        <CardContent className="py-4">
          <ReviewActionButtons
            availableScripts={availableScripts}
            hasRunningProcess={hasRunningProcess}
            isLoading={isLoading}
            onApprove={handleApprove}
            onDiscard={handleDiscard}
            onOpenTerminal={handleOpenTerminal}
            onRunProject={handleRunProject}
            onStopProject={handleStopProject}
            projectPath={targetProjectPath}
            taskId={taskId}
            workspacePath={workspacePath}
          />
        </CardContent>
      </Card>
    </div>
  )
}
