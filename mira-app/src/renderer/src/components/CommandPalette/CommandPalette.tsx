/**
 * Command Palette Component
 *
 * A unified search overlay for quick navigation and actions.
 * Requirements: 13.1, 13.2, 13.3, 13.4
 */

import { useEffect, useRef, useState, useMemo } from 'react'
import { X, Folder, Terminal, Zap } from 'lucide-react'
import { useAppStore } from 'renderer/stores/app-store'
import { useProjects } from 'renderer/hooks/use-projects'
import { useCommands } from 'renderer/hooks/use-commands'

// Search result types
type SearchResultType = 'project' | 'command' | 'action'

interface SearchResult {
  id: string
  type: SearchResultType
  title: string
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  action: () => void
}

export function CommandPalette(): React.JSX.Element | null {
  const isOpen = useAppStore(state => state.commandPaletteOpen)
  const closeCommandPalette = useAppStore(state => state.closeCommandPalette)
  const setActiveProject = useAppStore(state => state.setActiveProject)
  const toggleZenMode = useAppStore(state => state.toggleZenMode)
  const toggleSidebar = useAppStore(state => state.toggleSidebar)
  const openSettingsPanel = useAppStore(state => state.openSettingsPanel)

  const inputRef = useRef<HTMLInputElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Fetch data
  const { data: projects = [] } = useProjects()
  const { data: commands = [] } = useCommands()

  // Define available actions
  const actions: SearchResult[] = useMemo(
    () => [
      {
        id: 'action-zen-mode',
        type: 'action',
        title: 'Toggle Zen Mode',
        subtitle: 'Hide/show sidebar and panels',
        icon: Zap,
        action: () => {
          toggleZenMode()
          closeCommandPalette()
        },
      },
      {
        id: 'action-toggle-sidebar',
        type: 'action',
        title: 'Toggle Sidebar',
        subtitle: 'Show/hide the sidebar',
        icon: Zap,
        action: () => {
          toggleSidebar()
          closeCommandPalette()
        },
      },
      {
        id: 'action-open-settings',
        type: 'action',
        title: 'Open Settings',
        subtitle: 'Configure keyboard shortcuts, blueprints, and API keys',
        icon: Zap,
        action: () => {
          openSettingsPanel()
          closeCommandPalette()
        },
      },
    ],
    [toggleZenMode, toggleSidebar, openSettingsPanel, closeCommandPalette]
  )

  // Search and filter results
  const searchResults = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()

    if (!query) {
      // Show all results when no query
      return [
        ...projects.slice(0, 5).map(
          (project): SearchResult => ({
            id: `project-${project.id}`,
            type: 'project',
            title: project.name,
            subtitle: project.path,
            icon: Folder,
            action: () => {
              setActiveProject(project.id)
              closeCommandPalette()
            },
          })
        ),
        ...commands.slice(0, 5).map(
          (command): SearchResult => ({
            id: `command-${command.id}`,
            type: 'command',
            title: command.name,
            subtitle: command.command,
            icon: Terminal,
            action: () => {
              // Command execution will be handled by terminal integration
              closeCommandPalette()
            },
          })
        ),
        ...actions,
      ]
    }

    // Filter projects
    const projectResults: SearchResult[] = projects
      .filter(
        project =>
          project.name.toLowerCase().includes(query) ||
          project.path.toLowerCase().includes(query)
      )
      .map(project => ({
        id: `project-${project.id}`,
        type: 'project',
        title: project.name,
        subtitle: project.path,
        icon: Folder,
        action: () => {
          setActiveProject(project.id)
          closeCommandPalette()
        },
      }))

    // Filter commands
    const commandResults: SearchResult[] = commands
      .filter(
        command =>
          command.name.toLowerCase().includes(query) ||
          command.command.toLowerCase().includes(query) ||
          command.category?.toLowerCase().includes(query)
      )
      .map(command => ({
        id: `command-${command.id}`,
        type: 'command',
        title: command.name,
        subtitle: command.command,
        icon: Terminal,
        action: () => {
          // Command execution will be handled by terminal integration
          closeCommandPalette()
        },
      }))

    // Filter actions
    const actionResults: SearchResult[] = actions.filter(
      action =>
        action.title.toLowerCase().includes(query) ||
        action.subtitle?.toLowerCase().includes(query)
    )

    return [...projectResults, ...commandResults, ...actionResults]
  }, [
    searchQuery,
    projects,
    commands,
    actions,
    setActiveProject,
    closeCommandPalette,
  ])

  // Group results by type
  const groupedResults = useMemo(() => {
    const groups: Record<SearchResultType, SearchResult[]> = {
      project: [],
      command: [],
      action: [],
    }

    searchResults.forEach(result => {
      groups[result.type].push(result)
    })

    return groups
  }, [searchResults])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        const openCommandPalette = useAppStore.getState().openCommandPalette
        openCommandPalette()
      }

      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        closeCommandPalette()
      }

      // Arrow navigation
      if (isOpen && searchResults.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedIndex(prev => (prev + 1) % searchResults.length)
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedIndex(
            prev => (prev - 1 + searchResults.length) % searchResults.length
          )
        } else if (e.key === 'Enter') {
          e.preventDefault()
          const selected = searchResults[selectedIndex]
          if (selected) {
            selected.action()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, closeCommandPalette, searchResults, selectedIndex])

  // Focus input when opened and reset state
  useEffect(() => {
    if (isOpen) {
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setSearchQuery('')
        setSelectedIndex(0)
      }, 0)
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }
  }, [isOpen])

  // Reset selected index when search query changes
  useEffect(() => {
    // Use setTimeout to avoid synchronous setState in effect
    setTimeout(() => {
      setSelectedIndex(0)
    }, 0)
  }, [searchQuery])

  // Handle overlay click to close
  const handleOverlayClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) {
      closeCommandPalette()
    }
  }

  if (!isOpen) return null

  return (
    <div
      aria-label="Command palette"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[20vh]"
      onClick={handleOverlayClick}
      onKeyDown={e => {
        if (e.key === 'Escape') closeCommandPalette()
      }}
      role="dialog"
    >
      <div className="w-full max-w-2xl rounded-md border border-neutral-700 bg-neutral-900 shadow-2xl">
        {/* Search Input */}
        <div className="flex items-center border-b border-neutral-700 px-4">
          <input
            className="flex-1 bg-transparent py-4 text-sm text-neutral-100 placeholder-neutral-500 outline-none"
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search projects, commands, and actions..."
            ref={inputRef}
            type="text"
            value={searchQuery}
          />
          <button
            aria-label="Close command palette"
            className="ml-2 rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            onClick={closeCommandPalette}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results Area */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {searchResults.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-neutral-500">
              {searchQuery ? 'No results found' : 'Type to search...'}
            </div>
          ) : (
            <div className="space-y-1">
              {/* Projects Section */}
              {groupedResults.project.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-xs font-medium text-neutral-400">
                    Projects
                  </div>
                  {groupedResults.project.map(result => {
                    const globalIndex = searchResults.indexOf(result)
                    return (
                      <ResultItem
                        isSelected={globalIndex === selectedIndex}
                        key={result.id}
                        onClick={() => result.action()}
                        result={result}
                      />
                    )
                  })}
                </div>
              )}

              {/* Commands Section */}
              {groupedResults.command.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-xs font-medium text-neutral-400">
                    Commands
                  </div>
                  {groupedResults.command.map(result => {
                    const globalIndex = searchResults.indexOf(result)
                    return (
                      <ResultItem
                        isSelected={globalIndex === selectedIndex}
                        key={result.id}
                        onClick={() => result.action()}
                        result={result}
                      />
                    )
                  })}
                </div>
              )}

              {/* Actions Section */}
              {groupedResults.action.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-xs font-medium text-neutral-400">
                    Actions
                  </div>
                  {groupedResults.action.map(result => {
                    const globalIndex = searchResults.indexOf(result)
                    return (
                      <ResultItem
                        isSelected={globalIndex === selectedIndex}
                        key={result.id}
                        onClick={() => result.action()}
                        result={result}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with keyboard hints */}
        <div className="border-t border-neutral-700 px-4 py-2 text-xs text-neutral-500">
          <span className="mr-4">
            <kbd className="rounded bg-neutral-800 px-1.5 py-0.5">↑↓</kbd>{' '}
            Navigate
          </span>
          <span className="mr-4">
            <kbd className="rounded bg-neutral-800 px-1.5 py-0.5">Enter</kbd>{' '}
            Select
          </span>
          <span>
            <kbd className="rounded bg-neutral-800 px-1.5 py-0.5">Esc</kbd>{' '}
            Close
          </span>
        </div>
      </div>
    </div>
  )
}

// Result Item Component
interface ResultItemProps {
  result: SearchResult
  isSelected: boolean
  onClick: () => void
}

function ResultItem({
  result,
  isSelected,
  onClick,
}: ResultItemProps): React.JSX.Element {
  const Icon = result.icon

  return (
    <button
      className={`flex w-full items-center gap-3 rounded px-3 py-2 text-left transition-colors ${
        isSelected
          ? 'bg-amber-600/20 text-amber-400'
          : 'text-neutral-300 hover:bg-neutral-800'
      }`}
      onClick={onClick}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{result.title}</div>
        {result.subtitle && (
          <div className="truncate text-xs text-neutral-500">
            {result.subtitle}
          </div>
        )}
      </div>
    </button>
  )
}
