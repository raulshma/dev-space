/**
 * useWorkspaceSession Hook
 *
 * Manages workspace session persistence: restoration on mount, auto-save on changes.
 * Handles open files, panel layout, sidebar state, and terminals.
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { useSession, useSaveSession } from 'renderer/hooks/use-sessions'
import { useAppStore } from 'renderer/stores/app-store'
import { useSidebarStore } from 'renderer/stores/sidebar-store'
import { useEditorStore } from 'renderer/stores/editor-store'
import { useTerminalStore } from 'renderer/stores/terminal-store'
import type { SessionState, Project } from 'shared/models'
import type { GroupImperativeHandle } from 'renderer/components/ui/resizable'

interface UseWorkspaceSessionOptions {
  projectId: string
  project: Project | null | undefined
  projectLoading: boolean
  panelGroupRef: React.RefObject<GroupImperativeHandle | null>
  centerPanelGroupRef?: React.RefObject<GroupImperativeHandle | null>
}

interface UseWorkspaceSessionReturn {
  isRestoring: boolean
  isReady: boolean
  lastLayoutRef: React.RefObject<{ [panelId: string]: number } | null>
  lastCenterLayoutRef: React.RefObject<{ [panelId: string]: number } | null>
  lastExpandedSizesRef: React.RefObject<{ left: number; right: number }>
  restoredLayout: { [panelId: string]: number } | undefined
  restoredCenterLayout: { [panelId: string]: number } | undefined
  scheduleSave: () => void
  saveNow: () => void
}

export function useWorkspaceSession({
  projectId,
  project,
  projectLoading,
  panelGroupRef,
  centerPanelGroupRef,
}: UseWorkspaceSessionOptions): UseWorkspaceSessionReturn {
  const { data: session, isLoading: sessionLoading } = useSession(projectId)
  const { mutate: saveSession } = useSaveSession()

  // Restoration state
  const [isReady, setIsReady] = useState(false)
  const [restoredLayout, setRestoredLayout] = useState<
    { [panelId: string]: number } | undefined
  >(undefined)
  const [restoredCenterLayout, setRestoredCenterLayout] = useState<
    { [panelId: string]: number } | undefined
  >(undefined)
  const isRestoredRef = useRef(false)
  const isRestoringRef = useRef(true)
  const saveTimerRef = useRef<number | null>(null)

  // Layout tracking
  const lastLayoutRef = useRef<{ [panelId: string]: number } | null>(null)
  const lastCenterLayoutRef = useRef<{ [panelId: string]: number } | null>(null)
  const lastExpandedSizesRef = useRef({ left: 15, right: 15 })

  // Build current session state - stable callback
  const buildSessionState = useCallback((): SessionState => {
    const terminals = useTerminalStore
      .getState()
      .getTerminalsByProject(projectId)
    const appState = useAppStore.getState()
    const sidebarState = useSidebarStore.getState()
    const editorState = useEditorStore.getState()
    // Prefer lastLayoutRef (updated by onLayoutChange) over panelGroupRef.getLayout()
    // because getLayout() may not reflect the latest resize
    const layout =
      lastLayoutRef.current ?? panelGroupRef.current?.getLayout() ?? undefined
    const centerLayout =
      lastCenterLayoutRef.current ??
      centerPanelGroupRef?.current?.getLayout() ??
      undefined

    const openDiffFiles = editorState.openFiles
      .filter(f => f.isDiff)
      .map(f => ({
        filePath: f.path.replace(/^diff:\/\//, '').replace(/\?staged$/, ''),
        staged: f.path.includes('?staged'),
      }))

    return {
      terminals: terminals.map(t => ({
        id: t.id,
        cwd: t.cwd,
        isPinned: t.isPinned,
        layout: { projectId, panes: [] },
      })),
      agentConversation: [],
      contextFiles: [],
      activeTerminalId: appState.activeTerminalId,
      workspace: {
        panelLayout: layout,
        centerPanelLayout: centerLayout,
        expandedPanelSizes: { ...lastExpandedSizesRef.current },
        sidebarCollapsed: appState.sidebarCollapsed,
        devToolsPanelCollapsed: appState.devToolsPanelCollapsed,
        zenMode: appState.zenMode,
        previousSidebarState: appState.previousSidebarState,
        previousDevToolsPanelState: appState.previousDevToolsPanelState,
        activeSidebarTab: sidebarState.activeTab,
        openFilePaths: editorState.openFiles
          .filter(f => !f.isDiff)
          .map(f => f.path),
        activeFilePath: editorState.activeFilePath,
        expandedFolderPaths: Array.from(sidebarState.expandedFolderPaths),
        openDiffFiles,
      },
    }
  }, [projectId, panelGroupRef, centerPanelGroupRef])

  // Immediate save - stable callback
  const saveNow = useCallback(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    saveSession({ projectId, state: buildSessionState() })
  }, [projectId, saveSession, buildSessionState])

  // Debounced save - stable callback that checks refs internally
  const scheduleSave = useCallback(() => {
    // Check restoration state via ref to avoid stale closures
    if (isRestoringRef.current) return

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      if (!isRestoringRef.current) {
        saveSession({ projectId, state: buildSessionState() })
      }
    }, 500)
  }, [projectId, saveSession, buildSessionState])

  // Restore session once data is ready
  useEffect(() => {
    // Wait for all data to be loaded before restoring
    if (isRestoredRef.current || sessionLoading || projectLoading || !project)
      return

    isRestoredRef.current = true
    isRestoringRef.current = true

    const restoreSession = async () => {
      const hydrateWorkspaceState = useAppStore.getState().hydrateWorkspaceState
      const editorStore = useEditorStore.getState()

      // Reset stores first - use session data if available
      const activeSidebarTab =
        (session?.workspace?.activeSidebarTab as
          | 'files'
          | 'git'
          | 'scripts'
          | 'commands') ?? 'files'
      const expandedFolderPaths = session?.workspace?.expandedFolderPaths ?? []

      useSidebarStore
        .getState()
        .hydrateSidebarState(activeSidebarTab, expandedFolderPaths)
      editorStore.closeAllFiles()

      // Restore workspace UI state
      if (session?.workspace) {
        hydrateWorkspaceState({
          sidebarCollapsed: session.workspace.sidebarCollapsed ?? false,
          devToolsPanelCollapsed:
            session.workspace.devToolsPanelCollapsed ?? false,
          zenMode: session.workspace.zenMode ?? false,
          previousSidebarState: session.workspace.previousSidebarState ?? false,
          previousDevToolsPanelState:
            session.workspace.previousDevToolsPanelState ?? false,
        })

        // Restore expanded panel sizes for collapsed panels
        if (session.workspace.expandedPanelSizes) {
          const { left, right } = session.workspace.expandedPanelSizes
          if (typeof left === 'number' && left > 0) {
            lastExpandedSizesRef.current.left = left
          }
          if (typeof right === 'number' && right > 0) {
            lastExpandedSizesRef.current.right = right
          }
        }

        // Restore open files sequentially
        const { openFilePaths, openDiffFiles, activeFilePath } =
          session.workspace

        if (openFilePaths?.length) {
          for (const filePath of openFilePaths) {
            try {
              await editorStore.openFile(filePath)
            } catch (err) {
              console.warn('Failed to restore file:', filePath, err)
            }
          }
        }

        if (openDiffFiles?.length) {
          for (const diffFile of openDiffFiles) {
            try {
              await editorStore.openDiff(
                project.path,
                diffFile.filePath,
                diffFile.staged
              )
            } catch (err) {
              console.warn('Failed to restore diff:', diffFile.filePath, err)
            }
          }
        }

        if (activeFilePath) {
          editorStore.setActiveFile(activeFilePath)
        }

        // Restore panel layout
        if (session.workspace.panelLayout) {
          const layout = session.workspace.panelLayout
          const expectedIds = [
            'project-workspace-left',
            'project-workspace-center',
            'project-workspace-right',
          ]

          if (expectedIds.some(id => id in layout)) {
            // Use the layout as-is since react-resizable-panels handles validation
            // Just ensure all expected panel IDs are present
            const clampedLayout = { ...layout }

            lastLayoutRef.current = clampedLayout

            // Only update expanded sizes from layout if panels were actually expanded
            // Otherwise keep the values from expandedPanelSizes (restored earlier)
            const leftSize = layout['project-workspace-left']
            const rightSize = layout['project-workspace-right']
            if (typeof leftSize === 'number' && leftSize > 0) {
              lastExpandedSizesRef.current.left = leftSize
            }
            if (typeof rightSize === 'number' && rightSize > 0) {
              lastExpandedSizesRef.current.right = rightSize
            }

            // Set the restored layout to be used as defaultLayout
            setRestoredLayout(clampedLayout)
          }
        }

        // Restore center panel layout (editor/terminal split)
        if (session.workspace.centerPanelLayout) {
          const centerLayout = session.workspace.centerPanelLayout
          const expectedCenterIds = ['center-editor', 'center-terminal']

          if (expectedCenterIds.some(id => id in centerLayout)) {
            lastCenterLayoutRef.current = { ...centerLayout }
            setRestoredCenterLayout({ ...centerLayout })
          }
        }
      }

      // Mark ready after restoration
      isRestoringRef.current = false
      setIsReady(true)
    }

    restoreSession()
  }, [session, sessionLoading, projectLoading, project, panelGroupRef])

  // Subscribe to store changes for auto-save
  useEffect(() => {
    if (!isReady) return

    const unsubscribeSidebar = useSidebarStore.subscribe(scheduleSave)
    const unsubscribeEditor = useEditorStore.subscribe(scheduleSave)
    const unsubscribeApp = useAppStore.subscribe(scheduleSave)

    return () => {
      unsubscribeSidebar()
      unsubscribeEditor()
      unsubscribeApp()
    }
  }, [scheduleSave, isReady])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  return {
    isRestoring: !isReady,
    isReady,
    lastLayoutRef,
    lastCenterLayoutRef,
    lastExpandedSizesRef,
    restoredLayout,
    restoredCenterLayout,
    scheduleSave,
    saveNow,
  }
}
