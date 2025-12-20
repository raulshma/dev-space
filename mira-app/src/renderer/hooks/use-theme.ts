import { useEffect } from 'react'
import { PREDEFINED_THEMES, type Theme, type ThemeColors } from 'shared/themes'
import { useProject } from './use-projects'
import { useCustomThemes } from './use-custom-themes'

/**
 * Hook to apply project-specific themes
 * @param projectId The active project ID
 */
export function useTheme(projectId: string | null) {
  const { data: project, isLoading } = useProject(projectId)
  const { themes } = useCustomThemes()

  useEffect(() => {
    // Wait for project data if we have an ID
    if (projectId && isLoading) return

    // Determine theme to apply
    const themeId = project?.themeId || 'default'

    // First check predefined
    let theme = PREDEFINED_THEMES.find(t => t.id === themeId)

    // Then check custom if not found
    if (!theme) {
      const customTheme = themes.find(t => t.id === themeId)
      if (customTheme) {
        theme = {
          id: customTheme.id,
          name: customTheme.name,
          colors: customTheme.colors as any,
        }
      }
    }

    // Fallback to default
    if (!theme) {
      theme = PREDEFINED_THEMES[0]
    }

    applyTheme(theme)

    // Cleanup not strictly necessary since we apply default on null projectId,
    // but good for safety
    return () => {
      if (!projectId) {
        applyTheme(PREDEFINED_THEMES[0])
      }
    }
  }, [project?.themeId, projectId, isLoading])
}

/**
 * Applies theme colors to document root as CSS variables
 */
function applyTheme(theme: Theme) {
  const root = document.documentElement
  const colors = theme.colors

  // Helper to map camelCase to kebab-case CSS variables
  const setVar = (name: string, value?: string) => {
    // Convert camelCase to kebab-case and handle digit prefix for charts
    const cssVarName = `--${name
      .replace(/([A-Z])/g, '-$1')
      .replace(/(\d)/g, '-$1')
      .toLowerCase()}`
    if (value) {
      root.style.setProperty(cssVarName, value)
    } else {
      root.style.removeProperty(cssVarName)
    }
  }

  // All potential color keys to manage
  const allColorKeys: (keyof ThemeColors)[] = [
    'background',
    'foreground',
    'card',
    'cardForeground',
    'popover',
    'popoverForeground',
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
    'border',
    'input',
    'ring',
    'chart1',
    'chart2',
    'chart3',
    'chart4',
    'chart5',
    'sidebar',
    'sidebarForeground',
    'sidebarPrimary',
    'sidebarPrimaryForeground',
    'sidebarAccent',
    'sidebarAccentForeground',
    'sidebarBorder',
    'sidebarRing',
    'radius',
    'spacing',
    'shadow2xs',
    'shadowXs',
    'shadowSm',
    'shadow',
    'shadowMd',
    'shadowLg',
    'shadowXl',
    'shadow2xl',
    'fontSans',
    'fontMono',
    'fontSerif',
  ]

  // Apply or clear each variable
  for (const key of allColorKeys) {
    setVar(key, (colors as any)[key])
  }
}
