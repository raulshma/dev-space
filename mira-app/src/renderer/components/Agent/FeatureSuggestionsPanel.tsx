/**
 * Feature Suggestions Panel Component
 *
 * Displays AI-generated feature suggestions for a project with:
 * - Generate suggestions button
 * - List of suggestions with status badges
 * - Approve/reject actions
 * - Bulk approval support
 * - Generation progress indicator
 */

import { useState, useCallback } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from 'renderer/components/ui/card'
import { Button } from 'renderer/components/ui/button'
import { Badge } from 'renderer/components/ui/badge'
import { Progress } from 'renderer/components/ui/progress'
import { Checkbox } from 'renderer/components/ui/checkbox'
import { ScrollArea } from 'renderer/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from 'renderer/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from 'renderer/components/ui/alert-dialog'
import {
  IconSparkles,
  IconCheck,
  IconX,
  IconLoader2,
  IconChevronRight,
  IconBulb,
  IconCode,
  IconShield,
  IconRocket,
  IconBug,
  IconFileText,
  IconTestPipe,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react'
import { cn } from 'renderer/lib/utils'
import {
  useFeatureSuggestions,
  useGenerateSuggestions,
  useApproveSuggestion,
  useRejectSuggestion,
  useBulkApproveSuggestions,
  useDeleteSuggestion,
  useGenerationProgress,
} from 'renderer/hooks/use-feature-suggestions'
import type {
  FeatureSuggestion,
  FeatureSuggestionCategory,
  FeatureSuggestionPriority,
  FeatureSuggestionStatus,
} from 'shared/ai-types'

// ============================================================================
// Types
// ============================================================================

interface FeatureSuggestionsPanelProps {
  projectId: string
  projectPath: string
  projectName?: string
  onSuggestionApproved?: (taskId: string) => void
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_CONFIG: Record<
  FeatureSuggestionCategory,
  { label: string; icon: React.ReactNode; className: string }
> = {
  feature: {
    label: 'Feature',
    icon: <IconRocket className="h-3.5 w-3.5" />,
    className: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  },
  improvement: {
    label: 'Improvement',
    icon: <IconBulb className="h-3.5 w-3.5" />,
    className: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  },
  refactor: {
    label: 'Refactor',
    icon: <IconRefresh className="h-3.5 w-3.5" />,
    className: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  },
  bugfix: {
    label: 'Bug Fix',
    icon: <IconBug className="h-3.5 w-3.5" />,
    className: 'bg-red-500/10 text-red-500 border-red-500/20',
  },
  performance: {
    label: 'Performance',
    icon: <IconRocket className="h-3.5 w-3.5" />,
    className: 'bg-green-500/10 text-green-500 border-green-500/20',
  },
  security: {
    label: 'Security',
    icon: <IconShield className="h-3.5 w-3.5" />,
    className: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  },
  documentation: {
    label: 'Docs',
    icon: <IconFileText className="h-3.5 w-3.5" />,
    className: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  },
  testing: {
    label: 'Testing',
    icon: <IconTestPipe className="h-3.5 w-3.5" />,
    className: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  },
}

const PRIORITY_CONFIG: Record<
  FeatureSuggestionPriority,
  { label: string; className: string }
> = {
  low: { label: 'Low', className: 'bg-muted/50 text-muted-foreground' },
  medium: { label: 'Medium', className: 'bg-blue-500/10 text-blue-500' },
  high: { label: 'High', className: 'bg-amber-500/10 text-amber-500' },
  critical: { label: 'Critical', className: 'bg-red-500/10 text-red-500' },
}

const STATUS_CONFIG: Record<
  FeatureSuggestionStatus,
  { label: string; className: string }
> = {
  pending: { label: 'Pending', className: 'bg-muted/50 text-muted-foreground' },
  approved: { label: 'Approved', className: 'bg-green-500/10 text-green-500' },
  rejected: { label: 'Rejected', className: 'bg-red-500/10 text-red-500' },
  converted: {
    label: 'Task Created',
    className: 'bg-blue-500/10 text-blue-500',
  },
}

// ============================================================================
// Component
// ============================================================================

export function FeatureSuggestionsPanel({
  projectId,
  projectPath,
  onSuggestionApproved,
}: FeatureSuggestionsPanelProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  // Hooks
  const { suggestions, isLoading } = useFeatureSuggestions({
    projectId,
  })
  const { generate, isGenerating } = useGenerateSuggestions()
  const { approve, isApproving } = useApproveSuggestion()
  const { reject } = useRejectSuggestion()
  const { bulkApprove, isBulkApproving } = useBulkApproveSuggestions()
  const { deleteSuggestion } = useDeleteSuggestion()
  const progress = useGenerationProgress()

  // Filter to show only pending suggestions by default
  const pendingSuggestions = suggestions.filter(s => s.status === 'pending')
  const otherSuggestions = suggestions.filter(s => s.status !== 'pending')

  // Handlers
  const handleGenerate = useCallback(() => {
    generate({
      projectId,
      projectPath,
      maxSuggestions: 10,
      analyzeCode: true,
      analyzeDependencies: true,
    })
  }, [generate, projectId, projectPath])

  const handleApprove = useCallback(
    (suggestion: FeatureSuggestion) => {
      approve(
        { suggestionId: suggestion.id },
        {
          onSuccess: data => {
            onSuggestionApproved?.(data.task.id)
          },
        }
      )
    },
    [approve, onSuggestionApproved]
  )

  const handleReject = useCallback((suggestionId: string) => {
    setRejectingId(suggestionId)
    setRejectDialogOpen(true)
  }, [])

  const confirmReject = useCallback(() => {
    if (rejectingId) {
      reject({ suggestionId: rejectingId })
      setRejectDialogOpen(false)
      setRejectingId(null)
    }
  }, [reject, rejectingId])

  const handleBulkApprove = useCallback(() => {
    if (selectedIds.size > 0) {
      bulkApprove({ suggestionIds: Array.from(selectedIds) })
      setSelectedIds(new Set())
    }
  }, [bulkApprove, selectedIds])

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    if (selectedIds.size === pendingSuggestions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pendingSuggestions.map(s => s.id)))
    }
  }, [pendingSuggestions, selectedIds.size])

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <IconSparkles className="h-4 w-4 text-amber-500" />
            Feature Suggestions
          </CardTitle>
          <Button disabled={isGenerating} onClick={handleGenerate} size="sm">
            {isGenerating ? (
              <>
                <IconLoader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <IconSparkles className="h-4 w-4 mr-1.5" />
                Generate
              </>
            )}
          </Button>
        </div>

        {/* Generation Progress */}
        {progress && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{progress.message}</span>
              <span className="text-muted-foreground">
                {Math.round(progress.progress)}%
              </span>
            </div>
            <Progress className="h-1.5" value={progress.progress} />

            {/* Streaming AI Output */}
            {progress.streamingText && (
              <div className="mt-2 p-2 bg-muted/50 rounded-md border max-h-48 overflow-auto">
                <div className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-words">
                  {progress.streamingText}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bulk Actions */}
        {pendingSuggestions.length > 0 && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t">
            <Checkbox
              checked={selectedIds.size === pendingSuggestions.length}
              onCheckedChange={selectAll}
            />
            <span className="text-sm text-muted-foreground">
              {selectedIds.size > 0
                ? `${selectedIds.size} selected`
                : 'Select all'}
            </span>
            {selectedIds.size > 0 && (
              <Button
                className="ml-auto"
                disabled={isBulkApproving}
                onClick={handleBulkApprove}
                size="sm"
                variant="outline"
              >
                {isBulkApproving ? (
                  <IconLoader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <IconCheck className="h-3.5 w-3.5 mr-1.5" />
                )}
                Approve Selected
              </Button>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full">
          <div className="p-4 pt-0 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : pendingSuggestions.length === 0 &&
              otherSuggestions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <IconBulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No suggestions yet</p>
                <p className="text-xs mt-1">
                  Click Generate to analyze your project
                </p>
              </div>
            ) : (
              <>
                {/* Pending Suggestions */}
                {pendingSuggestions.map(suggestion => (
                  <SuggestionCard
                    isApproving={isApproving}
                    isExpanded={expandedId === suggestion.id}
                    isSelected={selectedIds.has(suggestion.id)}
                    key={suggestion.id}
                    onApprove={() => handleApprove(suggestion)}
                    onDelete={() => deleteSuggestion(suggestion.id)}
                    onReject={() => handleReject(suggestion.id)}
                    onToggleExpand={() =>
                      setExpandedId(
                        expandedId === suggestion.id ? null : suggestion.id
                      )
                    }
                    onToggleSelect={() => toggleSelection(suggestion.id)}
                    suggestion={suggestion}
                  />
                ))}

                {/* Processed Suggestions */}
                {otherSuggestions.length > 0 && (
                  <>
                    <div className="text-xs text-muted-foreground pt-4 pb-2">
                      Previously Processed
                    </div>
                    {otherSuggestions.map(suggestion => (
                      <SuggestionCard
                        disabled
                        isExpanded={expandedId === suggestion.id}
                        isSelected={false}
                        key={suggestion.id}
                        onDelete={() => deleteSuggestion(suggestion.id)}
                        onToggleExpand={() =>
                          setExpandedId(
                            expandedId === suggestion.id ? null : suggestion.id
                          )
                        }
                        suggestion={suggestion}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </CardContent>

      {/* Reject Confirmation Dialog */}
      <AlertDialog onOpenChange={setRejectDialogOpen} open={rejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Suggestion?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the suggestion as rejected. You can still view it
              in the history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReject}>
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

// ============================================================================
// Suggestion Card Component
// ============================================================================

interface SuggestionCardProps {
  suggestion: FeatureSuggestion
  isSelected: boolean
  isExpanded: boolean
  onToggleSelect?: () => void
  onToggleExpand: () => void
  onApprove?: () => void
  onReject?: () => void
  onDelete?: () => void
  isApproving?: boolean
  disabled?: boolean
}

function SuggestionCard({
  suggestion,
  isSelected,
  isExpanded,
  onToggleSelect,
  onToggleExpand,
  onApprove,
  onReject,
  onDelete,
  isApproving,
  disabled,
}: SuggestionCardProps) {
  const categoryConfig = CATEGORY_CONFIG[suggestion.category]
  const priorityConfig = PRIORITY_CONFIG[suggestion.priority]
  const statusConfig = STATUS_CONFIG[suggestion.status]

  return (
    <div
      className={cn(
        'border rounded-lg transition-colors',
        isSelected && 'border-primary bg-primary/5',
        disabled && 'opacity-60'
      )}
    >
      <div className="p-3">
        <div className="flex items-start gap-2">
          {/* Checkbox */}
          {!disabled && onToggleSelect && (
            <Checkbox
              checked={isSelected}
              className="mt-0.5"
              onCheckedChange={onToggleSelect}
            />
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Category Badge */}
              <Badge
                className={cn('text-xs gap-1', categoryConfig.className)}
                variant="outline"
              >
                {categoryConfig.icon}
                {categoryConfig.label}
              </Badge>

              {/* Priority Badge */}
              <Badge
                className={cn('text-xs', priorityConfig.className)}
                variant="outline"
              >
                {priorityConfig.label}
              </Badge>

              {/* Status Badge (for non-pending) */}
              {suggestion.status !== 'pending' && (
                <Badge
                  className={cn('text-xs', statusConfig.className)}
                  variant="outline"
                >
                  {statusConfig.label}
                </Badge>
              )}

              {/* Complexity */}
              <span className="text-xs text-muted-foreground">
                Complexity: {suggestion.complexity}/5
              </span>
            </div>

            {/* Title */}
            <h4 className="font-medium mt-1.5 text-sm">{suggestion.title}</h4>

            {/* Expand/Collapse */}
            <button
              className="text-xs text-muted-foreground hover:text-foreground mt-1 flex items-center gap-1"
              onClick={onToggleExpand}
              type="button"
            >
              <IconChevronRight
                className={cn(
                  'h-3 w-3 transition-transform',
                  isExpanded && 'rotate-90'
                )}
              />
              {isExpanded ? 'Show less' : 'Show more'}
            </button>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="mt-3 space-y-2 text-sm">
                <p className="text-muted-foreground">
                  {suggestion.description}
                </p>

                {suggestion.affectedFiles &&
                  suggestion.affectedFiles.length > 0 && (
                    <div>
                      <span className="text-xs font-medium">
                        Affected files:
                      </span>
                      <ul className="text-xs text-muted-foreground mt-1">
                        {suggestion.affectedFiles.slice(0, 5).map(file => (
                          <li className="flex items-center gap-1" key={file}>
                            <IconCode className="h-3 w-3" />
                            {file}
                          </li>
                        ))}
                        {suggestion.affectedFiles.length > 5 && (
                          <li className="text-muted-foreground">
                            +{suggestion.affectedFiles.length - 5} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                <div>
                  <span className="text-xs font-medium">Rationale:</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {suggestion.rationale}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          {!disabled && (
            <div className="flex items-center gap-1">
              {onApprove && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        className="h-7 w-7 text-green-500 hover:text-green-600 hover:bg-green-500/10"
                        disabled={isApproving}
                        onClick={onApprove}
                        size="icon"
                        variant="ghost"
                      >
                        {isApproving ? (
                          <IconLoader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <IconCheck className="h-4 w-4" />
                        )}
                      </Button>
                    }
                  />
                  <TooltipContent>Approve & Create Task</TooltipContent>
                </Tooltip>
              )}

              {onReject && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        onClick={onReject}
                        size="icon"
                        variant="ghost"
                      >
                        <IconX className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <TooltipContent>Reject</TooltipContent>
                </Tooltip>
              )}
            </div>
          )}

          {/* Delete for processed suggestions */}
          {disabled && onDelete && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={onDelete}
                    size="icon"
                    variant="ghost"
                  >
                    <IconTrash className="h-4 w-4" />
                  </Button>
                }
              />
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  )
}

export default FeatureSuggestionsPanel
