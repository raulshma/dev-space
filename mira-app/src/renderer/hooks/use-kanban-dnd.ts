/**
 * Kanban Drag and Drop Hook
 *
 * Lightweight hook for managing drag-and-drop state in the kanban board.
 * Uses native HTML5 DnD API for performance.
 */

import { useState, useCallback, useRef } from 'react'
import type { TaskStatus } from 'shared/ai-types'

export interface DragState {
  taskId: string | null
  sourceStatus: TaskStatus | null
  targetStatus: TaskStatus | null
}

export interface UseKanbanDndReturn {
  dragState: DragState
  isDragging: boolean
  handleDragStart: (taskId: string, status: TaskStatus) => void
  handleDragEnd: () => void
  handleDragOver: (e: React.DragEvent, status: TaskStatus) => void
  handleDragLeave: () => void
  handleDrop: (e: React.DragEvent, status: TaskStatus) => TaskStatus | null
  isDropTarget: (status: TaskStatus) => boolean
}

const INITIAL_STATE: DragState = {
  taskId: null,
  sourceStatus: null,
  targetStatus: null,
}

/**
 * Hook for managing kanban drag-and-drop operations
 */
export function useKanbanDnd(): UseKanbanDndReturn {
  const [dragState, setDragState] = useState<DragState>(INITIAL_STATE)
  const dragCounterRef = useRef<Map<TaskStatus, number>>(new Map())

  const handleDragStart = useCallback((taskId: string, status: TaskStatus) => {
    setDragState({
      taskId,
      sourceStatus: status,
      targetStatus: null,
    })
  }, [])

  const handleDragEnd = useCallback(() => {
    setDragState(INITIAL_STATE)
    dragCounterRef.current.clear()
  }, [])

  const handleDragOver = useCallback(
    (e: React.DragEvent, status: TaskStatus) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'

      // Update target status if different
      setDragState(prev => {
        if (prev.targetStatus !== status) {
          return { ...prev, targetStatus: status }
        }
        return prev
      })
    },
    []
  )

  const handleDragLeave = useCallback(() => {
    // Small delay to prevent flickering when moving between elements
    setDragState(prev => ({ ...prev, targetStatus: null }))
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, status: TaskStatus): TaskStatus | null => {
      e.preventDefault()

      const { taskId, sourceStatus } = dragState

      // Reset state
      setDragState(INITIAL_STATE)
      dragCounterRef.current.clear()

      // Return the new status if it changed
      if (taskId && sourceStatus && sourceStatus !== status) {
        return status
      }

      return null
    },
    [dragState]
  )

  const isDropTarget = useCallback(
    (status: TaskStatus): boolean => {
      return (
        dragState.taskId !== null &&
        dragState.targetStatus === status &&
        dragState.sourceStatus !== status
      )
    },
    [dragState]
  )

  return {
    dragState,
    isDragging: dragState.taskId !== null,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    isDropTarget,
  }
}

/**
 * Valid status transitions for drag-and-drop
 * Some transitions don't make sense (e.g., can't drag to 'running')
 */
export const VALID_DROP_TARGETS: Record<TaskStatus, TaskStatus[]> = {
  pending: ['queued', 'stopped'], // Can queue or mark as stopped
  queued: ['pending', 'stopped'], // Can move back to backlog or stop
  running: [], // Can't drag running tasks
  paused: ['pending', 'queued', 'stopped'], // Can move back or stop
  completed: ['pending'], // Can reopen
  failed: ['pending', 'queued'], // Can retry
  stopped: ['pending', 'queued'], // Can requeue
}

/**
 * Check if a status transition is valid
 */
export function isValidTransition(from: TaskStatus, to: TaskStatus): boolean {
  return VALID_DROP_TARGETS[from]?.includes(to) ?? false
}
