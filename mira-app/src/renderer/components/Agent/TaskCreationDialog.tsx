/**
 * Task Creation Dialog Component
 *
 * Provides a dialog for creating new agent tasks with:
 * - Service type selection (Claude Code or Google Jules)
 * - Task description input
 * - Agent type selection (autonomous or feature)
 * - Target directory selection
 * - Service-specific configuration options
 * - AI-assisted parameter population
 * - Parameter review and edit
 *
 * Requirements: 6.1, 6.2, 6.3, 6.5
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from 'renderer/components/ui/dialog'
import { Input } from 'renderer/components/ui/input'
import { Button } from 'renderer/components/ui/button'
import { Label } from 'renderer/components/ui/label'
import { Textarea } from 'renderer/components/ui/textarea'
import { Alert, AlertDescription } from 'renderer/components/ui/alert'
import { Badge } from 'renderer/components/ui/badge'
import { Card, CardContent } from 'renderer/components/ui/card'
import { Switch } from 'renderer/components/ui/switch'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from 'renderer/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'renderer/components/ui/select'
import {
  IconFolder,
  IconRocket,
  IconGitBranch,
  IconLoader2,
  IconAlertTriangle,
  IconSparkles,
  IconChevronRight,
  IconRobot,
  IconBrandGoogle,
  IconExternalLink,
  IconSearch,
  IconCheck,
} from '@tabler/icons-react'
import { useCreateAgentTask } from 'renderer/hooks/use-agent-tasks'
import { useTaskList } from 'renderer/stores/agent-task-store'
import { useSetting, SETTING_KEYS } from 'renderer/hooks/use-settings'
import { useCreateProject } from 'renderer/hooks/use-projects'
import { PlanningModeSelector } from './PlanningModeSelector'
import { DependencySelector } from './DependencySelector'
import { BranchInput } from './BranchInput'
import type {
  AgentType,
  AgentParameters,
  TaskServiceType,
  JulesParameters,
  PlanningMode,
} from 'shared/ai-types'
import { TASK_SERVICE_TYPES } from 'shared/ai-types'

interface TaskCreationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultDirectory?: string
  onTaskCreated?: (taskId: string) => void
  /** Project ID to associate the task with */
  projectId?: string
  /** Project name for display purposes */
  projectName?: string
  /** Default agent type to select */
  defaultAgentType?: AgentType
}

type Step = 'service' | 'details' | 'parameters' | 'review'

/**
 * Get icon for service type
 */
function getServiceIcon(serviceId: TaskServiceType): React.ReactNode {
  switch (serviceId) {
    case 'claude-code':
      return <IconRobot className="h-5 w-5" />
    case 'google-jules':
      return <IconBrandGoogle className="h-5 w-5" />
    default:
      return <IconRobot className="h-5 w-5" />
  }
}

export function TaskCreationDialog({
  open,
  onOpenChange,
  defaultDirectory = '',
  onTaskCreated,
  projectId,
  projectName,
  ...props
}: TaskCreationDialogProps): React.JSX.Element {
  // Get default planning mode from settings
  const { data: defaultPlanningModeSetting } = useSetting(
    SETTING_KEYS.TASKS_DEFAULT_PLANNING_MODE
  )

  // Service selection state
  const [serviceType, setServiceType] = useState<TaskServiceType>('claude-code')

  // Form state
  const [step, setStep] = useState<Step>('service')
  const [description, setDescription] = useState('')
  const [agentType, setAgentType] = useState<AgentType>(
    props.defaultAgentType || 'feature'
  )
  const [targetDirectory, setTargetDirectory] = useState(defaultDirectory)
  const [parameters, setParameters] = useState<AgentParameters>({
    model: 'claude-sonnet-4-20250514',
    maxIterations: 10,
    testCount: 5,
    taskFile: '',
    customEnv: {},
  })

  // Planning mode state (for Claude Code) - initialized from settings
  const [planningMode, setPlanningMode] = useState<PlanningMode>(
    (defaultPlanningModeSetting as PlanningMode) || 'skip'
  )
  const [requirePlanApproval, setRequirePlanApproval] = useState(false)

  // Dependencies state
  const [selectedDependencies, setSelectedDependencies] = useState<string[]>([])

  // Branch/worktree state (for Claude Code)
  const [branchName, setBranchName] = useState('')
  // Get available tasks for dependency selection
  const availableTasks = useTaskList()

  // Jules-specific state
  const [julesParams, setJulesParams] = useState<JulesParameters>({
    source: '',
    startingBranch: 'main',
    automationMode: 'AUTO_CREATE_PR',
    requirePlanApproval: false,
    title: '',
  })
  const [availableSources, setAvailableSources] = useState<
    Array<{ name: string; id: string }>
  >([])
  const [isLoadingSources, setIsLoadingSources] = useState(false)
  const [sourceSearchQuery, setSourceSearchQuery] = useState('')
  const [isSourceDropdownOpen, setIsSourceDropdownOpen] = useState(false)

  // Configured services state
  const [configuredServices, setConfiguredServices] = useState<
    TaskServiceType[]
  >([])
  const [isLoadingServices, setIsLoadingServices] = useState(true)

  // UI state
  const [isValidating, setIsValidating] = useState(false)
  const [isGeneratingParams, setIsGeneratingParams] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const createTask = useCreateAgentTask()
  const createProject = useCreateProject()

  // Get selected service info
  const selectedService = TASK_SERVICE_TYPES.find(s => s.id === serviceType)

  // Filter available services based on configuration
  const availableServiceTypes = useMemo(() => {
    return TASK_SERVICE_TYPES.filter(s => configuredServices.includes(s.id))
  }, [configuredServices])

  // Fetch configured services when dialog opens
  useEffect(() => {
    if (open) {
      setIsLoadingServices(true)
      window.api.agentConfig
        .getConfiguredServices({})
        .then(response => {
          if (response.services) {
            setConfiguredServices(response.services)
            // Auto-select first configured service if current selection is not configured
            if (
              response.services.length > 0 &&
              !response.services.includes(serviceType)
            ) {
              setServiceType(response.services[0])
            }
          }
        })
        .catch(error => {
          console.error('Failed to fetch configured services:', error)
        })
        .finally(() => {
          setIsLoadingServices(false)
        })
    }
  }, [open, serviceType])

  // Reset agent type if not supported by selected service
  useEffect(() => {
    if (
      selectedService &&
      !selectedService.supportsAgentTypes.includes(agentType)
    ) {
      setAgentType(selectedService.supportsAgentTypes[0])
    }
  }, [serviceType, selectedService, agentType])

  // Sync planning mode with default setting when dialog opens
  useEffect(() => {
    if (open && defaultPlanningModeSetting) {
      setPlanningMode(defaultPlanningModeSetting as PlanningMode)
    }
  }, [open, defaultPlanningModeSetting])

  // Update Jules title when description changes
  useEffect(() => {
    if (serviceType === 'google-jules' && !julesParams.title) {
      setJulesParams(prev => ({
        ...prev,
        title: description.slice(0, 100),
      }))
    }
  }, [description, serviceType, julesParams.title])

  // Fetch Jules sources when service type is google-jules and dropdown opens
  const fetchJulesSources = useCallback(async () => {
    if (serviceType !== 'google-jules') return

    setIsLoadingSources(true)
    try {
      const response = await window.api.jules.listSources({})
      if (response.sources) {
        setAvailableSources(
          response.sources.map(s => ({
            name: s.name,
            id: s.name, // Use name as id since it's the source path
          }))
        )
      }
      if (response.error) {
        console.warn('Failed to fetch Jules sources:', response.error)
      }
    } catch (error) {
      console.error('Failed to fetch Jules sources:', error)
    } finally {
      setIsLoadingSources(false)
    }
  }, [serviceType])

  // Fetch sources when Jules is selected and dropdown opens
  useEffect(() => {
    if (
      serviceType === 'google-jules' &&
      isSourceDropdownOpen &&
      availableSources.length === 0
    ) {
      fetchJulesSources()
    }
  }, [
    serviceType,
    isSourceDropdownOpen,
    availableSources.length,
    fetchJulesSources,
  ])

  // Filter sources based on search query
  const filteredSources = useMemo(() => {
    if (!sourceSearchQuery.trim()) return availableSources
    const query = sourceSearchQuery.toLowerCase()
    return availableSources.filter(s => s.name.toLowerCase().includes(query))
  }, [availableSources, sourceSearchQuery])

  const resetForm = useCallback(() => {
    setStep('service')
    setServiceType('claude-code')
    setDescription('')
    setAgentType(props.defaultAgentType || 'feature')
    setTargetDirectory(defaultDirectory)
    setParameters({
      model: 'claude-sonnet-4-20250514',
      maxIterations: 10,
      testCount: 5,
      taskFile: '',
      customEnv: {},
    })
    setPlanningMode((defaultPlanningModeSetting as PlanningMode) || 'skip')
    setRequirePlanApproval(false)
    setSelectedDependencies([])
    setBranchName('')
    setJulesParams({
      source: '',
      startingBranch: 'main',
      automationMode: 'AUTO_CREATE_PR',
      requirePlanApproval: false,
      title: '',
    })
    setValidationError(null)
    setAvailableSources([])
    setSourceSearchQuery('')
    setIsSourceDropdownOpen(false)
  }, [defaultDirectory, defaultPlanningModeSetting])

  const handleClose = useCallback(() => {
    resetForm()
    onOpenChange(false)
  }, [resetForm, onOpenChange])

  const handleSelectDirectory = async (): Promise<void> => {
    try {
      const result = await window.api.dialog.openDirectory({
        title: 'Select Target Directory',
        defaultPath: targetDirectory || undefined,
      })

      if (!result.canceled && result.path) {
        setTargetDirectory(result.path)
        setValidationError(null)
      }
    } catch (error) {
      console.error('Failed to open directory dialog:', error)
    }
  }

  const validateDetails = async (): Promise<boolean> => {
    setIsValidating(true)
    setValidationError(null)

    try {
      if (!description.trim()) {
        setValidationError('Please enter a task description')
        return false
      }

      if (serviceType === 'claude-code') {
        if (!targetDirectory.trim()) {
          setValidationError('Please select a target directory')
          return false
        }

        // For feature agent, validate it's a git repository
        if (agentType === 'feature') {
          try {
            const telemetry = await window.api.git.getTelemetry({
              projectPath: targetDirectory,
            })
            if (!telemetry.telemetry) {
              setValidationError(
                'Target directory is not a valid git repository. Feature agents require a git repository.'
              )
              return false
            }
          } catch {
            setValidationError(
              'Target directory is not a valid git repository. Feature agents require a git repository.'
            )
            return false
          }
        }
      } else if (serviceType === 'google-jules') {
        if (!julesParams.source) {
          setValidationError('Please select a GitHub repository source')
          return false
        }
      }

      return true
    } finally {
      setIsValidating(false)
    }
  }

  const handleServiceSelect = (service: TaskServiceType): void => {
    setServiceType(service)
    setValidationError(null)
  }

  const handleNextStep = async (): Promise<void> => {
    if (step === 'service') {
      setStep('details')
    } else if (step === 'details') {
      const isValid = await validateDetails()
      if (isValid) {
        setStep('parameters')
      }
    } else if (step === 'parameters') {
      setStep('review')
    }
  }

  const handlePreviousStep = (): void => {
    if (step === 'details') {
      setStep('service')
    } else if (step === 'parameters') {
      setStep('details')
    } else if (step === 'review') {
      setStep('parameters')
    }
  }

  const handleGenerateParameters = async (): Promise<void> => {
    setIsGeneratingParams(true)
    try {
      const result = await window.api.ai.generateText({
        projectId: 'task-creation',
        content: `Based on this task description, suggest optimal parameters for a coding agent:

Task: ${description}
Agent Type: ${agentType}
Target Directory: ${targetDirectory}

Respond with JSON only:
{
  "maxIterations": <number 5-50>,
  "testCount": <number 0-20>,
  "reasoning": "<brief explanation>"
}`,
        action: 'parameter-extraction',
      })

      try {
        const parsed = JSON.parse(result.text)
        setParameters(prev => ({
          ...prev,
          maxIterations: parsed.maxIterations || prev.maxIterations,
          testCount: parsed.testCount || prev.testCount,
        }))
      } catch {
        console.warn('Failed to parse AI-generated parameters')
      }
    } catch (error) {
      console.error('Failed to generate parameters:', error)
    } finally {
      setIsGeneratingParams(false)
    }
  }

  const handleCreateTask = async (): Promise<void> => {
    try {
      let finalProjectId = projectId
      let finalProjectName = projectName

      // If no project ID is provided but we have a target directory (e.g. from autonomous mode),
      // try to create the project first
      if (!finalProjectId && targetDirectory && serviceType === 'claude-code') {
        try {
          // Extract project name from directory path
          const fullPath = targetDirectory.replace(/\\/g, '/')
          const name = fullPath.split('/').pop() || 'New Project'
          
          const newProject = await createProject.mutateAsync({
            name,
            path: targetDirectory,
          })
          
          finalProjectId = newProject.id
          finalProjectName = newProject.name
        } catch (error) {
          console.error('Failed to auto-create project:', error)
          // We continue without a project ID if creation fails, 
          // though ideally we might want to stop here
        }
      }

      const result = await createTask.mutateAsync({
        description: description.trim(),
        agentType,
        targetDirectory:
          serviceType === 'claude-code' ? targetDirectory.trim() : '',
        parameters: serviceType === 'claude-code' ? parameters : undefined,
        serviceType,
        julesParams: serviceType === 'google-jules' ? julesParams : undefined,
        planningMode: serviceType === 'claude-code' ? planningMode : undefined,
        requirePlanApproval:
          serviceType === 'claude-code' && planningMode !== 'skip'
            ? requirePlanApproval
            : undefined,
        branchName:
          serviceType === 'claude-code' && branchName.trim()
            ? branchName.trim()
            : undefined,
        projectId: finalProjectId,
        projectName: finalProjectName,
      })

      onTaskCreated?.(result.id)
      handleClose()
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : 'Failed to create task'
      )
    }
  }

  const getSteps = (): Step[] => {
    return ['service', 'details', 'parameters', 'review']
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Create Agent Task</DialogTitle>
          <DialogDescription>
            Define a development task for the coding agent to execute
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          <div className="space-y-4 py-2">
        <div className="flex items-center justify-center gap-2 py-2">
          {getSteps().map((s, i) => (
            <div className="flex items-center" key={s}>
              <Badge
                className="capitalize"
                variant={step === s ? 'default' : 'outline'}
              >
                {i + 1}. {s}
              </Badge>
              {i < getSteps().length - 1 && (
                <IconChevronRight className="mx-1 h-4 w-4 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>

        {/* Validation error */}
        {validationError && (
          <Alert variant="destructive">
            <IconAlertTriangle className="h-4 w-4" />
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        )}

        {/* Step 0: Service Selection */}
        {step === 'service' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Service</Label>
              <p className="text-xs text-muted-foreground">
                Choose the AI service to execute your task
              </p>
            </div>

            {isLoadingServices ? (
              <div className="flex items-center justify-center py-8">
                <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Loading services...
                </span>
              </div>
            ) : availableServiceTypes.length === 0 ? (
              <Alert>
                <IconAlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No services are configured. Please configure at least one
                  service (Claude Code or Google Jules) in Settings before
                  creating a task.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                {availableServiceTypes.map(service => (
                  <Card
                    className={`cursor-pointer transition-all hover:border-primary/50 ${
                      serviceType === service.id
                        ? 'border-primary bg-primary/5'
                        : ''
                    }`}
                    key={service.id}
                    onClick={() => handleServiceSelect(service.id)}
                  >
                    <CardContent className="flex items-center gap-4 p-4">
                      <div
                        className={`rounded-lg p-2 ${
                          serviceType === service.id
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted'
                        }`}
                      >
                        {getServiceIcon(service.id)}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">{service.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {service.description}
                        </p>
                        <div className="mt-1 flex gap-1">
                          {service.supportsAgentTypes.map(type => (
                            <Badge
                              className="text-xs capitalize"
                              key={type}
                              variant="secondary"
                            >
                              {type}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      {service.docsUrl && (
                        <Button
                          onClick={e => {
                            e.stopPropagation()
                            window.api.shell.openExternal({
                              url: service.docsUrl as string,
                            })
                          }}
                          size="icon-sm"
                          variant="ghost"
                        >
                          <IconExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 1: Details */}
        {step === 'details' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Task Description</Label>
              <Textarea
                className="min-h-[120px] max-h-[300px] overflow-y-auto font-sans resize-y"
                id="description"
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe what you want the agent to accomplish..."
                value={description}
              />
              <p className="text-xs text-muted-foreground">
                Be specific about the feature, bug fix, or task you want
                completed
              </p>
            </div>

            {/* Agent Type - only show if service supports multiple types */}
            {selectedService &&
              selectedService.supportsAgentTypes.length > 1 && (
                <div className="space-y-2">
                  <Label>Agent Type</Label>
                  <Tabs
                    onValueChange={v => setAgentType(v as AgentType)}
                    value={agentType}
                  >
                    <TabsList className="w-full">
                      {selectedService.supportsAgentTypes.includes(
                        'feature'
                      ) && (
                        <TabsTrigger className="flex-1" value="feature">
                          <IconGitBranch className="mr-2 h-4 w-4" />
                          Feature Agent
                        </TabsTrigger>
                      )}
                      {selectedService.supportsAgentTypes.includes(
                        'autonomous'
                      ) && (
                        <TabsTrigger className="flex-1" value="autonomous">
                          <IconRocket className="mr-2 h-4 w-4" />
                          Autonomous Agent
                        </TabsTrigger>
                      )}
                    </TabsList>
                    <TabsContent className="mt-2" value="feature">
                      <p className="text-xs text-muted-foreground">
                        Implements features in an existing repository. Requires
                        a valid git repository.
                      </p>
                    </TabsContent>
                    <TabsContent className="mt-2" value="autonomous">
                      <p className="text-xs text-muted-foreground">
                        Creates new projects from scratch. Can work in any
                        directory.
                      </p>
                    </TabsContent>
                  </Tabs>
                </div>
              )}

            {/* Claude Code: Target Directory */}
            {serviceType === 'claude-code' && (
              <div className="space-y-2">
                <Label htmlFor="directory">Target Directory</Label>
                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    id="directory"
                    onChange={e => setTargetDirectory(e.target.value)}
                    placeholder="/path/to/project"
                    value={targetDirectory}
                  />
                  <Button onClick={handleSelectDirectory} variant="outline">
                    <IconFolder className="h-4 w-4" />
                  </Button>
                </div>
                {agentType === 'feature' && (
                  <p className="text-xs text-muted-foreground">
                    Must be a valid git repository
                  </p>
                )}
              </div>
            )}

            {/* Google Jules: Source Selection */}
            {serviceType === 'google-jules' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="jules-source">GitHub Repository</Label>
                  <div className="relative">
                    <div className="relative">
                      <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        id="jules-source"
                        onChange={e => {
                          const value = e.target.value
                          setSourceSearchQuery(value)
                          setJulesParams(prev => ({
                            ...prev,
                            source: value,
                          }))
                        }}
                        onFocus={() => setIsSourceDropdownOpen(true)}
                        placeholder="Search repositories or enter sources/github/owner/repo"
                        value={julesParams.source || ''}
                      />
                      {isLoadingSources && (
                        <IconLoader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                      )}
                    </div>

                    {/* Dropdown for search results */}
                    {isSourceDropdownOpen &&
                      (availableSources.length > 0 || isLoadingSources) && (
                        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                          <div className="max-h-48 overflow-y-auto p-1">
                            {isLoadingSources &&
                            availableSources.length === 0 ? (
                              <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                                Loading repositories...
                              </div>
                            ) : filteredSources.length === 0 ? (
                              <div className="py-4 text-center text-sm text-muted-foreground">
                                No repositories found
                              </div>
                            ) : (
                              filteredSources.map(source => (
                                <button
                                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                                  key={source.id}
                                  onClick={() => {
                                    setJulesParams(prev => ({
                                      ...prev,
                                      source: source.name,
                                    }))
                                    setSourceSearchQuery('')
                                    setIsSourceDropdownOpen(false)
                                  }}
                                  type="button"
                                >
                                  <IconGitBranch className="h-4 w-4 text-muted-foreground" />
                                  <span className="flex-1 truncate text-left font-mono text-xs">
                                    {source.name}
                                  </span>
                                  {julesParams.source === source.name && (
                                    <IconCheck className="h-4 w-4 text-primary" />
                                  )}
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Search for repositories with Jules GitHub app installed, or
                    enter the source path manually (e.g.,
                    sources/github/owner/repo).
                  </p>
                  {/* Click outside to close dropdown */}
                  {isSourceDropdownOpen && (
                    <button
                      aria-label="Close dropdown"
                      className="fixed inset-0 z-40 cursor-default"
                      onClick={() => setIsSourceDropdownOpen(false)}
                      type="button"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jules-branch">Starting Branch</Label>
                  <Input
                    id="jules-branch"
                    onChange={e =>
                      setJulesParams(prev => ({
                        ...prev,
                        startingBranch: e.target.value,
                      }))
                    }
                    placeholder="main"
                    value={julesParams.startingBranch || 'main'}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Parameters */}
        {step === 'parameters' && (
          <div className="space-y-4">
            {/* Claude Code Parameters */}
            {serviceType === 'claude-code' && (
              <>
                <div className="flex items-center justify-between">
                  <Label>Agent Parameters</Label>
                  <Button
                    disabled={isGeneratingParams}
                    onClick={handleGenerateParameters}
                    size="sm"
                    variant="outline"
                  >
                    {isGeneratingParams ? (
                      <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <IconSparkles className="mr-2 h-4 w-4" />
                    )}
                    Auto-populate
                  </Button>
                </div>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="model">Model</Label>
                    <Input
                      id="model"
                      onChange={e =>
                        setParameters({ ...parameters, model: e.target.value })
                      }
                      placeholder="claude-sonnet-4-20250514"
                      value={parameters.model || ''}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="max-iterations">Max Iterations</Label>
                      <Input
                        id="max-iterations"
                        max={100}
                        min={1}
                        onChange={e =>
                          setParameters({
                            ...parameters,
                            maxIterations:
                              Number.parseInt(e.target.value, 10) || 10,
                          })
                        }
                        type="number"
                        value={parameters.maxIterations || 10}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="test-count">Test Count</Label>
                      <Input
                        id="test-count"
                        max={50}
                        min={0}
                        onChange={e =>
                          setParameters({
                            ...parameters,
                            testCount: Number.parseInt(e.target.value, 10) || 5,
                          })
                        }
                        type="number"
                        value={parameters.testCount || 5}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="task-file">Task File (optional)</Label>
                    <Input
                      id="task-file"
                      onChange={e =>
                        setParameters({
                          ...parameters,
                          taskFile: e.target.value,
                        })
                      }
                      placeholder="path/to/task.md"
                      value={parameters.taskFile || ''}
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional file containing detailed task instructions
                    </p>
                  </div>

                  {/* Planning Mode */}
                  <div className="border-t pt-4">
                    <PlanningModeSelector
                      onChange={setPlanningMode}
                      onRequireApprovalChange={setRequirePlanApproval}
                      requireApproval={requirePlanApproval}
                      value={planningMode}
                    />
                  </div>

                  {/* Task Dependencies */}
                  {availableTasks.length > 0 && (
                    <div className="border-t pt-4 space-y-2">
                      <Label>Task Dependencies (optional)</Label>
                      <DependencySelector
                        availableTasks={availableTasks}
                        onDependenciesChange={setSelectedDependencies}
                        placeholder="Select tasks this depends on..."
                        selectedDependencies={selectedDependencies}
                      />
                      <p className="text-xs text-muted-foreground">
                        This task will wait for selected dependencies to
                        complete before starting
                      </p>
                    </div>
                  )}

                  {/* Branch/Worktree Isolation */}
                  <div className="border-t pt-4">
                    <BranchInput
                      autoSuggest
                      helperText="Specify a branch name to isolate this task's changes in a separate worktree."
                      onChange={setBranchName}
                      taskDescription={description}
                      value={branchName}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Google Jules Parameters */}
            {serviceType === 'google-jules' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="jules-title">Session Title</Label>
                  <Input
                    id="jules-title"
                    onChange={e =>
                      setJulesParams(prev => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    placeholder="Task title for Jules session"
                    value={julesParams.title || ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Automation Mode</Label>
                  <Select
                    onValueChange={value =>
                      setJulesParams(prev => ({
                        ...prev,
                        automationMode: value as 'AUTO_CREATE_PR' | 'MANUAL',
                      }))
                    }
                    value={julesParams.automationMode || 'AUTO_CREATE_PR'}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUTO_CREATE_PR">
                        Auto Create PR
                      </SelectItem>
                      <SelectItem value="MANUAL">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    AUTO_CREATE_PR will automatically create a pull request when
                    the task is complete
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Require Plan Approval</Label>
                    <p className="text-xs text-muted-foreground">
                      Pause for approval before executing the plan
                    </p>
                  </div>
                  <Switch
                    checked={julesParams.requirePlanApproval || false}
                    onCheckedChange={checked =>
                      setJulesParams(prev => ({
                        ...prev,
                        requirePlanApproval: checked,
                      }))
                    }
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Review */}
        {step === 'review' && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                {getServiceIcon(serviceType)}
                <span className="font-medium">{selectedService?.name}</span>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">
                  Description
                </Label>
                <p className="border rounded-md p-2 bg-muted/30 text-sm max-h-[150px] overflow-y-auto whitespace-pre-wrap">
                  {description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Agent Type
                  </Label>
                  <p className="text-sm capitalize">{agentType}</p>
                </div>
                {serviceType === 'claude-code' && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Model
                    </Label>
                    <p className="font-mono text-xs">
                      {parameters.model}
                    </p>
                  </div>
                )}
              </div>

              {serviceType === 'claude-code' && (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Target Directory
                    </Label>
                    <p className="font-mono text-xs truncate">
                      {targetDirectory}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Max Iterations
                      </Label>
                      <p className="text-sm">{parameters.maxIterations}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Test Count
                      </Label>
                      <p className="text-sm">{parameters.testCount}</p>
                    </div>
                  </div>

                  {parameters.taskFile && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Task File
                      </Label>
                      <p className="font-mono text-xs">
                        {parameters.taskFile}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Planning Mode
                      </Label>
                      <p className="text-sm capitalize">{planningMode}</p>
                    </div>
                    {planningMode !== 'skip' && (
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Plan Approval
                        </Label>
                        <p className="text-sm">
                          {requirePlanApproval ? 'Required' : 'Auto-approved'}
                        </p>
                      </div>
                    )}
                  </div>

                  {selectedDependencies.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Dependencies
                      </Label>
                      <p className="text-sm">
                        {selectedDependencies.length} task
                        {selectedDependencies.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  )}

                  {branchName && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Branch / Worktree
                      </Label>
                      <p className="font-mono text-xs text-muted-foreground">{branchName}</p>
                    </div>
                  )}
                </>
              )}

              {serviceType === 'google-jules' && (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      GitHub Source
                    </Label>
                    <p className="font-mono text-xs truncate">
                      {julesParams.source}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Starting Branch
                      </Label>
                      <p className="text-sm">{julesParams.startingBranch}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Automation Mode
                      </Label>
                      <p className="text-sm">{julesParams.automationMode}</p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Plan Approval
                    </Label>
                    <p className="text-sm">
                      {julesParams.requirePlanApproval
                        ? 'Required'
                        : 'Auto-approved'}
                    </p>
                  </div>
                </>
              )}
            </div>

            <Alert>
              <AlertDescription className="text-xs">
                {serviceType === 'claude-code'
                  ? 'The task will be added to the backlog with "pending" status. You can start it from the task list when ready.'
                  : "A Jules session will be created and the task will start executing immediately on Google's infrastructure."}
              </AlertDescription>
            </Alert>
          </div>
        )}
          </div>
        </div>
        <DialogFooter>
          {step !== 'service' && (
            <Button onClick={handlePreviousStep} variant="outline">
              Back
            </Button>
          )}

          {step === 'review' ? (
            <Button disabled={createTask.isPending} onClick={handleCreateTask}>
              {createTask.isPending ? (
                <>
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Task'
              )}
            </Button>
          ) : (
            <Button
              disabled={
                isValidating ||
                isLoadingServices ||
                (step === 'service' && availableServiceTypes.length === 0)
              }
              onClick={handleNextStep}
            >
              {isValidating ? (
                <>
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating...
                </>
              ) : (
                'Next'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
