// Unit tests for TerminalStore
import { describe, it, expect, beforeEach } from 'vitest'
import { useTerminalStore, type TerminalInstance } from './terminal-store'

describe('TerminalStore', () => {
  const mockTerminal: TerminalInstance = {
    id: 'term-1',
    projectId: 'project-1',
    ptyId: 'pty-1',
    isPinned: false,
    title: 'Terminal 1',
    cwd: '/home/user/project'
  }

  beforeEach(() => {
    // Reset store state before each test
    useTerminalStore.setState({
      terminals: new Map(),
      layouts: new Map(),
      focusedTerminalId: null
    })
  })

  it('should add a terminal', () => {
    const { addTerminal, getTerminal } = useTerminalStore.getState()

    addTerminal(mockTerminal)

    const terminal = getTerminal('term-1')
    expect(terminal).toEqual(mockTerminal)
  })

  it('should remove a terminal', () => {
    const { addTerminal, removeTerminal, getTerminal } = useTerminalStore.getState()

    addTerminal(mockTerminal)
    expect(getTerminal('term-1')).toBeDefined()

    removeTerminal('term-1')
    expect(getTerminal('term-1')).toBeUndefined()
  })

  it('should update a terminal', () => {
    const { addTerminal, updateTerminal, getTerminal } = useTerminalStore.getState()

    addTerminal(mockTerminal)

    updateTerminal('term-1', { title: 'Updated Terminal' })

    const terminal = getTerminal('term-1')
    expect(terminal?.title).toBe('Updated Terminal')
    expect(terminal?.id).toBe('term-1')
  })

  it('should get terminals by project', () => {
    const { addTerminal, getTerminalsByProject } = useTerminalStore.getState()

    const terminal1 = { ...mockTerminal, id: 'term-1', projectId: 'project-1' }
    const terminal2 = { ...mockTerminal, id: 'term-2', projectId: 'project-1' }
    const terminal3 = { ...mockTerminal, id: 'term-3', projectId: 'project-2' }

    addTerminal(terminal1)
    addTerminal(terminal2)
    addTerminal(terminal3)

    const project1Terminals = getTerminalsByProject('project-1')
    expect(project1Terminals).toHaveLength(2)
    expect(project1Terminals.map(t => t.id)).toEqual(['term-1', 'term-2'])
  })

  it('should focus a terminal', () => {
    const { addTerminal, focusTerminal } = useTerminalStore.getState()

    addTerminal(mockTerminal)

    focusTerminal('term-1')
    expect(useTerminalStore.getState().focusedTerminalId).toBe('term-1')
  })

  it('should pin and unpin a terminal', () => {
    const { addTerminal, pinTerminal, unpinTerminal, getTerminal } = useTerminalStore.getState()

    addTerminal(mockTerminal)

    pinTerminal('term-1')
    expect(getTerminal('term-1')?.isPinned).toBe(true)

    unpinTerminal('term-1')
    expect(getTerminal('term-1')?.isPinned).toBe(false)
  })

  it('should clear all terminals for a project', () => {
    const { addTerminal, clearProject, getTerminalsByProject } = useTerminalStore.getState()

    const terminal1 = { ...mockTerminal, id: 'term-1', projectId: 'project-1' }
    const terminal2 = { ...mockTerminal, id: 'term-2', projectId: 'project-1' }
    const terminal3 = { ...mockTerminal, id: 'term-3', projectId: 'project-2' }

    addTerminal(terminal1)
    addTerminal(terminal2)
    addTerminal(terminal3)

    clearProject('project-1')

    expect(getTerminalsByProject('project-1')).toHaveLength(0)
    expect(getTerminalsByProject('project-2')).toHaveLength(1)
  })

  it('should clear focused terminal when removing it', () => {
    const { addTerminal, focusTerminal, removeTerminal } = useTerminalStore.getState()

    addTerminal(mockTerminal)
    focusTerminal('term-1')

    expect(useTerminalStore.getState().focusedTerminalId).toBe('term-1')

    removeTerminal('term-1')
    expect(useTerminalStore.getState().focusedTerminalId).toBe(null)
  })
})
