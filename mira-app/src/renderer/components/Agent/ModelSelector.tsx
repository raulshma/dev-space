import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from 'renderer/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from 'renderer/components/ui/card'
import { Badge } from 'renderer/components/ui/badge'
import { Button } from 'renderer/components/ui/button'
import { Alert, AlertDescription } from 'renderer/components/ui/alert'
import { Spinner } from 'renderer/components/ui/spinner'
import { Input } from 'renderer/components/ui/input'
import { ScrollArea } from 'renderer/components/ui/scroll-area'
import {
  IconAlertTriangle,
  IconRefresh,
  IconCpu,
  IconCurrencyDollar,
  IconMessage,
  IconSearch,
  IconCheck,
  IconSettings,
  IconChevronRight,
} from '@tabler/icons-react'
import type { AIModel, AIAction } from 'shared/ai-types'
import {
  useAIModels,
  useSetDefaultModel,
  useSetActionModel,
} from 'renderer/hooks/use-ai'
import { useAIStore, useUsingCachedModels } from 'renderer/stores/ai-store'
import { cn } from 'renderer/lib/utils'

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

const ACTION_LABELS: Record<
  AIAction,
  { label: string; description: string; icon: React.ReactNode }
> = {
  chat: {
    label: 'Chat',
    description: 'General conversation and assistance',
    icon: <IconMessage className="h-4 w-4" />,
  },
  'code-generation': {
    label: 'Code Generation',
    description: 'Writing and generating code',
    icon: <IconCpu className="h-4 w-4" />,
  },
  'error-fix': {
    label: 'Error Fixing',
    description: 'Analyzing and fixing errors',
    icon: <IconAlertTriangle className="h-4 w-4" />,
  },
  'parameter-extraction': {
    label: 'Parameter Extraction',
    description: 'Extracting parameters from text',
    icon: <IconCurrencyDollar className="h-4 w-4" />,
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
  const { isLoading, error, refetch } = useAIModels()
  const setDefaultModelMutation = useSetDefaultModel()
  const setActionModelMutation = useSetActionModel()
  const isUsingCachedModels = useUsingCachedModels()

  const { defaultModelId, actionModels, availableModels } = useAIStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [filterTab, setFilterTab] = useState<'all' | 'free' | 'paid'>('all')
  const [activeTarget, setActiveTarget] = useState<'default' | AIAction>(
    'default'
  )
  const [selectedActionModels, setSelectedActionModels] = useState<
    Record<AIAction, string>
  >({
    chat: '',
    'code-generation': '',
    'error-fix': '',
    'parameter-extraction': '',
  })
  const [sortBy, setSortBy] = useState<
    'created' | 'name' | 'context' | 'price'
  >('created')

  // Initialize action models from store
  useEffect(() => {
    const initial: Record<AIAction, string> = {
      chat: '',
      'code-generation': '',
      'error-fix': '',
      'parameter-extraction': '',
    }
    actionModels.forEach((modelId, action) => {
      initial[action] = modelId
    })
    setSelectedActionModels(initial)
  }, [actionModels])

  const handleModelSelect = useCallback(
    async (modelId: string) => {
      if (!modelId) return

      const model = availableModels.find(m => m.id === modelId)
      if (!model) return

      if (!model.isConfigured) {
        alert(
          `Please configure an API key for ${model.provider} in the API Keys settings`
        )
        return
      }

      try {
        if (activeTarget === 'default') {
          await setDefaultModelMutation.mutateAsync(modelId)
          if (onModelChange) {
            onModelChange(model)
          }
        } else {
          await setActionModelMutation.mutateAsync({
            action: activeTarget,
            modelId,
          })
          setSelectedActionModels(prev => ({
            ...prev,
            [activeTarget]: modelId,
          }))
        }
      } catch (err) {
        console.error('Failed to set model:', err)
        alert('Failed to set model. Please try again.')
      }
    },
    [
      availableModels,
      setDefaultModelMutation,
      setActionModelMutation,
      activeTarget,
      onModelChange,
    ]
  )

  const handleRefresh = useCallback(() => {
    refetch()
  }, [refetch])

  const filteredModels = useMemo(() => {
    return availableModels
      .filter(model => {
        const matchesSearch =
          model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          model.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
          model.description?.toLowerCase().includes(searchQuery.toLowerCase())

        const matchesTab =
          filterTab === 'all' ||
          (filterTab === 'free' && model.isFree) ||
          (filterTab === 'paid' && !model.isFree)

        return matchesSearch && matchesTab
      })
      .sort((a, b) => {
        // Primary sort: isConfigured first
        if (a.isConfigured !== b.isConfigured) return a.isConfigured ? -1 : 1

        // Secondary sort: by selected criteria
        switch (sortBy) {
          case 'created':
            return (b.created || 0) - (a.created || 0)
          case 'context':
            return b.contextLength - a.contextLength
          case 'price':
            return (a.pricing.prompt || 0) - (b.pricing.prompt || 0)
          default:
            return a.name.localeCompare(b.name)
        }
      })
  }, [availableModels, searchQuery, filterTab])

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
        <IconAlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>Failed to load models: {error.message}</span>
          <Button onClick={handleRefresh} size="sm" variant="outline">
            <IconRefresh className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const currentSelectedId =
    activeTarget === 'default'
      ? defaultModelId
      : selectedActionModels[activeTarget] || ''

  const currentModel = availableModels.find(m => m.id === currentSelectedId)

  return (
    <div className="flex flex-col gap-6 h-full min-h-[500px]">
      {/* Cached Models Warning */}
      {isUsingCachedModels && (
        <Alert>
          <IconAlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Using cached model list. OpenRouter API may be unavailable.
            </span>
            <Button onClick={handleRefresh} size="sm" variant="outline">
              <IconRefresh className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-6 h-full overflow-hidden">
        {/* Left: Configuration Targets */}
        <div className="w-64 shrink-0 flex flex-col gap-2">
          <div className="text-xs font-semibold px-2 text-muted-foreground uppercase tracking-wider mb-1">
            Configuration Targets
          </div>

          <TargetItem
            description="All general operations"
            icon={<IconSettings className="h-4 w-4" />}
            isActive={activeTarget === 'default'}
            label="Default Model"
            onClick={() => setActiveTarget('default')}
            selectedModelName={
              availableModels.find(m => m.id === defaultModelId)?.name ||
              'Not set'
            }
          />

          {showActionModels &&
            (Object.keys(ACTION_LABELS) as AIAction[]).map(action => {
              const info = ACTION_LABELS[action]
              const modelId = selectedActionModels[action]
              const modelName =
                availableModels.find(m => m.id === modelId)?.name ||
                `Default (${availableModels.find(m => m.id === defaultModelId)?.name || 'Not set'})`

              return (
                <TargetItem
                  description={info.description}
                  icon={info.icon}
                  isActive={activeTarget === action}
                  key={action}
                  label={info.label}
                  onClick={() => setActiveTarget(action)}
                  selectedModelName={modelName}
                />
              )
            })}

          <div className="mt-auto pt-4 border-t px-2">
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span>{availableModels.length} models</span>
              <span>•</span>
              <span className="text-green-600 font-medium">
                {availableModels.filter(m => m.isFree).length} free
              </span>
            </div>
          </div>
        </div>

        {/* Right: Model Selection Grid */}
        <div className="flex-1 flex flex-col border rounded-xl overflow-hidden bg-muted/10">
          <div className="p-4 border-b bg-background/50 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 h-9"
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search models or providers..."
                  value={searchQuery}
                />
              </div>

              <div className="flex gap-1 bg-muted p-1 rounded-md shrink-0">
                {(['all', 'free', 'paid'] as const).map(tab => (
                  <button
                    className={cn(
                      'px-3 py-1 text-xs font-medium rounded transition-all capitalize',
                      filterTab === tab
                        ? 'bg-background text-foreground shadow-sm'
                        : 'hover:text-foreground text-muted-foreground'
                    )}
                    key={tab}
                    onClick={() => setFilterTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <Select onValueChange={(v: any) => setSortBy(v)} value={sortBy}>
                <SelectTrigger className="w-[130px] h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created">Newest First</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="context">Context Size</SelectItem>
                  <SelectItem value="price">Price (Low to High)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                {activeTarget === 'default'
                  ? 'Default Model'
                  : ACTION_LABELS[activeTarget as AIAction].label}
              </div>
              {currentModel && (
                <div className="text-xs text-muted-foreground">
                  Currently:{' '}
                  <span className="font-semibold text-foreground">
                    {currentModel.name}
                  </span>
                </div>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 pb-8">
              {filteredModels.length > 0 ? (
                filteredModels.map(model => (
                  <ModelCard
                    isProcessing={
                      (activeTarget === 'default' &&
                        setDefaultModelMutation.isPending) ||
                      (activeTarget !== 'default' &&
                        setActionModelMutation.isPending)
                    }
                    isSelected={currentSelectedId === model.id}
                    key={model.id}
                    model={model}
                    onClick={() => handleModelSelect(model.id)}
                  />
                ))
              ) : (
                <div className="col-span-full py-12 text-center text-muted-foreground">
                  No models found matching your search
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}

function TargetItem({
  label,
  description,
  icon,
  isActive,
  selectedModelName,
  onClick,
}: {
  label: string
  description?: string
  icon: React.ReactNode
  isActive: boolean
  selectedModelName: string
  onClick: () => void
}) {
  return (
    <button
      className={cn(
        'flex flex-col items-start gap-1 p-3 rounded-xl text-left transition-all w-full',
        isActive
          ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
          : 'hover:bg-accent hover:text-accent-foreground border border-transparent'
      )}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-center gap-2 w-full text-left">
        {icon}
        <span className="font-semibold text-sm flex-1 truncate">{label}</span>
        {isActive && (
          <IconChevronRight className="h-4 w-4 opacity-50 shrink-0" />
        )}
      </div>
      <div
        className={cn(
          'text-[10px] line-clamp-1 text-left',
          isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'
        )}
      >
        {selectedModelName}
      </div>
    </button>
  )
}

function ModelCard({
  model,
  isSelected,
  onClick,
  isProcessing,
}: {
  model: AIModel
  isSelected: boolean
  onClick: () => void
  isProcessing?: boolean
}) {
  return (
    <button
      className={cn(
        'group relative flex flex-col p-4 rounded-xl border transition-all cursor-pointer text-left w-full',
        isSelected
          ? 'border-primary bg-primary/3 ring-1 ring-primary'
          : 'bg-background hover:bg-accent/50 hover:border-accent-foreground/20',
        !model.isConfigured && 'opacity-60 grayscale-[0.5]',
        isProcessing && 'pointer-events-none'
      )}
      disabled={isProcessing}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-bold text-sm tracking-tight truncate">
              {model.name}
            </span>
            {!model.isConfigured && (
              <Badge
                className="text-[10px] px-1 py-0 border-yellow-500/50 text-yellow-600 bg-yellow-500/5 shrink-0"
                variant="outline"
              >
                Key Required
              </Badge>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 uppercase font-medium tracking-wider">
            {model.provider}
          </div>
        </div>
        <div
          className={cn(
            'shrink-0 p-1.5 rounded-full transition-all',
            isSelected
              ? 'bg-primary text-primary-foreground shadow-sm scale-110'
              : 'bg-muted text-muted-foreground opacity-0 group-hover:opacity-100'
          )}
        >
          <IconCheck className="h-3 w-3" strokeWidth={3} />
        </div>
      </div>

      <div className="mt-auto space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {model.isFree && (
            <Badge
              className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-200/50 uppercase font-bold tracking-tighter"
              variant="secondary"
            >
              Free
            </Badge>
          )}
          <Badge
            className="text-[10px] px-1.5 py-0 bg-muted/50 font-medium"
            variant="outline"
          >
            {formatContextLength(model.contextLength)} ctx
          </Badge>
          {!model.isFree && (
            <Badge
              className="text-[10px] px-1.5 py-0 bg-blue-50/50 text-blue-700 border-blue-200/50 font-medium"
              variant="outline"
            >
              In: {formatPricing(model.pricing.prompt)}
            </Badge>
          )}
          {model.architecture?.modality && (
            <Badge
              className="text-[10px] px-1.5 py-0 bg-purple-50/50 text-purple-700 border-purple-200/50 font-medium"
              variant="outline"
            >
              {model.architecture.modality}
            </Badge>
          )}
          {model.supportedMethods?.map(method => (
            <Badge
              className="text-[10px] px-1.5 py-0 bg-orange-50/50 text-orange-700 border-orange-200/50 font-medium capitalize"
              key={method}
              variant="outline"
            >
              {method}
            </Badge>
          ))}
        </div>

        {model.description && (
          <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed h-[2.5em]">
            {model.description}
          </p>
        )}
      </div>

      {isSelected && (
        <div className="absolute top-0 right-0 p-1">
          <div className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
        </div>
      )}
    </button>
  )
}

/**
 * Compact model selector for use in toolbars or headers
 */
export function CompactModelSelector({
  onModelChange,
}: {
  onModelChange?: (model: AIModel) => void
}): React.JSX.Element {
  const { isLoading } = useAIModels()
  const setDefaultModelMutation = useSetDefaultModel()
  const { defaultModelId, availableModels } = useAIStore()
  const isUsingCachedModels = useUsingCachedModels()

  const handleModelChange = useCallback(
    async (modelId: string | null) => {
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
    },
    [availableModels, setDefaultModelMutation, onModelChange]
  )

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
        <IconAlertTriangle
          className="h-4 w-4 text-yellow-500"
          title="Using cached models"
        />
      )}
      <Select
        disabled={setDefaultModelMutation.isPending}
        onValueChange={handleModelChange}
        value={defaultModelId || null}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue>
            {selectedModel?.name || (
              <span className="text-muted-foreground">Select Model</span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Array.from(groupedModels.entries()).map(
            ([provider, providerModels]) => (
              <SelectGroup key={provider}>
                <SelectLabel>{provider}</SelectLabel>
                {providerModels.map(model => (
                  <SelectItem
                    disabled={!model.isConfigured}
                    key={model.id}
                    value={model.id}
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
            )
          )}
        </SelectContent>
      </Select>
    </div>
  )
}
