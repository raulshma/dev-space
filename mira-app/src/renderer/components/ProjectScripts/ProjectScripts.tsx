import { useState, useCallback } from 'react'
import {
  IconChevronRight,
  IconScript,
  IconPlayerPlay,
} from '@tabler/icons-react'
import { useScripts } from 'renderer/hooks/use-scripts'
import { useTerminalStore } from 'renderer/stores/terminal-store'

import { Separator } from 'renderer/components/ui/separator'
import { Spinner } from 'renderer/components/ui/spinner'
import { Badge } from 'renderer/components/ui/badge'
import {
  Empty,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from 'renderer/components/ui/empty'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from 'renderer/components/ui/collapsible'
import type { ProjectScript } from 'shared/ipc-types'
import { DevCommandConfig } from './DevCommandConfig'

interface ProjectScriptsProps {
  projectId: string
  projectPath: string
}

function buildRunCommand(
  scriptName: string,
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun'
): string {
  switch (packageManager) {
    case 'pnpm':
      return `pnpm ${scriptName}`
    case 'yarn':
      return `yarn ${scriptName}`
    case 'bun':
      return `bun run ${scriptName}`
    default:
      return `npm run ${scriptName}`
  }
}

export function ProjectScripts({
  projectId,
  projectPath,
}: ProjectScriptsProps) {
  const { data, isLoading, error } = useScripts(projectPath)
  const focusedTerminalId = useTerminalStore(state => state.focusedTerminalId)
  const getTerminal = useTerminalStore(state => state.getTerminal)
  const [isExpanded, setIsExpanded] = useState(true)

  const handleScriptClick = useCallback(
    async (script: ProjectScript): Promise<void> => {
      const terminal = focusedTerminalId ? getTerminal(focusedTerminalId) : null

      if (!terminal || terminal.projectId !== projectId) {
        alert('Please focus a terminal first')
        return
      }

      const runCommand = buildRunCommand(script.name, script.packageManager)

      try {
        await window.api.pty.write({
          ptyId: terminal.ptyId,
          data: `${runCommand}\r`,
        })
      } catch (err) {
        console.error('Failed to inject script command:', err)
        alert('Failed to run script. Please try again.')
      }
    },
    [focusedTerminalId, getTerminal, projectId]
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Spinner className="h-5 w-5" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive">
        Failed to load scripts.
      </div>
    )
  }

  if (!data?.hasPackageJson) {
    // Still show dev command config even without package.json
    return (
      <div className="flex flex-col">
        <DevCommandConfig projectId={projectId} projectPath={projectPath} />
        <Separator />
      </div>
    )
  }

  if (data.scripts.length === 0) {
    return (
      <Empty>
        <EmptyMedia variant="icon">
          <IconScript className="h-4 w-4" />
        </EmptyMedia>
        <EmptyTitle>No scripts found</EmptyTitle>
        <EmptyDescription>
          Add scripts to package.json to see them here.
        </EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col">
      <DevCommandConfig projectId={projectId} projectPath={projectPath} />
      <Collapsible onOpenChange={setIsExpanded} open={isExpanded}>
        <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold hover:bg-muted/50">
          <div className="flex items-center gap-2">
            <IconScript className="h-4 w-4" />
            <span>Scripts</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="text-xs" variant="secondary">
              {data.packageManager}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {data.scripts.length}
            </span>
            <IconChevronRight
              className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="max-h-96 overflow-y-auto bg-muted/30">
            {data.scripts.map(script => (
              <button
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-primary/5 focus:bg-primary/5 focus:outline-none group"
                key={script.name}
                onClick={() => handleScriptClick(script)}
                title={`Run: ${buildRunCommand(script.name, script.packageManager)}\n\nCommand: ${script.command}`}
              >
                <IconPlayerPlay className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{script.name}</span>
                  <p className="truncate text-xs text-muted-foreground">
                    {script.command}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
      <Separator />
    </div>
  )
}
