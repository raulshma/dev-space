/**
 * Notification Types
 *
 * Shared types for the application notification system.
 * Supports task notifications, Jules interactions, and general alerts.
 */

/**
 * Notification severity levels
 */
export type NotificationSeverity = 'info' | 'warning' | 'error' | 'success'

/**
 * Notification types for categorization
 */
export type NotificationType =
  | 'task-status'
  | 'jules-plan-approval'
  | 'jules-waiting-reply'
  | 'jules-completed'
  | 'jules-error'
  | 'task-completed'
  | 'task-failed'
  | 'system'

/**
 * Action that can be taken on a notification
 */
export interface NotificationAction {
  id: string
  label: string
  variant?: 'default' | 'primary' | 'destructive'
  /** Action type for IPC handling */
  actionType:
    | 'approve-plan'
    | 'send-message'
    | 'resync'
    | 'view-task'
    | 'dismiss'
    | 'open-url'
  /** Additional data for the action */
  payload?: Record<string, unknown>
}

/**
 * Base notification interface
 */
export interface AppNotification {
  id: string
  type: NotificationType
  severity: NotificationSeverity
  title: string
  message?: string
  timestamp: Date
  /** Whether the notification persists until dismissed */
  persistent: boolean
  /** Auto-dismiss timeout in ms (0 = no auto-dismiss) */
  autoHideMs: number
  /** Associated task ID if applicable */
  taskId?: string
  /** Associated Jules session ID if applicable */
  julesSessionId?: string
  /** Available actions for this notification */
  actions?: NotificationAction[]
  /** Whether the notification has been read/acknowledged */
  read: boolean
  /** Progress percentage (0-100) for progress notifications */
  progress?: number
}

/**
 * Jules task state for tracking session status
 */
export type JulesTaskState =
  | 'initializing'
  | 'planning'
  | 'awaiting-plan-approval'
  | 'executing'
  | 'awaiting-reply'
  | 'completed'
  | 'failed'
  | 'unknown'

/**
 * Jules session status with detailed state
 */
export interface JulesSessionStatus {
  sessionId: string
  taskId: string
  state: JulesTaskState
  title?: string
  /** The prompt used to start the session */
  prompt?: string
  /** Session creation time */
  createTime?: string
  /** Session last update time */
  updateTime?: string
  /** URL to view the session in Jules web app */
  webUrl?: string
  /** Source context (repo info) */
  sourceContext?: {
    source: string
    githubRepoContext?: {
      startingBranch: string
    }
  }
  /** Current plan if awaiting approval */
  pendingPlan?: {
    id: string
    steps: Array<{ id: string; title: string; index?: number }>
  }
  /** Last activity timestamp */
  lastActivityAt?: Date
  /** PR URL if completed */
  pullRequestUrl?: string
}

/**
 * Input for creating a notification
 */
export interface CreateNotificationInput {
  type: NotificationType
  severity: NotificationSeverity
  title: string
  message?: string
  persistent?: boolean
  autoHideMs?: number
  taskId?: string
  julesSessionId?: string
  actions?: NotificationAction[]
  progress?: number
}

/**
 * Status bar item for displaying in the bottom bar
 */
export interface StatusBarItem {
  id: string
  /** Icon name from Tabler icons */
  icon?: string
  label: string
  tooltip?: string
  /** Click action */
  onClick?: () => void
  /** Priority for ordering (higher = more left) */
  priority: number
  /** Whether this is a task-related status */
  isTaskStatus?: boolean
  /** Associated notification ID */
  notificationId?: string
}
