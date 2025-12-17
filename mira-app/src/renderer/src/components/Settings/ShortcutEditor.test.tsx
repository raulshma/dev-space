// Unit tests for ShortcutEditor component
// Requirements: 14.2, 14.3, 14.4
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@testing-library/jest-dom/vitest'
import { ShortcutEditor } from './ShortcutEditor'

// Mock the hooks
vi.mock('../../hooks/use-shortcuts', () => ({
  useShortcuts: vi.fn(() => ({
    data: {
      'command-palette:open': 'Mod+K',
      'zen-mode:toggle': 'Mod+Shift+Z'
    },
    isLoading: false
  })),
  useSetShortcut: vi.fn(() => ({
    mutateAsync: vi.fn()
  }))
}))

describe('ShortcutEditor', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    })
  })

  it('should render shortcut categories', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ShortcutEditor />
      </QueryClientProvider>
    )

    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument()
    expect(screen.getByText('General')).toBeInTheDocument()
    expect(screen.getByText('Terminal')).toBeInTheDocument()
    expect(screen.getByText('Project')).toBeInTheDocument()
  })

  it('should display shortcut items with labels', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ShortcutEditor />
      </QueryClientProvider>
    )

    expect(screen.getByText('Open Command Palette')).toBeInTheDocument()
    expect(screen.getByText('Toggle Zen Mode')).toBeInTheDocument()
    expect(screen.getByText('Toggle Sidebar')).toBeInTheDocument()
  })

  it('should display current bindings', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ShortcutEditor />
      </QueryClientProvider>
    )

    // Check that bindings are displayed
    const bindings = screen.getAllByText(/Mod\+/)
    expect(bindings.length).toBeGreaterThan(0)
  })

  it('should show edit buttons for each shortcut', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ShortcutEditor />
      </QueryClientProvider>
    )

    const editButtons = screen.getAllByText('Edit')
    expect(editButtons.length).toBeGreaterThan(0)
  })
})
