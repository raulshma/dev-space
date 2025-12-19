/**
 * StatusBar Component
 *
 * Bottom status bar displaying task notifications, Jules status,
 * and actionable items like plan approval requests.
 */

import { memo, useCallback } from 'react'
import { Button } from 'renderer/components/ui/button'
import { Badge } from 'renderer/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from 'renderer/components/ui/tooltip'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from 'renderer/components/ui/popover'
import { ScrollArea } from 'renderer/components/ui/scroll-area'
import {
  IconBell,
  IconCheck,
  IconX,
  IconLoader2,
  IconAlertTriangle,
  IconInfoCircle,
  IconClipboardCheck,
  IconMessage,
  IconRefresh,
  IconExternalLink,
} from '@tabler/icons-react'
import { RunningProjectsIndicator } from './RunningProjectsIndicator'
import {
  useNotificationStore,
  usePersistentNotifications,
  useUnreadCount,
  useJulesStatuses,
} from 'renderer/stores/notification-store'
import { useAppStore } from 'renderer/stores/app-store'
import { useAgentTaskStore } from 'renderer/stores/agent-task-store'
import type {
  AppNotification,
  NotificationAction,
  JulesSessionStatus,
} from 'shared/notification-types'

// ============================================================================
// Sub-components
// ============================================================================

const SeverityIcon = memo(function SeverityIcon({
  severity,
  className = 'h-4 w-4',
}: {
  severity: AppNotification['severity']
  className?: string
}) {
  switch (severity) {
    case 'success':
      return <IconCheck className={`${className} text-green-500`} />
    case 'error':
      return <IconX className={`${className} text-destructive`} />
    case 'warning':
      return <IconAlertTriangle className={`${className} text-yellow-500`} />
    default:
      return <IconInfoCircle className={`${className} text-blue-500`} />
  }
})

const JulesStateIcon = memo(function JulesStateIcon({
  state,
  className = 'h-4 w-4',
}: {
  state: JulesSessionStatus['state']
  className?: string
}) {
  switch (state) {
    case 'awaiting-plan-approval':
      return <IconClipboardCheck className={`${className} text-yellow-500`} />
    case 'awaiting-reply':
      return <IconMessage className={`${className} text-blue-500`} />
    case 'executing':
    case 'planning':
    case 'initializing':
      return (
        <IconLoader2 className={`${className} text-blue-500 animate-spin`} />
      )
    case 'completed':
      return <IconCheck className={`${className} text-green-500`} />
    case 'failed':
      return <IconX className={`${className} text-destructive`} />
    default:
      return <IconInfoCircle className={`${className} text-muted-foreground`} />
  }
})

interface NotificationItemProps {
  notification: AppNotification
  onAction: (action: NotificationAction) => void
  onDismiss: () => void
}

const NotificationItem = memo(function NotificationItem({
  notification,
  onAction,
  onDismiss,
}: NotificationItemProps) {
  return (
    <div className="flex items-start gap-3 p-3 border-b border-border last:border-0 hover:bg-muted/50">
      <SeverityIcon
        className="h-4 w-4 mt-0.5 shrink-0"
        severity={notification.severity}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{notification.title}</p>
        {notification.message && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {notification.message}
          </p>
        )}
        {notification.actions && notification.actions.length > 0 && (
          <div className="flex gap-2 mt-2">
            {notification.actions.map(action => (
              <Button
                className="h-7 text-xs"
                key={action.id}
                onClick={() => onAction(action)}
                size="sm"
                variant={action.variant === 'primary' ? 'default' : 'outline'}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
      {!notification.persistent && (
        <Button
          className="shrink-0"
          onClick={onDismiss}
          size="icon-sm"
          variant="ghost"
        >
          <IconX className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
})

interface JulesStatusItemProps {
  status: JulesSessionStatus
  onApprovePlan: () => void
  onResync: () => void
  onViewTask: () => void
}

const JulesStatusItem = memo(function JulesStatusItem({
  status,
  onApprovePlan,
  onResync,
  onViewTask,
}: JulesStatusItemProps) {
  const stateLabels: Record<JulesSessionStatus['state'], string> = {
    initializing: 'Initializing...',
    planning: 'Creating plan...',
    'awaiting-plan-approval': 'Waiting for plan approval',
    executing: 'Executing...',
    'awaiting-reply': 'Waiting for your reply',
    completed: 'Completed',
    failed: 'Failed',
    unknown: 'Unknown state',
  }

  const needsAction =
    status.state === 'awaiting-plan-approval' ||
    status.state === 'awaiting-reply'

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 ${
        needsAction ? 'bg-yellow-500/10' : ''
      }`}
    >
      <JulesStateIcon className="h-3.5 w-3.5" state={status.state} />
      <span className="text-xs truncate flex-1">
        {status.title || 'Jules Task'}: {stateLabels[status.state]}
      </span>

      <div className="flex items-center gap-1">
        {status.state === 'awaiting-plan-approval' && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  className="h-6 w-6"
                  onClick={onApprovePlan}
                  size="icon-sm"
                  variant="ghost"
                >
                  <IconCheck className="h-3.5 w-3.5 text-green-500" />
                </Button>
              }
            />
            <TooltipContent>Approve Plan</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                className="h-6 w-6"
                onClick={onResync}
                size="icon-sm"
                variant="ghost"
              >
                <IconRefresh className="h-3.5 w-3.5" />
              </Button>
            }
          />
          <TooltipContent>Resync Status</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                className="h-6 w-6"
                onClick={onViewTask}
                size="icon-sm"
                variant="ghost"
              >
                <IconExternalLink className="h-3.5 w-3.5" />
              </Button>
            }
          />
          <TooltipContent>View Task</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
})

// ============================================================================
// Main Component
// ============================================================================

export function StatusBar(): React.JSX.Element {
  const persistentNotifications = usePersistentNotifications()
  const unreadCount = useUnreadCount()
  const julesStatuses = useJulesStatuses()
  const { removeNotification, markAsRead } = useNotificationStore()
  const setActiveView = useAppStore(state => state.setActiveView)
  const { setSelectedTask } = useAgentTaskStore()

  // Get active Jules tasks that need attention
  const activeJulesStatuses = julesStatuses.filter(
    s =>
      s.state !== 'completed' && s.state !== 'failed' && s.state !== 'unknown'
  )

  const needsAttention = activeJulesStatuses.some(
    s => s.state === 'awaiting-plan-approval' || s.state === 'awaiting-reply'
  )

  const handleNotificationAction = useCallback(
    async (notification: AppNotification, action: NotificationAction) => {
      markAsRead(notification.id)

      switch (action.actionType) {
        case 'approve-plan':
          if (notification.julesSessionId) {
            // Will be handled by IPC
            try {
              await window.api.jules.approvePlan({
                sessionId: notification.julesSessionId,
              })
            } catch (error) {
              console.error('Failed to approve plan:', error)
            }
          }
          break

        case 'view-task':
          if (notification.taskId) {
            setSelectedTask(notification.taskId)
            setActiveView('tasks')
          }
          break

        case 'dismiss':
          removeNotification(notification.id)
          break

        case 'open-url':
          if (action.payload?.url) {
            window.api.shell.openExternal({ url: action.payload.url as string })
          }
          break

        case 'resync':
          if (notification.taskId) {
            try {
              await window.api.jules.resyncTask({ taskId: notification.taskId })
            } catch (error) {
              console.error('Failed to resync task:', error)
            }
          }
          break
      }
    },
    [markAsRead, removeNotification, setSelectedTask, setActiveView]
  )

  const handleJulesApprovePlan = useCallback(
    async (status: JulesSessionStatus) => {
      try {
        await window.api.jules.approvePlan({ sessionId: status.sessionId })
      } catch (error) {
        console.error('Failed to approve plan:', error)
      }
    },
    []
  )

  const handleJulesResync = useCallback(async (status: JulesSessionStatus) => {
    try {
      await window.api.jules.resyncTask({ taskId: status.taskId })
    } catch (error) {
      console.error('Failed to resync:', error)
    }
  }, [])

  const handleViewTask = useCallback(
    (status: JulesSessionStatus) => {
      setSelectedTask(status.taskId)
      setActiveView('tasks')
    },
    [setSelectedTask, setActiveView]
  )

  return (
    <div className="border-t border-border bg-muted/30">
      {/* Jules status items */}
      {activeJulesStatuses.length > 0 && (
        <div className="border-b border-border">
          {activeJulesStatuses.map(status => (
            <JulesStatusItem
              key={status.sessionId}
              onApprovePlan={() => handleJulesApprovePlan(status)}
              onResync={() => handleJulesResync(status)}
              onViewTask={() => handleViewTask(status)}
              status={status}
            />
          ))}
        </div>
      )}

      {/* Main status bar - always visible like VS Code */}
      <div className="flex items-center justify-between h-6 px-2">
        <div className="flex items-center gap-2">
          {needsAttention && (
            <Badge
              className="h-5 text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/30"
              variant="outline"
            >
              <IconAlertTriangle className="h-3 w-3 mr-1" />
              Action Required
            </Badge>
          )}

          {activeJulesStatuses.length > 0 && !needsAttention && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <IconLoader2 className="h-3 w-3 animate-spin" />
              {activeJulesStatuses.length} Jules task
              {activeJulesStatuses.length > 1 ? 's' : ''} running
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Running projects indicator */}
          <RunningProjectsIndicator />

          {/* Notification bell with popover */}
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  className="h-5 w-5 relative"
                  size="icon-sm"
                  variant="ghost"
                >
                  <IconBell className="h-3.5 w-3.5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-destructive text-[9px] text-destructive-foreground flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
              }
            />
            <PopoverContent
              align="end"
              className="w-80 p-0"
              side="top"
              sideOffset={8}
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <span className="text-sm font-medium">Notifications</span>
                {unreadCount > 0 && (
                  <Button
                    className="h-6 text-xs"
                    onClick={() =>
                      useNotificationStore.getState().markAllAsRead()
                    }
                    size="sm"
                    variant="ghost"
                  >
                    Mark all read
                  </Button>
                )}
              </div>
              <ScrollArea className="max-h-64">
                {persistentNotifications.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No notifications
                  </p>
                ) : (
                  persistentNotifications.map(notification => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onAction={action =>
                        handleNotificationAction(notification, action)
                      }
                      onDismiss={() => removeNotification(notification.id)}
                    />
                  ))
                )}
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  )
}
