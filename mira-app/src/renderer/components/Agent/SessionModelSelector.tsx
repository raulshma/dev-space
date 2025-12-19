/**
 * Session Model Selector Component
 *
 * A simplified model selector for use within session contexts.
 * Provides a dropdown for AI model selection with model info display.
 *
 * Requirements: 6.5, 6.6
 */

import { memo, useCallback, useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from 'renderer/components/ui/select'
import { Badge } from 'renderer/components/ui/badge'
import { Spinner } from 'renderer/components/ui/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from 'renderer/components/ui/tooltip'
import { IconCpu, IconAlertTriangle } from '@tabler/icons-react'
import { useAIModels } from 'renderer/hooks/use-ai'
import { useAIStore } from 'renderer/stores/ai-store'
import type { AIModel } from 'shared/ai-types'
import { cn } from 'renderer/lib/utils'

interface SessionModelSelectorProps {
  /** Currently selected model ID */
  value: string
  /** Callback when model changes */
  onChange: (modelId: string) => void
  /** Whether the selector is disabled */
  disabled?: boolean
  /** Optional compact mode */
  compact?: boolean
  /** Optional className */
  className?: string
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

export const SessionModelSelector = memo(function SessionModelSelector({
  value,
  onChange,
  disabled = false,
  compact = false,
  className,
}: SessionModelSelectorProps): React.JSX.Element {
  const { isLoading } = useAIModels()
  const { availableModels } = useAIStore()

  // Filter to only configured models and sort by provider
  const configuredModels = useMemo(() => {
    return availableModels
      .filter(m => m.isConfigured)
      .sort((a, b) => {
        // Sort by provider, then by name
        const providerCompare = a.provider.localeCompare(b.provider)
        if (providerCompare !== 0) return providerCompare
        return a.name.localeCompare(b.name)
      })
  }, [availableModels])

  const groupedModels = useMemo(
    () => groupModelsByProvider(configuredModels),
    [configuredModels]
  )

  const selectedModel = useMemo(
    () => availableModels.find(m => m.id === value),
    [availableModels, value]
  )

  const handleChange = useCallback(
    (modelId: string | null) => {
      if (modelId) {
        onChange(modelId)
      }
    },
    [onChange]
  )

  if (isLoading) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 text-sm text-muted-foreground',
          className
        )}
      >
        <Spinner className="h-4 w-4" />
        <span>Loading models...</span>
      </div>
    )
  }

  if (configuredModels.length === 0) {
    return (
      <Tooltip>
        <TooltipTrigger
          className={cn(
            'flex items-center gap-2 text-sm text-muted-foreground',
            className
          )}
        >
          <IconAlertTriangle className="h-4 w-4 text-yellow-500" />
          <span>No models configured</span>
        </TooltipTrigger>
        <TooltipContent>
          Configure API keys in Settings to enable AI models
        </TooltipContent>
      </Tooltip>
    )
  }

  if (compact) {
    return (
      <Select disabled={disabled} onValueChange={handleChange} value={value}>
        <SelectTrigger className={cn('w-[180px] h-8 text-xs', className)}>
          <SelectValue>
            {selectedModel ? (
              <span className="truncate">{selectedModel.name}</span>
            ) : (
              <span className="text-muted-foreground">Select model</span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Array.from(groupedModels.entries()).map(([provider, models]) => (
            <SelectGroup key={provider}>
              <SelectLabel className="text-xs">{provider}</SelectLabel>
              {models.map(model => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex items-center gap-2">
                    <span className="truncate">{model.name}</span>
                    {model.isFree && (
                      <Badge
                        className="h-4 px-1 text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200/50"
                        variant="secondary"
                      >
                        Free
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <Select disabled={disabled} onValueChange={handleChange} value={value}>
        <SelectTrigger className="w-full">
          <SelectValue>
            {selectedModel ? (
              <div className="flex items-center gap-2">
                <IconCpu className="h-4 w-4 shrink-0" />
                <span className="truncate">{selectedModel.name}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">Select model</span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Array.from(groupedModels.entries()).map(([provider, models]) => (
            <SelectGroup key={provider}>
              <SelectLabel>{provider}</SelectLabel>
              {models.map(model => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex items-center justify-between gap-4 w-full">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate font-medium">{model.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {model.isFree && (
                        <Badge
                          className="h-4 px-1 text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200/50"
                          variant="secondary"
                        >
                          Free
                        </Badge>
                      )}
                      <Badge className="h-4 px-1 text-[9px]" variant="outline">
                        {formatContextLength(model.contextLength)} ctx
                      </Badge>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>

      {/* Model info display */}
      {selectedModel && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <span>{selectedModel.provider}</span>
          <span>•</span>
          <span>
            {formatContextLength(selectedModel.contextLength)} context
          </span>
          {selectedModel.isFree && (
            <>
              <span>•</span>
              <span className="text-emerald-600">Free</span>
            </>
          )}
        </div>
      )}
    </div>
  )
})

/**
 * Compact model selector for use in headers/toolbars
 */
export const CompactSessionModelSelector = memo(
  function CompactSessionModelSelector(
    props: Omit<SessionModelSelectorProps, 'compact'>
  ): React.JSX.Element {
    return <SessionModelSelector {...props} compact />
  }
)

/**
 * Model badge display component
 * Shows the model name in a badge format for display in lists
 */
interface ModelBadgeProps {
  modelId: string
  className?: string
}

export const ModelBadge = memo(function ModelBadge({
  modelId,
  className,
}: ModelBadgeProps): React.JSX.Element | null {
  const { availableModels } = useAIStore()
  const model = availableModels.find(m => m.id === modelId)

  if (!model) {
    return (
      <Badge className={cn('text-xs', className)} variant="outline">
        {modelId.split('/').pop() || modelId}
      </Badge>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge
          className={cn(
            'text-xs gap-1',
            model.isFree &&
              'bg-emerald-50 text-emerald-700 border-emerald-200/50',
            className
          )}
          variant="outline"
        >
          <IconCpu className="h-3 w-3" />
          {model.name}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs">
          <p className="font-medium">{model.name}</p>
          <p className="text-muted-foreground">
            {model.provider} • {formatContextLength(model.contextLength)}{' '}
            context
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  )
})
