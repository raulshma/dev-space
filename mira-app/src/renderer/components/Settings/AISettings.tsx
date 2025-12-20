/**
 * AI Settings Component
 *
 * Manages AI-specific settings including:
 * - Default model selection
 * - Response streaming
 * - Max tokens configuration
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
import { Slider } from 'renderer/components/ui/slider'
import { IconCheck, IconLoader2, IconInfoCircle } from '@tabler/icons-react'
import {
  useAllSettings,
  useSetSetting,
  SETTING_KEYS,
  DEFAULT_SETTINGS,
} from 'renderer/hooks/use-settings'

export function AISettings(): React.JSX.Element {
  const { data: settings, isLoading } = useAllSettings()
  const setSetting = useSetSetting()
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Local state
  const [streamResponses, setStreamResponses] = useState(
    DEFAULT_SETTINGS[SETTING_KEYS.AI_STREAM_RESPONSES] === 'true'
  )
  const [maxTokens, setMaxTokens] = useState(
    Number(DEFAULT_SETTINGS[SETTING_KEYS.AI_MAX_TOKENS])
  )

  // Sync with fetched settings
  useEffect(() => {
    if (settings) {
      setStreamResponses(settings[SETTING_KEYS.AI_STREAM_RESPONSES] === 'true')
      setMaxTokens(Number(settings[SETTING_KEYS.AI_MAX_TOKENS]) || 4096)
    }
  }, [settings])

  const handleSettingChange = async (
    key: string,
    value: string
  ): Promise<void> => {
    try {
      await setSetting.mutateAsync({
        key: key as typeof SETTING_KEYS.THEME,
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
        <h2 className="text-lg font-semibold">AI Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure AI behavior and response settings
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

      {/* Response Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Response Behavior</CardTitle>
          <CardDescription>
            Configure how AI responses are delivered
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stream Responses */}
          <div className="flex items-center justify-between opacity-60">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Label>Stream Responses</Label>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                  Coming Soon
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Show AI responses as they are generated
              </p>
            </div>
            <Switch
              checked={streamResponses}
              disabled
              onCheckedChange={checked => {
                setStreamResponses(checked)
                handleSettingChange(
                  SETTING_KEYS.AI_STREAM_RESPONSES,
                  String(checked)
                )
              }}
            />
          </div>

          {/* Max Tokens */}
          <div className="space-y-3 opacity-60">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Label>Max Response Tokens</Label>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                    Coming Soon
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Maximum length of AI responses ({maxTokens.toLocaleString()}{' '}
                  tokens)
                </p>
              </div>
              <span className="text-sm font-mono w-16 text-right">
                {maxTokens.toLocaleString()}
              </span>
            </div>
            <Slider
              className="w-full"
              disabled
              max={16384}
              min={256}
              onValueChange={value => {
                const newValue = Array.isArray(value) ? value[0] : value
                setMaxTokens(newValue)
                handleSettingChange(
                  SETTING_KEYS.AI_MAX_TOKENS,
                  String(newValue)
                )
              }}
              step={256}
              value={[maxTokens]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Alert>
        <IconInfoCircle className="h-4 w-4" />
        <AlertDescription>
          For API key management and model selection, use the dedicated tabs in
          settings. Agent-specific configuration is available in the Agent
          Configuration tab.
        </AlertDescription>
      </Alert>
    </div>
  )
}
