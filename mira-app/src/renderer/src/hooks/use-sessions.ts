// TanStack Query hooks for session operations
// Requirements: 4.1, 4.2, 4.3, 4.4

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { SessionState } from '../../../shared/models'

// Query keys
export const sessionKeys = {
  all: ['sessions'] as const,
  details: () => [...sessionKeys.all, 'detail'] as const,
  detail: (projectId: string) => [...sessionKeys.details(), projectId] as const
}

// Hook to restore a session for a project
export function useSession(projectId: string | null) {
  return useQuery({
    queryKey: sessionKeys.detail(projectId || ''),
    queryFn: async () => {
      if (!projectId) return null
      const response = await window.api.sessions.restore({ projectId })
      return response.state
    },
    enabled: !!projectId
  })
}

// Hook to save a session
export function useSaveSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ projectId, state }: { projectId: string; state: SessionState }) => {
      const response = await window.api.sessions.save({ projectId, state })
      return response.success
    },
    onSuccess: (_, { projectId }) => {
      // Invalidate the session cache for this project
      queryClient.invalidateQueries({ queryKey: sessionKeys.detail(projectId) })
    }
  })
}
