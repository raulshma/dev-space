import { useEffect, useRef } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from 'renderer/lib/query-client'
import { useAppStore } from 'renderer/stores/app-store'
import { useNotificationStore } from 'renderer/stores/notification-store'
import { ProjectDashboard } from 'renderer/components/ProjectDashboard'
import { ProjectWorkspace } from 'renderer/components/ProjectWorkspace'
import { TasksScreen } from 'renderer/screens/tasks'
import { CommandPalette } from 'renderer/components/CommandPalette'
import { SettingsPanel } from 'renderer/components/Settings'
import { StatusBar } from 'renderer/components/StatusBar'
import { ErrorBoundary } from 'renderer/components/ErrorBoundary'
import { ErrorToast } from 'renderer/components/ErrorToast'
import { keyboardManager } from 'renderer/lib/keyboard-manager'
import { useShortcuts } from 'renderer/hooks/use-shortcuts'
import { SETTING_KEYS } from 'renderer/hooks/use-settings'

// The "api" type comes from preload/index.d.ts which declares Window.api globally

export function MainScreen() {
  const activeProjectId = useAppStore(state => state.activeProjectId)
  const activeView = useAppStore(state => state.activeView)
  const settingsPanelOpen = useAppStore(state => state.settingsPanelOpen)
  const openCommandPalette = useAppStore(state => state.openCommandPalette)
  const openSettingsPanel = useAppStore(state => state.openSettingsPanel)
  const closeSettingsPanel = useAppStore(state => state.closeSettingsPanel)
  const toggleZenMode = useAppStore(state => state.toggleZenMode)
  const toggleSidebar = useAppStore(state => state.toggleSidebar)
  const setActiveProject = useAppStore(state => state.setActiveProject)

  // Track if we've restored the last project
  const hasRestoredLastProject = useRef(false)

  // Load shortcuts from database
  const { data: shortcuts } = useShortcuts()

  // Restore last opened project on startup
  useEffect(() => {
    if (hasRestoredLastProject.current) return
    hasRestoredLastProject.current = true

    window.api.settings
      .get({ key: SETTING_KEYS.LAST_OPENED_PROJECT })
      .then(response => {
        if (response.value) {
          // Verify the project still exists before opening
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

  // Save last opened project when it changes
  useEffect(() => {
    // Save the current project (or empty string if null/closed)
    window.api.settings
      .set({
        key: SETTING_KEYS.LAST_OPENED_PROJECT,
        value: activeProjectId ?? '',
      })
      .catch(error => {
        console.warn('Failed to save last opened project:', error)
      })
  }, [activeProjectId])

  // Subscribe to Jules status updates and create notifications
  useEffect(() => {
    const cleanup = window.api.jules.onStatusUpdate(data => {
      const store = useNotificationStore.getState()
      const previousStatus = store.getJulesStatus(data.status.sessionId)

      // Update the status
      store.setJulesStatus(data.status)

      // Create notification if state changed to an actionable state
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

    // Register global action handlers
    keyboardManager.registerHandler('command-palette:open', openCommandPalette)
    keyboardManager.registerHandler('zen-mode:toggle', toggleZenMode)
    keyboardManager.registerHandler('sidebar:toggle', toggleSidebar)
    keyboardManager.registerHandler('settings:open', openSettingsPanel)

    // Start listening for keyboard events
    keyboardManager.startListening()

    // Cleanup on unmount
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

  const renderContent = () => {
    // Check activeView first - it takes precedence
    switch (activeView) {
      case 'tasks':
        return <TasksScreen />
      case 'workspace':
        if (activeProjectId) {
          // Key ensures component remounts when project changes, resetting all refs and state
          return (
            <ProjectWorkspace
              key={activeProjectId}
              projectId={activeProjectId}
            />
          )
        }
        // Fall through to dashboard if no project selected
        return <ProjectDashboard />
      default:
        // For 'dashboard' or any other value, show dashboard or workspace based on activeProjectId
        if (activeProjectId) {
          // Key ensures component remounts when project changes, resetting all refs and state
          return (
            <ProjectWorkspace
              key={activeProjectId}
              projectId={activeProjectId}
            />
          )
        }
        return <ProjectDashboard />
    }
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <main className="h-screen w-full bg-background text-foreground flex flex-col">
          <div className="flex-1 min-h-0">{renderContent()}</div>
          <StatusBar />
          <CommandPalette />
          <SettingsPanel
            isOpen={settingsPanelOpen}
            onClose={closeSettingsPanel}
          />
          <ErrorToast />
        </main>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
