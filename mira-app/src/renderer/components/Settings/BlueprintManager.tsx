import { useState } from 'react'
import { Package } from 'lucide-react'
import {
  useBlueprints,
  useCreateBlueprint,
} from 'renderer/hooks/use-blueprints'
import { Button } from 'renderer/components/ui/button'
import { Input } from 'renderer/components/ui/input'
import { Textarea } from 'renderer/components/ui/textarea'
import { Label } from 'renderer/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from 'renderer/components/ui/card'
import { ScrollArea } from 'renderer/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'renderer/components/ui/dialog'
import {
  Empty,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from 'renderer/components/ui/empty'
import type { Blueprint } from 'shared/models'

/**
 * BlueprintManager Component
 *
 * Manages scaffold blueprints for quick project setup.
 * Displays saved blueprints and provides actions to save and apply templates.
 *
 * Requirements: 15.1, 15.2, 15.3
 */
export function BlueprintManager(): React.JSX.Element {
  const { data: blueprints, isLoading, error } = useBlueprints()
  const createBlueprint = useCreateBlueprint()

  const [showCaptureDialog, setShowCaptureDialog] = useState(false)
  const [showApplyDialog, setShowApplyDialog] = useState(false)
  const [selectedBlueprint, setSelectedBlueprint] = useState<Blueprint | null>(
    null
  )

  // Form state for capturing blueprint
  const [capturePath, setCapturePath] = useState('')
  const [captureName, setCaptureName] = useState('')
  const [captureDescription, setCaptureDescription] = useState('')
  const [captureExcludePatterns, setCaptureExcludePatterns] = useState('')

  // Form state for applying blueprint
  const [applyTargetPath, setApplyTargetPath] = useState('')

  const handleSaveAsTemplate = async (): Promise<void> => {
    if (!capturePath || !captureName) {
      alert('Please provide both a project path and blueprint name')
      return
    }

    try {
      const captureResponse = await window.api.blueprints.capture({
        projectPath: capturePath,
        customExcludePatterns: captureExcludePatterns
          ? captureExcludePatterns.split(',').map(p => p.trim())
          : undefined,
      })

      await createBlueprint.mutateAsync({
        name: captureName,
        description: captureDescription || undefined,
        structure: captureResponse.structure,
      })

      setCapturePath('')
      setCaptureName('')
      setCaptureDescription('')
      setCaptureExcludePatterns('')
      setShowCaptureDialog(false)

      alert('Blueprint saved successfully!')
    } catch (err) {
      console.error('Failed to save blueprint:', err)
      alert(
        `Failed to save blueprint: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    }
  }

  const handleApplyBlueprint = async (): Promise<void> => {
    if (!selectedBlueprint || !applyTargetPath) {
      alert('Please select a blueprint and provide a target path')
      return
    }

    try {
      await window.api.blueprints.apply({
        blueprintId: selectedBlueprint.id,
        targetPath: applyTargetPath,
      })

      setApplyTargetPath('')
      setShowApplyDialog(false)
      setSelectedBlueprint(null)

      alert('Blueprint applied successfully!')
    } catch (err) {
      console.error('Failed to apply blueprint:', err)
      alert(
        `Failed to apply blueprint: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    }
  }

  const openApplyDialog = (blueprint: Blueprint): void => {
    setSelectedBlueprint(blueprint)
    setShowApplyDialog(true)
  }

  if (isLoading) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">Loading blueprints...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-sm text-destructive">Failed to load blueprints</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Scaffold Blueprints</h2>
            <p className="text-sm text-muted-foreground">
              Save and reuse project templates
            </p>
          </div>
          <Button onClick={() => setShowCaptureDialog(true)}>
            Save as Template
          </Button>
        </div>
      </div>

      {/* Blueprint List */}
      <ScrollArea className="flex-1">
        {!blueprints || blueprints.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <Package className="h-4 w-4" />
            </EmptyMedia>
            <EmptyTitle>No blueprints saved yet</EmptyTitle>
            <EmptyDescription>
              Click &apos;Save as Template&apos; to create your first blueprint
            </EmptyDescription>
          </Empty>
        ) : (
          <div className="space-y-3">
            {blueprints.map(blueprint => (
              <Card
                className="hover:bg-muted/50 transition-colors"
                key={blueprint.id}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-sm">
                        {blueprint.name}
                      </CardTitle>
                      {blueprint.description && (
                        <CardDescription className="mt-1">
                          {blueprint.description}
                        </CardDescription>
                      )}
                    </div>
                    <Button
                      onClick={() => openApplyDialog(blueprint)}
                      size="sm"
                    >
                      Apply
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{blueprint.structure.files.length} files</span>
                    <span>•</span>
                    <span>
                      Created{' '}
                      {new Date(blueprint.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Capture Dialog */}
      <Dialog onOpenChange={setShowCaptureDialog} open={showCaptureDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Project as Template</DialogTitle>
            <DialogDescription>
              Capture the structure of an existing project as a reusable
              blueprint.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="capture-path">
                Project Path <span className="text-destructive">*</span>
              </Label>
              <Input
                id="capture-path"
                onChange={e => setCapturePath(e.target.value)}
                placeholder="/path/to/project"
                value={capturePath}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capture-name">
                Blueprint Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="capture-name"
                onChange={e => setCaptureName(e.target.value)}
                placeholder="My Project Template"
                value={captureName}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capture-description">Description</Label>
              <Textarea
                id="capture-description"
                onChange={e => setCaptureDescription(e.target.value)}
                placeholder="Optional description..."
                value={captureDescription}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capture-exclude">
                Additional Exclude Patterns
              </Label>
              <Input
                id="capture-exclude"
                onChange={e => setCaptureExcludePatterns(e.target.value)}
                placeholder="*.log, temp, cache"
                value={captureExcludePatterns}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated patterns (node_modules, .git, build are excluded
                by default)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setShowCaptureDialog(false)
                setCapturePath('')
                setCaptureName('')
                setCaptureDescription('')
                setCaptureExcludePatterns('')
              }}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={
                !capturePath || !captureName || createBlueprint.isPending
              }
              onClick={handleSaveAsTemplate}
            >
              {createBlueprint.isPending ? 'Saving...' : 'Save Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Dialog */}
      <Dialog onOpenChange={setShowApplyDialog} open={showApplyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Blueprint</DialogTitle>
            {selectedBlueprint && (
              <DialogDescription>
                Applying: {selectedBlueprint.name}
                {selectedBlueprint.description &&
                  ` - ${selectedBlueprint.description}`}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apply-target">
                Target Directory <span className="text-destructive">*</span>
              </Label>
              <Input
                id="apply-target"
                onChange={e => setApplyTargetPath(e.target.value)}
                placeholder="/path/to/new-project"
                value={applyTargetPath}
              />
              <p className="text-xs text-muted-foreground">
                The blueprint structure will be created in this directory
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setShowApplyDialog(false)
                setApplyTargetPath('')
                setSelectedBlueprint(null)
              }}
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={!applyTargetPath} onClick={handleApplyBlueprint}>
              Apply Blueprint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
