import { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/query-client'
import { useAppStore } from './stores/app-store'
import { ProjectDashboard } from './components/ProjectDashboard'
import { ProjectWorkspace } from './components/ProjectWorkspace'
import { CommandPalette } from './components/CommandPalette'
import { SettingsPanel } from './components/Settings'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ErrorToast } from './components/ErrorToast'
import { keyboardManager } from './lib/keyboard-manager'
import { useShortcuts } from './hooks/use-shortcuts'

function App(): React.JSX.Element {
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
        {activeProjectId ? (
          <ProjectWorkspace projectId={activeProjectId} />
        ) : (
          <ProjectDashboard />
        )}
        <CommandPalette />
        {settingsPanelOpen && <SettingsPanel onClose={closeSettingsPanel} />}
        <ErrorToast />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
