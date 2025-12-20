/**
 * Hook for managing application settings
 *
 * Provides React Query hooks for fetching and updating settings
 * stored in the database via IPC.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// Setting keys used throughout the application
export const SETTING_KEYS = {
  // Appearance
  THEME: 'appearance.theme',
  FONT_SIZE: 'appearance.fontSize',
  FONT_FAMILY: 'appearance.fontFamily',
  TOP_NAV_ICON_BG: 'appearance.topNavIconBg',
  SIDEBAR_ICON_BG: 'appearance.sidebarIconBg',

  // Terminal
  TERMINAL_FONT_SIZE: 'terminal.fontSize',
  TERMINAL_FONT_FAMILY: 'terminal.fontFamily',
  TERMINAL_CURSOR_STYLE: 'terminal.cursorStyle',
  TERMINAL_CURSOR_BLINK: 'terminal.cursorBlink',
  TERMINAL_SCROLLBACK: 'terminal.scrollback',
  TERMINAL_SHELL: 'terminal.shell',

  // Editor (not yet exposed in UI - reserved for future code editor feature)
  EDITOR_TAB_SIZE: 'editor.tabSize',
  EDITOR_WORD_WRAP: 'editor.wordWrap',
  EDITOR_LINE_NUMBERS: 'editor.lineNumbers',

  // Data & Privacy
  TELEMETRY_ENABLED: 'privacy.telemetryEnabled',
  AUTO_SAVE_SESSION: 'privacy.autoSaveSession',

  // AI
  AI_DEFAULT_MODEL: 'ai.defaultModel',
  AI_STREAM_RESPONSES: 'ai.streamResponses',
  AI_MAX_TOKENS: 'ai.maxTokens',

  // Tasks
  TASKS_AUTO_RESUME: 'tasks.autoResume',
  TASKS_DEFAULT_PLANNING_MODE: 'tasks.defaultPlanningMode',
  TASKS_DEPENDENCY_BLOCKING_ENABLED: 'tasks.dependencyBlockingEnabled',

  // Workspace
  LAST_OPENED_PROJECT: 'workspace.lastOpenedProject',
} as const

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS]

// Default values for settings
export const DEFAULT_SETTINGS: Record<SettingKey, string> = {
  [SETTING_KEYS.THEME]: 'system',
  [SETTING_KEYS.FONT_SIZE]: '14',
  [SETTING_KEYS.FONT_FAMILY]: 'system-ui',
  [SETTING_KEYS.TOP_NAV_ICON_BG]: 'none',
  [SETTING_KEYS.SIDEBAR_ICON_BG]: 'none',

  [SETTING_KEYS.TERMINAL_FONT_SIZE]: '14',
  [SETTING_KEYS.TERMINAL_FONT_FAMILY]: 'monospace',
  [SETTING_KEYS.TERMINAL_CURSOR_STYLE]: 'block',
  [SETTING_KEYS.TERMINAL_CURSOR_BLINK]: 'true',
  [SETTING_KEYS.TERMINAL_SCROLLBACK]: '1000',
  [SETTING_KEYS.TERMINAL_SHELL]: '',

  [SETTING_KEYS.EDITOR_TAB_SIZE]: '2',
  [SETTING_KEYS.EDITOR_WORD_WRAP]: 'true',
  [SETTING_KEYS.EDITOR_LINE_NUMBERS]: 'true',

  [SETTING_KEYS.TELEMETRY_ENABLED]: 'false',
  [SETTING_KEYS.AUTO_SAVE_SESSION]: 'true',

  [SETTING_KEYS.AI_DEFAULT_MODEL]: '',
  [SETTING_KEYS.AI_STREAM_RESPONSES]: 'true',
  [SETTING_KEYS.AI_MAX_TOKENS]: '4096',

  [SETTING_KEYS.TASKS_AUTO_RESUME]: 'false',
  [SETTING_KEYS.TASKS_DEFAULT_PLANNING_MODE]: 'skip',
  [SETTING_KEYS.TASKS_DEPENDENCY_BLOCKING_ENABLED]: 'true',

  [SETTING_KEYS.LAST_OPENED_PROJECT]: '',
}

/**
 * Hook for fetching a single setting
 */
export function useSetting(key: SettingKey) {
  return useQuery({
    queryKey: ['settings', key],
    queryFn: async () => {
      const response = await window.api.settings.get({ key })
      return response.value ?? DEFAULT_SETTINGS[key]
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Hook for fetching multiple settings at once
 */
export function useSettings(keys: SettingKey[]) {
  return useQuery({
    queryKey: ['settings', 'batch', keys],
    queryFn: async () => {
      const results: Record<string, string> = {}
      for (const key of keys) {
        const response = await window.api.settings.get({ key })
        results[key] = response.value ?? DEFAULT_SETTINGS[key]
      }
      return results
    },
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Hook for fetching all settings
 */
export function useAllSettings() {
  const allKeys = Object.values(SETTING_KEYS)
  return useSettings(allKeys)
}

/**
 * Hook for updating a setting
 */
export function useSetSetting() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ key, value }: { key: SettingKey; value: string }) => {
      const response = await window.api.settings.set({ key, value })
      if (!response.success) {
        throw new Error('Failed to save setting')
      }
      return response
    },
    onSuccess: (_data, variables) => {
      // Invalidate specific setting query
      queryClient.invalidateQueries({ queryKey: ['settings', variables.key] })
      // Invalidate batch queries
      queryClient.invalidateQueries({ queryKey: ['settings', 'batch'] })
    },
  })
}

/**
 * Hook for updating multiple settings at once
 */
export function useSetSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (settings: Array<{ key: SettingKey; value: string }>) => {
      for (const { key, value } of settings) {
        const response = await window.api.settings.set({ key, value })
        if (!response.success) {
          throw new Error(`Failed to save setting: ${key}`)
        }
      }
      return { success: true }
    },
    onSuccess: () => {
      // Invalidate all settings queries
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })
}
