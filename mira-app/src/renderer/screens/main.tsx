import { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from 'renderer/lib/query-client'
import { useAppStore } from 'renderer/stores/app-store'
import { ProjectDashboard } from 'renderer/components/ProjectDashboard'
import { ProjectWorkspace } from 'renderer/components/ProjectWorkspace'
import { CommandPalette } from 'renderer/components/CommandPalette'
import { SettingsPanel } from 'renderer/components/Settings'
import { ErrorBoundary } from 'renderer/components/ErrorBoundary'
import { ErrorToast } from 'renderer/components/ErrorToast'
import { keyboardManager } from 'renderer/lib/keyboard-manager'
import { useShortcuts } from 'renderer/hooks/use-shortcuts'

// The "api" type comes from preload/index.d.ts which declares Window.api globally

export function MainScreen() {
  const activeProjectId = useAppStore(state => state.activeProjectId)
  const settingsPanelOpen = useAppStore(state => state.settingsPanelOpen)
  const openCommandPalette = useAppStore(state => state.openCommandPalette)
  const openSettingsPanel = useAppStore(state => state.openSettingsPanel)
  const closeSettingsPanel = useAppStore(state => state.closeSettingsPanel)
  const toggleZenMode = useAppStore(state => state.toggleZenMode)
  const toggleSidebar = useAppStore(state => state.toggleSidebar)

  // Load shortcuts from database
  const { data: shortcuts } = useShortcuts()

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

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <main className="h-screen w-full bg-background text-foreground">
          {activeProjectId ? (
            <ProjectWorkspace projectId={activeProjectId} />
          ) : (
            <ProjectDashboard />
          )}
          <CommandPalette />
          {settingsPanelOpen && <SettingsPanel onClose={closeSettingsPanel} />}
          <ErrorToast />
        </main>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
