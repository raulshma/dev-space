/**
 * Terminal Settings Component
 *
 * Manages terminal-specific settings including:
 * - Font size and family
 * - Cursor style and blink
 * - Scrollback buffer size
 * - Default shell
 */

import { useState, useEffect } from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from 'renderer/components/ui/card'
import { Input } from 'renderer/components/ui/input'
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
import { IconCheck, IconLoader2 } from '@tabler/icons-react'
import {
  useAllSettings,
  useSetSetting,
  SETTING_KEYS,
  DEFAULT_SETTINGS,
} from 'renderer/hooks/use-settings'

const CURSOR_STYLE_OPTIONS = [
  { value: 'block', label: 'Block' },
  { value: 'underline', label: 'Underline' },
  { value: 'bar', label: 'Bar' },
]

const TERMINAL_FONT_OPTIONS = [
  { value: 'monospace', label: 'System Monospace' },
  { value: 'JetBrains Mono, monospace', label: 'JetBrains Mono' },
  { value: 'Fira Code, monospace', label: 'Fira Code' },
  { value: 'Source Code Pro, monospace', label: 'Source Code Pro' },
  { value: 'Cascadia Code, monospace', label: 'Cascadia Code' },
  { value: 'Consolas, monospace', label: 'Consolas' },
]

export function TerminalSettings(): React.JSX.Element {
  const { data: settings, isLoading } = useAllSettings()
  const setSetting = useSetSetting()
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Local state
  const [fontSize, setFontSize] = useState(
    Number(DEFAULT_SETTINGS[SETTING_KEYS.TERMINAL_FONT_SIZE])
  )
  const [fontFamily, setFontFamily] = useState(
    DEFAULT_SETTINGS[SETTING_KEYS.TERMINAL_FONT_FAMILY]
  )
  const [cursorStyle, setCursorStyle] = useState(
    DEFAULT_SETTINGS[SETTING_KEYS.TERMINAL_CURSOR_STYLE]
  )
  const [cursorBlink, setCursorBlink] = useState(
    DEFAULT_SETTINGS[SETTING_KEYS.TERMINAL_CURSOR_BLINK] === 'true'
  )
  const [scrollback, setScrollback] = useState(
    Number(DEFAULT_SETTINGS[SETTING_KEYS.TERMINAL_SCROLLBACK])
  )
  const [shell, setShell] = useState(
    DEFAULT_SETTINGS[SETTING_KEYS.TERMINAL_SHELL]
  )

  // Sync with fetched settings
  useEffect(() => {
    if (settings) {
      setFontSize(Number(settings[SETTING_KEYS.TERMINAL_FONT_SIZE]) || 14)
      setFontFamily(
        settings[SETTING_KEYS.TERMINAL_FONT_FAMILY] ||
          DEFAULT_SETTINGS[SETTING_KEYS.TERMINAL_FONT_FAMILY]
      )
      setCursorStyle(
        settings[SETTING_KEYS.TERMINAL_CURSOR_STYLE] ||
          DEFAULT_SETTINGS[SETTING_KEYS.TERMINAL_CURSOR_STYLE]
      )
      setCursorBlink(settings[SETTING_KEYS.TERMINAL_CURSOR_BLINK] === 'true')
      setScrollback(Number(settings[SETTING_KEYS.TERMINAL_SCROLLBACK]) || 1000)
      setShell(settings[SETTING_KEYS.TERMINAL_SHELL] || '')
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
        <h2 className="text-lg font-semibold">Terminal Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure the integrated terminal appearance and behavior
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

      {/* Font Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Font</CardTitle>
          <CardDescription>Customize terminal font appearance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Font Size */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Font Size</Label>
                <p className="text-xs text-muted-foreground">
                  Terminal text size ({fontSize}px)
                </p>
              </div>
              <span className="text-sm font-mono w-12 text-right">
                {fontSize}px
              </span>
            </div>
            <Slider
              className="w-full"
              max={24}
              min={10}
              onValueChange={value => {
                const newValue = Array.isArray(value) ? value[0] : value
                setFontSize(newValue)
                handleSettingChange(
                  SETTING_KEYS.TERMINAL_FONT_SIZE,
                  String(newValue)
                )
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
                Monospace font for terminal
              </p>
            </div>
            <Select
              onValueChange={(value: string | null) => {
                if (value) {
                  setFontFamily(value)
                  handleSettingChange(SETTING_KEYS.TERMINAL_FONT_FAMILY, value)
                }
              }}
              value={fontFamily}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TERMINAL_FONT_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Cursor Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Cursor</CardTitle>
          <CardDescription>Configure cursor appearance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Cursor Style */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Cursor Style</Label>
              <p className="text-xs text-muted-foreground">
                Shape of the terminal cursor
              </p>
            </div>
            <Select
              onValueChange={(value: string | null) => {
                if (value) {
                  setCursorStyle(value)
                  handleSettingChange(SETTING_KEYS.TERMINAL_CURSOR_STYLE, value)
                }
              }}
              value={cursorStyle}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURSOR_STYLE_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cursor Blink */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Cursor Blink</Label>
              <p className="text-xs text-muted-foreground">
                Enable cursor blinking animation
              </p>
            </div>
            <Switch
              checked={cursorBlink}
              onCheckedChange={checked => {
                setCursorBlink(checked)
                handleSettingChange(
                  SETTING_KEYS.TERMINAL_CURSOR_BLINK,
                  String(checked)
                )
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Behavior Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Behavior</CardTitle>
          <CardDescription>Terminal behavior and performance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Scrollback */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Scrollback Lines</Label>
                <p className="text-xs text-muted-foreground">
                  Number of lines to keep in history (
                  {scrollback.toLocaleString()})
                </p>
              </div>
              <span className="text-sm font-mono w-16 text-right">
                {scrollback.toLocaleString()}
              </span>
            </div>
            <Slider
              className="w-full"
              max={10000}
              min={100}
              onValueChange={value => {
                const newValue = Array.isArray(value) ? value[0] : value
                setScrollback(newValue)
                handleSettingChange(
                  SETTING_KEYS.TERMINAL_SCROLLBACK,
                  String(newValue)
                )
              }}
              step={100}
              value={[scrollback]}
            />
          </div>

          {/* Default Shell */}
          <div className="space-y-2">
            <Label htmlFor="shell">Default Shell</Label>
            <Input
              className="font-mono text-sm"
              id="shell"
              onBlur={() => {
                handleSettingChange(SETTING_KEYS.TERMINAL_SHELL, shell)
              }}
              onChange={e => setShell(e.target.value)}
              placeholder="Leave empty for system default"
              value={shell}
            />
            <p className="text-xs text-muted-foreground">
              Path to shell executable (e.g., /bin/zsh, powershell.exe)
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
