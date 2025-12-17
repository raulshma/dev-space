// Unit tests for KeyboardManager
// Requirements: 14.1
// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { KeyboardManager, DEFAULT_SHORTCUTS } from './keyboard-manager'

describe('KeyboardManager', () => {
  let manager: KeyboardManager

  beforeEach(() => {
    manager = new KeyboardManager()
  })

  it('should initialize with default shortcuts', () => {
    const allShortcuts = manager.getAllShortcuts()

    expect(allShortcuts.size).toBeGreaterThan(0)
    expect(allShortcuts.get('command-palette:open')).toBe(
      DEFAULT_SHORTCUTS['command-palette:open']
    )
    expect(allShortcuts.get('zen-mode:toggle')).toBe(
      DEFAULT_SHORTCUTS['zen-mode:toggle']
    )
  })

  it('should load shortcuts from database', () => {
    const customShortcuts = {
      'command-palette:open': 'Mod+P',
      'zen-mode:toggle': 'Mod+Z',
    }

    manager.loadShortcuts(customShortcuts)

    expect(manager.getBinding('command-palette:open')).toBe('Mod+P')
    expect(manager.getBinding('zen-mode:toggle')).toBe('Mod+Z')
    // Other shortcuts should still have defaults
    expect(manager.getBinding('sidebar:toggle')).toBe(
      DEFAULT_SHORTCUTS['sidebar:toggle']
    )
  })

  it('should register and unregister action handlers', () => {
    const handler = vi.fn()

    manager.registerHandler('command-palette:open', handler)
    expect(manager.handlers.has('command-palette:open')).toBe(true)

    manager.unregisterHandler('command-palette:open')
    expect(manager.handlers.has('command-palette:open')).toBe(false)
  })

  it('should start and stop listening for keyboard events', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

    manager.startListening()
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'keydown',
      expect.any(Function)
    )

    manager.stopListening()
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'keydown',
      expect.any(Function)
    )
  })

  it('should not add duplicate listeners', () => {
    manager.startListening()

    // Check that listener is set
    expect(manager.listener).not.toBeNull()

    const firstListener = manager.listener

    // Try to start listening again
    manager.startListening()

    // Should still be the same listener
    expect(manager.listener).toBe(firstListener)

    manager.stopListening()
  })

  it('should get binding for an action', () => {
    manager.loadShortcuts({ 'command-palette:open': 'Mod+P' })

    expect(manager.getBinding('command-palette:open')).toBe('Mod+P')
    expect(manager.getBinding('zen-mode:toggle')).toBe(
      DEFAULT_SHORTCUTS['zen-mode:toggle']
    )
  })

  it('should return all shortcuts', () => {
    const customShortcuts = {
      'command-palette:open': 'Mod+P',
      'zen-mode:toggle': 'Mod+Z',
    }

    manager.loadShortcuts(customShortcuts)
    const allShortcuts = manager.getAllShortcuts()

    expect(allShortcuts.size).toBeGreaterThan(0)
    expect(allShortcuts.get('command-palette:open')).toBe('Mod+P')
    expect(allShortcuts.get('zen-mode:toggle')).toBe('Mod+Z')
  })
})
