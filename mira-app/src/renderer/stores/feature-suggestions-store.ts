/**
 * Feature Suggestions Store - Zustand state management
 *
 * Manages feature suggestions state including:
 * - Suggestions list and filtering
 * - Generation progress tracking
 * - Approval/rejection workflow
 */

import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type {
  FeatureSuggestion,
  FeatureSuggestionFilter,
  FeatureSuggestionStatus,
  FeatureSuggestionCategory,
  FeatureSuggestionPriority,
  SuggestionBatch,
  AgentTask,
} from 'shared/ai-types'

// ============================================================================
// Types
// ============================================================================

export interface GenerationProgress {
  projectId: string
  status: 'analyzing' | 'generating' | 'complete' | 'error'
  progress: number
  message: string
  currentStep?: string
  /** Streaming text output from AI */
  streamingText?: string
}

export interface FeatureSuggestionsState {
  // Suggestions data
  suggestions: Map<string, FeatureSuggestion>
  batches: SuggestionBatch[]

  // Loading states
  isLoading: boolean
  isGenerating: boolean
  error: string | null

  // Generation progress
  generationProgress: GenerationProgress | null

  // Filter state
  filter: FeatureSuggestionFilter

  // Selected suggestion
  selectedSuggestionId: string | null

  // Actions
  setSuggestions: (suggestions: FeatureSuggestion[]) => void
  addSuggestion: (suggestion: FeatureSuggestion) => void
  updateSuggestion: (id: string, updates: Partial<FeatureSuggestion>) => void
  removeSuggestion: (id: string) => void
  setBatches: (batches: SuggestionBatch[]) => void
  setLoading: (loading: boolean) => void
  setGenerating: (generating: boolean) => void
  setError: (error: string | null) => void
  setGenerationProgress: (progress: GenerationProgress | null) => void
  setFilter: (filter: Partial<FeatureSuggestionFilter>) => void
  clearFilter: () => void
  setSelectedSuggestion: (id: string | null) => void
  reset: () => void
}

// ============================================================================
// Store
// ============================================================================

const initialState = {
  suggestions: new Map<string, FeatureSuggestion>(),
  batches: [],
  isLoading: false,
  isGenerating: false,
  error: null,
  generationProgress: null,
  filter: {},
  selectedSuggestionId: null,
}

export const useFeatureSuggestionsStore = create<FeatureSuggestionsState>(
  (set, get) => ({
    ...initialState,

    setSuggestions: (suggestions: FeatureSuggestion[]) => {
      const map = new Map<string, FeatureSuggestion>()
      for (const s of suggestions) {
        map.set(s.id, s)
      }
      set({ suggestions: map })
    },

    addSuggestion: (suggestion: FeatureSuggestion) => {
      set(state => {
        const newMap = new Map(state.suggestions)
        newMap.set(suggestion.id, suggestion)
        return { suggestions: newMap }
      })
    },

    updateSuggestion: (id: string, updates: Partial<FeatureSuggestion>) => {
      set(state => {
        const existing = state.suggestions.get(id)
        if (!existing) return state

        const newMap = new Map(state.suggestions)
        newMap.set(id, { ...existing, ...updates })
        return { suggestions: newMap }
      })
    },

    removeSuggestion: (id: string) => {
      set(state => {
        const newMap = new Map(state.suggestions)
        newMap.delete(id)
        return { suggestions: newMap }
      })
    },

    setBatches: (batches: SuggestionBatch[]) => {
      set({ batches })
    },

    setLoading: (loading: boolean) => {
      set({ isLoading: loading })
    },

    setGenerating: (generating: boolean) => {
      set({ isGenerating: generating })
    },

    setError: (error: string | null) => {
      set({ error })
    },

    setGenerationProgress: (progress: GenerationProgress | null) => {
      set({ generationProgress: progress })
    },

    setFilter: (filter: Partial<FeatureSuggestionFilter>) => {
      set(state => ({
        filter: { ...state.filter, ...filter },
      }))
    },

    clearFilter: () => {
      set({ filter: {} })
    },

    setSelectedSuggestion: (id: string | null) => {
      set({ selectedSuggestionId: id })
    },

    reset: () => {
      set(initialState)
    },
  })
)

// ============================================================================
// Selectors
// ============================================================================

/**
 * Get all suggestions as an array
 */
export function useSuggestionsList(): FeatureSuggestion[] {
  return useFeatureSuggestionsStore(
    useShallow(state => Array.from(state.suggestions.values()))
  )
}

/**
 * Get filtered suggestions
 */
export function useFilteredSuggestions(): FeatureSuggestion[] {
  return useFeatureSuggestionsStore(
    useShallow(state => {
      const suggestions = Array.from(state.suggestions.values())
      const { filter } = state

      return suggestions.filter(s => {
        if (filter.projectId && s.projectId !== filter.projectId) return false
        if (filter.status && s.status !== filter.status) return false
        if (filter.category && s.category !== filter.category) return false
        if (filter.priority && s.priority !== filter.priority) return false
        return true
      })
    })
  )
}

/**
 * Get pending suggestions count
 */
export function usePendingSuggestionsCount(): number {
  return useFeatureSuggestionsStore(
    state =>
      Array.from(state.suggestions.values()).filter(s => s.status === 'pending')
        .length
  )
}

/**
 * Get suggestions by status
 */
export function useSuggestionsByStatus(
  status: FeatureSuggestionStatus
): FeatureSuggestion[] {
  return useFeatureSuggestionsStore(
    useShallow(state =>
      Array.from(state.suggestions.values()).filter(s => s.status === status)
    )
  )
}

/**
 * Get a single suggestion by ID
 */
export function useSuggestion(id: string): FeatureSuggestion | undefined {
  return useFeatureSuggestionsStore(state => state.suggestions.get(id))
}

/**
 * Get the selected suggestion
 */
export function useSelectedSuggestion(): FeatureSuggestion | undefined {
  return useFeatureSuggestionsStore(state => {
    if (!state.selectedSuggestionId) return undefined
    return state.suggestions.get(state.selectedSuggestionId)
  })
}

/**
 * Get generation progress
 */
export function useGenerationProgress(): GenerationProgress | null {
  return useFeatureSuggestionsStore(state => state.generationProgress)
}

/**
 * Get loading states
 */
export function useFeatureSuggestionsLoading(): {
  isLoading: boolean
  isGenerating: boolean
} {
  return useFeatureSuggestionsStore(
    useShallow(state => ({
      isLoading: state.isLoading,
      isGenerating: state.isGenerating,
    }))
  )
}
