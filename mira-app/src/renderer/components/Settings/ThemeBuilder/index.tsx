import type React from 'react'
import { useState, useEffect } from 'react'
import {
  IconPlus,
  IconTable,
  IconPalette,
  IconTypography,
  IconLayout,
  IconShadow,
  IconTrash,
  IconDeviceFloppy,
  IconArrowLeft,
} from '@tabler/icons-react'
import { Button } from 'renderer/components/ui/button'
import { Input } from 'renderer/components/ui/input'
import { Label } from 'renderer/components/ui/label'
import { ScrollArea } from 'renderer/components/ui/scroll-area'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from 'renderer/components/ui/card'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from 'renderer/components/ui/tabs'
import { useCustomThemes } from 'renderer/hooks/use-custom-themes'
import { PREDEFINED_THEMES, type ThemeColors } from 'shared/themes'
import { toast } from 'sonner'

export function ThemeBuilder() {
  const { themes, createTheme, updateTheme, deleteTheme, isLoading } =
    useCustomThemes()
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null)

  // Theme state for the builder
  const [themeName, setThemeName] = useState('')
  const [themeDescription, setThemeDescription] = useState('')
  const [colors, setColors] = useState<Partial<ThemeColors>>({})

  const selectedTheme = themes.find(t => t.id === editingThemeId)

  useEffect(() => {
    if (selectedTheme) {
      setThemeName(selectedTheme.name)
      setThemeDescription(selectedTheme.description || '')
      setColors(selectedTheme.colors)
    } else {
      setThemeName('')
      setThemeDescription('')
      setColors({})
    }
  }, [editingThemeId, selectedTheme])

  const handleSave = async () => {
    if (!themeName.trim()) {
      toast.error('Theme name is required')
      return
    }

    try {
      if (editingThemeId && editingThemeId.startsWith('custom-')) {
        await updateTheme({
          id: editingThemeId,
          data: {
            name: themeName,
            description: themeDescription,
            colors: colors as any,
          },
        })
        toast.success('Theme updated')
      } else {
        const newTheme = await createTheme({
          name: themeName,
          description: themeDescription,
          colors: colors as any,
        })
        setEditingThemeId(newTheme.id)
        toast.success('Theme created')
      }
    } catch (error) {
      toast.error('Failed to save theme')
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this theme?')) {
      await deleteTheme(id)
      if (editingThemeId === id) setEditingThemeId(null)
      toast.success('Theme deleted')
    }
  }

  const handleColorChange = (key: keyof ThemeColors, value: string) => {
    setColors(prev => ({ ...prev, [key]: value }))
  }

  // Predefined default colors from Slate theme as a starting point
  const fallbackColors =
    PREDEFINED_THEMES.find(t => t.id === 'slate')?.colors || {}

  if (editingThemeId) {
    return (
      <div className="flex flex-col h-full space-y-4 animate-in fade-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setEditingThemeId(null)}
              size="icon"
              variant="ghost"
            >
              <IconArrowLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-lg font-semibold">
              {editingThemeId.startsWith('custom-')
                ? 'Edit Theme'
                : 'Create Theme'}
            </h3>
          </div>
          <Button className="gap-2" onClick={handleSave}>
            <IconDeviceFloppy className="h-4 w-4" />
            Save Theme
          </Button>
        </div>

        <div className="grid grid-cols-[1fr,300px] gap-6 flex-1 min-h-0">
          <div className="space-y-6 overflow-y-auto pr-2">
            <div className="grid gap-4 p-4 border rounded-xl bg-card/50 backdrop-blur-sm shadow-sm">
              {/* Preset Selector */}
              <div className="grid gap-2">
                <Label htmlFor="theme-preset">Start from Preset</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  defaultValue=""
                  id="theme-preset"
                  onChange={e => {
                    const preset = PREDEFINED_THEMES.find(
                      t => t.id === e.target.value
                    )
                    if (preset) {
                      setColors({ ...preset.colors })
                      if (!themeName) {
                        setThemeName(`${preset.name} (Custom)`)
                      }
                      toast.success(`Loaded "${preset.name}" as preset`)
                    }
                  }}
                >
                  <option disabled value="">
                    Select a preset to start from...
                  </option>
                  {PREDEFINED_THEMES.map(theme => (
                    <option key={theme.id} value={theme.id}>
                      {theme.name} — {theme.description || 'Default theme'}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground">
                  Choose a predefined theme as a starting point, then customize
                  it.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="theme-name">Theme Name</Label>
                <Input
                  id="theme-name"
                  onChange={e => setThemeName(e.target.value)}
                  placeholder="e.g. Cyberpunk Pro"
                  value={themeName}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="theme-desc">Description (Optional)</Label>
                <Input
                  id="theme-desc"
                  onChange={e => setThemeDescription(e.target.value)}
                  placeholder="e.g. High contrast neon theme"
                  value={themeDescription}
                />
              </div>
            </div>

            <Tabs className="w-full" defaultValue="colors">
              <TabsList className="grid grid-cols-5 w-full bg-muted/50 p-1">
                <TabsTrigger className="gap-2" value="colors">
                  <IconPalette className="h-4 w-4" />
                  Colors
                </TabsTrigger>
                <TabsTrigger className="gap-2" value="sidebar">
                  <IconTable className="h-4 w-4" />
                  Sidebar
                </TabsTrigger>
                <TabsTrigger className="gap-2" value="typography">
                  <IconTypography className="h-4 w-4" />
                  Fonts
                </TabsTrigger>
                <TabsTrigger className="gap-2" value="layout">
                  <IconLayout className="h-4 w-4" />
                  Layout
                </TabsTrigger>
                <TabsTrigger className="gap-2" value="shadows">
                  <IconShadow className="h-4 w-4" />
                  Shadows
                </TabsTrigger>
              </TabsList>

              <TabsContent
                className="mt-4 space-y-4 animate-in fade-in duration-300"
                value="colors"
              >
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <ColorGroup
                    colors={colors}
                    keys={[
                      'background',
                      'foreground',
                      'card',
                      'cardForeground',
                      'border',
                      'input',
                      'ring',
                    ]}
                    onChanged={handleColorChange}
                    title="Base"
                  />
                  <ColorGroup
                    colors={colors}
                    keys={[
                      'primary',
                      'primaryForeground',
                      'secondary',
                      'secondaryForeground',
                      'muted',
                      'mutedForeground',
                      'accent',
                      'accentForeground',
                      'destructive',
                      'destructiveForeground',
                    ]}
                    onChanged={handleColorChange}
                    title="Actions"
                  />
                </div>
                <div className="mt-6 border-t pt-4">
                  <h4 className="text-sm font-medium mb-3">Chart Colors</h4>
                  <div className="grid grid-cols-5 gap-4">
                    {['chart1', 'chart2', 'chart3', 'chart4', 'chart5'].map(
                      key => (
                        <div className="space-y-1.5" key={key}>
                          <Label className="text-[10px] uppercase text-muted-foreground">
                            {key}
                          </Label>
                          <div className="flex gap-2 items-center">
                            <input
                              className="w-full h-8 rounded border bg-transparent cursor-pointer"
                              onChange={e =>
                                handleColorChange(key as any, e.target.value)
                              }
                              type="color"
                              value={(colors as any)[key] || '#cccccc'}
                            />
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent
                className="mt-4 space-y-4 animate-in fade-in duration-300"
                value="sidebar"
              >
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <ColorGroup
                    colors={colors}
                    keys={[
                      'sidebar',
                      'sidebarForeground',
                      'sidebarBorder',
                      'sidebarRing',
                    ]}
                    onChanged={handleColorChange}
                    title="Sidebar Base"
                  />
                  <ColorGroup
                    colors={colors}
                    keys={[
                      'sidebarPrimary',
                      'sidebarPrimaryForeground',
                      'sidebarAccent',
                      'sidebarAccentForeground',
                    ]}
                    onChanged={handleColorChange}
                    title="Sidebar Active"
                  />
                </div>
              </TabsContent>

              <TabsContent
                className="mt-4 space-y-6 animate-in fade-in duration-300"
                value="typography"
              >
                <div className="grid gap-6">
                  <FontInput
                    label="Sans Serif"
                    onChange={v => handleColorChange('fontSans', v)}
                    placeholder="Inter, system-ui, sans-serif"
                    value={colors.fontSans || ''}
                  />
                  <FontInput
                    label="Monospace"
                    onChange={v => handleColorChange('fontMono', v)}
                    placeholder="JetBrains Mono, monospace"
                    value={colors.fontMono || ''}
                  />
                  <FontInput
                    label="Serif"
                    onChange={v => handleColorChange('fontSerif', v)}
                    placeholder="Playfair Display, serif"
                    value={colors.fontSerif || ''}
                  />
                </div>
              </TabsContent>

              <TabsContent
                className="mt-4 space-y-6 animate-in fade-in duration-300"
                value="layout"
              >
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Border Radius</Label>
                    <Input
                      onChange={e =>
                        handleColorChange('radius', e.target.value)
                      }
                      placeholder="e.g. 0.5rem"
                      value={colors.radius || ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Global Spacing</Label>
                    <Input
                      onChange={e =>
                        handleColorChange('spacing', e.target.value)
                      }
                      placeholder="e.g. 0.25rem"
                      value={colors.spacing || ''}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent
                className="mt-4 space-y-4 animate-in fade-in duration-300"
                value="shadows"
              >
                <div className="grid grid-cols-2 gap-4">
                  {[
                    'shadow2xs',
                    'shadowXs',
                    'shadowSm',
                    'shadow',
                    'shadowMd',
                    'shadowLg',
                    'shadowXl',
                    'shadow2xl',
                  ].map(key => (
                    <div className="space-y-1.5" key={key}>
                      <Label className="text-xs">
                        {key.replace('shadow', 'Shadow ')}
                      </Label>
                      <Input
                        onChange={e =>
                          handleColorChange(key as any, e.target.value)
                        }
                        placeholder="e.g. 0 1px 2px 0 rgb(0 0 0 / 0.05)"
                        value={(colors as any)[key] || ''}
                      />
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <aside className="border-l pl-6 flex flex-col space-y-4">
            <h4 className="text-sm font-medium">Quick Preview</h4>
            <div
              className="flex-1 rounded-xl p-4 border bg-background space-y-4 overflow-hidden relative"
              style={
                {
                  '--primary': colors.primary,
                  '--background': colors.background,
                  '--foreground': colors.foreground,
                  '--card': colors.card,
                  '--border': colors.border,
                  '--radius': colors.radius || '0.5rem',
                } as React.CSSProperties
              }
            >
              <div className="h-8 w-1/2 bg-primary rounded" />
              <div className="space-y-2">
                <div className="h-4 w-full bg-muted rounded" />
                <div className="h-4 w-3/4 bg-muted rounded" />
              </div>
              <div className="flex gap-2">
                <div className="h-10 w-10 rounded-full bg-accent" />
                <div className="flex-1 h-10 rounded bg-card border" />
              </div>
              <div className="p-3 border rounded shadow-md bg-card">
                <div className="text-[10px] text-muted-foreground uppercase font-bold mb-1">
                  Preview Shadow
                </div>
                <div className="h-2 w-full bg-muted rounded mb-2" />
                <div className="flex justify-end">
                  <div className="h-6 w-12 bg-primary rounded cursor-default" />
                </div>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground italic">
              Note: Full preview is applied directly to the app during edit.
            </p>
          </aside>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Custom Themes</h3>
          <p className="text-sm text-muted-foreground">
            Build and manage your own visual styles
          </p>
        </div>
        <Button className="gap-2" onClick={() => setEditingThemeId('new')}>
          <IconPlus className="h-4 w-4" />
          Create Theme
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="grid grid-cols-2 gap-4">
          {themes.map(theme => (
            <Card
              className="group overflow-hidden border bg-muted/20 hover:bg-muted/40 transition-all hover:shadow-md"
              key={theme.id}
            >
              <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-base">{theme.name}</CardTitle>
                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {theme.description || 'No description'}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    onClick={() => setEditingThemeId(theme.id)}
                    size="icon"
                    variant="ghost"
                  >
                    <IconPalette className="h-4 w-4" />
                  </Button>
                  <Button
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(theme.id)}
                    size="icon"
                    variant="ghost"
                  >
                    <IconTrash className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex gap-1 h-2 rounded-full overflow-hidden">
                  <div
                    className="flex-1"
                    style={{ background: theme.colors.primary }}
                  />
                  <div
                    className="flex-1"
                    style={{ background: theme.colors.background }}
                  />
                  <div
                    className="flex-1"
                    style={{ background: theme.colors.accent }}
                  />
                  <div
                    className="flex-1"
                    style={{ background: theme.colors.secondary }}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
          {themes.length === 0 && !isLoading && (
            <div className="col-span-2 py-12 flex flex-col items-center justify-center text-center space-y-3 opacity-50 border-2 border-dashed rounded-2xl">
              <IconPalette className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="font-medium">No custom themes yet</p>
                <p className="text-sm">
                  Click the button above to start building
                </p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function ColorGroup({
  title,
  keys,
  colors,
  onChanged,
}: {
  title: string
  keys: string[]
  colors: any
  onChanged: any
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </h4>
      <div className="space-y-2">
        {keys.map(key => (
          <div
            className="grid grid-cols-[120px,1fr] items-center gap-2"
            key={key}
          >
            <Label className="text-xs overflow-hidden text-ellipsis whitespace-nowrap">
              {key}
            </Label>
            <div className="flex gap-2">
              <Input
                className="h-8 py-1 px-2 text-xs font-mono"
                onChange={e => onChanged(key, e.target.value)}
                placeholder="e.g. oklch(...)"
                value={colors[key] || ''}
              />
              <input
                className="w-8 h-8 p-0 rounded border bg-transparent cursor-pointer shrink-0"
                onChange={e => onChanged(key, e.target.value)}
                type="color" // Basic fallback for CSS functions
                value={
                  colors[key]?.startsWith('oklch')
                    ? '#cccccc'
                    : colors[key] || '#cccccc'
                }
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FontInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </div>
  )
}
