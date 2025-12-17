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
import { useTerminalStore } from '../../stores/terminal-store'
import type { TerminalInstance } from '../../stores/terminal-store'

interface TerminalTabsProps {
  projectId: string
  onCreateTerminal: () => void
}

export function TerminalTabs({ projectId, onCreateTerminal }: TerminalTabsProps): React.JSX.Element {
  const terminals = useTerminalStore((state) => state.getTerminalsByProject(projectId))
  const focusedTerminalId = useTerminalStore((state) => state.focusedTerminalId)
  const focusTerminal = useTerminalStore((state) => state.focusTerminal)
  const removeTerminal = useTerminalStore((state) => state.removeTerminal)
  const pinTerminal = useTerminalStore((state) => state.pinTerminal)
  const unpinTerminal = useTerminalStore((state) => state.unpinTerminal)

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Cmd/Ctrl + T: New terminal
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault()
        onCreateTerminal()
        return
      }

      // Cmd/Ctrl + W: Close current terminal
      if ((e.metaKey || e.ctrlKey) && e.key === 'w' && focusedTerminalId) {
        e.preventDefault()
        handleCloseTerminal(focusedTerminalId)
        return
      }

      // Cmd/Ctrl + [1-9]: Switch to terminal by index
      if ((e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key)) {
        e.preventDefault()
        const index = parseInt(e.key) - 1
        if (index < terminals.length) {
          focusTerminal(terminals[index].id)
        }
        return
      }

      // Cmd/Ctrl + [ or ]: Navigate between terminals
      if ((e.metaKey || e.ctrlKey) && (e.key === '[' || e.key === ']')) {
        e.preventDefault()
        const currentIndex = terminals.findIndex((t) => t.id === focusedTerminalId)
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
    const terminal = terminals.find((t) => t.id === terminalId)
    if (!terminal) return

    // Kill PTY
    window.api.pty.kill({ ptyId: terminal.ptyId }).catch((error) => {
      console.error('Failed to kill PTY:', error)
    })

    // Remove from store
    removeTerminal(terminalId)

    // Focus another terminal if this was focused
    if (focusedTerminalId === terminalId && terminals.length > 1) {
      const remainingTerminals = terminals.filter((t) => t.id !== terminalId)
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
    <div className="flex items-center gap-1 bg-neutral-100 border-b border-neutral-200 px-2 py-1">
      {/* Terminal tabs */}
      {terminals.map((terminal: TerminalInstance, index: number) => (
        <div
          key={terminal.id}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-sm cursor-pointer
            transition-colors text-sm relative
            ${
              focusedTerminalId === terminal.id
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'bg-transparent text-neutral-600 hover:bg-neutral-200'
            }
            ${terminal.isPinned ? 'border border-amber-500/30' : ''}
          `}
          onClick={() => handleTabClick(terminal.id)}
        >
          <span className="text-xs text-neutral-400">{index + 1}</span>
          <span className="max-w-[120px] truncate">{terminal.title}</span>

          {/* Pin/Unpin button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleTogglePin(terminal)
            }}
            className={`p-0.5 rounded hover:bg-neutral-300 transition-colors ${
              terminal.isPinned ? 'text-amber-600' : 'text-neutral-400'
            }`}
            aria-label={terminal.isPinned ? 'Unpin terminal' : 'Pin terminal'}
            title={
              terminal.isPinned
                ? 'Unpin (will close when leaving project)'
                : 'Pin (keeps running when leaving project)'
            }
          >
            {terminal.isPinned ? <Pin size={14} fill="currentColor" /> : <PinOff size={14} />}
          </button>

          {/* Close button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleCloseTerminal(terminal.id)
            }}
            className="p-0.5 rounded hover:bg-neutral-300 transition-colors"
            aria-label="Close terminal"
          >
            <X size={14} />
          </button>
        </div>
      ))}

      {/* Add terminal button */}
      <button
        onClick={onCreateTerminal}
        className="flex items-center gap-1 px-2 py-1.5 rounded-sm text-sm
                   text-neutral-600 hover:bg-neutral-200 transition-colors"
        aria-label="New terminal"
      >
        <Plus size={16} />
      </button>

      {/* Keyboard shortcuts hint */}
      <div className="ml-auto text-xs text-neutral-400 hidden md:block">
        <span className="mr-3">⌘T New</span>
        <span className="mr-3">⌘W Close</span>
        <span>⌘1-9 Switch</span>
      </div>
    </div>
  )
}
