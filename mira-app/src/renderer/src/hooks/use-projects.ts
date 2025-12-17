// TanStack Query hooks for project operations
// Requirements: 1.1, 3.2, 18.4

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { handleDatabaseError } from '../lib/error-handler'
import type {
  ProjectFilter,
  CreateProjectInput,
  UpdateProjectInput
} from '../../../shared/models'

// Query keys
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filter?: ProjectFilter) => [...projectKeys.lists(), filter] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const
}

// Hook to fetch all projects with optional filtering
export function useProjects(filter?: ProjectFilter) {
  return useQuery({
    queryKey: projectKeys.list(filter),
    queryFn: async () => {
      const response = await window.api.projects.list({ filter })
      return response.projects
    }
  })
}

// Hook to fetch a single project by ID
export function useProject(id: string | null) {
  return useQuery({
    queryKey: projectKeys.detail(id || ''),
    queryFn: async () => {
      if (!id) return null
      const response = await window.api.projects.get({ id })
      return response.project
    },
    enabled: !!id
  })
}

// Hook to create a new project
export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateProjectInput) => {
      const response = await window.api.projects.create({ data })
      return response.project
    },
    onSuccess: () => {
      // Invalidate all project lists to refetch
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
    },
    onError: (error) => {
      handleDatabaseError(error, 'create project')
    }
  })
}

// Hook to update an existing project
export function useUpdateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateProjectInput }) => {
      const response = await window.api.projects.update({ id, data })
      return response.project
    },
    onSuccess: (project) => {
      // Invalidate the specific project and all lists
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(project.id) })
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
    },
    onError: (error) => {
      handleDatabaseError(error, 'update project')
    }
  })
}

// Hook to delete a project
export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await window.api.projects.delete({ id })
      return response.success
    },
    onSuccess: (_, id) => {
      // Remove the project from cache and invalidate lists
      queryClient.removeQueries({ queryKey: projectKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
    },
    onError: (error) => {
      handleDatabaseError(error, 'delete project')
    }
  })
}
