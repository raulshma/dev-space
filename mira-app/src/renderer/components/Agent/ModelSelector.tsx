import { useState, useEffect, useCallback } from 'react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from 'renderer/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'renderer/components/ui/card'
import { Badge } from 'renderer/components/ui/badge'
import { Button } from 'renderer/components/ui/button'
import { Alert, AlertDescription } from 'renderer/components/ui/alert'
import { Spinner } from 'renderer/components/ui/spinner'
import { AlertTriangle, RefreshCw, Cpu, DollarSign, MessageSquare } from 'lucide-react'
import type { AIModel, AIAction } from 'shared/ai-types'
import { useAIModels, useSetDefaultModel, useSetActionModel } from 'renderer/hooks/use-ai'
import { useAIStore, useUsingCachedModels } from 'renderer/stores/ai-store'

/**
 * ModelSelector Component
 *
 * Displays models from OpenRouter with details including name, provider,
 * context length, and pricing. Supports default and per-action model selection.
 * Shows fallback warning when using cached models.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

interface ModelSelectorProps {
  /** Optional callback when model changes */
  onModelChange?: (model: AIModel) => void
  /** Whether to show per-action model configuration */
  showActionModels?: boolean
}

const ACTION_LABELS: Record<AIAction, { label: string; description: string; icon: React.ReactNode }> = {
  'chat': {
    label: 'Chat',
    description: 'General conversation and assistance',
    icon: <MessageSquare className="h-4 w-4" />,
  },
  'code-generation': {
    label: 'Code Generation',
    description: 'Writing and generating code',
    icon: <Cpu className="h-4 w-4" />,
  },
  'error-fix': {
    label: 'Error Fixing',
    description: 'Analyzing and fixing errors',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  'parameter-extraction': {
    label: 'Parameter Extraction',
    description: 'Extracting parameters from text',
    icon: <DollarSign className="h-4 w-4" />,
  },
}

/**
 * Formats pricing to a readable string
 */
function formatPricing(price: number): string {
  if (price === 0) return 'Free'
  if (price < 0.001) return `$${(price * 1000000).toFixed(2)}/M`
  return `$${price.toFixed(4)}/1K`
}

/**
 * Formats context length to a readable string
 */
function formatContextLength(length: number): string {
  if (length >= 1000000) return `${(length / 1000000).toFixed(1)}M`
  if (length >= 1000) return `${(length / 1000).toFixed(0)}K`
  return `${length}`
}

/**
 * Groups models by provider
 */
function groupModelsByProvider(models: AIModel[]): Map<string, AIModel[]> {
  const grouped = new Map<string, AIModel[]>()
  for (const model of models) {
    const provider = model.provider || 'Other'
    const existing = grouped.get(provider) || []
    grouped.set(provider, [...existing, model])
  }
  return grouped
}

export function ModelSelector({
  onModelChange,
  showActionModels = false,
}: ModelSelectorProps): React.JSX.Element {
  const { data: models, isLoading, error, refetch } = useAIModels()
  const setDefaultModelMutation = useSetDefaultModel()
  const setActionModelMutation = useSetActionModel()
  const isUsingCachedModels = useUsingCachedModels()

  const { defaultModelId, actionModels, availableModels } = useAIStore()

  const [selectedActionModels, setSelectedActionModels] = useState<Record<AIAction, string>>({
    'chat': '',
    'code-generation': '',
    'error-fix': '',
    'parameter-extraction': '',
  })

  // Initialize action models from store
  useEffect(() => {
    const initial: Record<AIAction, string> = {
      'chat': '',
      'code-generation': '',
      'error-fix': '',
      'parameter-extraction': '',
    }
    actionModels.forEach((modelId, action) => {
      initial[action] = modelId
    })
    setSelectedActionModels(initial)
  }, [actionModels])

  const handleDefaultModelChange = useCallback(async (modelId: string) => {
    if (!modelId) return

    const model = availableModels.find(m => m.id === modelId)
    if (!model) return

    if (!model.isConfigured) {
      alert(`Please configure an API key for ${model.provider} in the API Keys settings`)
      return
    }

    try {
      await setDefaultModelMutation.mutateAsync(modelId)
      if (onModelChange) {
        onModelChange(model)
      }
    } catch (err) {
      console.error('Failed to set default model:', err)
      alert('Failed to set default model. Please try again.')
    }
  }, [availableModels, setDefaultModelMutation, onModelChange])

  const handleActionModelChange = useCallback(async (action: AIAction, modelId: string) => {
    if (!modelId) return

    const model = availableModels.find(m => m.id === modelId)
    if (!model) return

    if (!model.isConfigured) {
      alert(`Please configure an API key for ${model.provider} in the API Keys settings`)
      return
    }

    try {
      await setActionModelMutation.mutateAsync({ action, modelId })
      setSelectedActionModels(prev => ({ ...prev, [action]: modelId }))
    } catch (err) {
      console.error('Failed to set action model:', err)
      alert('Failed to set model for this action. Please try again.')
    }
  }, [availableModels, setActionModelMutation])

  const handleRefresh = useCallback(() => {
    refetch()
  }, [refetch])

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Spinner className="h-4 w-4" />
        Loading models from OpenRouter...
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>Failed to load models: {error.message}</span>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const groupedModels = groupModelsByProvider(availableModels)
  const defaultModel = availableModels.find(m => m.id === defaultModelId)

  return (
    <div className="space-y-6">
      {/* Cached Models Warning */}
      {isUsingCachedModels && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Using cached model list. OpenRouter API may be unavailable.</span>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Default Model Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Default Model</CardTitle>
          <CardDescription>
            Select the default AI model for all operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ModelSelectDropdown
            models={availableModels}
            groupedModels={groupedModels}
            value={defaultModelId || ''}
            onChange={handleDefaultModelChange}
            placeholder="Select default model"
            disabled={setDefaultModelMutation.isPending}
          />

          {defaultModel && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline">
                {formatContextLength(defaultModel.contextLength)} context
              </Badge>
              <Badge variant="outline">
                Input: {formatPricing(defaultModel.pricing.prompt)}
              </Badge>
              <Badge variant="outline">
                Output: {formatPricing(defaultModel.pricing.completion)}
              </Badge>
              {defaultModel.capabilities.slice(0, 3).map(cap => (
                <Badge key={cap} variant="secondary" className="text-xs">
                  {cap}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-Action Model Selection */}
      {showActionModels && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Per-Action Models</CardTitle>
            <CardDescription>
              Optionally configure different models for specific actions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(Object.keys(ACTION_LABELS) as AIAction[]).map(action => {
              const actionInfo = ACTION_LABELS[action]
              const selectedModelId = selectedActionModels[action]

              return (
                <div key={action} className="space-y-2">
                  <div className="flex items-center gap-2">
                    {actionInfo.icon}
                    <span className="text-sm font-medium">{actionInfo.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {actionInfo.description}
                    </span>
                  </div>
                  <ModelSelectDropdown
                    models={availableModels}
                    groupedModels={groupedModels}
                    value={selectedModelId}
                    onChange={(modelId) => handleActionModelChange(action, modelId)}
                    placeholder={`Use default (${defaultModel?.name || 'not set'})`}
                    disabled={setActionModelMutation.isPending}
                    allowClear
                  />
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Model Count Info */}
      <div className="text-xs text-muted-foreground">
        {availableModels.length} models available from {groupedModels.size} providers
      </div>
    </div>
  )
}

interface ModelSelectDropdownProps {
  models: AIModel[]
  groupedModels: Map<string, AIModel[]>
  value: string
  onChange: (value: string) => void
  placeholder: string
  disabled?: boolean
  allowClear?: boolean
}

function ModelSelectDropdown({
  models,
  groupedModels,
  value,
  onChange,
  placeholder,
  disabled,
  allowClear,
}: ModelSelectDropdownProps): React.JSX.Element {
  const selectedModel = models.find(m => m.id === value)

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder}>
          {selectedModel ? (
            <span className="flex items-center gap-2">
              <span>{selectedModel.name}</span>
              <span className="text-xs text-muted-foreground">
                ({selectedModel.provider})
              </span>
            </span>
          ) : (
            placeholder
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {allowClear && value && (
          <SelectItem value="">
            <span className="text-muted-foreground">Use default model</span>
          </SelectItem>
        )}
        {Array.from(groupedModels.entries()).map(([provider, providerModels]) => (
          <SelectGroup key={provider}>
            <SelectLabel className="text-xs font-semibold uppercase tracking-wider">
              {provider}
            </SelectLabel>
            {providerModels.map(model => (
              <SelectItem
                key={model.id}
                value={model.id}
                disabled={!model.isConfigured}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{model.name}</span>
                    {!model.isConfigured && (
                      <Badge variant="outline" className="text-xs">
                        Configure Key
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatContextLength(model.contextLength)} ctx</span>
                    <span>•</span>
                    <span>{formatPricing(model.pricing.prompt)}</span>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * Compact model selector for use in toolbars or headers
 */
export function CompactModelSelector({
  onModelChange
}: {
  onModelChange?: (model: AIModel) => void
}): React.JSX.Element {
  const { isLoading } = useAIModels()
  const setDefaultModelMutation = useSetDefaultModel()
  const { defaultModelId, availableModels } = useAIStore()
  const isUsingCachedModels = useUsingCachedModels()

  const handleModelChange = useCallback(async (modelId: string) => {
    if (!modelId) return

    const model = availableModels.find(m => m.id === modelId)
    if (!model || !model.isConfigured) return

    try {
      await setDefaultModelMutation.mutateAsync(modelId)
      if (onModelChange) {
        onModelChange(model)
      }
    } catch (err) {
      console.error('Failed to set model:', err)
    }
  }, [availableModels, setDefaultModelMutation, onModelChange])

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Spinner className="h-4 w-4" />
        Loading...
      </div>
    )
  }

  const groupedModels = groupModelsByProvider(availableModels)
  const selectedModel = availableModels.find(m => m.id === defaultModelId)

  return (
    <div className="flex items-center gap-2">
      {isUsingCachedModels && (
        <AlertTriangle className="h-4 w-4 text-yellow-500" title="Using cached models" />
      )}
      <Select
        value={defaultModelId || ''}
        onValueChange={handleModelChange}
        disabled={setDefaultModelMutation.isPending}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select Model">
            {selectedModel?.name || 'Select Model'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Array.from(groupedModels.entries()).map(([provider, providerModels]) => (
            <SelectGroup key={provider}>
              <SelectLabel>{provider}</SelectLabel>
              {providerModels.map(model => (
                <SelectItem
                  key={model.id}
                  value={model.id}
                  disabled={!model.isConfigured}
                >
                  <span className="flex items-center gap-2">
                    <span>{model.name}</span>
                    {!model.isConfigured && (
                      <span className="text-xs text-muted-foreground">
                        (Configure Key)
                      </span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
