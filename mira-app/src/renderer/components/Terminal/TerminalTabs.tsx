/**
 * TerminalTabs Component
 *
 * Tab bar for managing multiple terminal instances.
 * Handles tab switching, keyboard navigation, and add/close actions.
 *
 * Requirements: 9.1, 9.3
 */

import { useEffect } from 'react'
import { X, Plus, Pin, PinOff } from 'lucide-react'
import {
  useTerminalStore,
  useTerminalsByProject,
} from 'renderer/stores/terminal-store'
import { Button } from 'renderer/components/ui/button'
import { Kbd } from 'renderer/components/ui/kbd'
import type { TerminalInstance } from 'renderer/stores/terminal-store'

interface TerminalTabsProps {
  projectId: string
  onCreateTerminal: () => void
}

export function TerminalTabs({
  projectId,
  onCreateTerminal,
}: TerminalTabsProps): React.JSX.Element {
  const terminals = useTerminalsByProject(projectId)
  const focusedTerminalId = useTerminalStore(state => state.focusedTerminalId)
  const focusTerminal = useTerminalStore(state => state.focusTerminal)
  const removeTerminal = useTerminalStore(state => state.removeTerminal)
  const pinTerminal = useTerminalStore(state => state.pinTerminal)
  const unpinTerminal = useTerminalStore(state => state.unpinTerminal)

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault()
        onCreateTerminal()
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'w' && focusedTerminalId) {
        e.preventDefault()
        handleCloseTerminal(focusedTerminalId)
        return
      }

      if ((e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key)) {
        e.preventDefault()
        const index = parseInt(e.key, 10) - 1
        if (index < terminals.length) {
          focusTerminal(terminals[index].id)
        }
        return
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === '[' || e.key === ']')) {
        e.preventDefault()
        const currentIndex = terminals.findIndex(
          t => t.id === focusedTerminalId
        )
        if (currentIndex === -1) return

        const nextIndex = e.key === '[' ? currentIndex - 1 : currentIndex + 1
        if (nextIndex >= 0 && nextIndex < terminals.length) {
          focusTerminal(terminals[nextIndex].id)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [terminals, focusedTerminalId, onCreateTerminal, focusTerminal])

  const handleCloseTerminal = (terminalId: string): void => {
    const terminal = terminals.find(t => t.id === terminalId)
    if (!terminal) return

    window.api.pty.kill({ ptyId: terminal.ptyId }).catch(error => {
      console.error('Failed to kill PTY:', error)
    })

    removeTerminal(terminalId)

    if (focusedTerminalId === terminalId && terminals.length > 1) {
      const remainingTerminals = terminals.filter(t => t.id !== terminalId)
      if (remainingTerminals.length > 0) {
        focusTerminal(remainingTerminals[0].id)
      }
    }
  }

  const handleTabClick = (terminalId: string): void => {
    focusTerminal(terminalId)
  }

  const handleTogglePin = async (terminal: TerminalInstance): Promise<void> => {
    try {
      if (terminal.isPinned) {
        await window.api.pty.unpin({ ptyId: terminal.ptyId })
        unpinTerminal(terminal.id)
      } else {
        await window.api.pty.pin({ ptyId: terminal.ptyId })
        pinTerminal(terminal.id)
      }
    } catch (error) {
      console.error('Failed to toggle pin:', error)
    }
  }

  return (
    <div className="flex items-center gap-1 bg-muted border-b px-2 py-1">
      {/* Terminal tabs */}
      {terminals.map((terminal: TerminalInstance, index: number) => (
        <div
          aria-selected={focusedTerminalId === terminal.id}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-sm cursor-pointer
            transition-colors text-sm relative
            ${
              focusedTerminalId === terminal.id
                ? 'bg-background text-foreground shadow-sm'
                : 'bg-transparent text-muted-foreground hover:bg-accent'
            }
            ${terminal.isPinned ? 'border border-primary/30' : ''}
          `}
          key={terminal.id}
          onClick={() => handleTabClick(terminal.id)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleTabClick(terminal.id)
            }
          }}
          role="tab"
          tabIndex={0}
        >
          <span className="text-xs text-muted-foreground">{index + 1}</span>
          <span className="max-w-[120px] truncate">{terminal.title}</span>

          {/* Pin/Unpin button */}
          <Button
            aria-label={terminal.isPinned ? 'Unpin terminal' : 'Pin terminal'}
            className={
              terminal.isPinned ? 'text-primary' : 'text-muted-foreground'
            }
            onClick={e => {
              e.stopPropagation()
              handleTogglePin(terminal)
            }}
            size="icon-xs"
            title={
              terminal.isPinned
                ? 'Unpin (will close when leaving project)'
                : 'Pin (keeps running when leaving project)'
            }
            variant="ghost"
          >
            {terminal.isPinned ? (
              <Pin className="h-3 w-3" fill="currentColor" />
            ) : (
              <PinOff className="h-3 w-3" />
            )}
          </Button>

          {/* Close button */}
          <Button
            aria-label="Close terminal"
            onClick={e => {
              e.stopPropagation()
              handleCloseTerminal(terminal.id)
            }}
            size="icon-xs"
            variant="ghost"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}

      {/* Add terminal button */}
      <Button
        aria-label="New terminal"
        onClick={onCreateTerminal}
        size="sm"
        variant="ghost"
      >
        <Plus className="h-4 w-4" />
      </Button>

      {/* Keyboard shortcuts hint */}
      <div className="ml-auto hidden md:flex items-center gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Kbd>⌘T</Kbd> New
        </span>
        <span className="flex items-center gap-1">
          <Kbd>⌘W</Kbd> Close
        </span>
        <span className="flex items-center gap-1">
          <Kbd>⌘1-9</Kbd> Switch
        </span>
      </div>
    </div>
  )
}
