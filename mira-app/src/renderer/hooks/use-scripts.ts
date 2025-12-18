import { useQuery } from '@tanstack/react-query'
import type { ProjectScript } from 'shared/ipc-types'

export const scriptKeys = {
  all: ['scripts'] as const,
  project: (projectPath: string) => [...scriptKeys.all, projectPath] as const,
}

export interface UseScriptsResult {
  scripts: ProjectScript[]
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun'
  hasPackageJson: boolean
}

export function useScripts(projectPath: string | null) {
  return useQuery({
    queryKey: scriptKeys.project(projectPath ?? ''),
    queryFn: async (): Promise<UseScriptsResult> => {
      if (!projectPath) {
        return { scripts: [], packageManager: 'npm', hasPackageJson: false }
      }
      const response = await window.api.scripts.get({ projectPath })
      return response
    },
    enabled: !!projectPath,
    staleTime: 30000, // Cache for 30 seconds
  })
}
