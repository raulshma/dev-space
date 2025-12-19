/**
 * React hook for CLI detection
 *
 * Provides easy access to CLI autodetection functionality
 * for detecting Python, Node.js, Git, and other development tools.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { CLIType, CLIDetectionResult, DetectedCLI } from 'shared/ipc-types'

/**
 * Query key factory for CLI detection
 */
const cliKeys = {
  all: ['cli'] as const,
  detect: (cliType: CLIType) => [...cliKeys.all, 'detect', cliType] as const,
  detectAll: () => [...cliKeys.all, 'detectAll'] as const,
  recommended: (cliType: CLIType) =>
    [...cliKeys.all, 'recommended', cliType] as const,
}

/**
 * Hook to detect a specific CLI
 *
 * @param cliType - The type of CLI to detect
 * @param options - Query options
 * @returns Query result with detection info
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useCLIDetection('python')
 * if (data?.result.found) {
 *   console.log('Python found at:', data.result.recommended?.path)
 * }
 * ```
 */
export function useCLIDetection(
  cliType: CLIType,
  options?: {
    enabled?: boolean
    useCache?: boolean
  }
) {
  return useQuery({
    queryKey: cliKeys.detect(cliType),
    queryFn: async () => {
      const response = await window.api.cli.detect({
        cliType,
        useCache: options?.useCache ?? true,
      })
      return response
    },
    enabled: options?.enabled ?? true,
    staleTime: 60000, // 1 minute
  })
}

/**
 * Hook to detect all supported CLIs
 *
 * @returns Query result with all detection results
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useAllCLIDetection()
 * if (data?.results.python?.found) {
 *   console.log('Python:', data.results.python.recommended?.version)
 * }
 * ```
 */
export function useAllCLIDetection(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: cliKeys.detectAll(),
    queryFn: async () => {
      const response = await window.api.cli.detectAll({})
      return response
    },
    enabled: options?.enabled ?? true,
    staleTime: 60000,
  })
}

/**
 * Hook to get the recommended path for a CLI
 *
 * @param cliType - The type of CLI
 * @returns Query result with recommended path
 */
export function useCLIRecommendedPath(
  cliType: CLIType,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: cliKeys.recommended(cliType),
    queryFn: async () => {
      const response = await window.api.cli.getRecommended({ cliType })
      return response.path
    },
    enabled: options?.enabled ?? true,
    staleTime: 60000,
  })
}

/**
 * Hook to verify a CLI path
 *
 * @returns Mutation for verifying paths
 *
 * @example
 * ```tsx
 * const verifyPath = useCLIVerifyPath()
 * const isValid = await verifyPath.mutateAsync({
 *   cliType: 'python',
 *   path: '/usr/bin/python3'
 * })
 * ```
 */
export function useCLIVerifyPath() {
  return useMutation({
    mutationFn: async ({
      cliType,
      path,
    }: {
      cliType: CLIType
      path: string
    }) => {
      const response = await window.api.cli.verifyPath({ cliType, path })
      return response.valid
    },
  })
}

/**
 * Hook to clear CLI detection cache
 *
 * @returns Mutation for clearing cache
 */
export function useCLIClearCache() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const response = await window.api.cli.clearCache({})
      return response.success
    },
    onSuccess: () => {
      // Invalidate all CLI queries to force re-detection
      queryClient.invalidateQueries({ queryKey: cliKeys.all })
    },
  })
}

/**
 * Hook to auto-detect and apply Python path to agent config
 *
 * Detects Python and automatically updates the agent configuration
 * if a valid Python installation is found.
 *
 * @returns Object with detection state and apply function
 */
export function useAutoDetectPython() {
  const queryClient = useQueryClient()
  const detection = useCLIDetection('python')

  const applyMutation = useMutation({
    mutationFn: async (pythonPath: string) => {
      await window.api.agentConfig.set({
        updates: { pythonPath },
      })
      return pythonPath
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agentConfig'] })
    },
  })

  return {
    detection,
    recommended: detection.data?.result.recommended,
    installations: detection.data?.result.installations ?? [],
    isDetecting: detection.isLoading,
    applyPath: applyMutation.mutate,
    applyPathAsync: applyMutation.mutateAsync,
    isApplying: applyMutation.isPending,
  }
}

/**
 * Utility to get a human-readable name for a CLI type
 */
export function getCLIDisplayName(cliType: CLIType): string {
  const names: Record<CLIType, string> = {
    python: 'Python',
    node: 'Node.js',
    git: 'Git',
    npm: 'npm',
    pnpm: 'pnpm',
    yarn: 'Yarn',
    bun: 'Bun',
    'claude-code': 'Claude Code CLI',
    uv: 'uv',
    uvx: 'uvx',
  }
  return names[cliType] ?? cliType
}

/**
 * Utility to get installation instructions for a CLI
 */
export function getCLIInstallInstructions(cliType: CLIType): string {
  const instructions: Record<CLIType, string> = {
    python: 'Install from https://python.org or use your package manager',
    node: 'Install from https://nodejs.org or use nvm',
    git: 'Install from https://git-scm.com',
    npm: 'Included with Node.js installation',
    pnpm: 'Run: npm install -g pnpm',
    yarn: 'Run: npm install -g yarn',
    bun: 'Install from https://bun.sh',
    'claude-code': 'Run: npm install -g @anthropic-ai/claude-code',
    uv: 'Install from https://docs.astral.sh/uv/getting-started/installation/',
    uvx: 'Included with uv installation',
  }
  return instructions[cliType] ?? 'Check the official documentation'
}
