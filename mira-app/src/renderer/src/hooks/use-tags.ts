// TanStack Query hooks for tag operations
// Requirements: 3.2

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateTagInput } from '../../../shared/models'
import { projectKeys } from './use-projects'

// Query keys
export const tagKeys = {
  all: ['tags'] as const,
  lists: () => [...tagKeys.all, 'list'] as const,
  list: () => [...tagKeys.lists()] as const
}

// Hook to fetch all tags
export function useTags() {
  return useQuery({
    queryKey: tagKeys.list(),
    queryFn: async () => {
      const response = await window.api.tags.list({})
      return response.tags
    }
  })
}

// Hook to create a new tag
export function useCreateTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateTagInput) => {
      const response = await window.api.tags.create({ data })
      return response.tag
    },
    onSuccess: () => {
      // Invalidate tag list to refetch
      queryClient.invalidateQueries({ queryKey: tagKeys.lists() })
    }
  })
}

// Hook to add a tag to a project
export function useAddTagToProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ projectId, tagId }: { projectId: string; tagId: string }) => {
      const response = await window.api.tags.addToProject({ projectId, tagId })
      return response.success
    },
    onSuccess: (_, { projectId }) => {
      // Invalidate the specific project and all project lists
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
    }
  })
}

// Hook to remove a tag from a project
export function useRemoveTagFromProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ projectId, tagId }: { projectId: string; tagId: string }) => {
      const response = await window.api.tags.removeFromProject({ projectId, tagId })
      return response.success
    },
    onSuccess: (_, { projectId }) => {
      // Invalidate the specific project and all project lists
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
    }
  })
}
