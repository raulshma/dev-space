/**
 * React hooks for agent task operations
 *
 * Provides TanStack Query hooks for agent task management including
 * task CRUD, execution control, and output streaming.
 * Requirements: 7.1, 8.1, 9.2, 10.1
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import { useAgentTaskStore } from 'renderer/stores/agent-task-store'
import type {
  AgentType,
  TaskStatus,
  AgentParameters,
  UpdateAgentTaskInput,
  OutputLine,
} from 'shared/ai-types'

// ============================================================================
// Query Keys
// ============================================================================

export const agentTaskKeys = {
  all: ['agentTasks'] as const,
  lists: () => [...agentTaskKeys.all, 'list'] as const,
  list: (filter?: { status?: TaskStatus; agentType?: AgentType }) =>
    [...agentTaskKeys.lists(), filter] as const,
  details: () => [...agentTaskKeys.all, 'detail'] as const,
  detail: (taskId: string) => [...agentTaskKeys.details(), taskId] as const,
  output: (taskId: string) => [...agentTaskKeys.all, 'output', taskId] as const,
}

// ============================================================================
// Task List Hooks
// ============================================================================

/**
 * Hook to fetch all agent tasks
 */
export function useAgentTasks(filter?: {
  status?: TaskStatus
  agentType?: AgentType
  limit?: number
}) {
  const { setTasks, setTasksLoading, setTasksError } = useAgentTaskStore()

  return useQuery({
    queryKey: agentTaskKeys.list(filter),
    queryFn: async () => {
      setTasksLoading(true)
      try {
        const response = await window.api.agentTasks.list({ filter })
        // Convert timestamps
        const tasks = response.tasks.map(task => ({
          ...task,
          createdAt:
            task.createdAt instanceof Date
              ? task.createdAt
              : new Date(task.createdAt as unknown as string),
          startedAt: task.startedAt
            ? task.startedAt instanceof Date
              ? task.startedAt
              : new Date(task.startedAt as unknown as string)
            : undefined,
          completedAt: task.completedAt
            ? task.completedAt instanceof Date
              ? task.completedAt
              : new Date(task.completedAt as unknown as string)
            : undefined,
        }))
        setTasks(tasks)
        return tasks
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to fetch tasks'
        setTasksError(message)
        throw error
      } finally {
        setTasksLoading(false)
      }
    },
    // Poll for task updates every 2 seconds to catch status changes
    refetchInterval: 2000,
  })
}

/**
 * Hook to fetch a single agent task
 */
export function useAgentTask(taskId: string | null) {
  const { updateTask } = useAgentTaskStore()

  return useQuery({
    queryKey: agentTaskKeys.detail(taskId || ''),
    queryFn: async () => {
      if (!taskId) return null
      const response = await window.api.agentTasks.get({ taskId })
      if (!response.task) return null

      const task = {
        ...response.task,
        createdAt:
          response.task.createdAt instanceof Date
            ? response.task.createdAt
            : new Date(response.task.createdAt as unknown as string),
        startedAt: response.task.startedAt
          ? response.task.startedAt instanceof Date
            ? response.task.startedAt
            : new Date(response.task.startedAt as unknown as string)
          : undefined,
        completedAt: response.task.completedAt
          ? response.task.completedAt instanceof Date
            ? response.task.completedAt
            : new Date(response.task.completedAt as unknown as string)
          : undefined,
      }

      updateTask(taskId, task)
      return task
    },
    enabled: !!taskId,
    // Poll for task updates every 2 seconds
    refetchInterval: 2000,
  })
}

// ============================================================================
// Task CRUD Hooks
// ============================================================================

/**
 * Hook to create a new agent task
 */
export function useCreateAgentTask() {
  const queryClient = useQueryClient()
  const { addTask } = useAgentTaskStore()

  return useMutation({
    mutationFn: async ({
      description,
      agentType,
      targetDirectory,
      parameters,
      priority,
      serviceType,
      julesParams,
      planningMode,
      requirePlanApproval,
      branchName,
    }: {
      description: string
      agentType: AgentType
      targetDirectory: string
      parameters?: AgentParameters
      priority?: number
      serviceType?: import('shared/ai-types').TaskServiceType
      julesParams?: import('shared/ai-types').JulesParameters
      planningMode?: import('shared/ai-types').PlanningMode
      requirePlanApproval?: boolean
      branchName?: string
    }) => {
      const response = await window.api.agentTasks.create({
        description,
        agentType,
        targetDirectory,
        parameters,
        priority,
        serviceType,
        julesParams,
        planningMode,
        requirePlanApproval,
        branchName,
      })

      const task = {
        ...response.task,
        createdAt:
          response.task.createdAt instanceof Date
            ? response.task.createdAt
            : new Date(response.task.createdAt as unknown as string),
        startedAt: response.task.startedAt
          ? response.task.startedAt instanceof Date
            ? response.task.startedAt
            : new Date(response.task.startedAt as unknown as string)
          : undefined,
        completedAt: response.task.completedAt
          ? response.task.completedAt instanceof Date
            ? response.task.completedAt
            : new Date(response.task.completedAt as unknown as string)
          : undefined,
      }

      return task
    },
    onSuccess: task => {
      addTask(task)
      queryClient.invalidateQueries({ queryKey: agentTaskKeys.lists() })
    },
  })
}

/**
 * Hook to update an agent task
 */
export function useUpdateAgentTask() {
  const queryClient = useQueryClient()
  const { updateTask } = useAgentTaskStore()

  return useMutation({
    mutationFn: async ({
      taskId,
      updates,
    }: {
      taskId: string
      updates: UpdateAgentTaskInput
    }) => {
      const response = await window.api.agentTasks.update({ taskId, updates })

      const task = {
        ...response.task,
        createdAt:
          response.task.createdAt instanceof Date
            ? response.task.createdAt
            : new Date(response.task.createdAt as unknown as string),
        startedAt: response.task.startedAt
          ? response.task.startedAt instanceof Date
            ? response.task.startedAt
            : new Date(response.task.startedAt as unknown as string)
          : undefined,
        completedAt: response.task.completedAt
          ? response.task.completedAt instanceof Date
            ? response.task.completedAt
            : new Date(response.task.completedAt as unknown as string)
          : undefined,
      }

      return task
    },
    onSuccess: task => {
      updateTask(task.id, task)
      queryClient.invalidateQueries({
        queryKey: agentTaskKeys.detail(task.id),
      })
      queryClient.invalidateQueries({ queryKey: agentTaskKeys.lists() })
    },
  })
}

/**
 * Hook to delete an agent task
 */
export function useDeleteAgentTask() {
  const queryClient = useQueryClient()
  const { removeTask } = useAgentTaskStore()

  return useMutation({
    mutationFn: async (taskId: string) => {
      const response = await window.api.agentTasks.delete({ taskId })
      return response.success
    },
    onSuccess: (_, taskId) => {
      removeTask(taskId)
      queryClient.removeQueries({ queryKey: agentTaskKeys.detail(taskId) })
      queryClient.invalidateQueries({ queryKey: agentTaskKeys.lists() })
    },
  })
}

// ============================================================================
// Task Execution Control Hooks
// ============================================================================

/**
 * Hook to start an agent task
 */
export function useStartAgentTask() {
  const queryClient = useQueryClient()
  const { updateTask, setCurrentTask } = useAgentTaskStore()

  return useMutation({
    mutationFn: async (taskId: string) => {
      const response = await window.api.agentTasks.start({ taskId })
      return response.success
    },
    onSuccess: (_, taskId) => {
      updateTask(taskId, { status: 'running' })
      setCurrentTask(taskId)
      queryClient.invalidateQueries({
        queryKey: agentTaskKeys.detail(taskId),
      })
      queryClient.invalidateQueries({ queryKey: agentTaskKeys.lists() })
    },
  })
}

/**
 * Hook to pause an agent task
 */
export function usePauseAgentTask() {
  const queryClient = useQueryClient()
  const { updateTask } = useAgentTaskStore()

  return useMutation({
    mutationFn: async (taskId: string) => {
      const response = await window.api.agentTasks.pause({ taskId })
      return response.success
    },
    onSuccess: (_, taskId) => {
      updateTask(taskId, { status: 'paused' })
      queryClient.invalidateQueries({
        queryKey: agentTaskKeys.detail(taskId),
      })
      queryClient.invalidateQueries({ queryKey: agentTaskKeys.lists() })
    },
  })
}

/**
 * Hook to resume an agent task
 */
export function useResumeAgentTask() {
  const queryClient = useQueryClient()
  const { updateTask } = useAgentTaskStore()

  return useMutation({
    mutationFn: async (taskId: string) => {
      const response = await window.api.agentTasks.resume({ taskId })
      return response.success
    },
    onSuccess: (_, taskId) => {
      updateTask(taskId, { status: 'running' })
      queryClient.invalidateQueries({
        queryKey: agentTaskKeys.detail(taskId),
      })
      queryClient.invalidateQueries({ queryKey: agentTaskKeys.lists() })
    },
  })
}

/**
 * Hook to restart a stopped/failed agent task
 *
 * Restarts the task, optionally resuming from the previous Claude SDK session.
 * This allows continuing work from where the agent left off.
 */
export function useRestartAgentTask() {
  const queryClient = useQueryClient()
  const { updateTask } = useAgentTaskStore()

  return useMutation({
    mutationFn: async ({
      taskId,
      resumeSession = true,
      forkSession = false,
    }: {
      taskId: string
      resumeSession?: boolean
      forkSession?: boolean
    }) => {
      const response = await window.api.agentTasks.restart({
        taskId,
        resumeSession,
        forkSession,
      })
      return response
    },
    onSuccess: (response, { taskId }) => {
      updateTask(taskId, { status: 'queued' })
      queryClient.invalidateQueries({
        queryKey: agentTaskKeys.detail(taskId),
      })
      queryClient.invalidateQueries({ queryKey: agentTaskKeys.lists() })
    },
  })
}

/**
 * Hook to stop an agent task
 */
export function useStopAgentTask() {
  const queryClient = useQueryClient()
  const { updateTask, setCurrentTask } = useAgentTaskStore()

  return useMutation({
    mutationFn: async (taskId: string) => {
      const response = await window.api.agentTasks.stop({ taskId })
      return response.success
    },
    onSuccess: (_, taskId) => {
      updateTask(taskId, { status: 'stopped' })
      setCurrentTask(null)
      queryClient.invalidateQueries({
        queryKey: agentTaskKeys.detail(taskId),
      })
      queryClient.invalidateQueries({ queryKey: agentTaskKeys.lists() })
    },
  })
}

// ============================================================================
// Task Output Hooks
// ============================================================================

/**
 * Hook to fetch task output
 *
 * For running/paused tasks, gets output from memory buffer.
 * For completed/stopped/failed/awaiting_approval tasks, loads persisted output from database.
 */
export function useAgentTaskOutput(taskId: string | null) {
  const { setOutput } = useAgentTaskStore()
  const task = useAgentTaskStore(state =>
    taskId ? state.tasks.get(taskId) : undefined
  )

  // Determine if we should load from database (persisted) or memory
  // awaiting_approval tasks have persisted output since they may survive app reload
  const isPersistedTask =
    task?.status === 'completed' ||
    task?.status === 'failed' ||
    task?.status === 'stopped' ||
    task?.status === 'awaiting_approval'

  return useQuery({
    // Include task status in query key to refetch when status changes
    queryKey: [...agentTaskKeys.output(taskId || ''), task?.status],
    queryFn: async () => {
      if (!taskId) return []

      // Use loadOutput for persisted tasks, getOutput for active tasks
      const response = isPersistedTask
        ? await window.api.agentTasks.loadOutput({ taskId })
        : await window.api.agentTasks.getOutput({ taskId })

      // Convert timestamps
      const output = response.output.map(line => ({
        ...line,
        timestamp:
          line.timestamp instanceof Date
            ? line.timestamp
            : new Date(line.timestamp as unknown as string),
      }))

      setOutput(taskId, output)
      return output
    },
    enabled: !!taskId,
    // Refetch more frequently for active tasks (running/paused)
    refetchInterval:
      task?.status === 'running' || task?.status === 'paused' ? 2000 : false,
  })
}

/**
 * Hook to subscribe to task output stream
 */
export function useTaskOutputSubscription(taskId: string | null) {
  const { appendOutput, addSubscription, removeSubscription } =
    useAgentTaskStore()
  const cleanupRef = useRef<(() => void) | null>(null)

  const subscribe = useCallback(async () => {
    if (!taskId) return

    // Set up output listener
    const cleanup = window.api.agentTasks.onOutputLine(data => {
      if (data.taskId !== taskId) return

      const line: OutputLine = {
        ...data.line,
        timestamp:
          data.line.timestamp instanceof Date
            ? data.line.timestamp
            : new Date(data.line.timestamp as unknown as string),
      }

      appendOutput(taskId, line)
    })

    cleanupRef.current = cleanup
    addSubscription(taskId)

    // Subscribe to output stream
    await window.api.agentTasks.subscribeOutput({ taskId })
  }, [taskId, appendOutput, addSubscription])

  const unsubscribe = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
    if (taskId) {
      removeSubscription(taskId)
    }
  }, [taskId, removeSubscription])

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
      }
    }
  }, [])

  return { subscribe, unsubscribe }
}

/**
 * Hook to reorder tasks in the backlog
 */
export function useReorderTasks() {
  const queryClient = useQueryClient()
  const { reorderTasks } = useAgentTaskStore()

  return useMutation({
    mutationFn: async (taskIds: string[]) => {
      // Update priorities on the server
      const updates = taskIds.map((id, index) => ({
        taskId: id,
        priority: taskIds.length - index,
      }))

      // Update each task's priority
      for (const update of updates) {
        await window.api.agentTasks.update({
          taskId: update.taskId,
          updates: { priority: update.priority },
        })
      }

      return true
    },
    onMutate: taskIds => {
      // Optimistically update the order
      reorderTasks(taskIds)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentTaskKeys.lists() })
    },
    onError: () => {
      // Refetch to restore correct order on error
      queryClient.invalidateQueries({ queryKey: agentTaskKeys.lists() })
    },
  })
}

// ============================================================================
// Plan Approval Hooks
// ============================================================================

/**
 * Hook to approve a task's plan
 *
 * When a task is in 'awaiting_approval' status, this approves the plan
 * and resumes execution.
 */
export function useApprovePlanForTask() {
  const queryClient = useQueryClient()
  const { updateTask } = useAgentTaskStore()

  return useMutation({
    mutationFn: async (taskId: string) => {
      const response = await window.api.planning.approvePlan({ taskId })
      if ('error' in response) {
        throw new Error(String(response.error))
      }

      const task = {
        ...response.task,
        createdAt:
          response.task.createdAt instanceof Date
            ? response.task.createdAt
            : new Date(response.task.createdAt as unknown as string),
        startedAt: response.task.startedAt
          ? response.task.startedAt instanceof Date
            ? response.task.startedAt
            : new Date(response.task.startedAt as unknown as string)
          : undefined,
        completedAt: response.task.completedAt
          ? response.task.completedAt instanceof Date
            ? response.task.completedAt
            : new Date(response.task.completedAt as unknown as string)
          : undefined,
      }

      return task
    },
    onSuccess: task => {
      updateTask(task.id, task)
      queryClient.invalidateQueries({
        queryKey: agentTaskKeys.detail(task.id),
      })
      queryClient.invalidateQueries({ queryKey: agentTaskKeys.lists() })
    },
  })
}

/**
 * Hook to reject a task's plan with feedback
 *
 * When a task is in 'awaiting_approval' status, this rejects the plan
 * and sends feedback to the agent for regeneration.
 */
export function useRejectPlanForTask() {
  const queryClient = useQueryClient()
  const { updateTask } = useAgentTaskStore()

  return useMutation({
    mutationFn: async ({
      taskId,
      feedback,
    }: {
      taskId: string
      feedback: string
    }) => {
      const response = await window.api.planning.rejectPlan({
        taskId,
        feedback,
      })
      if ('error' in response) {
        throw new Error(String(response.error))
      }

      const task = {
        ...response.task,
        createdAt:
          response.task.createdAt instanceof Date
            ? response.task.createdAt
            : new Date(response.task.createdAt as unknown as string),
        startedAt: response.task.startedAt
          ? response.task.startedAt instanceof Date
            ? response.task.startedAt
            : new Date(response.task.startedAt as unknown as string)
          : undefined,
        completedAt: response.task.completedAt
          ? response.task.completedAt instanceof Date
            ? response.task.completedAt
            : new Date(response.task.completedAt as unknown as string)
          : undefined,
      }

      return task
    },
    onSuccess: task => {
      updateTask(task.id, task)
      queryClient.invalidateQueries({
        queryKey: agentTaskKeys.detail(task.id),
      })
      queryClient.invalidateQueries({ queryKey: agentTaskKeys.lists() })
    },
  })
}

// ============================================================================
// Real-time Status Subscription Hook
// ============================================================================

/**
 * Hook to subscribe to real-time task status updates
 *
 * Listens for task status changes from the main process and updates
 * the Zustand store immediately, enabling instant header updates
 * without waiting for polling.
 */
export function useTaskStatusSubscription() {
  const { updateTask } = useAgentTaskStore()
  const queryClient = useQueryClient()

  useEffect(() => {
    const cleanup = window.api.agentTasks.onStatusUpdate(data => {
      const task = {
        ...data.task,
        createdAt:
          data.task.createdAt instanceof Date
            ? data.task.createdAt
            : new Date(data.task.createdAt as unknown as string),
        startedAt: data.task.startedAt
          ? data.task.startedAt instanceof Date
            ? data.task.startedAt
            : new Date(data.task.startedAt as unknown as string)
          : undefined,
        completedAt: data.task.completedAt
          ? data.task.completedAt instanceof Date
            ? data.task.completedAt
            : new Date(data.task.completedAt as unknown as string)
          : undefined,
      }

      // Update Zustand store immediately for instant UI updates
      updateTask(task.id, task)

      // Invalidate queries to keep TanStack Query cache in sync
      queryClient.invalidateQueries({
        queryKey: agentTaskKeys.detail(task.id),
      })
      queryClient.invalidateQueries({ queryKey: agentTaskKeys.lists() })
    })

    return cleanup
  }, [updateTask, queryClient])
}
