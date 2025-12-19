/**
 * Task Settings Component
 *
 * Manages task execution settings including:
 * - Auto-resume interrupted tasks on app start
 * - Default planning mode for new tasks
 * - Dependency blocking toggle
 */

import { useState, useEffect } from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from 'renderer/components/ui/card'
import { Label } from 'renderer/components/ui/label'
import { Switch } from 'renderer/components/ui/switch'
import { Alert, AlertDescription } from 'renderer/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'renderer/components/ui/select'
import { IconCheck, IconLoader2, IconInfoCircle } from '@tabler/icons-react'
import {
  useAllSettings,
  useSetSetting,
  SETTING_KEYS,
  DEFAULT_SETTINGS,
} from 'renderer/hooks/use-settings'
import type { PlanningMode } from 'shared/ai-types'

/**
 * Planning mode options with labels and descriptions
 */
const PLANNING_MODE_OPTIONS: Array<{
  value: PlanningMode
  label: string
  description: string
}> = [
  {
    value: 'skip',
    label: 'Skip',
    description: 'Proceed directly to implementation without generating a plan',
  },
  {
    value: 'lite',
    label: 'Lite',
    description:
      'Generate a brief planning outline with goal, approach, and task list',
  },
  {
    value: 'spec',
    label: 'Spec',
    description:
      'Generate a specification with problem statement and acceptance criteria',
  },
  {
    value: 'full',
    label: 'Full',
    description:
      'Generate a comprehensive specification with user story, phased tasks, and risk analysis',
  },
]

export function TaskSettings(): React.JSX.Element {
  const { data: settings, isLoading } = useAllSettings()
  const setSetting = useSetSetting()
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Local state for immediate UI feedback
  const [autoResume, setAutoResume] = useState(
    DEFAULT_SETTINGS[SETTING_KEYS.TASKS_AUTO_RESUME] === 'true'
  )
  const [defaultPlanningMode, setDefaultPlanningMode] = useState<PlanningMode>(
    DEFAULT_SETTINGS[SETTING_KEYS.TASKS_DEFAULT_PLANNING_MODE] as PlanningMode
  )
  const [dependencyBlockingEnabled, setDependencyBlockingEnabled] = useState(
    DEFAULT_SETTINGS[SETTING_KEYS.TASKS_DEPENDENCY_BLOCKING_ENABLED] === 'true'
  )

  // Sync local state with fetched settings
  useEffect(() => {
    if (settings) {
      setAutoResume(settings[SETTING_KEYS.TASKS_AUTO_RESUME] === 'true')
      setDefaultPlanningMode(
        (settings[SETTING_KEYS.TASKS_DEFAULT_PLANNING_MODE] ||
          'skip') as PlanningMode
      )
      setDependencyBlockingEnabled(
        settings[SETTING_KEYS.TASKS_DEPENDENCY_BLOCKING_ENABLED] === 'true'
      )
    }
  }, [settings])

  const handleSettingChange = async (
    key: string,
    value: string
  ): Promise<void> => {
    try {
      await setSetting.mutateAsync({
        key: key as typeof SETTING_KEYS.TASKS_AUTO_RESUME,
        value,
      })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
    } catch (error) {
      console.error('Failed to save setting:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Task Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure how agent tasks are managed and executed
        </p>
      </div>

      {saveSuccess && (
        <Alert className="border-green-500/50 bg-green-500/10">
          <IconCheck className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-green-600 dark:text-green-400">
            Settings saved
          </AlertDescription>
        </Alert>
      )}

      {/* Task Recovery */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Task Recovery</CardTitle>
          <CardDescription>
            Control how interrupted tasks are handled on app restart
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Auto-resume */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-resume Claude Code Tasks</Label>
              <p className="text-xs text-muted-foreground">
                Automatically restart interrupted Claude Code tasks when the app
                starts
              </p>
            </div>
            <Switch
              checked={autoResume}
              onCheckedChange={checked => {
                setAutoResume(checked)
                handleSettingChange(
                  SETTING_KEYS.TASKS_AUTO_RESUME,
                  String(checked)
                )
              }}
            />
          </div>

          {/* Info about Jules tasks */}
          <Alert className="border-blue-500/30 bg-blue-500/5">
            <IconInfoCircle className="h-4 w-4 text-blue-500" />
            <AlertDescription className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                Google Jules tasks
              </span>{' '}
              run in the cloud and are automatically recovered on app restart.
              They continue running even when Mira is closed.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Planning Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Planning</CardTitle>
          <CardDescription>
            Configure default planning behavior for new tasks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Default Planning Mode */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Default Planning Mode</Label>
              <p className="text-xs text-muted-foreground">
                The planning mode used when creating new tasks
              </p>
            </div>
            <Select
              onValueChange={(value: string | null) => {
                if (value) {
                  setDefaultPlanningMode(value as PlanningMode)
                  handleSettingChange(
                    SETTING_KEYS.TASKS_DEFAULT_PLANNING_MODE,
                    value
                  )
                }
              }}
              value={defaultPlanningMode}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLANNING_MODE_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Planning mode description */}
          <Alert className="border-muted bg-muted/30">
            <IconInfoCircle className="h-4 w-4 text-muted-foreground" />
            <AlertDescription className="text-sm text-muted-foreground">
              {PLANNING_MODE_OPTIONS.find(
                opt => opt.value === defaultPlanningMode
              )?.description || 'Select a planning mode'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Dependencies Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Dependencies</CardTitle>
          <CardDescription>
            Configure how task dependencies are handled
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Dependency Blocking Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Dependency Blocking</Label>
              <p className="text-xs text-muted-foreground">
                Block tasks from starting until their dependencies are complete
              </p>
            </div>
            <Switch
              checked={dependencyBlockingEnabled}
              onCheckedChange={checked => {
                setDependencyBlockingEnabled(checked)
                handleSettingChange(
                  SETTING_KEYS.TASKS_DEPENDENCY_BLOCKING_ENABLED,
                  String(checked)
                )
              }}
            />
          </div>

          {/* Warning when disabled */}
          {!dependencyBlockingEnabled && (
            <Alert className="border-yellow-500/30 bg-yellow-500/5">
              <IconInfoCircle className="h-4 w-4 text-yellow-500" />
              <AlertDescription className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Warning:</span>{' '}
                When disabled, tasks can start regardless of their dependencies.
                This may lead to unexpected behavior if tasks depend on each
                other.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
