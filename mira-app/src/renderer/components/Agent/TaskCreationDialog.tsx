/**
 * Task Creation Dialog Component
 *
 * Provides a dialog for creating new agent tasks with:
 * - Task description input
 * - Agent type selection (autonomous or feature)
 * - Target directory selection
 * - AI-assisted parameter population
 * - Parameter review and edit
 *
 * Requirements: 6.1, 6.2, 6.3, 6.5
 */

import { useState, useCallback } from 'react'
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from 'renderer/components/ui/tabs'
import {
  IconFolder,
  IconRocket,
  IconGitBranch,
  IconLoader2,
  IconAlertTriangle,
  IconSparkles,
  IconChevronRight,
} from '@tabler/icons-react'
import { useCreateAgentTask } from 'renderer/hooks/use-agent-tasks'
import type { AgentType, AgentParameters } from 'shared/ai-types'

interface TaskCreationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultDirectory?: string
  onTaskCreated?: (taskId: string) => void
}

type Step = 'details' | 'parameters' | 'review'

export function TaskCreationDialog({
  open,
  onOpenChange,
  defaultDirectory = '',
  onTaskCreated,
}: TaskCreationDialogProps): React.JSX.Element {
  // Form state
  const [step, setStep] = useState<Step>('details')
  const [description, setDescription] = useState('')
  const [agentType, setAgentType] = useState<AgentType>('feature')
  const [targetDirectory, setTargetDirectory] = useState(defaultDirectory)
  const [parameters, setParameters] = useState<AgentParameters>({
    model: 'claude-sonnet-4-20250514',
    maxIterations: 10,
    testCount: 5,
    taskFile: '',
    customEnv: {},
  })

  // UI state
  const [isValidating, setIsValidating] = useState(false)
  const [isGeneratingParams, setIsGeneratingParams] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const createTask = useCreateAgentTask()

  const resetForm = useCallback(() => {
    setStep('details')
    setDescription('')
    setAgentType('feature')
    setTargetDirectory(defaultDirectory)
    setParameters({
      model: 'claude-sonnet-4-20250514',
      maxIterations: 10,
      testCount: 5,
      taskFile: '',
      customEnv: {},
    })
    setValidationError(null)
  }, [defaultDirectory])

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
      // Basic validation
      if (!description.trim()) {
        setValidationError('Please enter a task description')
        return false
      }

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

      return true
    } finally {
      setIsValidating(false)
    }
  }

  const handleNextStep = async (): Promise<void> => {
    if (step === 'details') {
      const isValid = await validateDetails()
      if (isValid) {
        setStep('parameters')
      }
    } else if (step === 'parameters') {
      setStep('review')
    }
  }

  const handlePreviousStep = (): void => {
    if (step === 'parameters') {
      setStep('details')
    } else if (step === 'review') {
      setStep('parameters')
    }
  }

  const handleGenerateParameters = async (): Promise<void> => {
    setIsGeneratingParams(true)
    try {
      // Use AI to suggest parameters based on description
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
        // If parsing fails, keep current parameters
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
      const result = await createTask.mutateAsync({
        description: description.trim(),
        agentType,
        targetDirectory: targetDirectory.trim(),
        parameters,
      })

      onTaskCreated?.(result.id)
      handleClose()
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : 'Failed to create task'
      )
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Agent Task</DialogTitle>
          <DialogDescription>
            Define a development task for the coding agent to execute
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          {(['details', 'parameters', 'review'] as Step[]).map((s, i) => (
            <div className="flex items-center" key={s}>
              <Badge
                className="capitalize"
                variant={step === s ? 'default' : 'outline'}
              >
                {i + 1}. {s}
              </Badge>
              {i < 2 && (
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

        {/* Step 1: Details */}
        {step === 'details' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Task Description</Label>
              <Textarea
                id="description"
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe what you want the agent to accomplish..."
                rows={4}
                value={description}
              />
              <p className="text-xs text-muted-foreground">
                Be specific about the feature, bug fix, or task you want
                completed
              </p>
            </div>

            <div className="space-y-2">
              <Label>Agent Type</Label>
              <Tabs
                onValueChange={v => setAgentType(v as AgentType)}
                value={agentType}
              >
                <TabsList className="w-full">
                  <TabsTrigger className="flex-1" value="feature">
                    <IconGitBranch className="mr-2 h-4 w-4" />
                    Feature Agent
                  </TabsTrigger>
                  <TabsTrigger className="flex-1" value="autonomous">
                    <IconRocket className="mr-2 h-4 w-4" />
                    Autonomous Agent
                  </TabsTrigger>
                </TabsList>
                <TabsContent className="mt-2" value="feature">
                  <p className="text-xs text-muted-foreground">
                    Implements features in an existing repository. Requires a
                    valid git repository.
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
          </div>
        )}

        {/* Step 2: Parameters */}
        {step === 'parameters' && (
          <div className="space-y-4">
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
                    setParameters({ ...parameters, taskFile: e.target.value })
                  }
                  placeholder="path/to/task.md"
                  value={parameters.taskFile || ''}
                />
                <p className="text-xs text-muted-foreground">
                  Optional file containing detailed task instructions
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 'review' && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">
                  Description
                </Label>
                <p className="text-sm">{description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Agent Type
                  </Label>
                  <p className="text-sm capitalize">{agentType}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Model</Label>
                  <p className="text-sm font-mono text-xs">
                    {parameters.model}
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">
                  Target Directory
                </Label>
                <p className="text-sm font-mono text-xs truncate">
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
                  <p className="text-sm font-mono text-xs">
                    {parameters.taskFile}
                  </p>
                </div>
              )}
            </div>

            <Alert>
              <AlertDescription className="text-xs">
                The task will be added to the backlog with "pending" status. You
                can start it from the task list when ready.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          {step !== 'details' && (
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
            <Button disabled={isValidating} onClick={handleNextStep}>
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
