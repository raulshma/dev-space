/**
 * Hook for applying appearance settings (font size and font family)
 *
 * Applies global appearance settings to the document root element
 * so that the base font size and font family affect the entire app.
 */

import { useEffect } from 'react'
import { useSettings, SETTING_KEYS, DEFAULT_SETTINGS } from './use-settings'

/**
 * Hook to apply appearance settings to the document root
 * Should be called once at the app root level
 */
export function useAppearance() {
  const { data: settings, isLoading } = useSettings([
    SETTING_KEYS.FONT_SIZE,
    SETTING_KEYS.FONT_FAMILY,
  ])

  useEffect(() => {
    if (isLoading || !settings) return

    const root = document.documentElement

    // Apply font size
    const fontSize =
      settings[SETTING_KEYS.FONT_SIZE] ||
      DEFAULT_SETTINGS[SETTING_KEYS.FONT_SIZE]
    root.style.fontSize = `${fontSize}px`

    // Apply font family
    const fontFamily =
      settings[SETTING_KEYS.FONT_FAMILY] ||
      DEFAULT_SETTINGS[SETTING_KEYS.FONT_FAMILY]
    root.style.fontFamily = fontFamily

    // Cleanup on unmount
    return () => {
      root.style.fontSize = ''
      root.style.fontFamily = ''
    }
  }, [settings, isLoading])
}
