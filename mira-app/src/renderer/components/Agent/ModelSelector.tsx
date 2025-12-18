import { useState, useEffect } from 'react'
import type { AIModel } from 'shared/models'

/**
 * ModelSelector Component
 *
 * Displays a dropdown with configured AI models and allows switching between them.
 * Shows disabled state for unconfigured models with "Configure Key" action.
 *
 * Requirements: 5.1, 5.4
 */

interface ModelSelectorProps {
  projectId: string
  onModelChange?: (model: AIModel) => void
}

export function ModelSelector({ onModelChange }: ModelSelectorProps) {
  const [models, setModels] = useState<AIModel[]>([])
  const [activeModel, setActiveModel] = useState<AIModel | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load available models on mount
  useEffect(() => {
    loadModels()
  }, [])

  const loadModels = async () => {
    try {
      setLoading(true)
      const response = await window.api.agent.getModels({})
      setModels(response.models)

      // Get active model
      try {
        const activeResponse = await window.api.agent.getModel({})
        setActiveModel(activeResponse.model)
      } catch {
        // No active model set yet
        setActiveModel(null)
      }
    } catch (error) {
      console.error('Failed to load models:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleModelSelect = async (model: AIModel) => {
    if (!model.isConfigured) {
      // Navigate to API key configuration
      // For now, just show an alert
      alert(`Please configure an API key for ${model.provider} in settings`)
      return
    }

    try {
      await window.api.agent.setModel({ model })
      setActiveModel(model)
      setIsOpen(false)

      // Notify parent component
      if (onModelChange) {
        onModelChange(model)
      }
    } catch (error) {
      console.error('Failed to set model:', error)
      alert('Failed to switch model. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-500">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-amber-500" />
        Loading models...
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Dropdown trigger */}
      <button
        className="flex items-center gap-2 rounded-sm border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-medium">
          {activeModel ? activeModel.name : 'Select Model'}
        </span>
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M19 9l-7 7-7-7"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <button
            aria-label="Close dropdown"
            className="fixed inset-0 z-10 cursor-default bg-transparent border-none"
            onClick={() => setIsOpen(false)}
            onKeyDown={e => {
              if (e.key === 'Escape') setIsOpen(false)
            }}
            tabIndex={-1}
            type="button"
          />

          {/* Menu */}
          <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-sm border border-neutral-300 bg-white shadow-lg">
            <div className="max-h-80 overflow-y-auto">
              {models.map(model => (
                <button
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                    model.isConfigured
                      ? 'hover:bg-neutral-50'
                      : 'cursor-not-allowed opacity-50'
                  } ${activeModel?.id === model.id ? 'bg-amber-50 text-amber-900' : ''}`}
                  disabled={!model.isConfigured}
                  key={model.id}
                  onClick={() => handleModelSelect(model)}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{model.name}</span>
                    <span className="text-xs text-neutral-500">
                      {model.provider} • {(model.maxTokens / 1000).toFixed(0)}k
                      tokens
                    </span>
                  </div>

                  {!model.isConfigured && (
                    <span className="text-xs text-amber-600">
                      Configure Key
                    </span>
                  )}

                  {activeModel?.id === model.id && (
                    <svg
                      className="h-4 w-4 text-amber-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        clipRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        fillRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>

            {models.filter(m => !m.isConfigured).length > 0 && (
              <div className="border-t border-neutral-200 px-3 py-2 text-xs text-neutral-500">
                Configure API keys in settings to enable more models
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
