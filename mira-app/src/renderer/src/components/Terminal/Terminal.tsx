/**
 * Terminal Component
 *
 * Main terminal component that combines tabs, panes, and terminal views.
 * Requirements: 9.1, 9.2, 9.3
 */

import { TerminalTabs } from './TerminalTabs'
import { TerminalPanes } from './TerminalPanes'
import { useTerminalStore } from 'renderer/stores/terminal-store'
import type { ErrorContext } from 'shared/models'

interface TerminalProps {
  projectId: string
  projectPath: string
  onErrorContext?: (context: ErrorContext) => void
}

export function Terminal({
  projectId,
  projectPath,
  onErrorContext,
}: TerminalProps): React.JSX.Element {
  const terminals = useTerminalStore(state =>
    state.getTerminalsByProject(projectId)
  )
  const addTerminal = useTerminalStore(state => state.addTerminal)

  const handleCreateTerminal = async (): Promise<void> => {
    try {
      const response = await window.api.pty.create({
        projectId,
        cwd: projectPath,
        shell: undefined,
      })

      const terminalId = `term-${Date.now()}`
      addTerminal({
        id: terminalId,
        projectId,
        ptyId: response.ptyId,
        isPinned: false,
        title: 'Terminal',
        cwd: projectPath,
      })
    } catch (error) {
      console.error('Failed to create terminal:', error)
    }
  }

  return (
    <div className="flex flex-col h-full bg-neutral-900">
      {/* Terminal tabs */}
      <TerminalTabs
        onCreateTerminal={handleCreateTerminal}
        projectId={projectId}
      />

      {/* Terminal panes */}
      <div className="flex-1 overflow-hidden">
        {terminals.length > 0 ? (
          <TerminalPanes
            onErrorContext={onErrorContext}
            projectId={projectId}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-neutral-400">
            <p className="mb-4">No terminals open</p>
            <button
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-sm transition-colors"
              onClick={handleCreateTerminal}
            >
              Create Terminal
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
