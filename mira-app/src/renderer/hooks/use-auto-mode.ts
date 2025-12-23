/**
 * Auto Mode Hook
 *
 * React hook for interacting with the new Auto Mode Service (AI Agent Rework).
 * Provides auto mode state management, feature execution controls,
 * and plan approval workflow.
 *
 * Requirements:
 * - 12.3: Provide auto mode state and control methods
 * - 12.4: Support plan approval workflow
 *
 * @module use-auto-mode
 */

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  AutoModeGetStateResponse,
  AutoModeGetQueueResponse,
  AutoModeFeature,
  AutoModeStateChangedData,
  AutoModeFeatureStartedData,
  AutoModeFeatureCompletedData,
  AutoModeFeatureFailedData,
  AutoModeFeatureProgressData,
  AutoModePlanGeneratedData,
  AutoModeRateLimitWaitData,
} from 'shared/ipc-types'

// ============================================================================
// Types
// ============================================================================

/**
 * Auto mode state from the API
 */
export interface AutoModeState {
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
export interface AutoModeConfig {
  maxConcurrency?: number
  defaultPlanningMode?: 'skip' | 'lite' | 'spec' | 'full'
  defaultRequirePlanApproval?: boolean
  rateLimitBufferSeconds?: number
}

/**
 * Feature progress event
 */
export interface FeatureProgressEvent {
  featureId: string
  status: AutoModeFeature['status']
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

export const autoModeKeys = {
  all: ['autoMode'] as const,
  state: (projectPath: string) =>
    [...autoModeKeys.all, 'state', projectPath] as const,
  queue: (projectPath: string) =>
    [...autoModeKeys.all, 'queue', projectPath] as const,
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to initialize Auto Mode event subscriptions
 * Call ONCE at app root level
 */
export function useAutoModeInit() {
  const queryClient = useQueryClient()

  useEffect(() => {
    // Subscribe to state change events
    const unsubStateChanged = window.api.autoMode.onStateChanged(
      (data: AutoModeStateChangedData) => {
        queryClient.invalidateQueries({
          queryKey: autoModeKeys.state(data.projectPath),
        })
      }
    )

    // Subscribe to feature started events
    const unsubFeatureStarted = window.api.autoMode.onFeatureStarted(
      (data: AutoModeFeatureStartedData) => {
        queryClient.invalidateQueries({
          queryKey: autoModeKeys.queue(data.projectPath),
        })
        queryClient.invalidateQueries({
          queryKey: autoModeKeys.state(data.projectPath),
        })
      }
    )

    // Subscribe to feature completed events
    const unsubFeatureCompleted = window.api.autoMode.onFeatureCompleted(
      (data: AutoModeFeatureCompletedData) => {
        queryClient.invalidateQueries({
          queryKey: autoModeKeys.queue(data.projectPath),
        })
        queryClient.invalidateQueries({
          queryKey: autoModeKeys.state(data.projectPath),
        })
      }
    )

    // Subscribe to feature failed events
    const unsubFeatureFailed = window.api.autoMode.onFeatureFailed(
      (data: AutoModeFeatureFailedData) => {
        queryClient.invalidateQueries({
          queryKey: autoModeKeys.queue(data.projectPath),
        })
        queryClient.invalidateQueries({
          queryKey: autoModeKeys.state(data.projectPath),
        })
      }
    )

    // Subscribe to plan generated events
    const unsubPlanGenerated = window.api.autoMode.onPlanGenerated(
      (data: AutoModePlanGeneratedData) => {
        queryClient.invalidateQueries({
          queryKey: autoModeKeys.queue(data.projectPath),
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
export function useAutoModeState(projectPath: string | null) {
  return useQuery({
    queryKey: autoModeKeys.state(projectPath || ''),
    queryFn: async (): Promise<AutoModeState | null> => {
      if (!projectPath) return null
      const response: AutoModeGetStateResponse =
        await window.api.autoMode.getState({ projectPath })
      return response.state
    },
    enabled: !!projectPath,
  })
}

/**
 * Hook to get the feature queue for a project
 */
export function useAutoModeQueue(projectPath: string | null) {
  return useQuery({
    queryKey: autoModeKeys.queue(projectPath || ''),
    queryFn: async (): Promise<AutoModeFeature[]> => {
      if (!projectPath) return []
      const response: AutoModeGetQueueResponse =
        await window.api.autoMode.getQueue({ projectPath })
      return response.features
    },
    enabled: !!projectPath,
  })
}

/**
 * Hook to start auto mode
 */
export function useStartAutoMode() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      projectPath,
      config,
    }: {
      projectPath: string
      config?: AutoModeConfig
    }) => {
      const response = await window.api.autoMode.start({
        projectPath,
        config,
      })
      return response.success
    },
    onSuccess: (_, { projectPath }) => {
      queryClient.invalidateQueries({
        queryKey: autoModeKeys.state(projectPath),
      })
    },
  })
}

/**
 * Hook to stop auto mode
 */
export function useStopAutoMode() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (projectPath: string) => {
      const response = await window.api.autoMode.stop({ projectPath })
      return response.stoppedCount
    },
    onSuccess: (_, projectPath) => {
      queryClient.invalidateQueries({
        queryKey: autoModeKeys.state(projectPath),
      })
    },
  })
}

/**
 * Hook to update auto mode configuration
 */
export function useUpdateAutoModeConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      projectPath,
      config,
    }: {
      projectPath: string
      config: AutoModeConfig
    }) => {
      const response = await window.api.autoMode.updateConfig({
        projectPath,
        config,
      })
      return response.success
    },
    onSuccess: (_, { projectPath }) => {
      queryClient.invalidateQueries({
        queryKey: autoModeKeys.state(projectPath),
      })
    },
  })
}

/**
 * Hook to enqueue a feature
 */
export function useEnqueueFeature() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      projectPath,
      featureId,
    }: {
      projectPath: string
      featureId: string
    }) => {
      const response = await window.api.autoMode.enqueueFeature({
        projectPath,
        featureId,
      })
      return response.feature
    },
    onSuccess: (_, { projectPath }) => {
      queryClient.invalidateQueries({
        queryKey: autoModeKeys.queue(projectPath),
      })
    },
  })
}

/**
 * Hook to dequeue a feature
 */
export function useDequeueFeature() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      projectPath,
      featureId,
    }: {
      projectPath: string
      featureId: string
    }) => {
      const response = await window.api.autoMode.dequeueFeature({
        projectPath,
        featureId,
      })
      return response.feature
    },
    onSuccess: (_, { projectPath }) => {
      queryClient.invalidateQueries({
        queryKey: autoModeKeys.queue(projectPath),
      })
    },
  })
}

/**
 * Hook to execute a single feature
 */
export function useExecuteFeature() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      projectPath,
      featureId,
    }: {
      projectPath: string
      featureId: string
    }) => {
      const response = await window.api.autoMode.executeFeature({
        projectPath,
        featureId,
      })
      return response.feature
    },
    onSuccess: (_, { projectPath }) => {
      queryClient.invalidateQueries({
        queryKey: autoModeKeys.queue(projectPath),
      })
      queryClient.invalidateQueries({
        queryKey: autoModeKeys.state(projectPath),
      })
    },
  })
}

/**
 * Hook to resume a feature from existing context
 */
export function useResumeFeature() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      projectPath,
      featureId,
    }: {
      projectPath: string
      featureId: string
    }) => {
      const response = await window.api.autoMode.resumeFeature({
        projectPath,
        featureId,
      })
      return response.feature
    },
    onSuccess: (_, { projectPath }) => {
      queryClient.invalidateQueries({
        queryKey: autoModeKeys.queue(projectPath),
      })
      queryClient.invalidateQueries({
        queryKey: autoModeKeys.state(projectPath),
      })
    },
  })
}

/**
 * Hook to check if a feature has existing context
 */
export function useCheckFeatureContext() {
  return useMutation({
    mutationFn: async ({
      projectPath,
      featureId,
    }: {
      projectPath: string
      featureId: string
    }) => {
      const response = await window.api.autoMode.checkContext({
        projectPath,
        featureId,
      })
      return response.hasContext
    },
  })
}

/**
 * Hook to stop a feature execution
 */
export function useStopFeature() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      projectPath,
      featureId,
    }: {
      projectPath: string
      featureId: string
    }) => {
      const response = await window.api.autoMode.stopFeature({
        featureId,
      })
      return response.success
    },
    onSuccess: (_, { projectPath }) => {
      queryClient.invalidateQueries({
        queryKey: autoModeKeys.queue(projectPath),
      })
      queryClient.invalidateQueries({
        queryKey: autoModeKeys.state(projectPath),
      })
    },
  })
}

/**
 * Hook to approve a plan
 */
export function useApprovePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      projectPath,
      featureId,
    }: {
      projectPath: string
      featureId: string
    }) => {
      const response = await window.api.autoMode.approvePlan({
        projectPath,
        featureId,
      })
      return response.feature
    },
    onSuccess: (_, { projectPath }) => {
      queryClient.invalidateQueries({
        queryKey: autoModeKeys.queue(projectPath),
      })
    },
  })
}

/**
 * Hook to reject a plan
 */
export function useRejectPlan() {
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
      const response = await window.api.autoMode.rejectPlan({
        projectPath,
        featureId,
        feedback,
      })
      return response.feature
    },
    onSuccess: (_, { projectPath }) => {
      queryClient.invalidateQueries({
        queryKey: autoModeKeys.queue(projectPath),
      })
    },
  })
}

/**
 * Main hook for Auto Mode interactions
 *
 * Provides auto mode state management, feature execution controls,
 * and plan approval workflow for a specific project.
 */
export function useAutoMode(projectPath: string | null) {
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
  const stateQuery = useAutoModeState(projectPath)
  const queueQuery = useAutoModeQueue(projectPath)

  // Mutations
  const startMutation = useStartAutoMode()
  const stopMutation = useStopAutoMode()
  const updateConfigMutation = useUpdateAutoModeConfig()
  const enqueueMutation = useEnqueueFeature()
  const dequeueMutation = useDequeueFeature()
  const executeMutation = useExecuteFeature()
  const resumeMutation = useResumeFeature()
  const checkContextMutation = useCheckFeatureContext()
  const stopFeatureMutation = useStopFeature()
  const approvePlanMutation = useApprovePlan()
  const rejectPlanMutation = useRejectPlan()

  // Subscribe to progress events
  useEffect(() => {
    if (!projectPath) return

    const unsubProgress = window.api.autoMode.onFeatureProgress(
      (data: AutoModeFeatureProgressData) => {
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

    const unsubRateLimit = window.api.autoMode.onRateLimitWait(
      (data: AutoModeRateLimitWaitData) => {
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
    async (config?: AutoModeConfig) => {
      if (!projectPath) return false
      return startMutation.mutateAsync({ projectPath, config })
    },
    [projectPath, startMutation]
  )

  const stop = useCallback(async () => {
    if (!projectPath) return 0
    return stopMutation.mutateAsync(projectPath)
  }, [projectPath, stopMutation])

  const updateConfig = useCallback(
    async (config: AutoModeConfig) => {
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
    async (featureId: string) => {
      if (!projectPath) return null
      return executeMutation.mutateAsync({
        projectPath,
        featureId,
      })
    },
    [projectPath, executeMutation]
  )

  const resumeFeature = useCallback(
    async (featureId: string) => {
      if (!projectPath) return null
      return resumeMutation.mutateAsync({
        projectPath,
        featureId,
      })
    },
    [projectPath, resumeMutation]
  )

  const checkFeatureContext = useCallback(
    async (featureId: string) => {
      if (!projectPath) return false
      return checkContextMutation.mutateAsync({
        projectPath,
        featureId,
      })
    },
    [projectPath, checkContextMutation]
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
    isResuming: resumeMutation.isPending,
    isCheckingContext: checkContextMutation.isPending,
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
    resumeFeature,
    checkFeatureContext,
    stopFeature,
    approvePlan,
    rejectPlan,
    clearFeatureProgress,

    // Refresh functions
    refreshState: () =>
      queryClient.invalidateQueries({
        queryKey: autoModeKeys.state(projectPath || ''),
      }),
    refreshQueue: () =>
      queryClient.invalidateQueries({
        queryKey: autoModeKeys.queue(projectPath || ''),
      }),
  }
}

/**
 * Hook to get all Auto Mode actions
 */
export function useAutoModeActions() {
  const startAutoMode = useStartAutoMode()
  const stopAutoMode = useStopAutoMode()
  const updateConfig = useUpdateAutoModeConfig()
  const enqueueFeature = useEnqueueFeature()
  const dequeueFeature = useDequeueFeature()
  const executeFeature = useExecuteFeature()
  const resumeFeature = useResumeFeature()
  const checkFeatureContext = useCheckFeatureContext()
  const stopFeature = useStopFeature()
  const approvePlan = useApprovePlan()
  const rejectPlan = useRejectPlan()

  return {
    startAutoMode: startAutoMode.mutateAsync,
    stopAutoMode: stopAutoMode.mutateAsync,
    updateConfig: updateConfig.mutateAsync,
    enqueueFeature: enqueueFeature.mutateAsync,
    dequeueFeature: dequeueFeature.mutateAsync,
    executeFeature: executeFeature.mutateAsync,
    resumeFeature: resumeFeature.mutateAsync,
    checkFeatureContext: checkFeatureContext.mutateAsync,
    stopFeature: stopFeature.mutateAsync,
    approvePlan: approvePlan.mutateAsync,
    rejectPlan: rejectPlan.mutateAsync,
    isStarting: startAutoMode.isPending,
    isStopping: stopAutoMode.isPending,
    isUpdatingConfig: updateConfig.isPending,
    isEnqueuing: enqueueFeature.isPending,
    isDequeuing: dequeueFeature.isPending,
    isExecuting: executeFeature.isPending,
    isResuming: resumeFeature.isPending,
    isCheckingContext: checkFeatureContext.isPending,
    isStoppingFeature: stopFeature.isPending,
    isApprovingPlan: approvePlan.isPending,
    isRejectingPlan: rejectPlan.isPending,
  }
}

/**
 * Hook to get features awaiting plan approval
 */
export function useFeaturesAwaitingApproval(projectPath: string | null) {
  const { queue } = useAutoMode(projectPath)

  return queue.filter(feature => feature.status === 'waiting_approval')
}

/**
 * Hook to get running features
 */
export function useRunningFeatures(projectPath: string | null) {
  const { queue, runningFeatureIds } = useAutoMode(projectPath)

  return queue.filter(feature => runningFeatureIds.includes(feature.id))
}

/**
 * Hook to get pending features (in queue but not running)
 */
export function usePendingFeatures(projectPath: string | null) {
  const { queue, runningFeatureIds } = useAutoMode(projectPath)

  return queue.filter(
    feature =>
      feature.status === 'pending' && !runningFeatureIds.includes(feature.id)
  )
}
