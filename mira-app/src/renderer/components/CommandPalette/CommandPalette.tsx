/**
 * Command Palette Component
 *
 * A unified search overlay for quick navigation and actions.
 * Requirements: 13.1, 13.2, 13.3, 13.4
 */

import { useEffect, useState, useMemo } from 'react'
import { IconFolder, IconTerminal, IconBolt } from '@tabler/icons-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from 'renderer/components/ui/command'
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

export function CommandPalette(): React.JSX.Element {
  const isOpen = useAppStore(state => state.commandPaletteOpen)
  const closeCommandPalette = useAppStore(state => state.closeCommandPalette)
  const setActiveProject = useAppStore(state => state.setActiveProject)
  const toggleZenMode = useAppStore(state => state.toggleZenMode)
  const toggleSidebar = useAppStore(state => state.toggleSidebar)
  const openSettingsPanel = useAppStore(state => state.openSettingsPanel)

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
        icon: IconBolt,
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
        icon: IconBolt,
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
        icon: IconBolt,
        action: () => {
          openSettingsPanel()
          closeCommandPalette()
        },
      },
    ],
    [toggleZenMode, toggleSidebar, openSettingsPanel, closeCommandPalette]
  )

  // Project results
  const projectResults = useMemo(
    () =>
      projects.map(
        (project): SearchResult => ({
          id: `project-${project.id}`,
          type: 'project',
          title: project.name,
          subtitle: project.path,
          icon: IconFolder,
          action: () => {
            setActiveProject(project.id)
            closeCommandPalette()
          },
        })
      ),
    [projects, setActiveProject, closeCommandPalette]
  )

  // Command results
  const commandResults = useMemo(
    () =>
      commands.map(
        (command): SearchResult => ({
          id: `command-${command.id}`,
          type: 'command',
          title: command.name,
          subtitle: command.command,
          icon: IconTerminal,
          action: () => {
            // Command execution will be handled by terminal integration
            closeCommandPalette()
          },
        })
      ),
    [commands, closeCommandPalette]
  )

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        const openCommandPalette = useAppStore.getState().openCommandPalette
        openCommandPalette()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <CommandDialog onOpenChange={closeCommandPalette} open={isOpen}>
      <CommandInput placeholder="Search projects, commands, and actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Projects Group */}
        {projectResults.length > 0 && (
          <CommandGroup heading="Projects">
            {projectResults.map(result => {
              const Icon = result.icon
              return (
                <CommandItem
                  key={result.id}
                  onSelect={() => result.action()}
                  value={`${result.title} ${result.subtitle}`}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span>{result.title}</span>
                    {result.subtitle && (
                      <span className="text-xs text-muted-foreground">
                        {result.subtitle}
                      </span>
                    )}
                  </div>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}

        {/* Commands Group */}
        {commandResults.length > 0 && (
          <CommandGroup heading="Commands">
            {commandResults.map(result => {
              const Icon = result.icon
              return (
                <CommandItem
                  key={result.id}
                  onSelect={() => result.action()}
                  value={`${result.title} ${result.subtitle}`}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span>{result.title}</span>
                    {result.subtitle && (
                      <span className="text-xs text-muted-foreground">
                        {result.subtitle}
                      </span>
                    )}
                  </div>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}

        {/* Actions Group */}
        {actions.length > 0 && (
          <CommandGroup heading="Actions">
            {actions.map(result => {
              const Icon = result.icon
              return (
                <CommandItem
                  key={result.id}
                  onSelect={() => result.action()}
                  value={`${result.title} ${result.subtitle || ''}`}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span>{result.title}</span>
                    {result.subtitle && (
                      <span className="text-xs text-muted-foreground">
                        {result.subtitle}
                      </span>
                    )}
                  </div>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
