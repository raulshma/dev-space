/**
 * Task Settings Component
 *
 * Manages task execution settings including:
 * - Auto-resume interrupted tasks on app start
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
import { IconCheck, IconLoader2, IconInfoCircle } from '@tabler/icons-react'
import {
  useAllSettings,
  useSetSetting,
  SETTING_KEYS,
  DEFAULT_SETTINGS,
} from 'renderer/hooks/use-settings'

export function TaskSettings(): React.JSX.Element {
  const { data: settings, isLoading } = useAllSettings()
  const setSetting = useSetSetting()
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Local state for immediate UI feedback
  const [autoResume, setAutoResume] = useState(
    DEFAULT_SETTINGS[SETTING_KEYS.TASKS_AUTO_RESUME] === 'true'
  )

  // Sync local state with fetched settings
  useEffect(() => {
    if (settings) {
      setAutoResume(settings[SETTING_KEYS.TASKS_AUTO_RESUME] === 'true')
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
    </div>
  )
}
