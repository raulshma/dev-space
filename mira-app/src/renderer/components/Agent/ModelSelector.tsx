import { useState, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'renderer/components/ui/select'
import { Spinner } from 'renderer/components/ui/spinner'
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

  const handleModelSelect = async (modelId: string | null) => {
    if (!modelId) return
    const model = models.find(m => m.id === modelId)
    if (!model) return

    if (!model.isConfigured) {
      alert(`Please configure an API key for ${model.provider} in settings`)
      return
    }

    try {
      await window.api.agent.setModel({ model })
      setActiveModel(model)

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
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Spinner className="h-4 w-4" />
        Loading models...
      </div>
    )
  }

  return (
    <Select onValueChange={handleModelSelect} value={activeModel?.id || ''}>
      <SelectTrigger className="w-full">
        <SelectValue>{activeModel?.name || 'Select Model'}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {models.map(model => (
          <SelectItem
            disabled={!model.isConfigured}
            key={model.id}
            value={model.id}
          >
            <span className="font-medium">{model.name}</span>
            <span className="text-xs text-muted-foreground ml-2">
              {model.provider} • {(model.maxTokens / 1000).toFixed(0)}k tokens
              {!model.isConfigured && ' • Configure Key'}
            </span>
          </SelectItem>
        ))}
        {models.filter(m => !m.isConfigured).length > 0 && (
          <div className="border-t px-3 py-2 text-xs text-muted-foreground">
            Configure API keys in settings to enable more models
          </div>
        )}
      </SelectContent>
    </Select>
  )
}
