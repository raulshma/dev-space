// Hook for managing keyboard shortcuts
// Requirements: 14.1, 14.2, 14.3, 14.4

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ShortcutListRequest, ShortcutSetRequest } from 'shared/ipc-types'

/**
 * Hook for fetching all keyboard shortcuts
 */
export function useShortcuts() {
  return useQuery({
    queryKey: ['shortcuts'],
    queryFn: async () => {
      const request: ShortcutListRequest = {}
      const response = await window.api.shortcuts.list(request)
      return response.shortcuts
    },
    staleTime: Infinity, // Shortcuts rarely change
  })
}

/**
 * Hook for setting a keyboard shortcut
 */
export function useSetShortcut() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      action,
      binding,
    }: {
      action: string
      binding: string
    }) => {
      const request: ShortcutSetRequest = { action, binding }
      const response = await window.api.shortcuts.set(request)

      if (!response.success) {
        throw new Error('Failed to set shortcut - binding conflict detected')
      }

      return response
    },
    onSuccess: () => {
      // Invalidate shortcuts query to refetch
      queryClient.invalidateQueries({ queryKey: ['shortcuts'] })
    },
  })
}
