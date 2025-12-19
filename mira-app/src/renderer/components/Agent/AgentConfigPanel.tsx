/**
 * Agent Configuration Panel Component
 *
 * Provides UI for configuring the coding agent environment including:
 * - Service/CLI selector (Claude Code, OpenCode, Google Jules, etc.)
 * - Service-specific configuration options
 * - Custom environment variable editor
 * - Validation feedback
 *
 * Requirements: 5.1, 5.3, 5.5
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from 'renderer/components/ui/card'
import { Input } from 'renderer/components/ui/input'
import { Button } from 'renderer/components/ui/button'
import { Label } from 'renderer/components/ui/label'
import { Alert, AlertDescription } from 'renderer/components/ui/alert'
import { Badge } from 'renderer/components/ui/badge'
import {
  IconPlus,
  IconTrash,
  IconCheck,
  IconAlertTriangle,
  IconLoader2,
  IconInfoCircle,
  IconChevronLeft,
  IconExternalLink,
  IconRobot,
  IconBrandGoogle,
  IconTerminal2,
  IconCode,
  IconSettings,
  IconWand,
} from '@tabler/icons-react'
import { useCLIDetection } from 'renderer/hooks/use-cli-detection'
import type {
  AgentEnvironmentConfig,
  AgentConfigValidationError,
  AgentCLIService,
  AgentCLIServiceInfo,
} from 'shared/ai-types'
import { AGENT_CLI_SERVICES } from 'shared/ai-types'

/**
 * Masks a token showing only the last 4 characters
 */
function maskToken(token: string): string {
  if (token.length <= 4) {
    return '•'.repeat(token.length)
  }
  return '•'.repeat(token.length - 4) + token.slice(-4)
}

interface EnvVarEntry {
  key: string
  value: string
}

/**
 * Get icon for agent service
 */
function getServiceIcon(serviceId: AgentCLIService): React.ReactNode {
  switch (serviceId) {
    case 'claude-code':
      return <IconRobot className="h-5 w-5" />
    case 'google-jules':
      return <IconBrandGoogle className="h-5 w-5" />
    case 'opencode':
      return <IconCode className="h-5 w-5" />
    case 'aider':
      return <IconTerminal2 className="h-5 w-5" />
    case 'custom':
      return <IconSettings className="h-5 w-5" />
    default:
      return <IconRobot className="h-5 w-5" />
  }
}

/**
 * Service selector card component
 */
function ServiceCard({
  service,
  isSelected,
  onClick,
}: {
  service: AgentCLIServiceInfo
  isSelected: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <Card
      className={`cursor-pointer transition-all hover:border-primary/50 ${
        isSelected ? 'border-primary bg-primary/5' : ''
      }`}
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-4 p-4">
        <div
          className={`rounded-lg p-2 ${isSelected ? 'bg-primary/10 text-primary' : 'bg-muted'}`}
        >
          {getServiceIcon(service.id)}
        </div>
        <div className="flex-1">
          <h4 className="font-medium">{service.name}</h4>
          <p className="text-sm text-muted-foreground">{service.description}</p>
        </div>
        {service.docsUrl && (
          <Button
            onClick={e => {
              e.stopPropagation()
              window.open(service.docsUrl, '_blank')
            }}
            size="icon-sm"
            variant="ghost"
          >
            <IconExternalLink className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Python Configuration Card with auto-detection
 */
function PythonConfigCard({
  config,
  setConfig,
}: {
  config: AgentEnvironmentConfig
  setConfig: React.Dispatch<React.SetStateAction<AgentEnvironmentConfig>>
}): React.JSX.Element {
  const {
    data: pythonDetection,
    isLoading: isDetecting,
    refetch: detectPython,
  } = useCLIDetection('python', { enabled: false })

  const [showInstallations, setShowInstallations] = useState(false)

  const handleAutoDetect = async (): Promise<void> => {
    const result = await detectPython()
    const recommended = result.data?.result.recommended
    if (recommended?.path) {
      setConfig(prev => ({
        ...prev,
        pythonPath: recommended.path,
      }))
    }
  }

  const handleSelectInstallation = (path: string): void => {
    setConfig(prev => ({ ...prev, pythonPath: path }))
    setShowInstallations(false)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Python Configuration</CardTitle>
        <CardDescription>
          Path to Python executable for running agents
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="python-path">Python Path</Label>
          <div className="flex gap-2">
            <Input
              className="flex-1"
              id="python-path"
              onChange={e =>
                setConfig(prev => ({ ...prev, pythonPath: e.target.value }))
              }
              placeholder="python"
              type="text"
              value={config.pythonPath}
            />
            <Button
              disabled={isDetecting}
              onClick={handleAutoDetect}
              size="sm"
              title="Auto-detect Python"
              variant="outline"
            >
              {isDetecting ? (
                <IconLoader2 className="h-4 w-4 animate-spin" />
              ) : (
                <IconWand className="h-4 w-4" />
              )}
              <span className="ml-1.5">Detect</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Path to Python 3.x executable (e.g., python, python3,
            /usr/bin/python3)
          </p>
        </div>

        {/* Detection results */}
        {pythonDetection?.result && (
          <div className="space-y-2">
            {pythonDetection.result.found ? (
              <>
                {pythonDetection.result.recommended && (
                  <Alert className="border-green-500/30 bg-green-500/5 py-2">
                    <IconCheck className="h-4 w-4 text-green-500" />
                    <AlertDescription className="text-sm">
                      <span className="font-medium">Detected:</span>{' '}
                      <code className="rounded bg-muted px-1 py-0.5 text-xs">
                        {pythonDetection.result.recommended.path}
                      </code>
                      {pythonDetection.result.recommended.version && (
                        <span className="ml-2 text-muted-foreground">
                          (v{pythonDetection.result.recommended.version})
                        </span>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {pythonDetection.result.installations.length > 1 && (
                  <div>
                    <Button
                      className="h-auto p-0 text-xs"
                      onClick={() => setShowInstallations(!showInstallations)}
                      variant="link"
                    >
                      {showInstallations ? 'Hide' : 'Show'}{' '}
                      {pythonDetection.result.installations.length}{' '}
                      installations found
                    </Button>

                    {showInstallations && (
                      <div className="mt-2 space-y-1 rounded-md border p-2">
                        {pythonDetection.result.installations.map(
                          installation => (
                            <div
                              className="flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-muted"
                              key={installation.path}
                            >
                              <div className="flex items-center gap-2">
                                <code className="text-muted-foreground">
                                  {installation.path}
                                </code>
                                {installation.version && (
                                  <Badge
                                    className="text-[10px]"
                                    variant="secondary"
                                  >
                                    v{installation.version}
                                  </Badge>
                                )}
                                {installation.isDefault && (
                                  <Badge
                                    className="text-[10px]"
                                    variant="outline"
                                  >
                                    recommended
                                  </Badge>
                                )}
                              </div>
                              <Button
                                className="h-6 px-2 text-xs"
                                onClick={() =>
                                  handleSelectInstallation(installation.path)
                                }
                                size="sm"
                                variant="ghost"
                              >
                                Use
                              </Button>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <Alert className="border-yellow-500/30 bg-yellow-500/5 py-2">
                <IconAlertTriangle className="h-4 w-4 text-yellow-500" />
                <AlertDescription className="text-sm text-muted-foreground">
                  Python not found. Please install Python 3.x or enter the path
                  manually.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function AgentConfigPanel(): React.JSX.Element {
  // View state - 'select' for service selection, 'configure' for configuration
  const [view, setView] = useState<'select' | 'configure'>('select')
  const [selectedService, setSelectedService] =
    useState<AgentCLIService | null>(null)

  // Configuration state
  const [config, setConfig] = useState<AgentEnvironmentConfig>({
    agentService: 'claude-code',
    anthropicAuthToken: '',
    anthropicBaseUrl: '',
    apiTimeoutMs: 30000,
    pythonPath: 'python',
    customEnvVars: {},
  })

  // UI state
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isConfigured, setIsConfigured] = useState(false)
  const [validationErrors, setValidationErrors] = useState<
    AgentConfigValidationError[]
  >([])
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [tokenInput, setTokenInput] = useState('')
  const [isEditingToken, setIsEditingToken] = useState(false)

  // Custom env vars as array for easier editing
  const [envVars, setEnvVars] = useState<EnvVarEntry[]>([])
  const [newEnvKey, setNewEnvKey] = useState('')
  const [newEnvValue, setNewEnvValue] = useState('')

  // Load configuration on mount
  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async (): Promise<void> => {
    try {
      setIsLoading(true)
      const response = await window.api.agentConfig.get({})
      const loadedConfig = response.config

      setConfig(loadedConfig)
      setTokenInput(loadedConfig.anthropicAuthToken ? '••••••••' : '')

      // Convert customEnvVars object to array
      const vars = Object.entries(loadedConfig.customEnvVars || {}).map(
        ([key, value]) => ({ key, value })
      )
      setEnvVars(vars)

      // Check if configured and set view accordingly
      const configuredResponse = await window.api.agentConfig.isConfigured({})
      setIsConfigured(configuredResponse.isConfigured)

      // If already configured, show the configure view with the saved service
      if (configuredResponse.isConfigured && loadedConfig.agentService) {
        setSelectedService(loadedConfig.agentService)
        setView('configure')
      }
    } catch (error) {
      console.error('Failed to load agent config:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleServiceSelect = (serviceId: AgentCLIService): void => {
    setSelectedService(serviceId)
    setConfig(prev => ({ ...prev, agentService: serviceId }))
    setView('configure')
  }

  const handleBackToSelect = (): void => {
    setView('select')
    setValidationErrors([])
    setSaveSuccess(false)
  }

  const validateAndSave = useCallback(async (): Promise<void> => {
    setIsSaving(true)
    setSaveSuccess(false)
    setValidationErrors([])

    try {
      const updatedConfig: AgentEnvironmentConfig = {
        ...config,
        anthropicAuthToken: isEditingToken
          ? tokenInput
          : config.anthropicAuthToken,
        customEnvVars: envVars.reduce(
          (acc, { key, value }) => {
            if (key.trim()) {
              acc[key.trim()] = value
            }
            return acc
          },
          {} as Record<string, string>
        ),
      }

      const validationResponse = await window.api.agentConfig.validate({
        config: updatedConfig,
      })

      if (!validationResponse.result.isValid) {
        setValidationErrors(validationResponse.result.errors)
        return
      }

      await window.api.agentConfig.set({
        updates: {
          agentService: config.agentService,
          anthropicAuthToken: isEditingToken ? tokenInput : undefined,
          anthropicBaseUrl: config.anthropicBaseUrl || undefined,
          apiTimeoutMs: config.apiTimeoutMs,
          pythonPath: config.pythonPath,
          customEnvVars: updatedConfig.customEnvVars,
          googleApiKey: config.googleApiKey,
          openaiApiKey: config.openaiApiKey,
          customCommand: config.customCommand,
        },
      })

      setSaveSuccess(true)
      setIsEditingToken(false)
      setTokenInput(tokenInput ? '••••••••' : '')
      await loadConfig()
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      console.error('Failed to save agent config:', error)
      setValidationErrors([
        {
          field: 'anthropicAuthToken',
          message:
            error instanceof Error
              ? error.message
              : 'Failed to save configuration',
        },
      ])
    } finally {
      setIsSaving(false)
    }
  }, [config, tokenInput, isEditingToken, envVars])

  const handleAddEnvVar = (): void => {
    if (!newEnvKey.trim()) return
    setEnvVars([...envVars, { key: newEnvKey.trim(), value: newEnvValue }])
    setNewEnvKey('')
    setNewEnvValue('')
  }

  const handleRemoveEnvVar = (index: number): void => {
    setEnvVars(envVars.filter((_, i) => i !== index))
  }

  const handleEnvVarChange = (
    index: number,
    field: 'key' | 'value',
    value: string
  ): void => {
    const updated = [...envVars]
    updated[index] = { ...updated[index], [field]: value }
    setEnvVars(updated)
  }

  const getFieldError = (
    field: keyof AgentEnvironmentConfig
  ): string | undefined => {
    return validationErrors.find(e => e.field === field)?.message
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Service selection view
  if (view === 'select') {
    return (
      <div className="flex h-full flex-col gap-4">
        <div>
          <h3 className="text-lg font-semibold">Agent Configuration</h3>
          <p className="text-sm text-muted-foreground">
            Select a coding agent CLI to configure
          </p>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto">
          {AGENT_CLI_SERVICES.map(service => (
            <ServiceCard
              isSelected={selectedService === service.id}
              key={service.id}
              onClick={() => handleServiceSelect(service.id)}
              service={service}
            />
          ))}
        </div>
      </div>
    )
  }

  // Get selected service info
  const serviceInfo = AGENT_CLI_SERVICES.find(s => s.id === selectedService)

  // Configuration view
  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header with back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button onClick={handleBackToSelect} size="icon-sm" variant="ghost">
            <IconChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            {serviceInfo && getServiceIcon(serviceInfo.id)}
            <div>
              <h3 className="text-lg font-semibold">
                {serviceInfo?.name} Configuration
              </h3>
              <p className="text-sm text-muted-foreground">
                Configure your {serviceInfo?.name} environment
              </p>
            </div>
          </div>
        </div>
        <Badge variant={isConfigured ? 'secondary' : 'outline'}>
          {isConfigured ? 'Configured' : 'Not Configured'}
        </Badge>
      </div>

      {/* Success message */}
      {saveSuccess && (
        <Alert className="border-green-500/50 bg-green-500/10">
          <IconCheck className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-green-600 dark:text-green-400">
            Configuration saved successfully
          </AlertDescription>
        </Alert>
      )}

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <IconAlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc pl-4">
              {validationErrors.map(error => (
                <li key={`${error.field}-${error.message}`}>{error.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto">
        {/* Service-specific configuration */}
        {renderServiceConfig()}
      </div>

      {/* Footer with save button */}
      <div className="flex items-center justify-between border-t pt-4">
        <Alert className="flex-1 mr-4 py-2">
          <IconInfoCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Sensitive values are stored securely in your OS keychain
          </AlertDescription>
        </Alert>
        <Button disabled={isSaving} onClick={validateAndSave}>
          {isSaving ? (
            <>
              <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Configuration'
          )}
        </Button>
      </div>
    </div>
  )

  function renderServiceConfig(): React.JSX.Element {
    switch (selectedService) {
      case 'claude-code':
        return renderClaudeCodeConfig()
      case 'google-jules':
        return renderGoogleJulesConfig()
      case 'opencode':
        return renderOpenCodeConfig()
      case 'aider':
        return renderAiderConfig()
      case 'custom':
        return renderCustomConfig()
      default:
        return <div>Select a service to configure</div>
    }
  }

  function renderClaudeCodeConfig(): React.JSX.Element {
    return (
      <>
        {/* Authentication Token */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Authentication</CardTitle>
            <CardDescription>
              Anthropic API token for Claude Code
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="auth-token">ANTHROPIC_AUTH_TOKEN</Label>
              {isEditingToken ? (
                <div className="flex gap-2">
                  <Input
                    className={
                      getFieldError('anthropicAuthToken')
                        ? 'border-destructive'
                        : ''
                    }
                    id="auth-token"
                    onChange={e => setTokenInput(e.target.value)}
                    placeholder="Enter your Anthropic API token"
                    type={showToken ? 'text' : 'password'}
                    value={tokenInput}
                  />
                  <Button
                    onClick={() => setShowToken(!showToken)}
                    size="sm"
                    variant="outline"
                  >
                    {showToken ? 'Hide' : 'Show'}
                  </Button>
                  <Button
                    onClick={() => {
                      setIsEditingToken(false)
                      setTokenInput(config.anthropicAuthToken ? '••••••••' : '')
                    }}
                    size="sm"
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-2 py-1 text-xs font-mono text-muted-foreground">
                    {config.anthropicAuthToken
                      ? maskToken(config.anthropicAuthToken)
                      : 'Not configured'}
                  </code>
                  <Button
                    onClick={() => {
                      setIsEditingToken(true)
                      setTokenInput('')
                    }}
                    size="sm"
                    variant="outline"
                  >
                    {config.anthropicAuthToken ? 'Update' : 'Add'}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* API Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">API Settings</CardTitle>
            <CardDescription>
              Configure API endpoint and timeout
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="base-url">ANTHROPIC_BASE_URL (optional)</Label>
              <Input
                id="base-url"
                onChange={e =>
                  setConfig({ ...config, anthropicBaseUrl: e.target.value })
                }
                placeholder="https://api.anthropic.com"
                type="url"
                value={config.anthropicBaseUrl || ''}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use the default Anthropic API endpoint
              </p>
            </div>
            {renderTimeoutField()}
          </CardContent>
        </Card>

        {renderPythonConfig()}
        {renderEnvVarsConfig()}
      </>
    )
  }

  function renderGoogleJulesConfig(): React.JSX.Element {
    return (
      <>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Authentication</CardTitle>
            <CardDescription>Google API key for Jules</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="google-api-key">GOOGLE_API_KEY</Label>
              <Input
                id="google-api-key"
                onChange={e =>
                  setConfig({ ...config, googleApiKey: e.target.value })
                }
                placeholder="Enter your Google API key"
                type="password"
                value={config.googleApiKey || ''}
              />
            </div>
          </CardContent>
        </Card>
        {renderTimeoutCard()}
        {renderPythonConfig()}
        {renderEnvVarsConfig()}
      </>
    )
  }

  function renderOpenCodeConfig(): React.JSX.Element {
    return (
      <>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Authentication</CardTitle>
            <CardDescription>
              API key for OpenCode (supports multiple providers)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="openai-api-key">OPENAI_API_KEY</Label>
              <Input
                id="openai-api-key"
                onChange={e =>
                  setConfig({ ...config, openaiApiKey: e.target.value })
                }
                placeholder="Enter your OpenAI API key"
                type="password"
                value={config.openaiApiKey || ''}
              />
              <p className="text-xs text-muted-foreground">
                OpenCode supports OpenAI, Anthropic, and other providers
              </p>
            </div>
          </CardContent>
        </Card>
        {renderTimeoutCard()}
        {renderPythonConfig()}
        {renderEnvVarsConfig()}
      </>
    )
  }

  function renderAiderConfig(): React.JSX.Element {
    return (
      <>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Authentication</CardTitle>
            <CardDescription>
              API keys for Aider (supports multiple providers)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="aider-openai-key">OPENAI_API_KEY</Label>
              <Input
                id="aider-openai-key"
                onChange={e =>
                  setConfig({ ...config, openaiApiKey: e.target.value })
                }
                placeholder="Enter your OpenAI API key"
                type="password"
                value={config.openaiApiKey || ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aider-anthropic-key">
                ANTHROPIC_API_KEY (optional)
              </Label>
              {isEditingToken ? (
                <div className="flex gap-2">
                  <Input
                    id="aider-anthropic-key"
                    onChange={e => setTokenInput(e.target.value)}
                    placeholder="Enter your Anthropic API key"
                    type={showToken ? 'text' : 'password'}
                    value={tokenInput}
                  />
                  <Button
                    onClick={() => setShowToken(!showToken)}
                    size="sm"
                    variant="outline"
                  >
                    {showToken ? 'Hide' : 'Show'}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-2 py-1 text-xs font-mono text-muted-foreground">
                    {config.anthropicAuthToken
                      ? maskToken(config.anthropicAuthToken)
                      : 'Not configured'}
                  </code>
                  <Button
                    onClick={() => setIsEditingToken(true)}
                    size="sm"
                    variant="outline"
                  >
                    {config.anthropicAuthToken ? 'Update' : 'Add'}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        {renderTimeoutCard()}
        {renderPythonConfig()}
        {renderEnvVarsConfig()}
      </>
    )
  }

  function renderCustomConfig(): React.JSX.Element {
    return (
      <>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Custom Agent Command</CardTitle>
            <CardDescription>
              Specify the command to run your custom agent
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="custom-command">Command</Label>
              <Input
                id="custom-command"
                onChange={e =>
                  setConfig({ ...config, customCommand: e.target.value })
                }
                placeholder="e.g., my-agent --config ~/.my-agent.json"
                type="text"
                value={config.customCommand || ''}
              />
              <p className="text-xs text-muted-foreground">
                The command that will be executed to start your agent
              </p>
            </div>
          </CardContent>
        </Card>
        {renderTimeoutCard()}
        {renderPythonConfig()}
        {renderEnvVarsConfig()}
      </>
    )
  }

  function renderTimeoutField(): React.JSX.Element {
    return (
      <div className="space-y-2">
        <Label htmlFor="timeout">API_TIMEOUT_MS</Label>
        <Input
          id="timeout"
          min={1000}
          onChange={e =>
            setConfig({
              ...config,
              apiTimeoutMs: Number.parseInt(e.target.value, 10) || 30000,
            })
          }
          step={1000}
          type="number"
          value={config.apiTimeoutMs}
        />
        <p className="text-xs text-muted-foreground">
          Request timeout in milliseconds (default: 30000)
        </p>
      </div>
    )
  }

  function renderTimeoutCard(): React.JSX.Element {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">API Settings</CardTitle>
          <CardDescription>Configure timeout settings</CardDescription>
        </CardHeader>
        <CardContent>{renderTimeoutField()}</CardContent>
      </Card>
    )
  }

  function renderPythonConfig(): React.JSX.Element {
    return <PythonConfigCard config={config} setConfig={setConfig} />
  }

  function renderEnvVarsConfig(): React.JSX.Element {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            Custom Environment Variables
          </CardTitle>
          <CardDescription>
            Additional environment variables to inject into agent processes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {envVars.length > 0 && (
            <div className="space-y-2">
              {envVars.map((envVar, index) => (
                <div
                  className="flex items-center gap-2"
                  key={`env-${envVar.key || index}`}
                >
                  <Input
                    className="flex-1 font-mono text-xs"
                    onChange={e =>
                      handleEnvVarChange(index, 'key', e.target.value)
                    }
                    placeholder="KEY"
                    value={envVar.key}
                  />
                  <span className="text-muted-foreground">=</span>
                  <Input
                    className="flex-1 font-mono text-xs"
                    onChange={e =>
                      handleEnvVarChange(index, 'value', e.target.value)
                    }
                    placeholder="value"
                    value={envVar.value}
                  />
                  <Button
                    onClick={() => handleRemoveEnvVar(index)}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <IconTrash className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Input
              className="flex-1 font-mono text-xs"
              onChange={e => setNewEnvKey(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddEnvVar()
              }}
              placeholder="NEW_KEY"
              value={newEnvKey}
            />
            <span className="text-muted-foreground">=</span>
            <Input
              className="flex-1 font-mono text-xs"
              onChange={e => setNewEnvValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddEnvVar()
              }}
              placeholder="value"
              value={newEnvValue}
            />
            <Button
              disabled={!newEnvKey.trim()}
              onClick={handleAddEnvVar}
              size="icon-sm"
              variant="outline"
            >
              <IconPlus className="h-4 w-4" />
            </Button>
          </div>

          {envVars.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No custom environment variables configured
            </p>
          )}
        </CardContent>
      </Card>
    )
  }
}
