import { useState } from 'react'
import { ChevronRight, Terminal } from 'lucide-react'
import { useCommands, useCreateCommand } from 'renderer/hooks/use-commands'
import { useTerminalStore } from 'renderer/stores/terminal-store'
import { Button } from 'renderer/components/ui/button'
import { Input } from 'renderer/components/ui/input'
import { Label } from 'renderer/components/ui/label'
import { Badge } from 'renderer/components/ui/badge'
import { ScrollArea } from 'renderer/components/ui/scroll-area'
import { Separator } from 'renderer/components/ui/separator'
import { Spinner } from 'renderer/components/ui/spinner'
import {
  Empty,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from 'renderer/components/ui/empty'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from 'renderer/components/ui/collapsible'
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
    const terminal = focusedTerminalId ? getTerminal(focusedTerminalId) : null

    if (!terminal || terminal.projectId !== projectId) {
      alert('Please focus a terminal first')
      return
    }

    try {
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
        <Spinner className="h-5 w-5" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive">
        Failed to load commands. Please try again.
      </div>
    )
  }

  if (!commands || commands.length === 0) {
    return (
      <Empty>
        <EmptyMedia variant="icon">
          <Terminal className="h-4 w-4" />
        </EmptyMedia>
        <EmptyTitle>No commands available</EmptyTitle>
        <EmptyDescription>Add custom commands to get started.</EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2">
        <h3 className="text-sm font-semibold">Command Library</h3>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          size="xs"
          title="Add custom command"
        >
          {showAddForm ? 'Cancel' : '+ Add'}
        </Button>
      </div>
      <Separator />

      {/* Add command form */}
      {showAddForm && (
        <>
          <div className="bg-muted/50 p-3">
            <form className="flex flex-col gap-2" onSubmit={handleAddCommand}>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="command-name">
                  Name
                </Label>
                <Input
                  className="h-7"
                  id="command-name"
                  onChange={e => setNewCommandName(e.target.value)}
                  placeholder="e.g., Install dependencies"
                  value={newCommandName}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs" htmlFor="command-text">
                  Command
                </Label>
                <Input
                  className="h-7 font-mono"
                  id="command-text"
                  onChange={e => setNewCommandText(e.target.value)}
                  placeholder="e.g., npm install"
                  value={newCommandText}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs" htmlFor="command-category">
                  Category (optional)
                </Label>
                <Input
                  className="h-7"
                  id="command-category"
                  onChange={e => setNewCommandCategory(e.target.value)}
                  placeholder="e.g., Package Management"
                  value={newCommandCategory}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  disabled={createCommand.isPending}
                  size="sm"
                  type="submit"
                >
                  {createCommand.isPending ? 'Adding...' : 'Add Command'}
                </Button>
                <Button
                  onClick={handleCancelAdd}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
          <Separator />
        </>
      )}

      <ScrollArea className="flex-1">
        {categories.map(category => {
          const isExpanded = expandedCategories.has(category)
          const categoryCommands = commandsByCategory?.[category]

          return (
            <Collapsible
              key={category}
              onOpenChange={() => toggleCategory(category)}
              open={isExpanded}
            >
              <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium hover:bg-muted/50">
                <span>{category}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {categoryCommands?.length ?? 0}
                  </span>
                  <ChevronRight
                    className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                {categoryCommands && (
                  <div className="bg-muted/30">
                    {categoryCommands.map(command => (
                      <button
                        className="flex w-full flex-col items-start gap-1 px-4 py-2 text-left text-sm hover:bg-primary/5 focus:bg-primary/5 focus:outline-none"
                        key={command.id}
                        onClick={() => handleCommandClick(command)}
                        title={`Click to inject: ${command.command}`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="font-medium">{command.name}</span>
                          {command.isCustom && (
                            <Badge className="text-xs" variant="secondary">
                              Custom
                            </Badge>
                          )}
                        </div>
                        <code className="text-xs text-muted-foreground">
                          {command.command}
                        </code>
                      </button>
                    ))}
                  </div>
                )}
              </CollapsibleContent>
              <Separator />
            </Collapsible>
          )
        })}
      </ScrollArea>
    </div>
  )
}
