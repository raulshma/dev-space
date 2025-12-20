/**
 * TerminalPanes Component
 *
 * Manages terminal pane layout with horizontal and vertical splits.
 * Handles pane resizing with drag handles.
 *
 * Requirements: 9.2
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { TerminalView } from './TerminalView'
import {
  useTerminalStore,
  useTerminalsByProject,
  useTerminal,
  useTerminalLayout,
} from 'renderer/stores/terminal-store'
import type { TerminalPane, ErrorContext } from 'shared/models'

interface TerminalPanesProps {
  projectId: string
  onErrorContext?: (context: ErrorContext) => void
}

interface PaneLayoutProps {
  pane: TerminalPane
  onSplit?: (terminalId: string, direction: 'horizontal' | 'vertical') => void
  onErrorContext?: (context: ErrorContext) => void
}

function PaneLayout({
  pane,
  onSplit,
  onErrorContext,
}: PaneLayoutProps): React.JSX.Element {
  const [size, setSize] = useState(pane.size)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number; size: number } | null>(
    null
  )

  const terminal = useTerminal(pane.terminalId)
  const updateTerminal = useTerminalStore(state => state.updateTerminal)

  const handleTitleChange = useCallback(
    (title: string) => {
      if (terminal) {
        updateTerminal(terminal.id, { title })
      }
    },
    [terminal?.id, updateTerminal]
  )

  const handleMouseDown = (e: React.MouseEvent): void => {
    e.preventDefault()
    setIsDragging(true)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      size,
    }
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent): void => {
      if (!dragStartRef.current) return

      const isHorizontal = pane.direction === 'horizontal'
      const delta = isHorizontal
        ? e.clientX - dragStartRef.current.x
        : e.clientY - dragStartRef.current.y

      const containerSize = isHorizontal
        ? window.innerWidth
        : window.innerHeight
      const deltaPercent = (delta / containerSize) * 100

      const newSize = Math.max(
        10,
        Math.min(90, dragStartRef.current.size + deltaPercent)
      )
      setSize(newSize)
    }

    const handleMouseUp = (): void => {
      setIsDragging(false)
      dragStartRef.current = null
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, pane.direction])

  // If this pane has children, render split layout
  if (pane.children && pane.children.length > 0) {
    const isHorizontal = pane.direction === 'horizontal'

    return (
      <div
        className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} w-full h-full`}
        style={{ gap: '4px' }}
      >
        {pane.children.map((childPane, index) => (
          <div
            key={childPane.terminalId}
            style={{
              [isHorizontal ? 'width' : 'height']: `${childPane.size}%`,
              position: 'relative',
            }}
          >
            <PaneLayout
              onErrorContext={onErrorContext}
              onSplit={onSplit}
              pane={childPane}
            />
            {pane.children && index < pane.children.length - 1 && (
              <div
                aria-label="Resize pane"
                aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
                aria-valuemax={90}
                aria-valuemin={10}
                aria-valuenow={size}
                className={`
                  absolute bg-neutral-300 hover:bg-amber-500 transition-colors cursor-${
                    isHorizontal ? 'col' : 'row'
                  }-resize
                  ${isHorizontal ? 'right-0 top-0 w-1 h-full' : 'bottom-0 left-0 h-1 w-full'}
                `}
                onKeyDown={e => {
                  // Allow keyboard resizing with arrow keys
                  if (
                    e.key === 'ArrowLeft' ||
                    e.key === 'ArrowRight' ||
                    e.key === 'ArrowUp' ||
                    e.key === 'ArrowDown'
                  ) {
                    e.preventDefault()
                  }
                }}
                onMouseDown={handleMouseDown}
                role="separator"
                tabIndex={0}
              />
            )}
          </div>
        ))}
      </div>
    )
  }

  // Leaf pane - render terminal (terminal may not be ready yet during creation)
  if (!terminal) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-neutral-900 text-neutral-400">
        <div className="animate-pulse">Loading terminal...</div>
      </div>
    )
  }



  return (
    <div className="relative w-full h-full group">
      <TerminalView
        onErrorContext={onErrorContext}
        onTitleChange={handleTitleChange}
        ptyId={terminal.ptyId}
        terminalId={terminal.id}
      />

      {/* Split controls - shown on hover */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-20">
        <button
          className="px-2 py-1 bg-neutral-800 text-neutral-200 text-xs rounded hover:bg-neutral-700"
          onClick={() => onSplit?.(terminal.id, 'horizontal')}
          title="Split horizontally"
        >
          ⬌
        </button>
        <button
          className="px-2 py-1 bg-neutral-800 text-neutral-200 text-xs rounded hover:bg-neutral-700"
          onClick={() => onSplit?.(terminal.id, 'vertical')}
          title="Split vertically"
        >
          ⬍
        </button>
      </div>
    </div>
  )
}

export function TerminalPanes({
  projectId,
  onErrorContext,
}: TerminalPanesProps): React.JSX.Element {
  const terminals = useTerminalsByProject(projectId)
  const focusedTerminalId = useTerminalStore(state => state.focusedTerminalId)
  const layout = useTerminalLayout(projectId)
  const setLayout = useTerminalStore(state => state.setLayout)
  const addTerminal = useTerminalStore(state => state.addTerminal)

  // Compute effective layout synchronously to prevent flash
  // This avoids the render -> effect -> re-render cycle
  const effectiveLayout = (() => {
    if (terminals.length === 0) {
      return { projectId, panes: [] }
    }

    if (!layout || layout.panes.length === 0) {
      // Create initial layout synchronously
      const initialLayout: TerminalPane = {
        terminalId: terminals[0].id,
        direction: null,
        size: 100,
      }
      return { projectId, panes: [initialLayout] }
    }

    // Check if layout references terminals that no longer exist
    const terminalIds = new Set(terminals.map(t => t.id))
    const cleanupPane = (pane: TerminalPane): TerminalPane | null => {
      if (pane.children && pane.children.length > 0) {
        const cleanedChildren = pane.children
          .map(cleanupPane)
          .filter((p): p is TerminalPane => p !== null)

        if (cleanedChildren.length === 0) {
          return null
        }
        if (cleanedChildren.length === 1) {
          return { ...cleanedChildren[0], size: pane.size }
        }
        return { ...pane, children: cleanedChildren }
      }

      // Leaf pane - check if terminal exists
      if (!terminalIds.has(pane.terminalId)) {
        return null
      }
      return pane
    }

    const cleanedPanes = layout.panes
      .map(cleanupPane)
      .filter((p): p is TerminalPane => p !== null)

    if (cleanedPanes.length === 0 && terminals.length > 0) {
      // All panes were removed but we have terminals - recreate layout
      const initialLayout: TerminalPane = {
        terminalId: terminals[0].id,
        direction: null,
        size: 100,
      }
      return { projectId, panes: [initialLayout] }
    }

    return { projectId, panes: cleanedPanes }
  })()

  // Sync computed layout to store (for persistence and splits)
  useEffect(() => {
    const currentLayout = useTerminalStore.getState().getLayout(projectId)
    if (
      JSON.stringify(currentLayout?.panes) !==
      JSON.stringify(effectiveLayout.panes)
    ) {
      setLayout(projectId, effectiveLayout)
    }
  }, [effectiveLayout, projectId, setLayout])

  const handleSplit = async (
    terminalId: string,
    direction: 'horizontal' | 'vertical'
  ): Promise<void> => {
    try {
      // Get the terminal being split
      const terminal = terminals.find(t => t.id === terminalId)
      if (!terminal) return

      // Create new PTY
      const response = await window.api.pty.create({
        projectId,
        cwd: terminal.cwd,
        shell: undefined,
      })

      // Create new terminal instance
      const newTerminalId = `term-${Date.now()}`
      addTerminal({
        id: newTerminalId,
        projectId,
        ptyId: response.ptyId,
        isPinned: false,
        title: 'Terminal',
        cwd: terminal.cwd,
      })

      // Update layout to include split
      if (effectiveLayout.panes.length > 0) {
        const updatePaneWithSplit = (pane: TerminalPane): TerminalPane => {
          if (pane.terminalId === terminalId) {
            // Convert this pane to a container with two children
            return {
              terminalId: pane.terminalId,
              direction,
              size: pane.size,
              children: [
                {
                  terminalId: pane.terminalId,
                  direction: null,
                  size: 50,
                },
                {
                  terminalId: newTerminalId,
                  direction: null,
                  size: 50,
                },
              ],
            }
          }

          if (pane.children) {
            return {
              ...pane,
              children: pane.children.map(updatePaneWithSplit),
            }
          }

          return pane
        }

        const updatedLayout = {
          ...effectiveLayout,
          panes: effectiveLayout.panes.map(updatePaneWithSplit),
        }

        setLayout(projectId, updatedLayout)
      }
    } catch (error) {
      console.error('Failed to split terminal:', error)
    }
  }

  // Get the focused terminal or first terminal
  const activeTerminal =
    terminals.find(t => t.id === focusedTerminalId) || terminals[0]

  if (!activeTerminal) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-neutral-900 text-neutral-400">
        No terminals available
      </div>
    )
  }

  // If no panes in effective layout, show single terminal
  if (effectiveLayout.panes.length === 0) {
    return (
      <div className="w-full h-full">
        <TerminalView
          onErrorContext={onErrorContext}
          ptyId={activeTerminal.ptyId}
          terminalId={activeTerminal.id}
        />
      </div>
    )
  }

  return (
    <div className="w-full h-full bg-neutral-900">
      {effectiveLayout.panes.map(pane => (
        <PaneLayout
          key={pane.terminalId}
          onErrorContext={onErrorContext}
          onSplit={handleSplit}
          pane={pane}
        />
      ))}
    </div>
  )
}
