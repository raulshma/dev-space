/**
 * Agent Configuration Panel Component
 *
 * Provides UI for configuring the coding agent environment including:
 * - ANTHROPIC_AUTH_TOKEN input with secure storage
 * - ANTHROPIC_BASE_URL configuration
 * - API_TIMEOUT_MS setting
 * - Python path configuration
 * - Custom environment variable editor
 * - Validation feedback
 *
 * Requirements: 5.1, 5.3, 5.5
 */

import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from 'renderer/components/ui/card'
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
} from '@tabler/icons-react'
import type {
  AgentEnvironmentConfig,
  AgentConfigValidationError,
} from 'shared/ai-types'

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

export function AgentConfigPanel(): React.JSX.Element {
  // Configuration state
  const [config, setConfig] = useState<AgentEnvironmentConfig>({
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
  const [validationErrors, setValidationErrors] = useState<AgentConfigValidationError[]>([])
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

      // Check if configured
      const configuredResponse = await window.api.agentConfig.isConfigured({})
      setIsConfigured(configuredResponse.isConfigured)
    } catch (error) {
      console.error('Failed to load agent config:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const validateAndSave = useCallback(async (): Promise<void> => {
    setIsSaving(true)
    setSaveSuccess(false)
    setValidationErrors([])

    try {
      // Build config with current values
      const updatedConfig: AgentEnvironmentConfig = {
        ...config,
        anthropicAuthToken: isEditingToken ? tokenInput : config.anthropicAuthToken,
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

      // Validate
      const validationResponse = await window.api.agentConfig.validate({
        config: updatedConfig,
      })

      if (!validationResponse.result.isValid) {
        setValidationErrors(validationResponse.result.errors)
        return
      }

      // Save
      await window.api.agentConfig.set({
        updates: {
          anthropicAuthToken: isEditingToken ? tokenInput : undefined,
          anthropicBaseUrl: config.anthropicBaseUrl || undefined,
          apiTimeoutMs: config.apiTimeoutMs,
          pythonPath: config.pythonPath,
          customEnvVars: updatedConfig.customEnvVars,
        },
      })

      setSaveSuccess(true)
      setIsEditingToken(false)
      setTokenInput(tokenInput ? '••••••••' : '')

      // Refresh config
      await loadConfig()

      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      console.error('Failed to save agent config:', error)
      setValidationErrors([
        {
          field: 'anthropicAuthToken',
          message: error instanceof Error ? error.message : 'Failed to save configuration',
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

  const getFieldError = (field: keyof AgentEnvironmentConfig): string | undefined => {
    return validationErrors.find((e) => e.field === field)?.message
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Agent Configuration</h3>
          <p className="text-sm text-muted-foreground">
            Configure the coding agent execution environment
          </p>
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
              {validationErrors.map((error, i) => (
                <li key={i}>{error.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto">
        {/* Authentication Token */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Authentication</CardTitle>
            <CardDescription>
              Anthropic API token for Claude Code agents
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="auth-token">ANTHROPIC_AUTH_TOKEN</Label>
              {isEditingToken ? (
                <div className="flex gap-2">
                  <Input
                    id="auth-token"
                    type={showToken ? 'text' : 'password'}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Enter your Anthropic API token"
                    className={getFieldError('anthropicAuthToken') ? 'border-destructive' : ''}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? 'Hide' : 'Show'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsEditingToken(false)
                      setTokenInput(config.anthropicAuthToken ? '••••••••' : '')
                    }}
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
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsEditingToken(true)
                      setTokenInput('')
                    }}
                  >
                    {config.anthropicAuthToken ? 'Update' : 'Add'}
                  </Button>
                </div>
              )}
              {getFieldError('anthropicAuthToken') && (
                <p className="text-xs text-destructive">
                  {getFieldError('anthropicAuthToken')}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* API Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">API Settings</CardTitle>
            <CardDescription>
              Configure API endpoint and timeout settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="base-url">ANTHROPIC_BASE_URL (optional)</Label>
              <Input
                id="base-url"
                type="url"
                value={config.anthropicBaseUrl || ''}
                onChange={(e) =>
                  setConfig({ ...config, anthropicBaseUrl: e.target.value })
                }
                placeholder="https://api.anthropic.com"
                className={getFieldError('anthropicBaseUrl') ? 'border-destructive' : ''}
              />
              {getFieldError('anthropicBaseUrl') && (
                <p className="text-xs text-destructive">
                  {getFieldError('anthropicBaseUrl')}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Leave empty to use the default Anthropic API endpoint
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeout">API_TIMEOUT_MS</Label>
              <Input
                id="timeout"
                type="number"
                min={1000}
                step={1000}
                value={config.apiTimeoutMs}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    apiTimeoutMs: Number.parseInt(e.target.value, 10) || 30000,
                  })
                }
                className={getFieldError('apiTimeoutMs') ? 'border-destructive' : ''}
              />
              {getFieldError('apiTimeoutMs') && (
                <p className="text-xs text-destructive">
                  {getFieldError('apiTimeoutMs')}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Request timeout in milliseconds (default: 30000)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Python Configuration */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Python Configuration</CardTitle>
            <CardDescription>
              Path to Python executable for running agents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="python-path">Python Path</Label>
              <Input
                id="python-path"
                type="text"
                value={config.pythonPath}
                onChange={(e) =>
                  setConfig({ ...config, pythonPath: e.target.value })
                }
                placeholder="python"
                className={getFieldError('pythonPath') ? 'border-destructive' : ''}
              />
              {getFieldError('pythonPath') && (
                <p className="text-xs text-destructive">
                  {getFieldError('pythonPath')}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Path to Python 3.x executable (e.g., python, python3, /usr/bin/python3)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Custom Environment Variables */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Custom Environment Variables</CardTitle>
            <CardDescription>
              Additional environment variables to inject into agent processes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Existing env vars */}
            {envVars.length > 0 && (
              <div className="space-y-2">
                {envVars.map((envVar, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={envVar.key}
                      onChange={(e) =>
                        handleEnvVarChange(index, 'key', e.target.value)
                      }
                      placeholder="KEY"
                      className="flex-1 font-mono text-xs"
                    />
                    <span className="text-muted-foreground">=</span>
                    <Input
                      value={envVar.value}
                      onChange={(e) =>
                        handleEnvVarChange(index, 'value', e.target.value)
                      }
                      placeholder="value"
                      className="flex-1 font-mono text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleRemoveEnvVar(index)}
                    >
                      <IconTrash className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new env var */}
            <div className="flex items-center gap-2">
              <Input
                value={newEnvKey}
                onChange={(e) => setNewEnvKey(e.target.value)}
                placeholder="NEW_KEY"
                className="flex-1 font-mono text-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddEnvVar()
                }}
              />
              <span className="text-muted-foreground">=</span>
              <Input
                value={newEnvValue}
                onChange={(e) => setNewEnvValue(e.target.value)}
                placeholder="value"
                className="flex-1 font-mono text-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddEnvVar()
                }}
              />
              <Button
                variant="outline"
                size="icon-sm"
                onClick={handleAddEnvVar}
                disabled={!newEnvKey.trim()}
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
      </div>

      {/* Footer with save button */}
      <div className="flex items-center justify-between border-t pt-4">
        <Alert className="flex-1 mr-4 py-2">
          <IconInfoCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Sensitive values are stored securely in your OS keychain
          </AlertDescription>
        </Alert>
        <Button onClick={validateAndSave} disabled={isSaving}>
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
}
