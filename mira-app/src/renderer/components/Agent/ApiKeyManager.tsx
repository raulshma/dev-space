import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from 'renderer/components/ui/card'
import { Input } from 'renderer/components/ui/input'
import { Button } from 'renderer/components/ui/button'
import { Badge } from 'renderer/components/ui/badge'
import { Alert, AlertDescription } from 'renderer/components/ui/alert'
import { Info } from 'lucide-react'
import type { AIProvider } from 'shared/models'

/**
 * ApiKeyManager Component
 *
 * Manages API keys for AI providers with secure storage through OS keychain.
 * Displays configured providers with masked keys and handles key input/deletion.
 *
 * Requirements: 8.1, 8.2, 8.4
 */

interface ProviderConfig {
  provider: AIProvider
  name: string
  description: string
}

const PROVIDERS: ProviderConfig[] = [
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

export function ApiKeyManager(): React.JSX.Element {
  const [providerStatus, setProviderStatus] = useState<
    Record<AIProvider, boolean>
  >({
    openai: false,
    anthropic: false,
    google: false,
    local: false,
  })
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(
    null
  )
  const [keyInput, setKeyInput] = useState('')
  const [loading, setLoading] = useState(false)

  // Load provider status on mount
  useEffect(() => {
    loadProviderStatus()
  }, [])

  const loadProviderStatus = async (): Promise<void> => {
    try {
      const status: Record<AIProvider, boolean> = {
        openai: false,
        anthropic: false,
        google: false,
        local: false,
      }

      for (const provider of PROVIDERS) {
        const response = await window.api.keychain.has({
          provider: provider.provider,
        })
        status[provider.provider] = response.hasKey
      }

      setProviderStatus(status)
    } catch (error) {
      console.error('Failed to load provider status:', error)
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
      alert('API key saved successfully')
    } catch (error) {
      console.error('Failed to save API key:', error)
      alert('Failed to save API key. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteKey = async (provider: AIProvider): Promise<void> => {
    if (!confirm(`Are you sure you want to delete the ${provider} API key?`)) {
      return
    }

    setLoading(true)

    try {
      await window.api.keychain.delete({ provider })
      await loadProviderStatus()
      alert('API key deleted successfully')
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

      {/* Provider list */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4">
          {PROVIDERS.map(config => {
            const isConfigured = providerStatus[config.provider]
            const isEditing = editingProvider === config.provider

            return (
              <Card key={config.provider}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{config.name}</CardTitle>
                    {isConfigured && (
                      <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400">
                        Configured
                      </Badge>
                    )}
                  </div>
                  <CardDescription>{config.description}</CardDescription>
                </CardHeader>

                <CardContent>
                  {isEditing ? (
                    <div className="space-y-3">
                      <Input
                        onChange={e => setKeyInput(e.target.value)}
                        placeholder="Enter API key"
                        type="password"
                        value={keyInput}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={loading}
                          onClick={() => handleSaveKey(config.provider)}
                        >
                          Save
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
                  ) : isConfigured ? (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        ••••••••••••••••
                      </span>
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
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={loading}
                      onClick={() => handleEditClick(config.provider)}
                    >
                      Add API Key
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
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
}
