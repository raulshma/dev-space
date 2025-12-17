import { useState } from 'react'
import { useCommands, useCreateCommand } from 'renderer/hooks/use-commands'
import { useTerminalStore } from 'renderer/stores/terminal-store'
import type { Command } from 'shared/models'

/**
 * CommandLibrary Component
 *
 * Displays categorized command list and implements command injection on click.
 * Allows users to quickly execute common commands without typing.
 * Includes form for creating custom commands.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */

interface CommandLibraryProps {
  projectId: string
}

export function CommandLibrary({ projectId }: CommandLibraryProps) {
  const { data: commands, isLoading, error } = useCommands()
  const createCommand = useCreateCommand()
  const focusedTerminalId = useTerminalStore(state => state.focusedTerminalId)
  const getTerminal = useTerminalStore(state => state.getTerminal)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['all'])
  )
  const [showAddForm, setShowAddForm] = useState(false)
  const [newCommandName, setNewCommandName] = useState('')
  const [newCommandText, setNewCommandText] = useState('')
  const [newCommandCategory, setNewCommandCategory] = useState('')

  // Group commands by category
  const commandsByCategory = commands?.reduce(
    (acc, command) => {
      const category = command.category || 'Uncategorized'
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(command)
      return acc
    },
    {} as Record<string, Command[]>
  )

  const categories = commandsByCategory
    ? Object.keys(commandsByCategory).sort()
    : []

  const toggleCategory = (category: string): void => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const handleCommandClick = async (command: Command): Promise<void> => {
    // Get the focused terminal for this project
    const terminal = focusedTerminalId ? getTerminal(focusedTerminalId) : null

    if (!terminal || terminal.projectId !== projectId) {
      alert('Please focus a terminal first')
      return
    }

    try {
      // Write command to the terminal (without executing it)
      await window.api.pty.write({
        ptyId: terminal.ptyId,
        data: command.command,
      })
    } catch (error) {
      console.error('Failed to inject command:', error)
      alert('Failed to inject command. Please try again.')
    }
  }

  const handleAddCommand = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()

    if (!newCommandName.trim() || !newCommandText.trim()) {
      alert('Please provide both a name and command text')
      return
    }

    try {
      await createCommand.mutateAsync({
        name: newCommandName.trim(),
        command: newCommandText.trim(),
        category: newCommandCategory.trim() || undefined,
      })

      // Reset form
      setNewCommandName('')
      setNewCommandText('')
      setNewCommandCategory('')
      setShowAddForm(false)
    } catch (error) {
      console.error('Failed to create command:', error)
      alert('Failed to create command. Please try again.')
    }
  }

  const handleCancelAdd = (): void => {
    setNewCommandName('')
    setNewCommandText('')
    setNewCommandCategory('')
    setShowAddForm(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-amber-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-600">
        Failed to load commands. Please try again.
      </div>
    )
  }

  if (!commands || commands.length === 0) {
    return (
      <div className="p-4 text-sm text-neutral-500">
        No commands available. Add custom commands to get started.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
        <h3 className="text-sm font-semibold text-neutral-900">
          Command Library
        </h3>
        <button
          className="rounded-sm bg-amber-500 px-2 py-1 text-xs font-medium text-white hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
          onClick={() => setShowAddForm(!showAddForm)}
          title="Add custom command"
        >
          {showAddForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {/* Add command form */}
      {showAddForm && (
        <div className="border-b border-neutral-200 bg-neutral-50 p-3">
          <form className="flex flex-col gap-2" onSubmit={handleAddCommand}>
            <div>
              <label
                className="mb-1 block text-xs font-medium text-neutral-700"
                htmlFor="command-name"
              >
                Name
              </label>
              <input
                className="w-full rounded-sm border border-neutral-300 px-2 py-1 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                id="command-name"
                onChange={e => setNewCommandName(e.target.value)}
                placeholder="e.g., Install dependencies"
                type="text"
                value={newCommandName}
              />
            </div>

            <div>
              <label
                className="mb-1 block text-xs font-medium text-neutral-700"
                htmlFor="command-text"
              >
                Command
              </label>
              <input
                className="w-full rounded-sm border border-neutral-300 px-2 py-1 font-mono text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                id="command-text"
                onChange={e => setNewCommandText(e.target.value)}
                placeholder="e.g., npm install"
                type="text"
                value={newCommandText}
              />
            </div>

            <div>
              <label
                className="mb-1 block text-xs font-medium text-neutral-700"
                htmlFor="command-category"
              >
                Category (optional)
              </label>
              <input
                className="w-full rounded-sm border border-neutral-300 px-2 py-1 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                id="command-category"
                onChange={e => setNewCommandCategory(e.target.value)}
                placeholder="e.g., Package Management"
                type="text"
                value={newCommandCategory}
              />
            </div>

            <div className="flex gap-2">
              <button
                className="flex-1 rounded-sm bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
                disabled={createCommand.isPending}
                type="submit"
              >
                {createCommand.isPending ? 'Adding...' : 'Add Command'}
              </button>
              <button
                className="rounded-sm border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-500"
                onClick={handleCancelAdd}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {categories.map(category => {
          const isExpanded = expandedCategories.has(category)
          const categoryCommands = commandsByCategory?.[category]

          return (
            <div className="border-b border-neutral-100" key={category}>
              {/* Category header */}
              <button
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                onClick={() => toggleCategory(category)}
              >
                <span>{category}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500">
                    {categoryCommands.length}
                  </span>
                  <svg
                    className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M9 5l7 7-7 7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                </div>
              </button>

              {/* Command list */}
              {isExpanded && (
                <div className="bg-neutral-50/50">
                  {categoryCommands.map(command => (
                    <button
                      className="flex w-full flex-col items-start gap-1 px-4 py-2 text-left text-sm hover:bg-amber-50 focus:bg-amber-50 focus:outline-none"
                      key={command.id}
                      onClick={() => handleCommandClick(command)}
                      title={`Click to inject: ${command.command}`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="font-medium text-neutral-900">
                          {command.name}
                        </span>
                        {command.isCustom && (
                          <span className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                            Custom
                          </span>
                        )}
                      </div>
                      <code className="text-xs text-neutral-600">
                        {command.command}
                      </code>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
