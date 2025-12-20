import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  CustomTheme,
  CreateCustomThemeInput,
} from 'shared/models'

export function useCustomThemes() {
  const queryClient = useQueryClient()

  const themesQuery = useQuery({
    queryKey: ['custom-themes'],
    queryFn: async () => {
      const response = await window.api.themes.list({})
      return response.themes as CustomTheme[]
    },
  })

  const createThemeMutation = useMutation({
    mutationFn: async (data: CreateCustomThemeInput) => {
      const response = await window.api.themes.create({ data })
      return response.theme as CustomTheme
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-themes'] })
    },
  })

  const updateThemeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateCustomThemeInput> }) => {
      const response = await window.api.themes.update({ id, data })
      return response.theme as CustomTheme
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-themes'] })
    },
  })

  const deleteThemeMutation = useMutation({
    mutationFn: async (id: string) => {
      await window.api.themes.delete({ id })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-themes'] })
    },
  })

  return {
    themes: themesQuery.data || [],
    isLoading: themesQuery.isLoading,
    createTheme: createThemeMutation.mutateAsync,
    isCreating: createThemeMutation.isPending,
    updateTheme: updateThemeMutation.mutateAsync,
    isUpdating: updateThemeMutation.isPending,
    deleteTheme: deleteThemeMutation.mutateAsync,
    isDeleting: deleteThemeMutation.isPending,
  }
}
