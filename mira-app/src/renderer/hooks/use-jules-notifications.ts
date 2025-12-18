/**
 * Hook for Jules task notifications
 *
 * Provides utilities for managing Jules task notifications,
 * including plan approval, message sending, and resync.
 */

import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNotificationStore } from 'renderer/stores/notification-store'
import { agentTaskKeys } from './use-agent-tasks'
import type { JulesSessionStatus } from 'shared/notification-types'

/**
 * Hook for approving a Jules plan
 */
export function useApprovePlan() {
  const queryClient = useQueryClient()
  const { addNotification, setJulesStatus } = useNotificationStore()

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await window.api.jules.approvePlan({ sessionId })
      if (!response.success) {
        throw new Error(response.error || 'Failed to approve plan')
      }
      return response
    },
    onSuccess: (_data, sessionId) => {
      // Update the Jules status to executing
      const currentStatus = useNotificationStore
        .getState()
        .getJulesStatus(sessionId)
      if (currentStatus) {
        setJulesStatus({
          ...currentStatus,
          state: 'executing',
          pendingPlan: undefined,
        })
      }

      addNotification({
        type: 'jules-completed',
        severity: 'success',
        title: 'Plan Approved',
        message: 'Jules is now executing the approved plan',
        autoHideMs: 3000,
      })

      // Invalidate task queries
      queryClient.invalidateQueries({ queryKey: agentTaskKeys.lists() })
    },
    onError: error => {
      addNotification({
        type: 'jules-error',
        severity: 'error',
        title: 'Failed to Approve Plan',
        message: error instanceof Error ? error.message : 'Unknown error',
        autoHideMs: 5000,
      })
    },
  })
}

/**
 * Hook for sending a message to Jules
 */
export function useSendJulesMessage() {
  const { addNotification, setJulesStatus } = useNotificationStore()

  return useMutation({
    mutationFn: async ({
      sessionId,
      message,
    }: {
      sessionId: string
      message: string
    }) => {
      const response = await window.api.jules.sendMessage({ sessionId, message })
      if (!response.success) {
        throw new Error(response.error || 'Failed to send message')
      }
      return response
    },
    onSuccess: (_data, { sessionId }) => {
      // Update the Jules status
      const currentStatus = useNotificationStore
        .getState()
        .getJulesStatus(sessionId)
      if (currentStatus) {
        setJulesStatus({
          ...currentStatus,
          state: 'executing',
        })
      }

      addNotification({
        type: 'jules-completed',
        severity: 'success',
        title: 'Message Sent',
        message: 'Your message has been sent to Jules',
        autoHideMs: 3000,
      })
    },
    onError: error => {
      addNotification({
        type: 'jules-error',
        severity: 'error',
        title: 'Failed to Send Message',
        message: error instanceof Error ? error.message : 'Unknown error',
        autoHideMs: 5000,
      })
    },
  })
}

/**
 * Hook for resyncing a Jules task
 */
export function useResyncJulesTask() {
  const queryClient = useQueryClient()
  const { addNotification, setJulesStatus } = useNotificationStore()

  return useMutation({
    mutationFn: async (taskId: string) => {
      const response = await window.api.jules.resyncTask({ taskId })
      if (!response.success) {
        throw new Error(response.error || 'Failed to resync task')
      }
      return response
    },
    onSuccess: data => {
      if (data.status) {
        setJulesStatus(data.status)
      }

      addNotification({
        type: 'task-status',
        severity: 'success',
        title: 'Task Resynced',
        message: 'Jules task status has been updated',
        autoHideMs: 3000,
      })

      // Invalidate task queries
      queryClient.invalidateQueries({ queryKey: agentTaskKeys.lists() })
    },
    onError: error => {
      addNotification({
        type: 'jules-error',
        severity: 'error',
        title: 'Failed to Resync Task',
        message: error instanceof Error ? error.message : 'Unknown error',
        autoHideMs: 5000,
      })
    },
  })
}

/**
 * Hook for getting Jules task status
 */
export function useJulesTaskStatus(taskId: string | null) {
  const { setJulesStatus } = useNotificationStore()

  const fetchStatus = useCallback(async () => {
    if (!taskId) return null

    try {
      const response = await window.api.jules.getSessionStatus({ taskId })
      if (response.status) {
        setJulesStatus(response.status)
        return response.status
      }
      return null
    } catch (error) {
      console.error('Failed to fetch Jules status:', error)
      return null
    }
  }, [taskId, setJulesStatus])

  return { fetchStatus }
}

/**
 * Create a notification for a Jules task state change
 */
export function createJulesNotification(
  status: JulesSessionStatus
): import('shared/notification-types').CreateNotificationInput | null {
  switch (status.state) {
    case 'awaiting-plan-approval':
      return {
        type: 'jules-plan-approval',
        severity: 'warning',
        title: 'Plan Approval Required',
        message: `Jules has generated a plan for "${status.title || 'your task'}"`,
        persistent: true,
        autoHideMs: 0,
        taskId: status.taskId,
        julesSessionId: status.sessionId,
        actions: [
          {
            id: 'approve',
            label: 'Approve Plan',
            variant: 'primary',
            actionType: 'approve-plan',
          },
          {
            id: 'view',
            label: 'View Details',
            actionType: 'view-task',
          },
        ],
      }

    case 'awaiting-reply':
      return {
        type: 'jules-waiting-reply',
        severity: 'info',
        title: 'Jules Needs Your Input',
        message: `Jules is waiting for your reply on "${status.title || 'your task'}"`,
        persistent: true,
        autoHideMs: 0,
        taskId: status.taskId,
        julesSessionId: status.sessionId,
        actions: [
          {
            id: 'view',
            label: 'View & Reply',
            variant: 'primary',
            actionType: 'view-task',
          },
        ],
      }

    case 'completed':
      return {
        type: 'jules-completed',
        severity: 'success',
        title: 'Jules Task Completed',
        message: status.pullRequestUrl
          ? `Pull request created for "${status.title || 'your task'}"`
          : `"${status.title || 'Your task'}" has been completed`,
        persistent: false,
        autoHideMs: 10000,
        taskId: status.taskId,
        julesSessionId: status.sessionId,
        actions: status.pullRequestUrl
          ? [
              {
                id: 'open-pr',
                label: 'Open PR',
                variant: 'primary',
                actionType: 'open-url',
                payload: { url: status.pullRequestUrl },
              },
              {
                id: 'view',
                label: 'View Task',
                actionType: 'view-task',
              },
            ]
          : [
              {
                id: 'view',
                label: 'View Task',
                actionType: 'view-task',
              },
            ],
      }

    case 'failed':
      return {
        type: 'jules-error',
        severity: 'error',
        title: 'Jules Task Failed',
        message: `"${status.title || 'Your task'}" has failed`,
        persistent: false,
        autoHideMs: 10000,
        taskId: status.taskId,
        julesSessionId: status.sessionId,
        actions: [
          {
            id: 'view',
            label: 'View Details',
            actionType: 'view-task',
          },
          {
            id: 'resync',
            label: 'Retry',
            actionType: 'resync',
          },
        ],
      }

    default:
      return null
  }
}
