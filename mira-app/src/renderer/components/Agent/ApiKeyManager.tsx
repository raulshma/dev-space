import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from 'renderer/components/ui/card'
import { Input } from 'renderer/components/ui/input'
import { Button } from 'renderer/components/ui/button'
import { Badge } from 'renderer/components/ui/badge'
import { Alert, AlertDescription } from 'renderer/components/ui/alert'
import { Info, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import type { AIProvider } from 'shared/models'

/**
 * ApiKeyManager Component
 *
 * Manages API keys for AI providers with secure storage through OS keychain.
 * Displays configured providers with masked keys and handles key input/deletion.
 * Includes OpenRouter as the primary provider for unified model access.
 *
 * Requirements: 2.1, 2.3, 2.4, 2.5
 */

interface ProviderConfig {
  provider: AIProvider
  name: string
  description: string
  isPrimary?: boolean
}

const PROVIDERS: ProviderConfig[] = [
  {
    provider: 'openrouter',
    name: 'OpenRouter',
    description: 'Unified access to multiple AI models (GPT-4, Claude, Gemini, and more)',
    isPrimary: true,
  },
  {
    provider: 'openai',
    name: 'OpenAI',
    description: 'GPT-4, GPT-4 Turbo, and other OpenAI models',
  },
  {
    provider: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 3 Opus, Claude 3.5 Sonnet, and other Claude models',
  },
  {
    provider: 'google',
    name: 'Google',
    description: 'Gemini Pro and other Google AI models',
  },
  {
    provider: 'local',
    name: 'Local',
    description: 'Local AI models (Ollama, LM Studio, etc.)',
  },
]

/**
 * Masks an API key showing only the last 4 characters.
 * For keys with 4 or fewer characters, shows all asterisks.
 *
 * @param key - The API key to mask
 * @returns Masked representation of the key
 */
function maskApiKey(key: string): string {
  if (key.length <= 4) {
    return '•'.repeat(key.length)
  }
  return '•'.repeat(key.length - 4) + key.slice(-4)
}

type ConfigurationStatus = 'configured' | 'not_configured' | 'error'

interface ProviderStatusInfo {
  hasKey: boolean
  maskedKey?: string
  status: ConfigurationStatus
  errorMessage?: string
}

export function ApiKeyManager(): React.JSX.Element {
  const [providerStatus, setProviderStatus] = useState<
    Record<AIProvider, ProviderStatusInfo>
  >({
    openrouter: { hasKey: false, status: 'not_configured' },
    openai: { hasKey: false, status: 'not_configured' },
    anthropic: { hasKey: false, status: 'not_configured' },
    google: { hasKey: false, status: 'not_configured' },
    local: { hasKey: false, status: 'not_configured' },
  })
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(
    null
  )
  const [keyInput, setKeyInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  // Load provider status on mount
  useEffect(() => {
    loadProviderStatus()
  }, [])

  const loadProviderStatus = async (): Promise<void> => {
    try {
      setInitialLoading(true)
      const status: Record<AIProvider, ProviderStatusInfo> = {
        openrouter: { hasKey: false, status: 'not_configured' },
        openai: { hasKey: false, status: 'not_configured' },
        anthropic: { hasKey: false, status: 'not_configured' },
        google: { hasKey: false, status: 'not_configured' },
        local: { hasKey: false, status: 'not_configured' },
      }

      for (const provider of PROVIDERS) {
        try {
          const hasResponse = await window.api.keychain.has({
            provider: provider.provider,
          })

          if (hasResponse.hasKey) {
            // Get the actual key to create masked version
            const keyResponse = await window.api.keychain.get({
              provider: provider.provider,
            })

            status[provider.provider] = {
              hasKey: true,
              maskedKey: keyResponse.key ? maskApiKey(keyResponse.key) : undefined,
              status: 'configured',
            }
          } else {
            status[provider.provider] = {
              hasKey: false,
              status: 'not_configured',
            }
          }
        } catch (error) {
          status[provider.provider] = {
            hasKey: false,
            status: 'error',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      }

      setProviderStatus(status)
    } catch (error) {
      console.error('Failed to load provider status:', error)
    } finally {
      setInitialLoading(false)
    }
  }

  const handleSaveKey = async (provider: AIProvider): Promise<void> => {
    if (!keyInput.trim()) {
      alert('Please enter an API key')
      return
    }

    setLoading(true)

    try {
      await window.api.keychain.set({ provider, key: keyInput.trim() })
      await loadProviderStatus()
      setEditingProvider(null)
      setKeyInput('')
    } catch (error) {
      console.error('Failed to save API key:', error)
      alert('Failed to save API key. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteKey = async (provider: AIProvider): Promise<void> => {
    const providerName = PROVIDERS.find(p => p.provider === provider)?.name || provider
    if (!confirm(`Are you sure you want to delete the ${providerName} API key?`)) {
      return
    }

    setLoading(true)

    try {
      await window.api.keychain.delete({ provider })
      await loadProviderStatus()
    } catch (error) {
      console.error('Failed to delete API key:', error)
      alert('Failed to delete API key. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleEditClick = (provider: AIProvider): void => {
    setEditingProvider(provider)
    setKeyInput('')
  }

  const handleCancelEdit = (): void => {
    setEditingProvider(null)
    setKeyInput('')
  }

  const getStatusIcon = (status: ConfigurationStatus) => {
    switch (status) {
      case 'configured':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />
      default:
        return <AlertTriangle className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getStatusBadge = (status: ConfigurationStatus) => {
    switch (status) {
      case 'configured':
        return (
          <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400">
            Configured
          </Badge>
        )
      case 'error':
        return (
          <Badge variant="destructive">
            Error
          </Badge>
        )
      default:
        return null
    }
  }

  if (initialLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading configuration...</div>
      </div>
    )
  }

  // Separate primary (OpenRouter) from other providers
  const primaryProvider = PROVIDERS.find(p => p.isPrimary)
  const otherProviders = PROVIDERS.filter(p => !p.isPrimary)

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold">
          API Key Management
        </h3>
        <p className="text-sm text-muted-foreground">
          Configure API keys for AI providers. Keys are stored securely in your
          OS keychain.
        </p>
      </div>

      {/* Configuration Status Summary */}
      <div className="mb-6 flex items-center gap-4 rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center gap-2">
          {getStatusIcon(providerStatus.openrouter?.status || 'not_configured')}
          <span className="text-sm font-medium">
            {providerStatus.openrouter?.status === 'configured'
              ? 'OpenRouter configured - Ready to use AI models'
              : 'Configure OpenRouter to access AI models'}
          </span>
        </div>
      </div>

      {/* Provider list */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4">
          {/* Primary Provider (OpenRouter) */}
          {primaryProvider && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{primaryProvider.name}</CardTitle>
                  <Badge variant="outline" className="text-xs">Recommended</Badge>
                  {getStatusBadge(providerStatus[primaryProvider.provider]?.status || 'not_configured')}
                </div>
                <CardDescription>{primaryProvider.description}</CardDescription>
              </CardHeader>

              <CardContent>
                {renderProviderContent(primaryProvider)}
              </CardContent>
            </Card>
          )}

          {/* Other Providers */}
          <div className="pt-4">
            <h4 className="mb-3 text-sm font-medium text-muted-foreground">Other Providers</h4>
            <div className="space-y-3">
              {otherProviders.map(config => (
                <Card key={config.provider}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{config.name}</CardTitle>
                      {getStatusBadge(providerStatus[config.provider]?.status || 'not_configured')}
                    </div>
                    <CardDescription className="text-xs">{config.description}</CardDescription>
                  </CardHeader>

                  <CardContent className="pt-0">
                    {renderProviderContent(config)}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <Alert className="mt-6">
        <Info className="h-4 w-4" />
        <AlertDescription>
          API keys are stored securely in your operating system&apos;s
          keychain and are never sent anywhere except to the respective AI
          provider.
        </AlertDescription>
      </Alert>
    </div>
  )

  function renderProviderContent(config: ProviderConfig) {
    const statusInfo = providerStatus[config.provider]
    const isEditing = editingProvider === config.provider

    if (isEditing) {
      return (
        <div className="space-y-3">
          <Input
            onChange={e => setKeyInput(e.target.value)}
            placeholder={`Enter ${config.name} API key`}
            type="password"
            value={keyInput}
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={loading}
              onClick={() => handleSaveKey(config.provider)}
            >
              {loading ? 'Saving...' : 'Save'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={handleCancelEdit}
            >
              Cancel
            </Button>
          </div>
        </div>
      )
    }

    if (statusInfo?.status === 'configured') {
      return (
        <div className="flex items-center gap-3">
          <code className="rounded bg-muted px-2 py-1 text-xs font-mono text-muted-foreground">
            {statusInfo.maskedKey || '••••••••••••'}
          </code>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            disabled={loading}
            onClick={() => handleEditClick(config.provider)}
          >
            Update
          </Button>
          <span className="text-muted-foreground">•</span>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-destructive"
            disabled={loading}
            onClick={() => handleDeleteKey(config.provider)}
          >
            Delete
          </Button>
        </div>
      )
    }

    if (statusInfo?.status === 'error') {
      return (
        <div className="space-y-2">
          <p className="text-xs text-destructive">{statusInfo.errorMessage}</p>
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => handleEditClick(config.provider)}
          >
            Try Again
          </Button>
        </div>
      )
    }

    return (
      <Button
        variant={config.isPrimary ? 'default' : 'outline'}
        size="sm"
        disabled={loading}
        onClick={() => handleEditClick(config.provider)}
      >
        Add API Key
      </Button>
    )
  }
}
