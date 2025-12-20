/**
 * General Settings Component
 *
 * Manages appearance and general application settings including:
 * - Theme selection (light/dark/system)
 * - Font size and family
 * - Data & privacy options
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
import { Slider } from 'renderer/components/ui/slider'
import { IconCheck, IconLoader2, IconTrash } from '@tabler/icons-react'
import {
  useAllSettings,
  useSetSetting,
  SETTING_KEYS,
  DEFAULT_SETTINGS,
} from 'renderer/hooks/use-settings'
import { Button } from 'renderer/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from 'renderer/components/ui/alert-dialog'
import { BACKGROUND_PRESETS } from 'renderer/lib/background-presets'

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

const FONT_FAMILY_OPTIONS = [
  { value: 'system-ui', label: 'System Default' },
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'SF Pro Display, sans-serif', label: 'SF Pro' },
  { value: 'Segoe UI, sans-serif', label: 'Segoe UI' },
]

export function GeneralSettings(): React.JSX.Element {
  const { data: settings, isLoading } = useAllSettings()
  const setSetting = useSetSetting()
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Local state for immediate UI feedback
  const [theme, setTheme] = useState(DEFAULT_SETTINGS[SETTING_KEYS.THEME])
  const [fontSize, setFontSize] = useState(
    Number(DEFAULT_SETTINGS[SETTING_KEYS.FONT_SIZE])
  )
  const [fontFamily, setFontFamily] = useState(
    DEFAULT_SETTINGS[SETTING_KEYS.FONT_FAMILY]
  )
  const [telemetryEnabled, setTelemetryEnabled] = useState(
    DEFAULT_SETTINGS[SETTING_KEYS.TELEMETRY_ENABLED] === 'true'
  )
  const [autoSaveSession, setAutoSaveSession] = useState(
    DEFAULT_SETTINGS[SETTING_KEYS.AUTO_SAVE_SESSION] === 'true'
  )

  // Sync local state with fetched settings
  useEffect(() => {
    if (settings) {
      setTheme(
        settings[SETTING_KEYS.THEME] || DEFAULT_SETTINGS[SETTING_KEYS.THEME]
      )
      setFontSize(Number(settings[SETTING_KEYS.FONT_SIZE]) || 14)
      setFontFamily(
        settings[SETTING_KEYS.FONT_FAMILY] ||
          DEFAULT_SETTINGS[SETTING_KEYS.FONT_FAMILY]
      )
      setTelemetryEnabled(settings[SETTING_KEYS.TELEMETRY_ENABLED] === 'true')
      setAutoSaveSession(settings[SETTING_KEYS.AUTO_SAVE_SESSION] === 'true')
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
        <h2 className="text-lg font-semibold">General Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure appearance and general application behavior
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

      {/* Appearance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Appearance</CardTitle>
          <CardDescription>
            Customize the look and feel of the application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Theme */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Theme</Label>
              <p className="text-xs text-muted-foreground">
                Select your preferred color scheme
              </p>
            </div>
            <Select
              onValueChange={(value: string | null) => {
                if (value) {
                  setTheme(value)
                  handleSettingChange(SETTING_KEYS.THEME, value)
                }
              }}
              value={theme}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THEME_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Font Size */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Font Size</Label>
                <p className="text-xs text-muted-foreground">
                  Adjust the base font size ({fontSize}px)
                </p>
              </div>
              <span className="text-sm font-mono w-12 text-right">
                {fontSize}px
              </span>
            </div>
            <Slider
              className="w-full"
              max={20}
              min={10}
              onValueChange={value => {
                const newValue = Array.isArray(value) ? value[0] : value
                setFontSize(newValue)
                handleSettingChange(SETTING_KEYS.FONT_SIZE, String(newValue))
              }}
              step={1}
              value={[fontSize]}
            />
          </div>

          {/* Font Family */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Font Family</Label>
              <p className="text-xs text-muted-foreground">
                Choose the UI font family
              </p>
            </div>
            <Select
              onValueChange={(value: string | null) => {
                if (value) {
                  setFontFamily(value)
                  handleSettingChange(SETTING_KEYS.FONT_FAMILY, value)
                }
              }}
              value={fontFamily}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_FAMILY_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Icon Backgrounds */}
          <div className="pt-4 border-t space-y-4">
            <div className="space-y-0.5">
              <h4 className="text-sm font-medium">Icon Customization</h4>
              <p className="text-xs text-muted-foreground">
                Apply creative backgrounds to navigation and sidebar icons
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Top Nav Icons */}
              <div className="space-y-2">
                <Label className="text-xs">Top Nav Icons</Label>
                <Select
                  onValueChange={value => {
                    if (value)
                      handleSettingChange(SETTING_KEYS.TOP_NAV_ICON_BG, value)
                  }}
                  value={settings?.[SETTING_KEYS.TOP_NAV_ICON_BG] || 'none'}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BACKGROUND_PRESETS.map(preset => (
                      <SelectItem key={preset.id} value={preset.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded border border-border"
                            style={preset.style}
                          />
                          {preset.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sidebar Icons */}
              <div className="space-y-2">
                <Label className="text-xs">Sidebar Icons</Label>
                <Select
                  onValueChange={value => {
                    if (value)
                      handleSettingChange(SETTING_KEYS.SIDEBAR_ICON_BG, value)
                  }}
                  value={settings?.[SETTING_KEYS.SIDEBAR_ICON_BG] || 'none'}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BACKGROUND_PRESETS.map(preset => (
                      <SelectItem key={preset.id} value={preset.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded border border-border"
                            style={preset.style}
                          />
                          {preset.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data & Privacy */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Data & Privacy</CardTitle>
          <CardDescription>
            Control how your data is stored and used
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Auto-save Session */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-save Session</Label>
              <p className="text-xs text-muted-foreground">
                Automatically save and restore workspace state
              </p>
            </div>
            <Switch
              checked={autoSaveSession}
              onCheckedChange={checked => {
                setAutoSaveSession(checked)
                handleSettingChange(
                  SETTING_KEYS.AUTO_SAVE_SESSION,
                  String(checked)
                )
              }}
            />
          </div>

          {/* Telemetry */}
          <div className="flex items-center justify-between opacity-60">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Label>Usage Analytics</Label>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                  Coming Soon
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Help improve Mira by sending anonymous usage data
              </p>
            </div>
            <Switch
              checked={telemetryEnabled}
              disabled
              onCheckedChange={checked => {
                setTelemetryEnabled(checked)
                handleSettingChange(
                  SETTING_KEYS.TELEMETRY_ENABLED,
                  String(checked)
                )
              }}
            />
          </div>

          {/* Reset Workspace Data */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="space-y-0.5">
              <Label>Reset Workspace Data</Label>
              <p className="text-xs text-muted-foreground">
                Clear all saved session and workspace configuration
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button size="sm" variant="destructive">
                    <IconTrash className="h-4 w-4 mr-1" />
                    Reset
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset Workspace Data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will clear all saved session data including open files,
                    terminal states, and panel layouts for all projects. This
                    action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      try {
                        await window.api.sessions.clearAll()
                        setSaveSuccess(true)
                        setTimeout(() => setSaveSuccess(false), 2000)
                      } catch (error) {
                        console.error('Failed to reset workspace data:', error)
                      }
                    }}
                  >
                    Reset
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
