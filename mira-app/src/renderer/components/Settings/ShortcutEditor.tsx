// Shortcut Editor component for managing keyboard shortcuts
// Requirements: 14.2, 14.3, 14.4

import { useState } from 'react'
import { useShortcuts, useSetShortcut } from 'renderer/hooks/use-shortcuts'
import {
  DEFAULT_SHORTCUTS,
  type ShortcutAction,
} from 'renderer/lib/keyboard-manager'
import { Button } from 'renderer/components/ui/button'
import { Input } from 'renderer/components/ui/input'
import { Kbd } from 'renderer/components/ui/kbd'
import { Alert, AlertDescription } from 'renderer/components/ui/alert'

interface ShortcutEditorProps {
  className?: string
}

interface ShortcutItem {
  action: ShortcutAction
  label: string
  category: string
}

const SHORTCUT_ITEMS: ShortcutItem[] = [
  {
    action: 'command-palette:open',
    label: 'Open Command Palette',
    category: 'General',
  },
  {
    action: 'zen-mode:toggle',
    label: 'Toggle Zen Mode',
    category: 'General',
  },
  {
    action: 'sidebar:toggle',
    label: 'Toggle Sidebar',
    category: 'General',
  },
  {
    action: 'settings:open',
    label: 'Open Settings',
    category: 'General',
  },
  {
    action: 'terminal:new',
    label: 'New Terminal',
    category: 'Terminal',
  },
  {
    action: 'terminal:close',
    label: 'Close Terminal',
    category: 'Terminal',
  },
  {
    action: 'terminal:next',
    label: 'Next Terminal',
    category: 'Terminal',
  },
  {
    action: 'terminal:previous',
    label: 'Previous Terminal',
    category: 'Terminal',
  },
  {
    action: 'terminal:split-horizontal',
    label: 'Split Terminal Horizontally',
    category: 'Terminal',
  },
  {
    action: 'terminal:split-vertical',
    label: 'Split Terminal Vertically',
    category: 'Terminal',
  },
  {
    action: 'project:close',
    label: 'Close Project',
    category: 'Project',
  },
]

export function ShortcutEditor({
  className,
}: ShortcutEditorProps): React.JSX.Element {
  const { data: shortcuts, isLoading } = useShortcuts()
  const setShortcut = useSetShortcut()
  const [editingAction, setEditingAction] = useState<ShortcutAction | null>(
    null
  )
  const [editingBinding, setEditingBinding] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [recordingKeys, setRecordingKeys] = useState(false)

  // Group shortcuts by category
  const groupedShortcuts = SHORTCUT_ITEMS.reduce(
    (acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = []
      }
      acc[item.category].push(item)
      return acc
    },
    {} as Record<string, ShortcutItem[]>
  )

  const handleEdit = (action: ShortcutAction): void => {
    const currentBinding = shortcuts?.[action] || DEFAULT_SHORTCUTS[action]
    setEditingAction(action)
    setEditingBinding(currentBinding)
    setError(null)
  }

  const handleCancel = (): void => {
    setEditingAction(null)
    setEditingBinding('')
    setError(null)
    setRecordingKeys(false)
  }

  const handleSave = async (): Promise<void> => {
    if (!editingAction || !editingBinding.trim()) {
      setError('Binding cannot be empty')
      return
    }

    try {
      await setShortcut.mutateAsync({
        action: editingAction,
        binding: editingBinding.trim(),
      })
      setEditingAction(null)
      setEditingBinding('')
      setError(null)
      setRecordingKeys(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set shortcut')
    }
  }

  const handleReset = async (action: ShortcutAction): Promise<void> => {
    const defaultBinding = DEFAULT_SHORTCUTS[action]
    try {
      await setShortcut.mutateAsync({
        action,
        binding: defaultBinding,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset shortcut')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (!recordingKeys) return

    e.preventDefault()
    e.stopPropagation()

    const parts: string[] = []

    if (e.ctrlKey || e.metaKey) {
      parts.push('Mod')
    }
    if (e.altKey) {
      parts.push('Alt')
    }
    if (e.shiftKey) {
      parts.push('Shift')
    }

    const key = e.key
    if (
      key &&
      key !== 'Control' &&
      key !== 'Meta' &&
      key !== 'Alt' &&
      key !== 'Shift'
    ) {
      parts.push(key.toUpperCase())
    }

    if (parts.length > 0) {
      setEditingBinding(parts.join('+'))
    }
  }

  const startRecording = (): void => {
    setRecordingKeys(true)
    setEditingBinding('')
  }

  if (isLoading) {
    return <div className={className}>Loading shortcuts...</div>
  }

  return (
    <div className={className}>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-2">Keyboard Shortcuts</h2>
          <p className="text-sm text-muted-foreground">
            Customize keyboard shortcuts for quick access to features
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {Object.entries(groupedShortcuts).map(([category, items]) => (
          <div className="space-y-2" key={category}>
            <h3 className="text-sm font-medium text-muted-foreground">
              {category}
            </h3>
            <div className="space-y-1">
              {items.map(item => {
                const currentBinding =
                  shortcuts?.[item.action] || DEFAULT_SHORTCUTS[item.action]
                const isEditing = editingAction === item.action

                return (
                  <div
                    className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-accent/50"
                    key={item.action}
                  >
                    <span className="text-sm">{item.label}</span>

                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Input
                          className="w-32 h-7"
                          onChange={e => setEditingBinding(e.target.value)}
                          onFocus={() => setRecordingKeys(false)}
                          onKeyDown={handleKeyDown}
                          placeholder="Enter shortcut..."
                          value={editingBinding}
                        />
                        <Button
                          onClick={startRecording}
                          size="xs"
                          variant="outline"
                        >
                          {recordingKeys ? 'Recording...' : 'Record'}
                        </Button>
                        <Button onClick={handleSave} size="xs">
                          Save
                        </Button>
                        <Button
                          onClick={handleCancel}
                          size="xs"
                          variant="outline"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Kbd>{currentBinding}</Kbd>
                        <Button
                          onClick={() => handleEdit(item.action)}
                          size="xs"
                          variant="outline"
                        >
                          Edit
                        </Button>
                        {currentBinding !== DEFAULT_SHORTCUTS[item.action] && (
                          <Button
                            className="text-muted-foreground"
                            onClick={() => handleReset(item.action)}
                            size="xs"
                            variant="ghost"
                          >
                            Reset
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
