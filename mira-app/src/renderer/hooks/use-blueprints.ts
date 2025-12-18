// TanStack Query hooks for blueprint operations
// Requirements: 1.1, 3.2

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateBlueprintInput } from 'shared/models'

// Query keys
export const blueprintKeys = {
  all: ['blueprints'] as const,
  lists: () => [...blueprintKeys.all, 'list'] as const,
  list: () => [...blueprintKeys.lists()] as const,
}

// Hook to fetch all blueprints
export function useBlueprints() {
  return useQuery({
    queryKey: blueprintKeys.list(),
    queryFn: async () => {
      const response = await window.api.blueprints.list({})
      return response.blueprints
    },
  })
}

// Hook to create a new blueprint
export function useCreateBlueprint() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateBlueprintInput) => {
      const response = await window.api.blueprints.create({ data })
      return response.blueprint
    },
    onSuccess: () => {
      // Invalidate blueprint list to refetch
      queryClient.invalidateQueries({ queryKey: blueprintKeys.lists() })
    },
  })
}
