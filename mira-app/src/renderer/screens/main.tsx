import { useEffect, useRef } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from 'renderer/lib/query-client'
import { useAppStore } from 'renderer/stores/app-store'
import { useNotificationStore } from 'renderer/stores/notification-store'
import { AppShell } from 'renderer/components/Shell'
import { ErrorBoundary } from 'renderer/components/ErrorBoundary'
import { keyboardManager } from 'renderer/lib/keyboard-manager'
import { useShortcuts } from 'renderer/hooks/use-shortcuts'
import { SETTING_KEYS } from 'renderer/hooks/use-settings'
import { useRunningProjectsInit } from 'renderer/hooks/use-running-projects'
import { useRunningTasksInit } from 'renderer/hooks/use-running-tasks'

export function MainScreen() {
  const openCommandPalette = useAppStore(state => state.openCommandPalette)
  const openSettingsPanel = useAppStore(state => state.openSettingsPanel)
  const toggleZenMode = useAppStore(state => state.toggleZenMode)
  const toggleSidebar = useAppStore(state => state.toggleSidebar)
  const setActiveProject = useAppStore(state => state.setActiveProject)

  // Track if we've restored the last project
  const hasRestoredLastProject = useRef(false)

  // Load shortcuts from database
  const { data: shortcuts } = useShortcuts()

  // Initialize running projects subscriptions
  useRunningProjectsInit()

  // Initialize running tasks subscriptions
  useRunningTasksInit()

  // Restore last opened project on startup
  useEffect(() => {
    if (hasRestoredLastProject.current) return
    hasRestoredLastProject.current = true

    window.api.settings
      .get({ key: SETTING_KEYS.LAST_OPENED_PROJECT })
      .then(response => {
        if (response.value) {
          window.api.projects
            .get({ id: response.value })
            .then(projectResponse => {
              if (
                projectResponse.project &&
                !projectResponse.project.isMissing
              ) {
                setActiveProject(response.value)
              }
            })
        }
      })
      .catch(error => {
        console.warn('Failed to restore last opened project:', error)
      })
  }, [setActiveProject])

  // Subscribe to Jules status updates
  useEffect(() => {
    const cleanup = window.api.jules.onStatusUpdate(data => {
      const store = useNotificationStore.getState()
      const previousStatus = store.getJulesStatus(data.status.sessionId)

      store.setJulesStatus(data.status)

      if (previousStatus?.state !== data.status.state) {
        const {
          createJulesNotification,
        } = require('renderer/hooks/use-jules-notifications')
        const notification = createJulesNotification(data.status)
        if (notification) {
          store.addNotification(notification)
        }
      }
    })
    return cleanup
  }, [])

  // Initialize keyboard manager
  useEffect(() => {
    if (shortcuts) {
      keyboardManager.loadShortcuts(shortcuts)
    }

    keyboardManager.registerHandler('command-palette:open', openCommandPalette)
    keyboardManager.registerHandler('zen-mode:toggle', toggleZenMode)
    keyboardManager.registerHandler('sidebar:toggle', toggleSidebar)
    keyboardManager.registerHandler('settings:open', openSettingsPanel)

    keyboardManager.startListening()

    return () => {
      keyboardManager.stopListening()
    }
  }, [
    shortcuts,
    openCommandPalette,
    toggleZenMode,
    toggleSidebar,
    openSettingsPanel,
  ])

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppShell />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
