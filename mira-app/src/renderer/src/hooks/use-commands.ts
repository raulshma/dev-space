// TanStack Query hooks for command library operations
// Requirements: 1.1, 3.2

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateCommandInput } from '../../../shared/models'

// Query keys
export const commandKeys = {
  all: ['commands'] as const,
  lists: () => [...commandKeys.all, 'list'] as const,
  list: () => [...commandKeys.lists()] as const
}

// Hook to fetch all commands
export function useCommands() {
  return useQuery({
    queryKey: commandKeys.list(),
    queryFn: async () => {
      const response = await window.api.commands.list({})
      return response.commands
    }
  })
}

// Hook to create a new command
export function useCreateCommand() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateCommandInput) => {
      const response = await window.api.commands.create({ data })
      return response.command
    },
    onSuccess: () => {
      // Invalidate command list to refetch
      queryClient.invalidateQueries({ queryKey: commandKeys.lists() })
    }
  })
}
