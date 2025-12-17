// TanStack Query hooks for git telemetry operations
// Requirements: 2.1, 2.2, 2.3, 2.4

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { GitTelemetry } from '../../../shared/models'

// Query keys
export const gitKeys = {
  all: ['git'] as const,
  telemetry: () => [...gitKeys.all, 'telemetry'] as const,
  telemetryForProject: (projectPath: string) => [...gitKeys.telemetry(), projectPath] as const
}

// Hook to fetch git telemetry for a project
export function useGitTelemetry(projectPath: string | null) {
  return useQuery({
    queryKey: gitKeys.telemetryForProject(projectPath || ''),
    queryFn: async () => {
      if (!projectPath) return null
      const response = await window.api.git.getTelemetry({ projectPath })
      return response.telemetry
    },
    enabled: !!projectPath,
    staleTime: 30000, // Consider data stale after 30 seconds
    refetchInterval: false // Don't auto-refetch, we'll use background refresh
  })
}

// Hook to manage background git telemetry refresh for a project
export function useGitTelemetryRefresh(
  projectId: string | null,
  projectPath: string | null,
  enabled: boolean = true
) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!projectId || !projectPath || !enabled) {
      return
    }

    // Start background refresh (every 30 seconds)
    const startRefresh = async (): Promise<void> => {
      try {
        await window.api.git.startRefresh({
          projectId,
          interval: 30000 // 30 seconds
        })
      } catch (error) {
        console.error('Failed to start git telemetry refresh:', error)
      }
    }

    // Stop background refresh
    const stopRefresh = async (): Promise<void> => {
      try {
        await window.api.git.stopRefresh({ projectId })
      } catch (error) {
        console.error('Failed to stop git telemetry refresh:', error)
      }
    }

    // Set up a polling interval to fetch updated telemetry
    const pollInterval = setInterval(async () => {
      try {
        const response = await window.api.git.getTelemetry({ projectPath })
        // Update the query cache with fresh data
        queryClient.setQueryData<GitTelemetry>(
          gitKeys.telemetryForProject(projectPath),
          response.telemetry
        )
      } catch (error) {
        console.error('Failed to poll git telemetry:', error)
      }
    }, 30000) // Poll every 30 seconds

    // Start the background refresh
    startRefresh()

    // Cleanup: stop refresh and clear interval
    return () => {
      stopRefresh()
      clearInterval(pollInterval)
    }
  }, [projectId, projectPath, enabled, queryClient])
}
