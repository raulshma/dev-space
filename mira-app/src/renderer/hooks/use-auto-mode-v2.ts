/**
 * Auto Mode V2 Hook
 *
 * React hook for interacting with the Auto Mode Service V2 (Claude SDK integration).
 * Provides auto mode state management, feature execution controls,
 * and plan approval workflow.
 *
 * Requirements:
 * - 4.1: Maintain a queue of pending features for execution
 * - 4.2: Continuously process pending features up to concurrency limit
 * - 4.7: Support stopping individual features or entire auto mode loop
 * - 5.5: Pause execution and emit awaiting_approval event when plan needs approval
 * - 5.6: Continue with implementation when plan is approved
 * - 5.7: Regenerate plan with feedback when rejected
 *
 * @module use-auto-mode-v2
 */

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  AutoModeV2GetStateResponse,
  AutoModeV2GetQueueResponse,
  AutoModeV2Feature,
  AutoModeV2StateChangedData,
  AutoModeV2FeatureStartedData,
  AutoModeV2FeatureCompletedData,
  AutoModeV2FeatureFailedData,
  AutoModeV2FeatureProgressData,
  AutoModeV2PlanGeneratedData,
  AutoModeV2RateLimitWaitData,
} from 'shared/ipc-types'

// ============================================================================
// Types
// ============================================================================

/**
 * Auto mode state from the V2 API
 */
export interface AutoModeV2State {
  isRunning: boolean
  runningCount: number
  maxConcurrency: number
  runningFeatureIds: string[]
  lastStartedFeatureId: string | null
  isWaitingForRateLimit: boolean
  rateLimitResetTime?: string
}

/**
 * Auto mode configuration
 */
export interface AutoModeV2Config {
  maxConcurrency?: number
  defaultPlanningMode?: 'skip' | 'lite' | 'spec' | 'full'
  defaultRequirePlanApproval?: boolean
  useWorktrees?: boolean
  rateLimitBufferSeconds?: number
}

/**
 * Feature progress event
 */
export interface FeatureProgressEvent {
  featureId: string
  status: AutoModeV2Feature['status']
  message: string
  textDelta?: string
  toolUse?: {
    name: string
    input: unknown
  }
}

/**
 * Plan spec from a feature
 */
export interface PlanSpec {
  status: 'pending' | 'generating' | 'generated' | 'approved' | 'rejected'
  content?: string
  version: number
  generatedAt?: string
  approvedAt?: string
}

// ============================================================================
// Query Keys
// ============================================================================

export const autoModeV2Keys = {
  all: ['autoModeV2'] as const,
  state: (projectPath: string) =>
    [...autoModeV2Keys.all, 'state', projectPath] as const,
  queue: (projectPath: string) =>
    [...autoModeV2Keys.all, 'queue', projectPath] as const,
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to initialize Auto Mode V2 event subscriptions
 * Call ONCE at app root level
 */
export function useAutoModeV2Init() {
  const queryClient = useQueryClient()

  useEffect(() => {
    // Subscribe to state change events
    const unsubStateChanged = window.api.autoModeV2.onStateChanged(
      (data: AutoModeV2StateChangedData) => {
        queryClient.invalidateQueries({
          queryKey: autoModeV2Keys.state(data.projectPath),
        })
      }
    )

    // Subscribe to feature started events
    const unsubFeatureStarted = window.api.autoModeV2.onFeatureStarted(
      (data: AutoModeV2FeatureStartedData) => {
        queryClient.invalidateQueries({
          queryKey: autoModeV2Keys.queue(data.projectPath),
        })
        queryClient.invalidateQueries({
          queryKey: autoModeV2Keys.state(data.projectPath),
        })
      }
    )

    // Subscribe to feature completed events
    const unsubFeatureCompleted = window.api.autoModeV2.onFeatureCompleted(
      (data: AutoModeV2FeatureCompletedData) => {
        queryClient.invalidateQueries({
          queryKey: autoModeV2Keys.queue(data.projectPath),
        })
        queryClient.invalidateQueries({
          queryKey: autoModeV2Keys.state(data.projectPath),
        })
      }
    )

    // Subscribe to feature failed events
    const unsubFeatureFailed = window.api.autoModeV2.onFeatureFailed(
      (data: AutoModeV2FeatureFailedData) => {
        queryClient.invalidateQueries({
          queryKey: autoModeV2Keys.queue(data.projectPath),
        })
        queryClient.invalidateQueries({
          queryKey: autoModeV2Keys.state(data.projectPath),
        })
      }
    )

    // Subscribe to plan generated events
    const unsubPlanGenerated = window.api.autoModeV2.onPlanGenerated(
      (data: AutoModeV2PlanGeneratedData) => {
        queryClient.invalidateQueries({
          queryKey: autoModeV2Keys.queue(data.projectPath),
        })
      }
    )

    return () => {
      unsubStateChanged()
      unsubFeatureStarted()
      unsubFeatureCompleted()
      unsubFeatureFailed()
      unsubPlanGenerated()
    }
  }, [queryClient])
}

/**
 * Hook to get auto mode state for a project
 */
export function useAutoModeV2State(projectPath: string | null) {
  return useQuery({
    queryKey: autoModeV2Keys.state(projectPath || ''),
    queryFn: async (): Promise<AutoModeV2State | null> => {
      if (!projectPath) return null
      const response: AutoModeV2GetStateResponse =
        await window.api.autoModeV2.getState({ projectPath })
      return response.state
    },
    enabled: !!projectPath,
  })
}

/**
 * Hook to get the feature queue for a project
 */
export function useAutoModeV2Queue(projectPath: string | null) {
  return useQuery({
    queryKey: autoModeV2Keys.queue(projectPath || ''),
    queryFn: async (): Promise<AutoModeV2Feature[]> => {
      if (!projectPath) return []
      const response: AutoModeV2GetQueueResponse =
        await window.api.autoModeV2.getQueue({ projectPath })
      return response.features
    },
    enabled: !!projectPath,
  })
}

/**
 * Hook to start auto mode
 */
export function useStartAutoModeV2() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      projectPath,
      config,
    }: {
      projectPath: string
      config?: AutoModeV2Config
    }) => {
      const response = await window.api.autoModeV2.start({
        projectPath,
        config,
      })
      return response.success
    },
    onSuccess: (_, { projectPath }) => {
      queryClient.invalidateQueries({
        queryKey: autoModeV2Keys.state(projectPath),
      })
    },
  })
}

/**
 * Hook to stop auto mode
 */
export function useStopAutoModeV2() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (projectPath: string) => {
      const response = await window.api.autoModeV2.stop({ projectPath })
      return response.success
    },
    onSuccess: (_, projectPath) => {
      queryClient.invalidateQueries({
        queryKey: autoModeV2Keys.state(projectPath),
      })
    },
  })
}

/**
 * Hook to update auto mode configuration
 */
export function useUpdateAutoModeV2Config() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      projectPath,
      config,
    }: {
      projectPath: string
      config: AutoModeV2Config
    }) => {
      const response = await window.api.autoModeV2.updateConfig({
        projectPath,
        config,
      })
      return response.success
    },
    onSuccess: (_, { projectPath }) => {
      queryClient.invalidateQueries({
        queryKey: autoModeV2Keys.state(projectPath),
      })
    },
  })
}

/**
 * Hook to enqueue a feature
 */
export function useEnqueueFeatureV2() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      projectPath,
      featureId,
    }: {
      projectPath: string
      featureId: string
    }) => {
      const response = await window.api.autoModeV2.enqueueFeature({
        projectPath,
        featureId,
      })
      return response.feature
    },
    onSuccess: (_, { projectPath }) => {
      queryClient.invalidateQueries({
        queryKey: autoModeV2Keys.queue(projectPath),
      })
    },
  })
}

/**
 * Hook to dequeue a feature
 */
export function useDequeueFeatureV2() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      projectPath,
      featureId,
    }: {
      projectPath: string
      featureId: string
    }) => {
      const response = await window.api.autoModeV2.dequeueFeature({
        projectPath,
        featureId,
      })
      return response.feature
    },
    onSuccess: (_, { projectPath }) => {
      queryClient.invalidateQueries({
        queryKey: autoModeV2Keys.queue(projectPath),
      })
    },
  })
}

/**
 * Hook to execute a single feature
 */
export function useExecuteFeatureV2() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      projectPath,
      featureId,
      useWorktrees,
    }: {
      projectPath: string
      featureId: string
      useWorktrees?: boolean
    }) => {
      const response = await window.api.autoModeV2.executeFeature({
        projectPath,
        featureId,
        useWorktrees,
      })
      return response.feature
    },
    onSuccess: (_, { projectPath }) => {
      queryClient.invalidateQueries({
        queryKey: autoModeV2Keys.queue(projectPath),
      })
      queryClient.invalidateQueries({
        queryKey: autoModeV2Keys.state(projectPath),
      })
    },
  })
}

/**
 * Hook to stop a feature execution
 */
export function useStopFeatureV2() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      projectPath,
      featureId,
    }: {
      projectPath: string
      featureId: string
    }) => {
      const response = await window.api.autoModeV2.stopFeature({
        projectPath,
        featureId,
      })
      return response.success
    },
    onSuccess: (_, { projectPath }) => {
      queryClient.invalidateQueries({
        queryKey: autoModeV2Keys.queue(projectPath),
      })
      queryClient.invalidateQueries({
        queryKey: autoModeV2Keys.state(projectPath),
      })
    },
  })
}

/**
 * Hook to approve a plan
 */
export function useApprovePlanV2() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      projectPath,
      featureId,
    }: {
      projectPath: string
      featureId: string
    }) => {
      const response = await window.api.autoModeV2.approvePlan({
        projectPath,
        featureId,
      })
      return response.feature
    },
    onSuccess: (_, { projectPath }) => {
      queryClient.invalidateQueries({
        queryKey: autoModeV2Keys.queue(projectPath),
      })
    },
  })
}

/**
 * Hook to reject a plan
 */
export function useRejectPlanV2() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      projectPath,
      featureId,
      feedback,
    }: {
      projectPath: string
      featureId: string
      feedback: string
    }) => {
      const response = await window.api.autoModeV2.rejectPlan({
        projectPath,
        featureId,
        feedback,
      })
      return response.feature
    },
    onSuccess: (_, { projectPath }) => {
      queryClient.invalidateQueries({
        queryKey: autoModeV2Keys.queue(projectPath),
      })
    },
  })
}

/**
 * Main hook for Auto Mode V2 interactions
 *
 * Provides auto mode state management, feature execution controls,
 * and plan approval workflow for a specific project.
 */
export function useAutoModeV2(projectPath: string | null) {
  const queryClient = useQueryClient()

  // Progress state for real-time updates
  const [featureProgress, setFeatureProgress] = useState<
    Map<string, FeatureProgressEvent>
  >(new Map())

  // Rate limit state
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    resetTime: string
    waitSeconds: number
  } | null>(null)

  // Get state and queue
  const stateQuery = useAutoModeV2State(projectPath)
  const queueQuery = useAutoModeV2Queue(projectPath)

  // Mutations
  const startMutation = useStartAutoModeV2()
  const stopMutation = useStopAutoModeV2()
  const updateConfigMutation = useUpdateAutoModeV2Config()
  const enqueueMutation = useEnqueueFeatureV2()
  const dequeueMutation = useDequeueFeatureV2()
  const executeMutation = useExecuteFeatureV2()
  const stopFeatureMutation = useStopFeatureV2()
  const approvePlanMutation = useApprovePlanV2()
  const rejectPlanMutation = useRejectPlanV2()

  // Subscribe to progress events
  useEffect(() => {
    if (!projectPath) return

    const unsubProgress = window.api.autoModeV2.onFeatureProgress(
      (data: AutoModeV2FeatureProgressData) => {
        if (data.projectPath !== projectPath) return
        setFeatureProgress(prev => {
          const next = new Map(prev)
          next.set(data.featureId, {
            featureId: data.featureId,
            status: data.status,
            message: data.message,
            textDelta: data.textDelta,
            toolUse: data.toolUse,
          })
          return next
        })
      }
    )

    const unsubRateLimit = window.api.autoModeV2.onRateLimitWait(
      (data: AutoModeV2RateLimitWaitData) => {
        if (data.projectPath !== projectPath) return
        setRateLimitInfo({
          resetTime: data.resetTime,
          waitSeconds: data.waitSeconds,
        })
      }
    )

    return () => {
      unsubProgress()
      unsubRateLimit()
    }
  }, [projectPath])

  // Clear rate limit info when state changes
  useEffect(() => {
    if (stateQuery.data && !stateQuery.data.isWaitingForRateLimit) {
      setRateLimitInfo(null)
    }
  }, [stateQuery.data])

  // Actions
  const start = useCallback(
    async (config?: AutoModeV2Config) => {
      if (!projectPath) return false
      return startMutation.mutateAsync({ projectPath, config })
    },
    [projectPath, startMutation]
  )

  const stop = useCallback(async () => {
    if (!projectPath) return false
    return stopMutation.mutateAsync(projectPath)
  }, [projectPath, stopMutation])

  const updateConfig = useCallback(
    async (config: AutoModeV2Config) => {
      if (!projectPath) return false
      return updateConfigMutation.mutateAsync({ projectPath, config })
    },
    [projectPath, updateConfigMutation]
  )

  const enqueueFeature = useCallback(
    async (featureId: string) => {
      if (!projectPath) return null
      return enqueueMutation.mutateAsync({ projectPath, featureId })
    },
    [projectPath, enqueueMutation]
  )

  const dequeueFeature = useCallback(
    async (featureId: string) => {
      if (!projectPath) return null
      return dequeueMutation.mutateAsync({ projectPath, featureId })
    },
    [projectPath, dequeueMutation]
  )

  const executeFeature = useCallback(
    async (featureId: string, useWorktrees?: boolean) => {
      if (!projectPath) return null
      return executeMutation.mutateAsync({
        projectPath,
        featureId,
        useWorktrees,
      })
    },
    [projectPath, executeMutation]
  )

  const stopFeature = useCallback(
    async (featureId: string) => {
      if (!projectPath) return false
      return stopFeatureMutation.mutateAsync({ projectPath, featureId })
    },
    [projectPath, stopFeatureMutation]
  )

  const approvePlan = useCallback(
    async (featureId: string) => {
      if (!projectPath) return null
      return approvePlanMutation.mutateAsync({ projectPath, featureId })
    },
    [projectPath, approvePlanMutation]
  )

  const rejectPlan = useCallback(
    async (featureId: string, feedback: string) => {
      if (!projectPath) return null
      return rejectPlanMutation.mutateAsync({
        projectPath,
        featureId,
        feedback,
      })
    },
    [projectPath, rejectPlanMutation]
  )

  const clearFeatureProgress = useCallback((featureId: string) => {
    setFeatureProgress(prev => {
      const next = new Map(prev)
      next.delete(featureId)
      return next
    })
  }, [])

  return {
    // State
    state: stateQuery.data,
    stateLoading: stateQuery.isLoading,
    stateError: stateQuery.error,

    // Queue
    queue: queueQuery.data || [],
    queueLoading: queueQuery.isLoading,
    queueError: queueQuery.error,

    // Derived state
    isRunning: stateQuery.data?.isRunning ?? false,
    runningCount: stateQuery.data?.runningCount ?? 0,
    maxConcurrency: stateQuery.data?.maxConcurrency ?? 1,
    runningFeatureIds: stateQuery.data?.runningFeatureIds ?? [],
    isWaitingForRateLimit: stateQuery.data?.isWaitingForRateLimit ?? false,

    // Progress
    featureProgress,
    rateLimitInfo,

    // Loading states
    isStarting: startMutation.isPending,
    isStopping: stopMutation.isPending,
    isUpdatingConfig: updateConfigMutation.isPending,
    isEnqueuing: enqueueMutation.isPending,
    isDequeuing: dequeueMutation.isPending,
    isExecuting: executeMutation.isPending,
    isStoppingFeature: stopFeatureMutation.isPending,
    isApprovingPlan: approvePlanMutation.isPending,
    isRejectingPlan: rejectPlanMutation.isPending,

    // Actions
    start,
    stop,
    updateConfig,
    enqueueFeature,
    dequeueFeature,
    executeFeature,
    stopFeature,
    approvePlan,
    rejectPlan,
    clearFeatureProgress,

    // Refresh functions
    refreshState: () =>
      queryClient.invalidateQueries({
        queryKey: autoModeV2Keys.state(projectPath || ''),
      }),
    refreshQueue: () =>
      queryClient.invalidateQueries({
        queryKey: autoModeV2Keys.queue(projectPath || ''),
      }),
  }
}

/**
 * Hook to get all Auto Mode V2 actions
 */
export function useAutoModeV2Actions() {
  const startAutoMode = useStartAutoModeV2()
  const stopAutoMode = useStopAutoModeV2()
  const updateConfig = useUpdateAutoModeV2Config()
  const enqueueFeature = useEnqueueFeatureV2()
  const dequeueFeature = useDequeueFeatureV2()
  const executeFeature = useExecuteFeatureV2()
  const stopFeature = useStopFeatureV2()
  const approvePlan = useApprovePlanV2()
  const rejectPlan = useRejectPlanV2()

  return {
    startAutoMode: startAutoMode.mutateAsync,
    stopAutoMode: stopAutoMode.mutateAsync,
    updateConfig: updateConfig.mutateAsync,
    enqueueFeature: enqueueFeature.mutateAsync,
    dequeueFeature: dequeueFeature.mutateAsync,
    executeFeature: executeFeature.mutateAsync,
    stopFeature: stopFeature.mutateAsync,
    approvePlan: approvePlan.mutateAsync,
    rejectPlan: rejectPlan.mutateAsync,
    isStarting: startAutoMode.isPending,
    isStopping: stopAutoMode.isPending,
    isUpdatingConfig: updateConfig.isPending,
    isEnqueuing: enqueueFeature.isPending,
    isDequeuing: dequeueFeature.isPending,
    isExecuting: executeFeature.isPending,
    isStoppingFeature: stopFeature.isPending,
    isApprovingPlan: approvePlan.isPending,
    isRejectingPlan: rejectPlan.isPending,
  }
}

/**
 * Hook to get features awaiting plan approval
 */
export function useFeaturesAwaitingApproval(projectPath: string | null) {
  const { queue } = useAutoModeV2(projectPath)

  return queue.filter(feature => feature.status === 'waiting_approval')
}

/**
 * Hook to get running features
 */
export function useRunningFeaturesV2(projectPath: string | null) {
  const { queue, runningFeatureIds } = useAutoModeV2(projectPath)

  return queue.filter(feature => runningFeatureIds.includes(feature.id))
}

/**
 * Hook to get pending features (in queue but not running)
 */
export function usePendingFeaturesV2(projectPath: string | null) {
  const { queue, runningFeatureIds } = useAutoModeV2(projectPath)

  return queue.filter(
    feature =>
      feature.status === 'pending' && !runningFeatureIds.includes(feature.id)
  )
}
