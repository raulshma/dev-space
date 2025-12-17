import { useState, useEffect } from 'react'
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
        <h3 className="text-lg font-semibold text-neutral-100">
          API Key Management
        </h3>
        <p className="text-sm text-neutral-400">
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
              <div
                className="p-4 border border-neutral-700 rounded-lg"
                key={config.provider}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-neutral-100">
                        {config.name}
                      </h4>
                      {isConfigured && (
                        <span className="rounded-full bg-green-900/50 px-2 py-0.5 text-xs font-medium text-green-400">
                          Configured
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-neutral-400">
                      {config.description}
                    </p>

                    {isEditing ? (
                      <div className="mt-3 space-y-2">
                        <input
                          className="w-full rounded-sm border border-neutral-600 bg-neutral-900 text-neutral-100 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          onChange={e => setKeyInput(e.target.value)}
                          placeholder="Enter API key"
                          type="password"
                          value={keyInput}
                        />
                        <div className="flex gap-2">
                          <button
                            className="rounded-sm bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:bg-neutral-700"
                            disabled={loading}
                            onClick={() => handleSaveKey(config.provider)}
                          >
                            Save
                          </button>
                          <button
                            className="rounded-sm border border-neutral-600 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800"
                            disabled={loading}
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : isConfigured ? (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-neutral-400">
                          ••••••••••••••••
                        </span>
                        <button
                          className="text-xs text-amber-400 hover:text-amber-300"
                          disabled={loading}
                          onClick={() => handleEditClick(config.provider)}
                        >
                          Update
                        </button>
                        <span className="text-neutral-600">•</span>
                        <button
                          className="text-xs text-red-400 hover:text-red-300"
                          disabled={loading}
                          onClick={() => handleDeleteKey(config.provider)}
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <button
                        className="mt-3 rounded-sm border border-amber-600 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-900/20"
                        disabled={loading}
                        onClick={() => handleEditClick(config.provider)}
                      >
                        Add API Key
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer info */}
      <div className="mt-6 pt-4 border-t border-neutral-700">
        <div className="flex items-start gap-2 text-xs text-neutral-400">
          <svg
            className="mt-0.5 h-4 w-4 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              clipRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              fillRule="evenodd"
            />
          </svg>
          <p>
            API keys are stored securely in your operating system&apos;s
            keychain and are never sent anywhere except to the respective AI
            provider.
          </p>
        </div>
      </div>
    </div>
  )
}
