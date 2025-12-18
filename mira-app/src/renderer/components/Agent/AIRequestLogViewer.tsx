import { useState, useCallback, useMemo } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from 'renderer/components/ui/card'
import { Input } from 'renderer/components/ui/input'
import { Button } from 'renderer/components/ui/button'
import { Badge } from 'renderer/components/ui/badge'
import { ScrollArea } from 'renderer/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'renderer/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from 'renderer/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'renderer/components/ui/tabs'
import { Spinner } from 'renderer/components/ui/spinner'
import {
  IconSearch,
  IconFilter,
  IconRefresh,
  IconClock,
  IconCircleCheck,
  IconCircleX,
  IconAlertCircle,
  IconChevronRight,
  IconCopy,
  IconExternalLink,
} from '@tabler/icons-react'
import type {
  AIRequestLog,
  AIAction,
  AIRequestStatus,
  AILogFilter,
} from 'shared/ai-types'
import { useAIRequestLogs, useAIRequestLog } from 'renderer/hooks/use-ai'

/**
 * AIRequestLogViewer Component
 *
 * Displays AI request logs with filtering and search capabilities.
 * Shows request/response details in a modal dialog.
 *
 * Requirements: 4.5
 */

const STATUS_CONFIG: Record<
  AIRequestStatus,
  { label: string; icon: React.ReactNode; className: string }
> = {
  pending: {
    label: 'Pending',
    icon: <IconClock className="h-3 w-3" />,
    className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  },
  completed: {
    label: 'Completed',
    icon: <IconCircleCheck className="h-3 w-3" />,
    className: 'bg-green-500/10 text-green-600 dark:text-green-400',
  },
  failed: {
    label: 'Failed',
    icon: <IconCircleX className="h-3 w-3" />,
    className: 'bg-red-500/10 text-red-600 dark:text-red-400',
  },
}

const ACTION_LABELS: Record<AIAction, string> = {
  chat: 'Chat',
  'code-generation': 'Code Generation',
  'error-fix': 'Error Fix',
  'parameter-extraction': 'Parameter Extraction',
}

/**
 * Formats a date to a readable string
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

/**
 * Formats latency to a readable string
 */
function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

/**
 * Truncates text to a maximum length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

export function AIRequestLogViewer(): React.JSX.Element {
  const [filter, setFilter] = useState<AILogFilter>({
    limit: 50,
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null)

  const { data: logs, isLoading, error, refetch } = useAIRequestLogs(filter)

  // Filter logs by search query
  const filteredLogs = useMemo(() => {
    if (!logs) return []
    if (!searchQuery.trim()) return logs

    const query = searchQuery.toLowerCase()
    return logs.filter(
      log =>
        log.modelId.toLowerCase().includes(query) ||
        log.action.toLowerCase().includes(query) ||
        log.input.messages.some(m => m.content.toLowerCase().includes(query)) ||
        log.response?.output.toLowerCase().includes(query) ||
        log.error?.message.toLowerCase().includes(query)
    )
  }, [logs, searchQuery])

  const handleStatusFilter = useCallback((status: string) => {
    setFilter(prev => ({
      ...prev,
      status: status === 'all' ? undefined : (status as AIRequestStatus),
    }))
  }, [])

  const handleActionFilter = useCallback((action: string) => {
    setFilter(prev => ({
      ...prev,
      action: action === 'all' ? undefined : (action as AIAction),
    }))
  }, [])

  const handleRefresh = useCallback(() => {
    refetch()
  }, [refetch])

  const handleLogClick = useCallback((logId: string) => {
    setSelectedLogId(logId)
  }, [])

  const handleCloseDetail = useCallback(() => {
    setSelectedLogId(null)
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="h-4 w-4" />
          Loading request logs...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <IconAlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">
          Failed to load request logs
        </p>
        <Button onClick={handleRefresh} size="sm" variant="outline">
          <IconRefresh className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold">AI Request Logs</h3>
        <p className="text-sm text-muted-foreground">
          View and analyze AI API interactions
        </p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search logs..."
            value={searchQuery}
          />
        </div>

        {/* Status Filter */}
        <Select
          onValueChange={value => handleStatusFilter(value || 'all')}
          value={filter.status || 'all'}
        >
          <SelectTrigger className="w-[140px]">
            <IconFilter className="mr-2 h-4 w-4" />
            <SelectValue>
              {filter.status
                ? STATUS_CONFIG[filter.status].label
                : 'All Status'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        {/* Action Filter */}
        <Select
          onValueChange={value => handleActionFilter(value || 'all')}
          value={filter.action || 'all'}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue>
              {filter.action ? ACTION_LABELS[filter.action] : 'All Actions'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {Object.entries(ACTION_LABELS).map(([action, label]) => (
              <SelectItem key={action} value={action}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Refresh Button */}
        <Button onClick={handleRefresh} size="icon" variant="outline">
          <IconRefresh className="h-4 w-4" />
        </Button>
      </div>

      {/* Log List */}
      <ScrollArea className="flex-1">
        {filteredLogs.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            {searchQuery
              ? 'No logs match your search'
              : 'No request logs found'}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredLogs.map(log => (
              <LogListItem
                key={log.id}
                log={log}
                onClick={() => handleLogClick(log.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Log Count */}
      <div className="mt-4 text-xs text-muted-foreground">
        Showing {filteredLogs.length} of {logs?.length || 0} logs
      </div>

      {/* Detail Dialog */}
      <LogDetailDialog
        logId={selectedLogId}
        onClose={handleCloseDetail}
        open={!!selectedLogId}
      />
    </div>
  )
}

interface LogListItemProps {
  log: AIRequestLog
  onClick: () => void
}

function LogListItem({ log, onClick }: LogListItemProps): React.JSX.Element {
  const statusConfig = STATUS_CONFIG[log.status]
  const inputPreview =
    log.input.messages[log.input.messages.length - 1]?.content || ''

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-muted/50"
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-4 p-3">
        {/* Status Badge */}
        <Badge className={statusConfig.className} variant="secondary">
          {statusConfig.icon}
          <span className="ml-1">{statusConfig.label}</span>
        </Badge>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{log.modelId}</span>
            <Badge className="text-xs" variant="outline">
              {ACTION_LABELS[log.action]}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {truncateText(inputPreview, 100)}
          </p>
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {log.response && <span>{formatLatency(log.response.latencyMs)}</span>}
          <span>{formatDate(log.timestamp)}</span>
          <IconChevronRight className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  )
}

interface LogDetailDialogProps {
  logId: string | null
  open: boolean
  onClose: () => void
}

function LogDetailDialog({
  logId,
  open,
  onClose,
}: LogDetailDialogProps): React.JSX.Element {
  const { data: log, isLoading } = useAIRequestLog(logId)

  const handleCopyJson = useCallback(() => {
    if (!log) return
    navigator.clipboard.writeText(JSON.stringify(log, null, 2))
  }, [log])

  return (
    <Dialog onOpenChange={onClose} open={open}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Request Details</DialogTitle>
          <DialogDescription>
            {log
              ? `${log.modelId} - ${formatDate(log.timestamp)}`
              : 'Loading...'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner className="h-6 w-6" />
          </div>
        ) : log ? (
          <div className="flex-1 overflow-hidden">
            {/* Summary */}
            <div className="mb-4 flex flex-wrap gap-2">
              <Badge
                className={STATUS_CONFIG[log.status].className}
                variant="secondary"
              >
                {STATUS_CONFIG[log.status].icon}
                <span className="ml-1">{STATUS_CONFIG[log.status].label}</span>
              </Badge>
              <Badge variant="outline">{ACTION_LABELS[log.action]}</Badge>
              {log.response && (
                <>
                  <Badge variant="outline">
                    {log.response.tokenUsage.totalTokens} tokens
                  </Badge>
                  <Badge variant="outline">
                    {formatLatency(log.response.latencyMs)}
                  </Badge>
                </>
              )}
            </div>

            {/* Tabs for Input/Output/Error */}
            <Tabs className="flex-1" defaultValue="input">
              <TabsList>
                <TabsTrigger value="input">Input</TabsTrigger>
                <TabsTrigger disabled={!log.response} value="output">
                  Output
                </TabsTrigger>
                {log.error && <TabsTrigger value="error">Error</TabsTrigger>}
                <TabsTrigger value="metadata">Metadata</TabsTrigger>
              </TabsList>

              <ScrollArea className="h-[400px] mt-4">
                <TabsContent className="m-0" value="input">
                  <div className="space-y-4">
                    {log.input.systemPrompt && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">
                          System Prompt
                        </h4>
                        <pre className="rounded-lg bg-muted p-3 text-xs overflow-x-auto whitespace-pre-wrap">
                          {log.input.systemPrompt}
                        </pre>
                      </div>
                    )}
                    <div>
                      <h4 className="text-sm font-medium mb-2">Messages</h4>
                      <div className="space-y-2">
                        {log.input.messages.map((msg, idx) => (
                          <div className="rounded-lg bg-muted p-3" key={idx}>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className="text-xs" variant="outline">
                                {msg.role}
                              </Badge>
                            </div>
                            <pre className="text-xs whitespace-pre-wrap">
                              {msg.content}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent className="m-0" value="output">
                  {log.response && (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium mb-2">Response</h4>
                        <pre className="rounded-lg bg-muted p-3 text-xs overflow-x-auto whitespace-pre-wrap">
                          {log.response.output}
                        </pre>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-2">
                          Token Usage
                        </h4>
                        <div className="grid grid-cols-3 gap-4">
                          <Card>
                            <CardContent className="p-3 text-center">
                              <div className="text-2xl font-bold">
                                {log.response.tokenUsage.promptTokens}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Prompt Tokens
                              </div>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-3 text-center">
                              <div className="text-2xl font-bold">
                                {log.response.tokenUsage.completionTokens}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Completion Tokens
                              </div>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-3 text-center">
                              <div className="text-2xl font-bold">
                                {log.response.tokenUsage.totalTokens}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Total Tokens
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {log.error && (
                  <TabsContent className="m-0" value="error">
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium mb-2">Error Type</h4>
                        <Badge variant="destructive">{log.error.type}</Badge>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-2">Message</h4>
                        <pre className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive overflow-x-auto whitespace-pre-wrap">
                          {log.error.message}
                        </pre>
                      </div>
                      {log.error.stack && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">
                            Stack Trace
                          </h4>
                          <pre className="rounded-lg bg-muted p-3 text-xs overflow-x-auto whitespace-pre-wrap">
                            {log.error.stack}
                          </pre>
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-medium mb-2">
                          Retry Count
                        </h4>
                        <span className="text-sm">{log.error.retryCount}</span>
                      </div>
                    </div>
                  </TabsContent>
                )}

                <TabsContent className="m-0" value="metadata">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Request ID</h4>
                      <code className="rounded bg-muted px-2 py-1 text-xs">
                        {log.id}
                      </code>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-2">Model</h4>
                      <span className="text-sm">{log.modelId}</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-2">Action</h4>
                      <span className="text-sm">
                        {ACTION_LABELS[log.action]}
                      </span>
                    </div>
                    {log.metadata && (
                      <>
                        {log.metadata.temperature !== undefined && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">
                              Temperature
                            </h4>
                            <span className="text-sm">
                              {log.metadata.temperature}
                            </span>
                          </div>
                        )}
                        {log.metadata.maxTokens !== undefined && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">
                              Max Tokens
                            </h4>
                            <span className="text-sm">
                              {log.metadata.maxTokens}
                            </span>
                          </div>
                        )}
                        {log.metadata.projectId && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">
                              Project ID
                            </h4>
                            <code className="rounded bg-muted px-2 py-1 text-xs">
                              {log.metadata.projectId}
                            </code>
                          </div>
                        )}
                      </>
                    )}
                    {log.response?.modelVersion && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">
                          Model Version
                        </h4>
                        <span className="text-sm">
                          {log.response.modelVersion}
                        </span>
                      </div>
                    )}
                    {log.response?.finishReason && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">
                          Finish Reason
                        </h4>
                        <Badge variant="outline">
                          {log.response.finishReason}
                        </Badge>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </ScrollArea>
            </Tabs>

            {/* Actions */}
            <div className="mt-4 flex justify-end gap-2">
              <Button onClick={handleCopyJson} size="sm" variant="outline">
                <IconCopy className="mr-2 h-4 w-4" />
                Copy JSON
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Log not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
