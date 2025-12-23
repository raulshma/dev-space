/**
 * Dev Command Configuration
 *
 * Allows users to configure and run the dev command for a project.
 * Integrates with the running projects system.
 */

import { useState, useCallback, useEffect } from 'react'
import {
  IconPlayerPlay,
  IconPlayerStop,
  IconSettings,
  IconCheck,
  IconLoader2,
} from '@tabler/icons-react'
import { Button } from 'renderer/components/ui/button'
import { Input } from 'renderer/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from 'renderer/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'renderer/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from 'renderer/components/ui/tooltip'
import { useScripts } from 'renderer/hooks/use-scripts'
import {
  useRunningProjectsManager,
  useIsProjectRunning,
} from 'renderer/hooks/use-running-projects'
import { useRunningProjectsStore } from 'renderer/stores/running-projects-store'

interface DevCommandConfigProps {
  projectId: string
  projectPath: string
}

export function DevCommandConfig({
  projectId,
  projectPath,
}: DevCommandConfigProps) {
  const { data: scriptsData } = useScripts(projectPath)
  const { startProject, stopProject, setDevCommand, getDevCommand } =
    useRunningProjectsManager()
  const isRunning = useIsProjectRunning(projectId)
  const runningProject = useRunningProjectsStore(state =>
    state.projects.get(projectId)
  )

  const [customCommand, setCustomCommand] = useState('')
  const [selectedScript, setSelectedScript] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [isConfigOpen, setIsConfigOpen] = useState(false)

  // Load saved dev command on mount
  useEffect(() => {
    const loadDevCommand = async () => {
      const saved = await getDevCommand(projectId)
      if (saved) {
        setCustomCommand(saved)
        // Check if it matches a script
        if (scriptsData?.scripts) {
          const matchingScript = scriptsData.scripts.find(s => {
            const cmd = buildRunCommand(s.name, scriptsData.packageManager)
            return cmd === saved
          })
          if (matchingScript) {
            setSelectedScript(matchingScript.name)
          }
        }
      }
    }
    loadDevCommand()
  }, [projectId, getDevCommand, scriptsData])

  const buildRunCommand = useCallback(
    (scriptName: string, packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun') => {
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
    },
    []
  )

  const handleScriptSelect = useCallback(
    (scriptName: string | null) => {
      if (!scriptName) return
      setSelectedScript(scriptName)
      if (scriptsData) {
        const cmd = buildRunCommand(scriptName, scriptsData.packageManager)
        setCustomCommand(cmd)
      }
    },
    [scriptsData, buildRunCommand]
  )

  const handleSaveCommand = useCallback(async () => {
    if (!customCommand.trim()) return
    await setDevCommand(projectId, customCommand.trim())
    setIsConfigOpen(false)
  }, [projectId, customCommand, setDevCommand])

  const handleStartStop = useCallback(async () => {
    setIsLoading(true)
    try {
      if (isRunning) {
        await stopProject(projectId)
      } else {
        // Use saved command or current custom command
        const savedCommand = await getDevCommand(projectId)
        const commandToUse = savedCommand || customCommand.trim()
        if (!commandToUse) {
          setIsConfigOpen(true)
          return
        }
        await startProject(projectId, commandToUse)
      }
    } finally {
      setIsLoading(false)
    }
  }, [
    isRunning,
    projectId,
    customCommand,
    startProject,
    stopProject,
    getDevCommand,
  ])

  const status = runningProject?.status
  const isTransitioning = status === 'starting' || status === 'stopping'

  // All scripts from package.json - prioritize common dev scripts at the top
  const commonDevScriptNames = ['dev', 'start', 'serve', 'develop', 'run']
  const allScripts = scriptsData?.scripts ?? []

  // Sort scripts: common dev scripts first, then alphabetically
  const sortedScripts = [...allScripts].sort((a, b) => {
    const aIsCommon = commonDevScriptNames.includes(a.name.toLowerCase())
    const bIsCommon = commonDevScriptNames.includes(b.name.toLowerCase())
    if (aIsCommon && !bIsCommon) return -1
    if (!aIsCommon && bIsCommon) return 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-border">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              className="h-7 gap-1.5"
              disabled={isLoading || isTransitioning}
              onClick={handleStartStop}
              size="sm"
              variant={isRunning ? 'destructive' : 'default'}
            >
              {isLoading || isTransitioning ? (
                <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isRunning ? (
                <IconPlayerStop className="h-3.5 w-3.5" />
              ) : (
                <IconPlayerPlay className="h-3.5 w-3.5" />
              )}
              {isRunning ? 'Stop' : 'Start Dev'}
            </Button>
          }
        />
        <TooltipContent>
          {isRunning
            ? 'Stop the dev server'
            : customCommand
              ? `Run: ${customCommand}`
              : 'Configure and start dev server'}
        </TooltipContent>
      </Tooltip>

      <Popover onOpenChange={setIsConfigOpen} open={isConfigOpen}>
        <PopoverTrigger
          render={
            <Button className="h-7 w-7" size="icon-sm" variant="ghost">
              <IconSettings className="h-3.5 w-3.5" />
            </Button>
          }
        />
        <PopoverContent align="start" className="w-72" side="bottom">
          <div className="space-y-3">
            <div className="text-sm font-medium">Dev Command</div>

            {sortedScripts.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">
                  Select from scripts
                </label>
                <Select
                  onValueChange={handleScriptSelect}
                  value={selectedScript}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue>
                      {selectedScript || 'Choose a script...'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {sortedScripts.map(script => (
                      <SelectItem key={script.name} value={script.name}>
                        <span className="flex items-center gap-2">
                          {script.name}
                          {commonDevScriptNames.includes(
                            script.name.toLowerCase()
                          ) && (
                            <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">
                              dev
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">
                Or enter custom command
              </label>
              <Input
                className="h-8 text-xs"
                onChange={e => {
                  setCustomCommand(e.target.value)
                  setSelectedScript('')
                }}
                placeholder="npm run dev"
                value={customCommand}
              />
            </div>

            <Button
              className="w-full h-7 text-xs"
              disabled={!customCommand.trim()}
              onClick={handleSaveCommand}
              size="sm"
            >
              <IconCheck className="h-3.5 w-3.5 mr-1" />
              Save Command
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {customCommand && (
        <span className="text-xs text-muted-foreground truncate flex-1 ml-1">
          {customCommand}
        </span>
      )}
    </div>
  )
}
