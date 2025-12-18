/**
 * Notification Store
 *
 * Zustand store for managing application notifications.
 * Handles task notifications, Jules interactions, and status bar items.
 */

import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type {
  AppNotification,
  CreateNotificationInput,
  JulesSessionStatus,
  StatusBarItem,
} from 'shared/notification-types'

// ============================================================================
// Types
// ============================================================================

export interface NotificationState {
  // Notifications
  notifications: Map<string, AppNotification>
  notificationOrder: string[]

  // Jules session statuses
  julesStatuses: Map<string, JulesSessionStatus>

  // Status bar items
  statusBarItems: Map<string, StatusBarItem>

  // UI state
  statusBarExpanded: boolean
  unreadCount: number

  // Actions - Notifications
  addNotification: (input: CreateNotificationInput) => string
  updateNotification: (id: string, updates: Partial<AppNotification>) => void
  removeNotification: (id: string) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearAll: () => void

  // Actions - Jules status
  setJulesStatus: (status: JulesSessionStatus) => void
  removeJulesStatus: (sessionId: string) => void
  getJulesStatus: (sessionId: string) => JulesSessionStatus | undefined

  // Actions - Status bar
  setStatusBarItem: (item: StatusBarItem) => void
  removeStatusBarItem: (id: string) => void
  toggleStatusBar: () => void
  setStatusBarExpanded: (expanded: boolean) => void
}

// ============================================================================
// Helpers
// ============================================================================

function generateId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ============================================================================
// Store
// ============================================================================

export const useNotificationStore = create<NotificationState>((set, get) => ({
  // Initial state
  notifications: new Map(),
  notificationOrder: [],
  julesStatuses: new Map(),
  statusBarItems: new Map(),
  statusBarExpanded: false,
  unreadCount: 0,

  // Notification actions
  addNotification: input => {
    const id = generateId()
    const notification: AppNotification = {
      id,
      type: input.type,
      severity: input.severity,
      title: input.title,
      message: input.message,
      timestamp: new Date(),
      persistent: input.persistent ?? false,
      autoHideMs: input.autoHideMs ?? (input.persistent ? 0 : 5000),
      taskId: input.taskId,
      julesSessionId: input.julesSessionId,
      actions: input.actions,
      read: false,
      progress: input.progress,
    }

    set(state => {
      const newNotifications = new Map(state.notifications)
      newNotifications.set(id, notification)

      // Add to front of order (newest first)
      const newOrder = [id, ...state.notificationOrder]

      // Limit to 100 notifications
      if (newOrder.length > 100) {
        const toRemove = newOrder.slice(100)
        for (const removeId of toRemove) {
          newNotifications.delete(removeId)
        }
        newOrder.length = 100
      }

      return {
        notifications: newNotifications,
        notificationOrder: newOrder,
        unreadCount: state.unreadCount + 1,
      }
    })

    // Auto-hide if configured
    if (notification.autoHideMs > 0) {
      setTimeout(() => {
        get().removeNotification(id)
      }, notification.autoHideMs)
    }

    return id
  },

  updateNotification: (id, updates) =>
    set(state => {
      const existing = state.notifications.get(id)
      if (!existing) return state

      const newNotifications = new Map(state.notifications)
      newNotifications.set(id, { ...existing, ...updates })

      return { notifications: newNotifications }
    }),

  removeNotification: id =>
    set(state => {
      const notification = state.notifications.get(id)
      if (!notification) return state

      const newNotifications = new Map(state.notifications)
      newNotifications.delete(id)

      const newOrder = state.notificationOrder.filter(nid => nid !== id)
      const unreadDelta = notification.read ? 0 : -1

      return {
        notifications: newNotifications,
        notificationOrder: newOrder,
        unreadCount: Math.max(0, state.unreadCount + unreadDelta),
      }
    }),

  markAsRead: id =>
    set(state => {
      const notification = state.notifications.get(id)
      if (!notification || notification.read) return state

      const newNotifications = new Map(state.notifications)
      newNotifications.set(id, { ...notification, read: true })

      return {
        notifications: newNotifications,
        unreadCount: Math.max(0, state.unreadCount - 1),
      }
    }),

  markAllAsRead: () =>
    set(state => {
      const newNotifications = new Map(state.notifications)
      for (const [id, notification] of newNotifications) {
        if (!notification.read) {
          newNotifications.set(id, { ...notification, read: true })
        }
      }
      return { notifications: newNotifications, unreadCount: 0 }
    }),

  clearAll: () =>
    set({
      notifications: new Map(),
      notificationOrder: [],
      unreadCount: 0,
    }),

  // Jules status actions
  setJulesStatus: status =>
    set(state => {
      const newStatuses = new Map(state.julesStatuses)
      newStatuses.set(status.sessionId, status)
      return { julesStatuses: newStatuses }
    }),

  removeJulesStatus: sessionId =>
    set(state => {
      const newStatuses = new Map(state.julesStatuses)
      newStatuses.delete(sessionId)
      return { julesStatuses: newStatuses }
    }),

  getJulesStatus: sessionId => {
    return get().julesStatuses.get(sessionId)
  },

  // Status bar actions
  setStatusBarItem: item =>
    set(state => {
      const newItems = new Map(state.statusBarItems)
      newItems.set(item.id, item)
      return { statusBarItems: newItems }
    }),

  removeStatusBarItem: id =>
    set(state => {
      const newItems = new Map(state.statusBarItems)
      newItems.delete(id)
      return { statusBarItems: newItems }
    }),

  toggleStatusBar: () =>
    set(state => ({ statusBarExpanded: !state.statusBarExpanded })),

  setStatusBarExpanded: expanded => set({ statusBarExpanded: expanded }),
}))

// ============================================================================
// Hooks
// ============================================================================

/**
 * Get all notifications in order
 */
export const useNotifications = (): AppNotification[] => {
  return useNotificationStore(
    useShallow(state =>
      state.notificationOrder
        .map(id => state.notifications.get(id))
        .filter((n): n is AppNotification => n !== undefined)
    )
  )
}

/**
 * Get unread notifications
 */
export const useUnreadNotifications = (): AppNotification[] => {
  return useNotificationStore(
    useShallow(state =>
      state.notificationOrder
        .map(id => state.notifications.get(id))
        .filter((n): n is AppNotification => n !== undefined && !n.read)
    )
  )
}

/**
 * Get persistent notifications (for status bar)
 */
export const usePersistentNotifications = (): AppNotification[] => {
  return useNotificationStore(
    useShallow(state =>
      state.notificationOrder
        .map(id => state.notifications.get(id))
        .filter((n): n is AppNotification => n !== undefined && n.persistent)
    )
  )
}

/**
 * Get Jules statuses as array
 */
export const useJulesStatuses = (): JulesSessionStatus[] => {
  return useNotificationStore(
    useShallow(state => Array.from(state.julesStatuses.values()))
  )
}

/**
 * Get status bar items sorted by priority
 */
export const useStatusBarItems = (): StatusBarItem[] => {
  return useNotificationStore(
    useShallow(state =>
      Array.from(state.statusBarItems.values()).sort(
        (a, b) => b.priority - a.priority
      )
    )
  )
}

/**
 * Get unread count
 */
export const useUnreadCount = (): number => {
  return useNotificationStore(state => state.unreadCount)
}
