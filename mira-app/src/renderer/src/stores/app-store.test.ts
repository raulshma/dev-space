// Unit tests for AppStore
import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './app-store'

describe('AppStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAppStore.setState({
      sidebarCollapsed: false,
      agentPanelCollapsed: false,
      zenMode: false,
      activeProjectId: null,
      activeTerminalId: null,
      commandPaletteOpen: false,
      previousSidebarState: false,
      previousAgentPanelState: false
    })
  })

  it('should toggle sidebar', () => {
    const { toggleSidebar } = useAppStore.getState()

    expect(useAppStore.getState().sidebarCollapsed).toBe(false)

    toggleSidebar()
    expect(useAppStore.getState().sidebarCollapsed).toBe(true)

    toggleSidebar()
    expect(useAppStore.getState().sidebarCollapsed).toBe(false)
  })

  it('should set sidebar collapsed state', () => {
    const { setSidebarCollapsed } = useAppStore.getState()

    setSidebarCollapsed(true)
    expect(useAppStore.getState().sidebarCollapsed).toBe(true)

    setSidebarCollapsed(false)
    expect(useAppStore.getState().sidebarCollapsed).toBe(false)
  })

  it('should toggle agent panel', () => {
    const { toggleAgentPanel } = useAppStore.getState()

    expect(useAppStore.getState().agentPanelCollapsed).toBe(false)

    toggleAgentPanel()
    expect(useAppStore.getState().agentPanelCollapsed).toBe(true)

    toggleAgentPanel()
    expect(useAppStore.getState().agentPanelCollapsed).toBe(false)
  })

  it('should set agent panel collapsed state', () => {
    const { setAgentPanelCollapsed } = useAppStore.getState()

    setAgentPanelCollapsed(true)
    expect(useAppStore.getState().agentPanelCollapsed).toBe(true)

    setAgentPanelCollapsed(false)
    expect(useAppStore.getState().agentPanelCollapsed).toBe(false)
  })

  it('should toggle zen mode and save previous state', () => {
    const { toggleZenMode, setSidebarCollapsed, setAgentPanelCollapsed } = useAppStore.getState()

    // Set sidebar and agent panel to visible
    setSidebarCollapsed(false)
    setAgentPanelCollapsed(false)

    // Enter zen mode
    toggleZenMode()
    expect(useAppStore.getState().zenMode).toBe(true)
    expect(useAppStore.getState().sidebarCollapsed).toBe(true)
    expect(useAppStore.getState().agentPanelCollapsed).toBe(true)
    expect(useAppStore.getState().previousSidebarState).toBe(false)
    expect(useAppStore.getState().previousAgentPanelState).toBe(false)

    // Exit zen mode
    toggleZenMode()
    expect(useAppStore.getState().zenMode).toBe(false)
    expect(useAppStore.getState().sidebarCollapsed).toBe(false)
    expect(useAppStore.getState().agentPanelCollapsed).toBe(false)
  })

  it('should restore previous panel states when exiting zen mode', () => {
    const { toggleZenMode, setSidebarCollapsed, setAgentPanelCollapsed } = useAppStore.getState()

    // Set sidebar collapsed and agent panel visible
    setSidebarCollapsed(true)
    setAgentPanelCollapsed(false)

    // Enter zen mode
    toggleZenMode()
    expect(useAppStore.getState().zenMode).toBe(true)
    expect(useAppStore.getState().sidebarCollapsed).toBe(true)
    expect(useAppStore.getState().agentPanelCollapsed).toBe(true)

    // Exit zen mode - should restore previous states
    toggleZenMode()
    expect(useAppStore.getState().zenMode).toBe(false)
    expect(useAppStore.getState().sidebarCollapsed).toBe(true) // Was collapsed before
    expect(useAppStore.getState().agentPanelCollapsed).toBe(false) // Was visible before
  })

  it('should set active project', () => {
    const { setActiveProject } = useAppStore.getState()

    setActiveProject('project-1')
    expect(useAppStore.getState().activeProjectId).toBe('project-1')

    setActiveProject(null)
    expect(useAppStore.getState().activeProjectId).toBe(null)
  })

  it('should set active terminal', () => {
    const { setActiveTerminal } = useAppStore.getState()

    setActiveTerminal('terminal-1')
    expect(useAppStore.getState().activeTerminalId).toBe('terminal-1')

    setActiveTerminal(null)
    expect(useAppStore.getState().activeTerminalId).toBe(null)
  })

  it('should open and close command palette', () => {
    const { openCommandPalette, closeCommandPalette } = useAppStore.getState()

    expect(useAppStore.getState().commandPaletteOpen).toBe(false)

    openCommandPalette()
    expect(useAppStore.getState().commandPaletteOpen).toBe(true)

    closeCommandPalette()
    expect(useAppStore.getState().commandPaletteOpen).toBe(false)
  })
})
