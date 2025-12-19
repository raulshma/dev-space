// Keyboard shortcut manager for global keyboard event handling
// Requirements: 14.1

/**
 * Action types that can be triggered by keyboard shortcuts
 */
export type ShortcutAction =
  | 'command-palette:open'
  | 'zen-mode:toggle'
  | 'sidebar:toggle'
  | 'terminal:new'
  | 'terminal:close'
  | 'terminal:next'
  | 'terminal:previous'
  | 'terminal:split-horizontal'
  | 'terminal:split-vertical'
  | 'project:close'
  | 'settings:open'

/**
 * Default keyboard shortcuts
 */
export const DEFAULT_SHORTCUTS: Record<ShortcutAction, string> = {
  'command-palette:open': 'Mod+K',
  'zen-mode:toggle': 'Mod+Shift+Z',
  'sidebar:toggle': 'Mod+B',
  'terminal:new': 'Mod+T',
  'terminal:close': 'Mod+W',
  'terminal:next': 'Mod+]',
  'terminal:previous': 'Mod+[',
  'terminal:split-horizontal': 'Mod+Shift+H',
  'terminal:split-vertical': 'Mod+Shift+V',
  'project:close': 'Mod+Shift+W',
  'settings:open': 'Mod+,',
}

/**
 * Action handler function type
 */
export type ActionHandler = () => void

/**
 * Keyboard shortcut manager class
 */
export class KeyboardManager {
  private shortcuts: Map<string, string> = new Map()
  /** @internal Exposed for testing */
  handlers: Map<ShortcutAction, ActionHandler> = new Map()
  /** @internal Exposed for testing */
  listener: ((event: KeyboardEvent) => void) | null = null

  constructor() {
    // Initialize with default shortcuts
    for (const [action, binding] of Object.entries(DEFAULT_SHORTCUTS)) {
      this.shortcuts.set(action, binding)
    }
  }

  /**
   * Load shortcuts from database
   */
  loadShortcuts(shortcuts: Record<string, string>): void {
    this.shortcuts.clear()

    // Start with defaults
    for (const [action, binding] of Object.entries(DEFAULT_SHORTCUTS)) {
      this.shortcuts.set(action, binding)
    }

    // Override with saved shortcuts
    for (const [action, binding] of Object.entries(shortcuts)) {
      this.shortcuts.set(action, binding)
    }
  }

  /**
   * Register an action handler
   */
  registerHandler(action: ShortcutAction, handler: ActionHandler): void {
    this.handlers.set(action, handler)
  }

  /**
   * Unregister an action handler
   */
  unregisterHandler(action: ShortcutAction): void {
    this.handlers.delete(action)
  }

  /**
   * Start listening for keyboard events
   */
  startListening(): void {
    if (this.listener) {
      // Already listening
      return
    }

    this.listener = (event: KeyboardEvent) => {
      // Don't handle shortcuts when typing in input fields
      const target = event.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Exception: Command palette shortcut should work everywhere
        const binding = this.normalizeBinding(event)
        const commandPaletteBinding = this.shortcuts.get('command-palette:open')

        if (
          commandPaletteBinding &&
          binding === this.normalizeShortcut(commandPaletteBinding)
        ) {
          event.preventDefault()
          const handler = this.handlers.get('command-palette:open')
          if (handler) {
            handler()
          }
        }
        return
      }

      // Check if this event matches any registered shortcut
      const binding = this.normalizeBinding(event)

      for (const [action, shortcut] of this.shortcuts.entries()) {
        if (binding === this.normalizeShortcut(shortcut)) {
          event.preventDefault()
          event.stopPropagation()

          const handler = this.handlers.get(action as ShortcutAction)
          if (handler) {
            handler()
          }
          break
        }
      }
    }

    window.addEventListener('keydown', this.listener)
  }

  /**
   * Stop listening for keyboard events
   */
  stopListening(): void {
    if (this.listener) {
      window.removeEventListener('keydown', this.listener)
      this.listener = null
    }
  }

  /**
   * Normalize a keyboard event to a binding string
   */
  private normalizeBinding(event: KeyboardEvent): string {
    const parts: string[] = []

    // Add modifiers
    if (event.ctrlKey || event.metaKey) {
      parts.push('Mod')
    }
    if (event.altKey) {
      parts.push('Alt')
    }
    if (event.shiftKey) {
      parts.push('Shift')
    }

    // Add key
    const key = event.key
    if (
      key &&
      key !== 'Control' &&
      key !== 'Meta' &&
      key !== 'Alt' &&
      key !== 'Shift'
    ) {
      parts.push(key.toUpperCase())
    }

    return parts.join('+')
  }

  /**
   * Normalize a shortcut string (e.g., "Mod+K" -> "MOD+K")
   */
  private normalizeShortcut(shortcut: string): string {
    return shortcut
      .split('+')
      .map(part => part.trim().toUpperCase())
      .join('+')
  }

  /**
   * Get the binding for an action
   */
  getBinding(action: ShortcutAction): string | undefined {
    return this.shortcuts.get(action)
  }

  /**
   * Get all shortcuts
   */
  getAllShortcuts(): Map<string, string> {
    return new Map(this.shortcuts)
  }
}

// Global keyboard manager instance
export const keyboardManager = new KeyboardManager()
