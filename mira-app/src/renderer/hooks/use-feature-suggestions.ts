/**
 * Feature Suggestions Hook
 *
 * Provides React hooks for interacting with the feature suggestions API.
 * Handles data fetching, mutations, and real-time progress updates.
 */

import { useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useFeatureSuggestionsStore,
  useFilteredSuggestions,
  useSuggestionsList,
  useGenerationProgress,
  useFeatureSuggestionsLoading,
} from 'renderer/stores/feature-suggestions-store'
import type {
  FeatureSuggestion,
  FeatureSuggestionFilter,
  GenerateSuggestionsParams,
  AgentType,
  PlanningMode,
} from 'shared/ai-types'

// ============================================================================
// Query Keys
// ============================================================================

export const featureSuggestionsKeys = {
  all: ['featureSuggestions'] as const,
  lists: () => [...featureSuggestionsKeys.all, 'list'] as const,
  list: (filter: FeatureSuggestionFilter) =>
    [...featureSuggestionsKeys.lists(), filter] as const,
  details: () => [...featureSuggestionsKeys.all, 'detail'] as const,
  detail: (id: string) => [...featureSuggestionsKeys.details(), id] as const,
  batches: (projectId: string) =>
    [...featureSuggestionsKeys.all, 'batches', projectId] as const,
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch and manage feature suggestions
 */
export function useFeatureSuggestions(filter?: FeatureSuggestionFilter) {
  const queryClient = useQueryClient()
  const store = useFeatureSuggestionsStore()

  const query = useQuery({
    queryKey: featureSuggestionsKeys.list(filter ?? {}),
    queryFn: async () => {
      const response = await window.api.featureSuggestions.list({
        filter,
      })

      if ('error' in response) {
        throw new Error(response.error as string)
      }

      return response.suggestions
    },
    staleTime: 30_000, // 30 seconds
  })

  // Sync to store when data changes
  useEffect(() => {
    if (query.data) {
      store.setSuggestions(query.data)
    }
  }, [query.data, store.setSuggestions])

  return {
    suggestions: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  }
}

/**
 * Hook to generate feature suggestions for a project
 */
export function useGenerateSuggestions() {
  const queryClient = useQueryClient()
  const store = useFeatureSuggestionsStore()

  // Set up progress listener
  useEffect(() => {
    const unsubscribe = window.api.featureSuggestions.onProgress(data => {
      store.setGenerationProgress(data)

      if (data.status === 'complete' || data.status === 'error') {
        // Clear progress after a delay
        setTimeout(() => {
          store.setGenerationProgress(null)
        }, 3000)
      }
    })

    return unsubscribe
  }, [store.setGenerationProgress])

  const mutation = useMutation({
    mutationFn: async (params: GenerateSuggestionsParams) => {
      store.setGenerating(true)
      store.setError(null)

      const response = await window.api.featureSuggestions.generate({
        projectId: params.projectId,
        projectPath: params.projectPath,
        focusAreas: params.focusAreas,
        maxSuggestions: params.maxSuggestions,
        analyzeCode: params.analyzeCode,
        analyzeDependencies: params.analyzeDependencies,
        customContext: params.customContext,
      })

      if ('error' in response) {
        throw new Error(response.error as string)
      }

      return response
    },
    onSuccess: data => {
      // Add new suggestions to store
      for (const suggestion of data.suggestions) {
        store.addSuggestion(suggestion)
      }

      // Invalidate queries to refetch
      queryClient.invalidateQueries({
        queryKey: featureSuggestionsKeys.lists(),
      })
    },
    onError: error => {
      store.setError(error.message)
    },
    onSettled: () => {
      store.setGenerating(false)
    },
  })

  return {
    generate: mutation.mutate,
    generateAsync: mutation.mutateAsync,
    isGenerating: mutation.isPending,
    error: mutation.error?.message ?? null,
    data: mutation.data,
  }
}

/**
 * Hook to approve a suggestion (creates a task)
 */
export function useApproveSuggestion() {
  const queryClient = useQueryClient()
  const store = useFeatureSuggestionsStore()

  const mutation = useMutation({
    mutationFn: async (params: {
      suggestionId: string
      taskOverrides?: {
        description?: string
        agentType?: AgentType
        planningMode?: PlanningMode
        requirePlanApproval?: boolean
        branchName?: string
      }
    }) => {
      const response = await window.api.featureSuggestions.approve({
        suggestionId: params.suggestionId,
        taskOverrides: params.taskOverrides,
      })

      if ('error' in response) {
        throw new Error(response.error as string)
      }

      return response
    },
    onSuccess: data => {
      // Update suggestion in store
      store.updateSuggestion(data.suggestion.id, data.suggestion)

      // Invalidate queries
      queryClient.invalidateQueries({
        queryKey: featureSuggestionsKeys.lists(),
      })

      // Also invalidate agent tasks queries
      queryClient.invalidateQueries({
        queryKey: ['agentTasks'],
      })
    },
  })

  return {
    approve: mutation.mutate,
    approveAsync: mutation.mutateAsync,
    isApproving: mutation.isPending,
    error: mutation.error?.message ?? null,
  }
}

/**
 * Hook to reject a suggestion
 */
export function useRejectSuggestion() {
  const queryClient = useQueryClient()
  const store = useFeatureSuggestionsStore()

  const mutation = useMutation({
    mutationFn: async (params: { suggestionId: string; feedback?: string }) => {
      const response = await window.api.featureSuggestions.reject({
        suggestionId: params.suggestionId,
        feedback: params.feedback,
      })

      if ('error' in response) {
        throw new Error(response.error as string)
      }

      return response.suggestion
    },
    onSuccess: data => {
      store.updateSuggestion(data.id, data)

      queryClient.invalidateQueries({
        queryKey: featureSuggestionsKeys.lists(),
      })
    },
  })

  return {
    reject: mutation.mutate,
    rejectAsync: mutation.mutateAsync,
    isRejecting: mutation.isPending,
    error: mutation.error?.message ?? null,
  }
}

/**
 * Hook to bulk approve multiple suggestions
 */
export function useBulkApproveSuggestions() {
  const queryClient = useQueryClient()
  const store = useFeatureSuggestionsStore()

  const mutation = useMutation({
    mutationFn: async (params: {
      suggestionIds: string[]
      taskOverrides?: {
        agentType?: AgentType
        planningMode?: PlanningMode
        requirePlanApproval?: boolean
      }
    }) => {
      const response = await window.api.featureSuggestions.bulkApprove({
        suggestionIds: params.suggestionIds,
        taskOverrides: params.taskOverrides,
      })

      if ('error' in response) {
        throw new Error(response.error as string)
      }

      return response.results
    },
    onSuccess: results => {
      // Update successful suggestions in store
      for (const result of results) {
        if (result.success && result.task) {
          store.updateSuggestion(result.suggestionId, { status: 'converted' })
        }
      }

      queryClient.invalidateQueries({
        queryKey: featureSuggestionsKeys.lists(),
      })

      queryClient.invalidateQueries({
        queryKey: ['agentTasks'],
      })
    },
  })

  return {
    bulkApprove: mutation.mutate,
    bulkApproveAsync: mutation.mutateAsync,
    isBulkApproving: mutation.isPending,
    error: mutation.error?.message ?? null,
  }
}

/**
 * Hook to delete a suggestion
 */
export function useDeleteSuggestion() {
  const queryClient = useQueryClient()
  const store = useFeatureSuggestionsStore()

  const mutation = useMutation({
    mutationFn: async (suggestionId: string) => {
      const response = await window.api.featureSuggestions.delete({
        suggestionId,
      })

      if ('error' in response) {
        throw new Error(response.error as string)
      }

      return suggestionId
    },
    onSuccess: suggestionId => {
      store.removeSuggestion(suggestionId)

      queryClient.invalidateQueries({
        queryKey: featureSuggestionsKeys.lists(),
      })
    },
  })

  return {
    deleteSuggestion: mutation.mutate,
    deleteAsync: mutation.mutateAsync,
    isDeleting: mutation.isPending,
    error: mutation.error?.message ?? null,
  }
}

/**
 * Hook to get suggestion batches for a project
 */
export function useSuggestionBatches(projectId: string, limit?: number) {
  const store = useFeatureSuggestionsStore()

  const query = useQuery({
    queryKey: featureSuggestionsKeys.batches(projectId),
    queryFn: async () => {
      const response = await window.api.featureSuggestions.getBatches({
        projectId,
        limit,
      })

      if ('error' in response) {
        throw new Error(response.error as string)
      }

      return response.batches
    },
    enabled: !!projectId,
  })

  useEffect(() => {
    if (query.data) {
      store.setBatches(query.data)
    }
  }, [query.data, store.setBatches])

  return {
    batches: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
  }
}

// Re-export store selectors for convenience
export {
  useFilteredSuggestions,
  useSuggestionsList,
  useGenerationProgress,
  useFeatureSuggestionsLoading,
}
